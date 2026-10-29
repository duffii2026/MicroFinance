"""Local API and file backend for the MM1 Micro Finance suite."""
from __future__ import annotations

import hashlib
import hmac
import json
import mimetypes
import os
import secrets
import time
import uuid
from email import policy
from email.parser import BytesParser
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

ROOT = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("MM1_DATA_DIR", str(ROOT / "data"))).resolve()
FILES_DIR = DATA_DIR / "files"
def load_env_file():
    env_path = ROOT / ".env"
    if not env_path.is_file():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env_file()
HOST = os.environ.get("MM1_HOST", "127.0.0.1")
PORT = int(os.environ.get("MM1_PORT", os.environ.get("MM1_APP_PORT", "8080")))
CORS_ORIGINS = {origin.strip() for origin in os.environ.get("MM1_CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if origin.strip()}
SESSION_SECONDS = 8 * 60 * 60
DB_CONFIG = {
    "host": os.environ.get("MM1_DB_HOST", "127.0.0.1"),
    "port": int(os.environ.get("MM1_DB_PORT", "3306")),
    "user": os.environ.get("MM1_DB_USER", "mm1_app"),
    "password": os.environ.get("MM1_DB_PASSWORD", ""),
    "database": os.environ.get("MM1_DB_NAME", "mm1_microfinance"),
    "charset": "utf8mb4",
    "autocommit": False,
}


class MySQLConnection:
    """Small adapter for the MySQL Connector/Python API used by this service."""

    def __init__(self, connection):
        self.connection = connection

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        if exc_type:
            self.connection.rollback()
        else:
            self.connection.commit()
        self.connection.close()

    def execute(self, sql, params=()):
        cursor = self.connection.cursor(dictionary=True)
        try:
            cursor.execute(sql, params)
            return cursor
        except Exception:
            cursor.close()
            raise

    def executescript(self, sql):
        cursor = self.connection.cursor()
        for statement in sql.split(";"):
            statement = statement.strip()
            if statement:
                cursor.execute(statement)
        cursor.close()


def connect():
    FILES_DIR.mkdir(parents=True, exist_ok=True)
    try:
        import mysql.connector
    except ImportError as exc:
        raise RuntimeError("MySQL Connector/Python is missing. Run setup.bat or install requirements.txt.") from exc
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
    except mysql.connector.Error as exc:
        raise RuntimeError(f"Could not connect to MySQL at {DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}: {exc}") from exc
    return MySQLConnection(connection)

MODULES = {
    "central": "MM1-01 Central Database",
    "cpa": "MM1-02 CPA Control System",
    "credentials": "MM1-03 Account Access Credentials",
    "gateways": "MM1-04 Payment Gateways",
    "communications": "MM1-05 Communication Channel",
    "companies": "MM1-06 Company Database",
}


def init_db() -> None:
    with connect() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS records (
          id VARCHAR(64) PRIMARY KEY,
          module VARCHAR(64) NOT NULL,
          collection VARCHAR(128) NOT NULL,
          payload JSON NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX records_module_collection (module, collection)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        CREATE TABLE IF NOT EXISTS files (
          id VARCHAR(64) PRIMARY KEY,
          module VARCHAR(64) NOT NULL,
          record_id VARCHAR(64),
          original_name VARCHAR(1024) NOT NULL,
          stored_name VARCHAR(255) NOT NULL UNIQUE,
          content_type TEXT NOT NULL,
          size BIGINT UNSIGNED NOT NULL,
          sha256 CHAR(64) NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX files_module_record (module, record_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        CREATE TABLE IF NOT EXISTS users (
          username VARCHAR(128) PRIMARY KEY,
          password_hash CHAR(64) NOT NULL,
          salt VARCHAR(64) NOT NULL,
          role VARCHAR(64) NOT NULL DEFAULT 'Admin',
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        CREATE TABLE IF NOT EXISTS audit_log (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(128) NOT NULL,
          action VARCHAR(128) NOT NULL,
          module VARCHAR(64),
          detail TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX audit_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        CREATE TABLE IF NOT EXISTS settings (
          `key` VARCHAR(128) PRIMARY KEY,
          value TEXT NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        CREATE TABLE IF NOT EXISTS api_keys (
          id VARCHAR(64) PRIMARY KEY,
          name VARCHAR(128) NOT NULL,
          key_prefix VARCHAR(32) NOT NULL,
          key_hash CHAR(64) NOT NULL UNIQUE,
          modules JSON NOT NULL,
          created_by VARCHAR(128) NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP NULL,
          last_used_at TIMESTAMP NULL,
          revoked_at TIMESTAMP NULL,
          INDEX api_keys_created_by (created_by),
          INDEX api_keys_revoked_at (revoked_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        """)
        # Local first-run owner setup: change the initial password at first sign-in.
        if not db.execute("SELECT 1 FROM users LIMIT 1").fetchone():
            salt = secrets.token_hex(16)
            digest = hashlib.pbkdf2_hmac("sha256", b"ChangeMe123!", salt.encode(), 240000).hex()
            db.execute("INSERT INTO users(username,password_hash,salt,role) VALUES(%s,%s,%s,'Admin')",
                       ("admin", digest, salt))
        db.execute("INSERT IGNORE INTO settings(`key`,value) VALUES('initialized','true')")


SESSIONS: dict[str, tuple[str, float]] = {}


class Handler(SimpleHTTPRequestHandler):
    server_version = "MM1Local/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        print("[%s] %s" % (self.log_date_time_string(), fmt % args))

    def cors_headers(self):
        origin = self.headers.get("Origin")
        if origin and origin in CORS_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")

    def send_json(self, status: int, data) -> None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def body_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length > 20 * 1024 * 1024:
            raise ValueError("Request body is too large")
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw.decode("utf-8"))

    def do_OPTIONS(self):
        if not self.path.startswith("/api/v1/"):
            return self.send_error(HTTPStatus.NOT_FOUND)
        origin = self.headers.get("Origin")
        if origin and origin not in CORS_ORIGINS:
            return self.send_error(HTTPStatus.FORBIDDEN)
        self.send_response(HTTPStatus.NO_CONTENT)
        self.cors_headers()
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept")
        self.send_header("Access-Control-Max-Age", "600")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def username(self):
        cookie = SimpleCookie(self.headers.get("Cookie", ""))
        morsel = cookie.get("mm1_session")
        if not morsel:
            return None
        session = SESSIONS.get(morsel.value)
        if not session or session[1] < time.time():
            SESSIONS.pop(morsel.value, None)
            return None
        return session[0]

    def principal(self):
        user = self.username()
        if user:
            with connect() as db:
                row = db.execute("SELECT role FROM users WHERE username=%s", (user,)).fetchone()
            if row:
                return {"username": user, "role": row["role"], "modules": None, "api_key": False}
        scheme, _, secret = self.headers.get("Authorization", "").partition(" ")
        if scheme.lower() != "bearer" or not secret.startswith("mfs_live_"):
            return None
        digest = hashlib.sha256(secret.encode()).hexdigest()
        with connect() as db:
            row = db.execute("SELECT id,created_by,modules FROM api_keys WHERE key_hash=%s AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>NOW())", (digest,)).fetchone()
            if row:
                db.execute("UPDATE api_keys SET last_used_at=NOW() WHERE id=%s", (row["id"],))
        if not row:
            return None
        return {"username": row["created_by"], "role": "API key", "modules": self.json_value(row["modules"]), "api_key": True, "key_id": row["id"]}

    @staticmethod
    def module_allowed(principal, module):
        return principal and (principal["modules"] is None or module in principal["modules"])

    def require_admin_session(self):
        user = self.username()
        if not user:
            return None
        with connect() as db:
            row = db.execute("SELECT username,role FROM users WHERE username=%s", (user,)).fetchone()
        return dict(row) if row and row["role"].lower() == "admin" else None

    def key_summary(self, row):
        return {"id": row["id"], "name": row["name"], "prefix": row["key_prefix"],
                "modules": self.json_value(row["modules"]), "createdBy": row["created_by"],
                "createdAt": self.time_value(row["created_at"]), "expiresAt": self.time_value(row["expires_at"]),
                "lastUsedAt": self.time_value(row["last_used_at"]), "revokedAt": self.time_value(row["revoked_at"])}

    def audit(self, username, action, module=None, detail=None):
        with connect() as db:
            db.execute("INSERT INTO audit_log(username,action,module,detail) VALUES(%s,%s,%s,%s)",
                       (username, action, module, detail))

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/v1/health":
            try:
                with connect() as db:
                    db.execute("SELECT 1").fetchone()
                return self.send_json(200, {"ok": True, "database": "mysql", "service": "MM1 Local API", "version": "1.0.0"})
            except Exception as exc:
                return self.send_json(503, {"ok": False, "database": "unavailable", "error": str(exc)})
        if parsed.path == "/api/v1/session":
            user = self.username()
            if user:
                with connect() as db:
                    row = db.execute("SELECT username,role FROM users WHERE username=%s", (user,)).fetchone()
                return self.send_json(200, {"authenticated": True, "user": dict(row) if row else None})
            return self.send_json(200, {"authenticated": False})
        if not parsed.path.startswith("/api/v1/"):
            return super().do_GET()
        principal = self.principal()
        if not principal:
            return self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "Sign in to use the local API."})
        parts = [unquote(p) for p in parsed.path.split("/") if p]
        if parts[:3] == ["api", "v1", "admin"] and parts[3:] == ["api-keys"]:
            if not self.require_admin_session():
                return self.send_json(HTTPStatus.FORBIDDEN, {"error": "Administrator browser sign-in required."})
            with connect() as db:
                rows = db.execute("SELECT * FROM api_keys ORDER BY created_at DESC").fetchall()
            return self.send_json(200, {"items": [self.key_summary(row) for row in rows]})
        if len(parts) == 4 and parts[:3] == ["api", "v1", "modules"]:
            module = parts[3]
            if module not in MODULES:
                return self.send_json(404, {"error": "Unknown module"})
            if not self.module_allowed(principal, module):
                return self.send_json(HTTPStatus.FORBIDDEN, {"error": "This API key is not authorized for that module."})
            return self.send_json(200, {"module": module, "name": MODULES[module]})
        if len(parts) >= 6 and parts[:3] == ["api", "v1", "modules"] and parts[4] == "collections":
            module, collection = parts[3], parts[5]
            if module not in MODULES:
                return self.send_json(404, {"error": "Unknown module"})
            if not self.module_allowed(principal, module):
                return self.send_json(HTTPStatus.FORBIDDEN, {"error": "This API key is not authorized for that module."})
            query = parse_qs(parsed.query)
            with connect() as db:
                if len(parts) == 7:
                    row = db.execute("SELECT * FROM records WHERE module=%s AND collection=%s AND id=%s",
                                     (module, collection, parts[6])).fetchone()
                    if not row:
                        return self.send_json(404, {"error": "Record not found"})
                    return self.send_json(200, {"id": row["id"], "data": self.json_value(row["payload"]),
                                                "createdAt": self.time_value(row["created_at"]), "updatedAt": self.time_value(row["updated_at"])})
                rows = db.execute("SELECT * FROM records WHERE module=%s AND collection=%s ORDER BY updated_at DESC",
                                  (module, collection)).fetchall()
                return self.send_json(200, {"items": [{"id": r["id"], "data": self.json_value(r["payload"]),
                                                       "createdAt": self.time_value(r["created_at"]), "updatedAt": self.time_value(r["updated_at"])} for r in rows]})
        if len(parts) == 3 and parts[:2] == ["api", "v1"] and parts[2] == "files":
            q = parse_qs(parsed.query)
            module = q.get("module", [None])[0]
            if module and not self.module_allowed(principal, module):
                return self.send_json(HTTPStatus.FORBIDDEN, {"error": "This API key is not authorized for that module."})
            record_id = q.get("recordId", [None])[0]
            with connect() as db:
                rows = db.execute("SELECT id,module,record_id,original_name,content_type,size,sha256,created_at FROM files WHERE (%s IS NULL OR module=%s) AND (%s IS NULL OR record_id=%s) ORDER BY created_at DESC",
                                  (module, module, record_id, record_id)).fetchall()
            rows = [row for row in rows if self.module_allowed(principal, row["module"])]
            return self.send_json(200, {"items": [{**dict(r), "created_at": self.time_value(r["created_at"])} for r in rows]})
        if len(parts) == 4 and parts[:3] == ["api", "v1", "files"]:
            with connect() as db:
                row = db.execute("SELECT * FROM files WHERE id=%s", (parts[3],)).fetchone()
            if not row:
                return self.send_json(404, {"error": "File not found"})
            if not self.module_allowed(principal, row["module"]):
                return self.send_json(HTTPStatus.FORBIDDEN, {"error": "This API key is not authorized for that module."})
            path = FILES_DIR / row["stored_name"]
            if not path.is_file():
                return self.send_json(404, {"error": "Stored file is missing"})
            self.send_response(200)
            self.send_header("Content-Type", row["content_type"])
            self.send_header("Content-Disposition", "attachment; filename*=UTF-8''" + __import__("urllib.parse").parse.quote(row["original_name"]))
            self.send_header("Content-Length", str(path.stat().st_size))
            self.cors_headers()
            self.end_headers()
            with path.open("rb") as f:
                self.wfile.write(f.read())
            return
        return self.send_json(404, {"error": "Route not found"})

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/v1/auth/login":
            try:
                body = self.body_json()
            except Exception:
                return self.send_json(400, {"error": "Invalid JSON"})
            username = str(body.get("username", "")).strip()
            password = str(body.get("password", ""))
            with connect() as db:
                row = db.execute("SELECT * FROM users WHERE username=%s", (username,)).fetchone()
            if not row:
                return self.send_json(401, {"error": "Incorrect username or password"})
            digest = hashlib.pbkdf2_hmac("sha256", password.encode(), row["salt"].encode(), 240000).hex()
            if not hmac.compare_digest(digest, row["password_hash"]):
                return self.send_json(401, {"error": "Incorrect username or password"})
            token = secrets.token_urlsafe(32)
            SESSIONS[token] = (username, time.time() + SESSION_SECONDS)
            result = {"authenticated": True, "user": {"username": username, "role": row["role"]}}
            raw = json.dumps(result, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(raw)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("Set-Cookie", f"mm1_session={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age={SESSION_SECONDS}")
            self.end_headers()
            self.wfile.write(raw)
            return
        if parsed.path == "/api/v1/admin/api-keys":
            admin = self.require_admin_session()
            if not admin:
                return self.send_json(HTTPStatus.FORBIDDEN, {"error": "Administrator browser sign-in required."})
            try:
                body = self.body_json()
                name = str(body.get("name", "")).strip()
                modules = body.get("modules", [])
                days = body.get("expiresInDays")
                if not name or len(name) > 128 or not isinstance(modules, list) or not modules or any(m not in MODULES for m in modules):
                    raise ValueError("Enter a name and select one or more valid modules.")
                if days is not None and (not isinstance(days, int) or days < 1 or days > 3650):
                    raise ValueError("Expiration must be from 1 to 3,650 days, or never.")
            except Exception as exc:
                return self.send_json(400, {"error": str(exc) or "Invalid request"})
            key_id = str(uuid.uuid4())
            secret = "mfs_live_" + secrets.token_urlsafe(32)
            digest = hashlib.sha256(secret.encode()).hexdigest()
            with connect() as db:
                db.execute("INSERT INTO api_keys(id,name,key_prefix,key_hash,modules,created_by,expires_at) VALUES(%s,%s,%s,%s,CAST(%s AS JSON),%s,IF(%s IS NULL,NULL,DATE_ADD(NOW(),INTERVAL %s DAY)))",
                           (key_id, name, secret[:20], digest, json.dumps(modules), admin["username"], days, days))
            self.audit(admin["username"], "api_key.created", None, f"{name}/{key_id}")
            return self.send_json(201, {"item": {"id": key_id, "name": name, "prefix": secret[:20], "modules": modules, "createdBy": admin["username"]}, "apiKey": secret})
        principal = self.principal()
        if not principal:
            return self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "Sign in to use the local API."})
        user = principal["username"]
        if parsed.path == "/api/v1/auth/logout":
            if not self.username():
                return self.send_json(HTTPStatus.FORBIDDEN, {"error": "Browser session required."})
            cookie = SimpleCookie(self.headers.get("Cookie", ""))
            morsel = cookie.get("mm1_session")
            if morsel:
                SESSIONS.pop(morsel.value, None)
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Set-Cookie", "mm1_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0")
            self.end_headers()
            self.wfile.write(b'{"ok":true}')
            return
        parts = [unquote(p) for p in parsed.path.split("/") if p]
        if len(parts) == 6 and parts[:3] == ["api", "v1", "modules"] and parts[4] == "collections":
            module, collection = parts[3], parts[5]
            if module not in MODULES:
                return self.send_json(404, {"error": "Unknown module"})
            if not self.module_allowed(principal, module):
                return self.send_json(HTTPStatus.FORBIDDEN, {"error": "This API key is not authorized for that module."})
            try:
                data = self.body_json()
            except Exception as e:
                return self.send_json(400, {"error": str(e)})
            record_id = str(data.pop("id", "") or uuid.uuid4())
            with connect() as db:
                db.execute("INSERT INTO records(id,module,collection,payload) VALUES(%s,%s,%s,CAST(%s AS JSON))",
                           (record_id, module, collection, json.dumps(data, ensure_ascii=False)))
            self.audit(user, "record.created", module, f"{collection}/{record_id}")
            return self.send_json(201, {"id": record_id, "data": data})
        if len(parts) == 7 and parts[:3] == ["api", "v1", "modules"] and parts[4] == "collections":
            module, collection, record_id = parts[3], parts[5], parts[6]
            if module not in MODULES:
                return self.send_json(404, {"error": "Unknown module"})
            if not self.module_allowed(principal, module):
                return self.send_json(HTTPStatus.FORBIDDEN, {"error": "This API key is not authorized for that module."})
            try:
                data = self.body_json()
            except Exception as e:
                return self.send_json(400, {"error": str(e)})
            with connect() as db:
                exists = db.execute("SELECT 1 FROM records WHERE id=%s AND module=%s AND collection=%s",
                                    (record_id, module, collection)).fetchone()
                if not exists:
                    return self.send_json(404, {"error": "Record not found"})
                db.execute("UPDATE records SET payload=CAST(%s AS JSON) WHERE id=%s",
                           (json.dumps(data, ensure_ascii=False), record_id))
            self.audit(user, "record.updated", module, f"{collection}/{record_id}")
            return self.send_json(200, {"id": record_id, "data": data})
        if parsed.path == "/api/v1/files":
            return self.handle_file_upload(principal)
        if parsed.path == "/api/v1/auth/password":
            if not self.username():
                return self.send_json(HTTPStatus.FORBIDDEN, {"error": "Browser session required."})
            try:
                body = self.body_json()
            except Exception:
                return self.send_json(400, {"error": "Invalid JSON"})
            current, new = str(body.get("currentPassword", "")), str(body.get("newPassword", ""))
            if not new:
                return self.send_json(400, {"error": "New password cannot be empty."})
            with connect() as db:
                row = db.execute("SELECT * FROM users WHERE username=%s", (user,)).fetchone()
                digest = hashlib.pbkdf2_hmac("sha256", current.encode(), row["salt"].encode(), 240000).hex()
                if not hmac.compare_digest(digest, row["password_hash"]):
                    return self.send_json(401, {"error": "Current password is incorrect"})
                salt = secrets.token_hex(16)
                new_hash = hashlib.pbkdf2_hmac("sha256", new.encode(), salt.encode(), 240000).hex()
                db.execute("UPDATE users SET salt=%s,password_hash=%s WHERE username=%s", (salt, new_hash, user))
            return self.send_json(200, {"ok": True})
        return self.send_json(404, {"error": "Route not found"})

    def do_PATCH(self):
        parts = [unquote(p) for p in urlparse(self.path).path.split("/") if p]
        if len(parts) != 5 or parts[:4] != ["api", "v1", "admin", "api-keys"]:
            return self.send_json(404, {"error": "Route not found"})
        admin = self.require_admin_session()
        if not admin:
            return self.send_json(HTTPStatus.FORBIDDEN, {"error": "Administrator browser sign-in required."})
        try:
            body = self.body_json()
            name = str(body.get("name", "")).strip()
            modules = body.get("modules")
            if not name or len(name) > 128 or not isinstance(modules, list) or not modules or any(m not in MODULES for m in modules):
                raise ValueError("Enter a name and select one or more valid modules.")
            days = body.get("expiresInDays", "unchanged")
            if days != "unchanged" and days is not None and (not isinstance(days, int) or days < 1 or days > 3650):
                raise ValueError("Expiration must be from 1 to 3,650 days, or never.")
        except Exception as exc:
            return self.send_json(400, {"error": str(exc) or "Invalid request"})
        with connect() as db:
            if days == "unchanged":
                cur = db.execute("UPDATE api_keys SET name=%s,modules=CAST(%s AS JSON) WHERE id=%s AND revoked_at IS NULL", (name, json.dumps(modules), parts[4]))
            else:
                cur = db.execute("UPDATE api_keys SET name=%s,modules=CAST(%s AS JSON),expires_at=IF(%s IS NULL,NULL,DATE_ADD(NOW(),INTERVAL %s DAY)) WHERE id=%s AND revoked_at IS NULL", (name, json.dumps(modules), days, days, parts[4]))
        if not cur.rowcount:
            return self.send_json(404, {"error": "Active API key not found."})
        self.audit(admin["username"], "api_key.updated", None, f"{name}/{parts[4]}")
        return self.send_json(200, {"ok": True})

    def do_DELETE(self):
        parts = [unquote(p) for p in urlparse(self.path).path.split("/") if p]
        if len(parts) == 5 and parts[:4] == ["api", "v1", "admin", "api-keys"]:
            admin = self.require_admin_session()
            if not admin:
                return self.send_json(HTTPStatus.FORBIDDEN, {"error": "Administrator browser sign-in required."})
            with connect() as db:
                cur = db.execute("UPDATE api_keys SET revoked_at=NOW() WHERE id=%s AND revoked_at IS NULL", (parts[4],))
            if not cur.rowcount:
                return self.send_json(404, {"error": "Active API key not found."})
            self.audit(admin["username"], "api_key.revoked", None, parts[4])
            return self.send_json(200, {"ok": True})
        principal = self.principal()
        if not principal:
            return self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "Sign in to use the local API."})
        user = principal["username"]
        if len(parts) == 7 and parts[:3] == ["api", "v1", "modules"] and parts[4] == "collections":
            module, collection, record_id = parts[3], parts[5], parts[6]
            if module not in MODULES:
                return self.send_json(404, {"error": "Unknown module"})
            if not self.module_allowed(principal, module):
                return self.send_json(HTTPStatus.FORBIDDEN, {"error": "This API key is not authorized for that module."})
            with connect() as db:
                cur = db.execute("DELETE FROM records WHERE id=%s AND module=%s AND collection=%s",
                                 (record_id, module, collection))
            if not cur.rowcount:
                return self.send_json(404, {"error": "Record not found"})
            self.audit(user, "record.deleted", module, f"{collection}/{record_id}")
            return self.send_json(200, {"ok": True})
        return self.send_json(404, {"error": "Route not found"})

    def handle_file_upload(self, principal):
        content_type = self.headers.get("Content-Type", "")
        boundary = None
        for parameter in content_type.split(";")[1:]:
            name, separator, value = parameter.strip().partition("=")
            if separator and name.lower() == "boundary":
                boundary = value.strip().strip(chr(34)).encode("latin1")
                break
        if not boundary:
            return self.send_json(400, {"error": "Use multipart/form-data"})
        length = int(self.headers.get("Content-Length", "0"))
        if length > 25 * 1024 * 1024:
            return self.send_json(413, {"error": "Maximum upload size is 25 MB"})
        raw = self.rfile.read(length)
        fields, upload = {}, None
        envelope = (f"Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n").encode("latin1") + raw
        message = BytesParser(policy=policy.default).parsebytes(envelope)
        for part in message.iter_parts():
            name = part.get_param("name", header="content-disposition")
            filename = part.get_filename()
            data = part.get_payload(decode=True) or b""
            if filename:
                upload = (filename, part.get("Content-Type", "application/octet-stream"), data)
            elif name:
                fields[name] = data.decode("utf-8", "replace")
        if not upload or not upload[0]:
            return self.send_json(400, {"error": "Choose a file to upload"})
        original = Path(upload[0].replace("\\", "/")).name
        file_id, stored = str(uuid.uuid4()), str(uuid.uuid4()) + Path(original).suffix[:16]
        FILES_DIR.mkdir(exist_ok=True)
        path = FILES_DIR / stored
        path.write_bytes(upload[2])
        sha = hashlib.sha256(upload[2]).hexdigest()
        mime = upload[1] or mimetypes.guess_type(original)[0] or "application/octet-stream"
        module, record_id = fields.get("module", "central"), fields.get("recordId") or None
        if module not in MODULES:
            path.unlink(missing_ok=True)
            return self.send_json(400, {"error": "Unknown module"})
        if not self.module_allowed(principal, module):
            path.unlink(missing_ok=True)
            return self.send_json(HTTPStatus.FORBIDDEN, {"error": "This API key is not authorized for that module."})
        with connect() as db:
            db.execute("INSERT INTO files(id,module,record_id,original_name,stored_name,content_type,size,sha256) VALUES(%s,%s,%s,%s,%s,%s,%s,%s)",
                       (file_id, module, record_id, original, stored, mime, len(upload[2]), sha))
        self.audit(principal["username"], "file.uploaded", module, original)
        return self.send_json(201, {"id": file_id, "module": module, "recordId": record_id,
                                    "name": original, "contentType": mime, "size": len(upload[2]), "sha256": sha})

    @staticmethod
    def json_value(value):
        return json.loads(value) if isinstance(value, (str, bytes, bytearray)) else value

    @staticmethod
    def time_value(value):
        return value.isoformat(sep=" ") if hasattr(value, "isoformat") else value

    def send_json(self, status: int, data) -> None:
        # Login needs its session token in an HttpOnly cookie. The response body never includes it.
        if self.path.split("%s", 1)[0] == "/api/v1/auth/login" and status == 200:
            username = data["user"]["username"]
            token = next((k for k, v in SESSIONS.items() if v[0] == username and v[1] > time.time()), None)
            body = json.dumps(data, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("Set-Cookie", f"mm1_session={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age={SESSION_SECONDS}")
            self.end_headers()
            self.wfile.write(body)
            return
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.cors_headers()
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    try:
        init_db()
    except Exception as exc:
        raise SystemExit(f"MM1 startup failed: {exc}\nCheck MySQL settings in .env and confirm MySQL is running.")
    print(f"MM1 local system is ready at http://{HOST}:{PORT}")
    print("First sign-in: admin / ChangeMe123! — change this password immediately.")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
