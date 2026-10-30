"""Local API and file backend for the MM1 Micro Finance suite."""
from __future__ import annotations

import hashlib
import hmac
import json
import mimetypes
import os
import secrets
import threading
import time
import uuid
from contextlib import contextmanager
from email import policy
from email.parser import BytesParser
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

ROOT = Path(__file__).resolve().parent
WEB_ROOT = ROOT / "dist" if (ROOT / "dist" / "index.html").is_file() else ROOT
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
COOKIE_SECURE = os.environ.get("MM1_COOKIE_SECURE", "0").strip().lower() in {"1", "true", "yes"}
INITIAL_ADMIN_PASSWORD = os.environ.get("MM1_ADMIN_PASSWORD", "").strip()
MODULE_ADMIN_PASSWORD = os.environ.get("MM1_MODULE_ADMIN_PASSWORD", "").strip()
DB_CONFIG = {
    "host": os.environ.get("MM1_DB_HOST", "127.0.0.1"),
    "port": int(os.environ.get("MM1_DB_PORT", "3306")),
    "user": os.environ.get("MM1_DB_USER", "mm1_app"),
    "password": os.environ.get("MM1_DB_PASSWORD", ""),
    "database": os.environ.get("MM1_DB_NAME", "mm1_microfinance"),
    "charset": "utf8mb4",
    "autocommit": False,
}
_DB_CONTEXT = threading.local()


@contextmanager
def database_scope(module=None):
    previous = getattr(_DB_CONTEXT, "module", None)
    _DB_CONTEXT.module = module
    try:
        yield
    finally:
        _DB_CONTEXT.module = previous


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


def connect(module=None):
    FILES_DIR.mkdir(parents=True, exist_ok=True)
    try:
        import mysql.connector
    except ImportError as exc:
        raise RuntimeError("MySQL Connector/Python is missing. Run setup.bat or install requirements.txt.") from exc
    module = module or getattr(_DB_CONTEXT, "module", None)
    config = dict(DB_CONFIG)
    if module:
        if module not in MODULES:
            raise ValueError("Unknown module database")
        config["database"] = DB_CONFIG["database"] + "_" + module
    try:
        connection = mysql.connector.connect(**config)
    except mysql.connector.Error as exc:
        raise RuntimeError(f"Could not connect to MySQL at {config['host']}:{config['port']}/{config['database']}: {exc}") from exc
    return MySQLConnection(connection)


def connect_global():
    with database_scope(None):
        return connect()

MODULES = {
    "central": "MM1-01 Central Database",
    "cpa": "MM1-02 CPA Control System",
    "credentials": "MM1-03 Account Access Credentials",
    "gateways": "MM1-04 Payment Gateways",
    "communications": "MM1-05 Communication Channel",
    "companies": "MM1-06 Company Database",
    "mm2_pss_expenses": "MM2-01 PSS Request & Expense Tracking",
    "mm2_inventory": "MM2-04 Inventory Control",
    "mm2_account_service": "MM2-05 Account In Service Database",
    "mm2_cp_account_service": "MM2-06 CP Account In Service Database",
    "mm2_company_expenses": "MM2-07 Company & Legal Expenses",
    "mm2_account_statements": "MM2-08 Account Balance & Statements",
    "mm2_cpa_expenses": "MM2-09 CPA Salary & Commission",
    "mm2_gate_visa": "MM2-12 Gate & Visa Deposits",
    "mm2_fund_recovery": "MM2-13 Fund Recovery Timeline",
    "mm4_pss_requests": "MM4-01 PSS Request & Approval",
    "mm4_fund_transfers": "MM4-03 Fund Transfers & Settlement",
    "mm4_manual_cpa": "MM4-03a Manual CPA",
    "mm4_auto_payment": "MM4-03b Auto Payment",
}
MODULE_AUTH_MODULES = tuple(MODULES)
MM2_MODULES = tuple(module for module in MODULES if module.startswith("mm2_"))


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
        CREATE TABLE IF NOT EXISTS module_users (
          module VARCHAR(64) NOT NULL,
          username VARCHAR(128) NOT NULL,
          password_hash CHAR(64) NOT NULL,
          salt VARCHAR(64) NOT NULL,
          role VARCHAR(64) NOT NULL DEFAULT 'Admin',
          active TINYINT(1) NOT NULL DEFAULT 1,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY(module, username),
          INDEX module_users_active (module, active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        CREATE TABLE IF NOT EXISTS module_sessions (
          token_hash CHAR(64) PRIMARY KEY,
          module VARCHAR(64) NOT NULL,
          username VARCHAR(128) NOT NULL,
          expires_at DATETIME NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX module_sessions_expiry (expires_at),
          INDEX module_sessions_user (module, username)
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
            if not INITIAL_ADMIN_PASSWORD:
                raise RuntimeError("Set MM1_ADMIN_PASSWORD before the first database initialization.")
            salt = secrets.token_hex(16)
            digest = hashlib.pbkdf2_hmac("sha256", INITIAL_ADMIN_PASSWORD.encode("utf-8"), salt.encode(), 240000).hex()
            db.execute("INSERT INTO users(username,password_hash,salt,role) VALUES(%s,%s,%s,'Admin')",
                       ("admin", digest, salt))
        for module in MODULE_AUTH_MODULES:
            if not db.execute("SELECT 1 FROM module_users WHERE module=%s LIMIT 1", (module,)).fetchone():
                if not MODULE_ADMIN_PASSWORD:
                    raise RuntimeError("Set MM1_MODULE_ADMIN_PASSWORD before the first module database initialization.")
                salt = secrets.token_hex(16)
                digest = hashlib.pbkdf2_hmac("sha256", MODULE_ADMIN_PASSWORD.encode("utf-8"), salt.encode(), 240000).hex()
                db.execute("INSERT INTO module_users(module,username,password_hash,salt,role,active) VALUES(%s,'admin',%s,%s,'Admin',1)",
                           (module, digest, salt))
        db.execute("INSERT IGNORE INTO settings(`key`,value) VALUES('initialized','true')")
    ensure_module_databases()
    for module in MODULE_AUTH_MODULES:
        initialize_module_database(module)


def ensure_module_databases():
    missing = []
    for module in MODULE_AUTH_MODULES:
        try:
            with connect(module) as db:
                db.execute("SELECT 1").fetchone()
        except RuntimeError:
            missing.append(module)
    if not missing:
        return
    root_password = os.environ.get("MM1_MYSQL_ROOT_PASSWORD", "")
    if not root_password:
        raise RuntimeError("Per-module MySQL databases are missing. Set MM1_MYSQL_ROOT_PASSWORD once to provision them, or create and grant the module databases manually.")
    try:
        import mysql.connector
        config = {key: DB_CONFIG[key] for key in ("host", "port")}
        config.update(user="root", password=root_password, charset="utf8mb4", autocommit=True)
        root = mysql.connector.connect(**config)
        cursor = root.cursor()
        cursor.execute("SELECT host FROM mysql.user WHERE user=%s", (DB_CONFIG["user"],))
        app_hosts = [row[0] for row in cursor.fetchall()]
        if not app_hosts:
            raise RuntimeError("The configured MySQL application account does not exist.")
        for module in missing:
            database = DB_CONFIG["database"] + "_" + module
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci")
            for host in app_hosts:
                account_user = DB_CONFIG["user"].replace("\\", "\\\\").replace("'", "\\'")
                account_host = host.replace("\\", "\\\\").replace("'", "\\'")
                cursor.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, ALTER ON `{database}`.* TO '{account_user}'@'{account_host}'")
        cursor.close()
        root.close()
    except Exception as exc:
        raise RuntimeError(f"Could not provision isolated MySQL module databases: {exc}") from exc


def initialize_module_database(module):
    with connect(module) as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS records (
          id VARCHAR(64) PRIMARY KEY, module VARCHAR(64) NOT NULL,
          collection VARCHAR(128) NOT NULL, payload JSON NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX records_module_collection (module, collection)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        CREATE TABLE IF NOT EXISTS files (
          id VARCHAR(64) PRIMARY KEY, module VARCHAR(64) NOT NULL,
          record_id VARCHAR(64), original_name VARCHAR(1024) NOT NULL,
          stored_name VARCHAR(255) NOT NULL UNIQUE, content_type TEXT NOT NULL,
          size BIGINT UNSIGNED NOT NULL, sha256 CHAR(64) NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX files_module_record (module, record_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        CREATE TABLE IF NOT EXISTS module_users (
          module VARCHAR(64) NOT NULL, username VARCHAR(128) NOT NULL,
          password_hash CHAR(64) NOT NULL, salt VARCHAR(64) NOT NULL,
          role VARCHAR(64) NOT NULL DEFAULT 'Admin', active TINYINT(1) NOT NULL DEFAULT 1,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY(module, username), INDEX module_users_active (module, active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        CREATE TABLE IF NOT EXISTS module_sessions (
          token_hash CHAR(64) PRIMARY KEY, module VARCHAR(64) NOT NULL,
          username VARCHAR(128) NOT NULL, expires_at DATETIME NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX module_sessions_expiry (expires_at), INDEX module_sessions_user (module, username)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        CREATE TABLE IF NOT EXISTS audit_log (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(128) NOT NULL, action VARCHAR(128) NOT NULL,
          module VARCHAR(64), detail TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX audit_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        """)

    # Copy the existing partition into its dedicated database once. Keep the
    # original rows as a rollback copy; runtime requests use the module DB.
    with connect() as legacy:
        users = legacy.execute("SELECT * FROM module_users WHERE module=%s", (module,)).fetchall()
        records = legacy.execute("SELECT * FROM records WHERE module=%s", (module,)).fetchall()
        files = legacy.execute("SELECT * FROM files WHERE module=%s", (module,)).fetchall()
        audits = legacy.execute("SELECT * FROM audit_log WHERE module=%s", (module,)).fetchall()
    with connect(module) as db:
        for row in users:
            db.execute("INSERT IGNORE INTO module_users(module,username,password_hash,salt,role,active,created_at) VALUES(%s,%s,%s,%s,%s,%s,%s)",
                       (row["module"], row["username"], row["password_hash"], row["salt"], row["role"], row["active"], row["created_at"]))
        for row in records:
            payload = row["payload"]
            if isinstance(payload, (str, bytes, bytearray)):
                payload = json.loads(payload)
            db.execute("INSERT IGNORE INTO records(id,module,collection,payload,created_at,updated_at) VALUES(%s,%s,%s,CAST(%s AS JSON),%s,%s)",
                       (row["id"], row["module"], row["collection"], json.dumps(payload, ensure_ascii=False), row["created_at"], row["updated_at"]))
        for row in files:
            db.execute("INSERT IGNORE INTO files(id,module,record_id,original_name,stored_name,content_type,size,sha256,created_at) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                       (row["id"], row["module"], row["record_id"], row["original_name"], row["stored_name"], row["content_type"], row["size"], row["sha256"], row["created_at"]))
        for row in audits:
            db.execute("INSERT IGNORE INTO audit_log(id,username,action,module,detail,created_at) VALUES(%s,%s,%s,%s,%s,%s)",
                       (row["id"], row["username"], row["action"], row["module"], row["detail"], row["created_at"]))
        if not db.execute("SELECT 1 FROM module_users WHERE module=%s LIMIT 1", (module,)).fetchone():
            if not MODULE_ADMIN_PASSWORD:
                raise RuntimeError("Set MM1_MODULE_ADMIN_PASSWORD before the first module database initialization.")
            salt = secrets.token_hex(16)
            digest = hashlib.pbkdf2_hmac("sha256", MODULE_ADMIN_PASSWORD.encode("utf-8"), salt.encode(), 240000).hex()
            db.execute("INSERT INTO module_users(module,username,password_hash,salt,role,active) VALUES(%s,'admin',%s,%s,'Admin',1)",
                       (module, digest, salt))


SESSIONS: dict[str, tuple[str, float]] = {}
MODULE_SESSIONS: dict[str, tuple[str, str, str, float]] = {}


class Handler(SimpleHTTPRequestHandler):
    server_version = "MM1Local/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_ROOT), **kwargs)

    def log_message(self, fmt, *args):
        print("[%s] %s" % (self.log_date_time_string(), fmt % args))

    def end_headers(self):
        # Baseline browser protections for both API and static responses.
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        self.send_header("Referrer-Policy", "same-origin")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        super().end_headers()

    def secure_cookie_suffix(self):
        forwarded = self.headers.get("X-Forwarded-Proto", "").split(",", 1)[0].strip().lower()
        return "; Secure" if COOKIE_SECURE or forwarded == "https" else ""

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

    @staticmethod
    def module_cookie_name(module):
        return "mfs_mod_" + module

    def module_session(self, module):
        cookie = SimpleCookie(self.headers.get("Cookie", ""))
        morsel = cookie.get(self.module_cookie_name(module))
        if not morsel:
            return None
        token_hash = hashlib.sha256(morsel.value.encode()).hexdigest()
        with connect(module) as db:
            session = db.execute("SELECT username,expires_at FROM module_sessions WHERE token_hash=%s AND module=%s AND expires_at>NOW()", (token_hash, module)).fetchone()
            if not session:
                db.execute("DELETE FROM module_sessions WHERE token_hash=%s OR expires_at<=NOW()", (token_hash,))
                MODULE_SESSIONS.pop(morsel.value, None)
                return None
            user = db.execute("SELECT role,active FROM module_users WHERE module=%s AND username=%s", (module, session["username"])).fetchone()
        if not user or not user["active"]:
            with connect(module) as db:
                db.execute("DELETE FROM module_sessions WHERE token_hash=%s", (token_hash,))
            MODULE_SESSIONS.pop(morsel.value, None)
            return None
        username = session["username"]
        MODULE_SESSIONS[morsel.value] = (module, username, user["role"], time.time() + SESSION_SECONDS)
        return {"module": module, "username": username, "role": user["role"], "modules": [module], "api_key": False, "module_session": True}

    def principal(self, module=None):
        if module:
            module_principal = self.module_session(module)
            if module_principal:
                return module_principal
        # A workspace administrator session is not a module login. Each module
        # must present its own module cookie (or a scoped bearer API key).
        user = None if module else self.username()
        if user:
            with connect_global() as db:
                row = db.execute("SELECT role FROM users WHERE username=%s", (user,)).fetchone()
            if row:
                return {"username": user, "role": row["role"], "modules": None, "api_key": False}
        scheme, _, secret = self.headers.get("Authorization", "").partition(" ")
        if scheme.lower() != "bearer" or not secret.startswith("mfs_live_"):
            return None
        digest = hashlib.sha256(secret.encode()).hexdigest()
        with connect_global() as db:
            row = db.execute("SELECT id,created_by,modules FROM api_keys WHERE key_hash=%s AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>NOW())", (digest,)).fetchone()
            if row:
                db.execute("UPDATE api_keys SET last_used_at=NOW() WHERE id=%s", (row["id"],))
        if not row:
            return None
        return {"username": row["created_by"], "role": "API key", "modules": self.json_value(row["modules"]), "api_key": True, "key_id": row["id"]}

    @staticmethod
    def module_allowed(principal, module):
        if not principal:
            return False
        if principal.get("module_session"):
            return module in principal.get("modules", [])
        return principal["modules"] is None or module in principal["modules"]

    def require_admin_session(self):
        user = self.username()
        if not user:
            return None
        with connect_global() as db:
            row = db.execute("SELECT username,role FROM users WHERE username=%s", (user,)).fetchone()
        return dict(row) if row and row["role"].lower() == "admin" else None

    def key_summary(self, row):
        return {"id": row["id"], "name": row["name"], "prefix": row["key_prefix"],
                "modules": self.json_value(row["modules"]), "createdBy": row["created_by"],
                "createdAt": self.time_value(row["created_at"]), "expiresAt": self.time_value(row["expires_at"]),
                "lastUsedAt": self.time_value(row["last_used_at"]), "revokedAt": self.time_value(row["revoked_at"])}

    def audit(self, username, action, module=None, detail=None):
        with connect(module) as db:
            db.execute("INSERT INTO audit_log(username,action,module,detail) VALUES(%s,%s,%s,%s)",
                       (username, action, module, detail))

    def request_module(self):
        parsed = urlparse(self.path)
        parts = [unquote(p) for p in parsed.path.split("/") if p]
        if len(parts) >= 4 and parts[:3] == ["api", "v1", "modules"] and parts[3] in MODULES:
            return parts[3]
        if parsed.path.startswith("/api/v1/files"):
            module = parse_qs(parsed.query).get("module", [None])[0]
            return module if module in MODULES else None
        return None

    def do_GET(self):
        with database_scope(self.request_module()):
            return self._do_GET()

    def _do_GET(self):
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
        parts = [unquote(p) for p in parsed.path.split("/") if p]
        if len(parts) == 6 and parts[:3] == ["api", "v1", "modules"] and parts[4:] == ["auth", "session"]:
            module = parts[3]
            if module not in MODULE_AUTH_MODULES:
                return self.send_json(404, {"error": "Unknown module"})
            session = self.module_session(module)
            if not session:
                return self.send_json(200, {"authenticated": False})
            return self.send_json(200, {"authenticated": True, "user": {"username": session["username"], "role": session["role"]}})
        if len(parts) == 6 and parts[:3] == ["api", "v1", "modules"] and parts[4:] == ["auth", "users"]:
            module = parts[3]
            session = self.module_session(module) if module in MODULE_AUTH_MODULES else None
            if not session or session["role"].lower() != "admin":
                return self.send_json(403, {"error": "Sign in as this module's administrator to manage its users."})
            with connect() as db:
                rows = db.execute("SELECT username,role,active,created_at FROM module_users WHERE module=%s ORDER BY username", (module,)).fetchall()
            return self.send_json(200, {"items": [{"username": row["username"], "role": row["role"], "active": bool(row["active"]), "createdAt": self.time_value(row["created_at"])} for row in rows]})
        if parsed.path == "/api/v1/dashboard/module-data":
            admin_dashboard = bool(self.require_admin_session())
            accessible = []
            for module, name in MODULES.items():
                session = self.module_session(module)
                if not session and not admin_dashboard:
                    continue
                with connect(module) as db:
                    rows = db.execute("SELECT collection,payload,updated_at FROM records WHERE module=%s ORDER BY updated_at DESC", (module,)).fetchall()
                data_count = 0
                latest = None
                for row in rows:
                    latest = latest or self.time_value(row["updated_at"])
                    payload = self.json_value(row["payload"])
                    if row["collection"] == "browser-state":
                        state = payload.get("value") if isinstance(payload, dict) else None
                        if isinstance(state, str):
                            try:
                                state = json.loads(state)
                            except (TypeError, ValueError):
                                state = None
                        if isinstance(state, dict):
                            buckets = {
                                "central": ("mac", "mca", "pc", "skap", "skac", "people", "companies", "gateways", "channels"),
                                "cpa": ("accounts", "agents", "persons", "companies"),
                                "credentials": ("accounts", "access"),
                                "gateways": ("gateways", "merchants"),
                                "communications": ("channels",),
                                "companies": ("companies",),
                                "mm4_pss_requests": ("requests", "items"),
                                "mm4_manual_cpa": ("batches", "items", "payments"),
                                "mm4_auto_payment": ("transfers", "payments", "accounts"),
                            }.get(module, ())
                            for bucket in buckets:
                                collection = state.get(bucket)
                                if isinstance(collection, (dict, list)):
                                    data_count += len(collection)
                    elif row["collection"] == "legacy-source" and isinstance(payload, dict):
                        seed = payload.get("seed") or {}
                        # Count the original business records held by the
                        # import snapshot, rather than treating it as one row.
                        buckets = {
                            "mm2_pss_expenses": (),
                            "mm2_inventory": ("items", "transfers", "photoReqs"),
                            "mm2_account_service": ("accounts", "lines", "risk"),
                            "mm2_cp_account_service": ("accounts", "lines", "risk"),
                            "mm2_company_expenses": ("expenses",),
                            "mm2_account_statements": ("accounts", "stmts", "reasons", "shots"),
                            "mm2_cpa_expenses": ("persons",),
                            "mm2_fund_recovery": ("accounts",),
                        }.get(module, ())
                        if module == "mm2_pss_expenses" and not buckets:
                            data_count += len(seed)
                        for bucket in buckets:
                            collection = seed.get(bucket)
                            if isinstance(collection, (dict, list)):
                                data_count += len(collection)
                    elif row["collection"] == "import-meta":
                        continue
                    elif row["collection"] == "records" and module in {"mm2_pss_expenses", "mm2_inventory", "mm2_account_service", "mm2_cp_account_service", "mm2_company_expenses", "mm2_account_statements", "mm2_cpa_expenses", "mm2_fund_recovery"}:
                        # These rows are a table-friendly projection of the
                        # source snapshot and must not inflate its total.
                        continue
                    else:
                        data_count += 1
                accessible.append({"module": module, "name": name, "username": session["username"] if session else "admin", "records": data_count, "updatedAt": latest})
            return self.send_json(200, {"items": accessible, "totalModules": len(accessible), "totalRecords": sum(item["records"] for item in accessible)})
        module_hint = parts[3] if len(parts) >= 4 and parts[:3] == ["api", "v1", "modules"] else None
        if parsed.path.startswith("/api/v1/files"):
            module_hint = parse_qs(parsed.query).get("module", [None])[0]
            if module_hint is not None and module_hint not in MODULES:
                return self.send_json(400, {"error": "Provide a valid module query parameter."})
        principal = self.principal(module_hint)
        if not principal:
            return self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "Sign in to use the local API."})
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
            modules = [module] if module else [candidate for candidate in MODULES if self.module_allowed(principal, candidate)]
            rows = []
            for candidate in modules:
                with connect(candidate) as db:
                    rows.extend(db.execute("SELECT id,module,record_id,original_name,content_type,size,sha256,created_at FROM files WHERE module=%s AND (%s IS NULL OR record_id=%s) ORDER BY created_at DESC",
                                           (candidate, record_id, record_id)).fetchall())
            rows.sort(key=lambda row: row["created_at"], reverse=True)
            return self.send_json(200, {"items": [{**dict(r), "created_at": self.time_value(r["created_at"])} for r in rows]})
        if len(parts) == 4 and parts[:3] == ["api", "v1", "files"]:
            module = parse_qs(parsed.query).get("module", [None])[0]
            if module not in MODULES:
                return self.send_json(400, {"error": "Provide a valid module query parameter."})
            with connect() as db:
                row = db.execute("SELECT * FROM files WHERE id=%s AND module=%s", (parts[3], module)).fetchone()
            if not row:
                return self.send_json(404, {"error": "File not found"})
            if not self.module_allowed(principal, row["module"]):
                return self.send_json(HTTPStatus.FORBIDDEN, {"error": "This API key is not authorized for that module."})
            path = FILES_DIR / row["module"] / row["stored_name"]
            if not path.is_file():
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
        with database_scope(self.request_module()):
            return self._do_POST()

    def _do_POST(self):
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
            self.send_header("Set-Cookie", f"mm1_session={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age={SESSION_SECONDS}{self.secure_cookie_suffix()}")
            self.end_headers()
            self.wfile.write(raw)
            return
        parts = [unquote(p) for p in parsed.path.split("/") if p]
        module_auth = len(parts) >= 6 and parts[:3] == ["api", "v1", "modules"] and parts[4] == "auth"
        if module_auth:
            module, action = parts[3], parts[5]
            if module not in MODULE_AUTH_MODULES:
                return self.send_json(404, {"error": "Unknown module"})
            cookie_name = self.module_cookie_name(module)
            if action == "login" and len(parts) == 6:
                try:
                    body = self.body_json()
                    username = str(body.get("username", "")).strip()
                    password = str(body.get("password", ""))
                except Exception:
                    return self.send_json(400, {"error": "Invalid JSON"})
                with connect() as db:
                    row = db.execute("SELECT username,password_hash,salt,role,active FROM module_users WHERE module=%s AND username=%s", (module, username)).fetchone()
                if not row or not row["active"]:
                    return self.send_json(401, {"error": "Incorrect module username or password"})
                digest = hashlib.pbkdf2_hmac("sha256", password.encode(), row["salt"].encode(), 240000).hex()
                if not hmac.compare_digest(digest, row["password_hash"]):
                    return self.send_json(401, {"error": "Incorrect module username or password"})
                token = secrets.token_urlsafe(32)
                MODULE_SESSIONS[token] = (module, username, row["role"], time.time() + SESSION_SECONDS)
                with connect() as db:
                    db.execute("INSERT INTO module_sessions(token_hash,module,username,expires_at) VALUES(%s,%s,%s,DATE_ADD(NOW(),INTERVAL %s SECOND))",
                               (hashlib.sha256(token.encode()).hexdigest(), module, username, SESSION_SECONDS))
                self.audit(username, "module.login", module, "Signed in")
                result = json.dumps({"authenticated": True, "user": {"username": username, "role": row["role"]}}, ensure_ascii=False).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(result)))
                self.send_header("Cache-Control", "no-store")
                self.send_header("Set-Cookie", f"{cookie_name}={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age={SESSION_SECONDS}{self.secure_cookie_suffix()}")
                self.end_headers()
                self.wfile.write(result)
                return
            if action == "logout" and len(parts) == 6:
                cookie = SimpleCookie(self.headers.get("Cookie", ""))
                morsel = cookie.get(cookie_name)
                session = MODULE_SESSIONS.pop(morsel.value, None) if morsel else None
                if morsel:
                    with connect() as db:
                        db.execute("DELETE FROM module_sessions WHERE token_hash=%s AND module=%s",
                                   (hashlib.sha256(morsel.value.encode()).hexdigest(), module))
                if session and session[0] == module:
                    self.audit(session[1], "module.logout", module, "Signed out")
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Set-Cookie", f"{cookie_name}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0{self.secure_cookie_suffix()}")
                self.end_headers()
                self.wfile.write(b'{"ok":true}')
                return
            session = self.module_session(module)
            if not session:
                return self.send_json(401, {"error": "Sign in to this module first."})
            if action == "password" and len(parts) == 6:
                try:
                    body = self.body_json()
                    current = str(body.get("currentPassword", ""))
                    new = str(body.get("newPassword", ""))
                    if not new:
                        raise ValueError("Enter a new password.")
                except Exception as exc:
                    return self.send_json(400, {"error": str(exc) or "Invalid request"})
                with connect() as db:
                    row = db.execute("SELECT password_hash,salt FROM module_users WHERE module=%s AND username=%s AND active=1", (module, session["username"])).fetchone()
                    if not row:
                        return self.send_json(401, {"error": "This module account is unavailable."})
                    digest = hashlib.pbkdf2_hmac("sha256", current.encode(), row["salt"].encode(), 240000).hex()
                    if not hmac.compare_digest(digest, row["password_hash"]):
                        return self.send_json(401, {"error": "Current password is incorrect"})
                    salt = secrets.token_hex(16)
                    new_hash = hashlib.pbkdf2_hmac("sha256", new.encode(), salt.encode(), 240000).hex()
                    db.execute("UPDATE module_users SET salt=%s,password_hash=%s WHERE module=%s AND username=%s", (salt, new_hash, module, session["username"]))
                self.audit(session["username"], "module.password.updated", module, "Changed module password")
                return self.send_json(200, {"ok": True})
            if action == "users" and len(parts) == 6:
                if session["role"].lower() != "admin":
                    return self.send_json(403, {"error": "Module administrator access required."})
                try:
                    body = self.body_json()
                    username = str(body.get("username", "")).strip()
                    password = str(body.get("password", ""))
                    role = str(body.get("role", "User")).strip()
                    if not username or len(username) > 128 or not password or role.lower() not in {"admin", "user"}:
                        raise ValueError("Enter a username, password, and valid role.")
                except Exception as exc:
                    return self.send_json(400, {"error": str(exc) or "Invalid request"})
                salt = secrets.token_hex(16)
                digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 240000).hex()
                try:
                    with connect() as db:
                        db.execute("INSERT INTO module_users(module,username,password_hash,salt,role,active) VALUES(%s,%s,%s,%s,%s,1)", (module, username, digest, salt, "Admin" if role.lower() == "admin" else "User"))
                except Exception:
                    return self.send_json(409, {"error": "That username already exists in this module."})
                self.audit(session["username"], "module.user.created", module, username)
                return self.send_json(201, {"username": username, "role": "Admin" if role.lower() == "admin" else "User", "active": True})
            return self.send_json(404, {"error": "Module authentication route not found."})
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
        if len(parts) == 7 and parts[:3] == ["api", "v1", "modules"] and parts[4:6] == ["collections", "records"] and parts[6] == "bulk":
            module = parts[3]
            if module not in MODULES:
                return self.send_json(404, {"error": "Unknown module"})
            principal = self.principal(module)
            if not principal or not self.module_allowed(principal, module):
                return self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "Sign in to this module first."})
            try:
                body = self.body_json()
                items = body.get("items")
                if not isinstance(items, list) or len(items) > 1000:
                    raise ValueError("Provide up to 1,000 records per batch.")
                prepared = []
                for item in items:
                    if not isinstance(item, dict) or not item.get("id"):
                        raise ValueError("Each imported record needs an ID.")
                    record_id = str(item["id"])
                    if len(record_id) > 64:
                        raise ValueError("Imported record ID is too long.")
                    payload = {key: value for key, value in item.items() if key != "id"}
                    prepared.append((record_id, module, "records", json.dumps(payload, ensure_ascii=False)))
            except Exception as exc:
                return self.send_json(400, {"error": str(exc) or "Invalid import batch."})
            with connect() as db:
                for record_id, record_module, collection, payload in prepared:
                    if body.get("updateExisting"):
                        db.execute("INSERT IGNORE INTO records(id,module,collection,payload) VALUES(%s,%s,%s,CAST(%s AS JSON)) ON DUPLICATE KEY UPDATE payload=IF(module=%s AND collection=%s,VALUES(payload),payload)",
                                   (record_id, record_module, collection, payload, record_module, collection))
                    else:
                        db.execute("INSERT IGNORE INTO records(id,module,collection,payload) VALUES(%s,%s,%s,CAST(%s AS JSON))",
                                   (record_id, record_module, collection, payload))
            self.audit(principal["username"], "record.imported", module, f"records/{len(prepared)}")
            return self.send_json(200, {"received": len(prepared), "items": [{"id": row[0]} for row in prepared]})
        if parsed.path == "/api/v1/files":
            return self.handle_file_upload(None)
        module_hint = parts[3] if len(parts) >= 4 and parts[:3] == ["api", "v1", "modules"] else None
        principal = self.principal(module_hint)
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
            self.send_header("Set-Cookie", "mm1_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0" + self.secure_cookie_suffix())
            self.end_headers()
            self.wfile.write(b'{"ok":true}')
            return
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
                db.execute("INSERT IGNORE INTO records(id,module,collection,payload) VALUES(%s,%s,%s,CAST(%s AS JSON))",
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
        with database_scope(self.request_module()):
            return self._do_PATCH()

    def _do_PATCH(self):
        parts = [unquote(p) for p in urlparse(self.path).path.split("/") if p]
        if len(parts) == 7 and parts[:3] == ["api", "v1", "modules"] and parts[4:6] == ["auth", "users"]:
            module, username = parts[3], parts[6]
            session = self.module_session(module) if module in MODULE_AUTH_MODULES else None
            if not session or session["role"].lower() != "admin":
                return self.send_json(403, {"error": "Module administrator access required."})
            try:
                body = self.body_json()
                active = body.get("active")
                role = body.get("role")
                password = str(body.get("password", ""))
                if active is not None and not isinstance(active, bool):
                    raise ValueError("Active must be true or false.")
                if role is not None and str(role).lower() not in {"admin", "user"}:
                    raise ValueError("Role must be Admin or User.")
                if not any(value is not None for value in (active, role)) and not password:
                    raise ValueError("Provide a role, active state, or password to update.")
            except Exception as exc:
                return self.send_json(400, {"error": str(exc) or "Invalid request"})
            with connect() as db:
                target = db.execute("SELECT role,active FROM module_users WHERE module=%s AND username=%s", (module, username)).fetchone()
                if not target:
                    return self.send_json(404, {"error": "Module user not found."})
                disabling_admin = target["role"].lower() == "admin" and target["active"] and (active is False or (role and role.lower() != "admin"))
                if disabling_admin:
                    admins = db.execute("SELECT COUNT(*) AS n FROM module_users WHERE module=%s AND role='Admin' AND active=1", (module,)).fetchone()["n"]
                    if admins <= 1:
                        return self.send_json(400, {"error": "Each module must keep at least one active administrator."})
                new_salt = secrets.token_hex(16) if password else None
                new_hash = hashlib.pbkdf2_hmac("sha256", password.encode(), new_salt.encode(), 240000).hex() if password else None
                db.execute("UPDATE module_users SET active=COALESCE(%s,active),role=COALESCE(%s,role),salt=COALESCE(%s,salt),password_hash=COALESCE(%s,password_hash) WHERE module=%s AND username=%s",
                           (None if active is None else int(active), None if role is None else ("Admin" if role.lower() == "admin" else "User"), new_salt, new_hash, module, username))
            self.audit(session["username"], "module.user.updated", module, username)
            return self.send_json(200, {"ok": True})
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
        with database_scope(self.request_module()):
            return self._do_DELETE()

    def _do_DELETE(self):
        parts = [unquote(p) for p in urlparse(self.path).path.split("/") if p]
        if len(parts) == 7 and parts[:3] == ["api", "v1", "modules"] and parts[4:6] == ["auth", "users"]:
            module, username = parts[3], parts[6]
            session = self.module_session(module) if module in MODULE_AUTH_MODULES else None
            if not session or session["role"].lower() != "admin":
                return self.send_json(403, {"error": "Module administrator access required."})
            if username == session["username"]:
                return self.send_json(400, {"error": "You cannot remove your own module account."})
            with connect() as db:
                target = db.execute("SELECT role,active FROM module_users WHERE module=%s AND username=%s", (module, username)).fetchone()
                if not target:
                    return self.send_json(404, {"error": "Module user not found."})
                if target["role"].lower() == "admin" and target["active"]:
                    admins = db.execute("SELECT COUNT(*) AS n FROM module_users WHERE module=%s AND role='Admin' AND active=1", (module,)).fetchone()["n"]
                    if admins <= 1:
                        return self.send_json(400, {"error": "Each module must keep at least one active administrator."})
                db.execute("DELETE FROM module_users WHERE module=%s AND username=%s", (module, username))
            self.audit(session["username"], "module.user.deleted", module, username)
            return self.send_json(200, {"ok": True})
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
        module_hint = parts[3] if len(parts) >= 4 and parts[:3] == ["api", "v1", "modules"] else None
        principal = self.principal(module_hint)
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
        module, record_id = fields.get("module"), fields.get("recordId") or None
        if module not in MODULES:
            return self.send_json(400, {"error": "A valid module field is required."})
        principal = self.principal(module)
        if not principal or not self.module_allowed(principal, module):
            return self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "Sign in to this module first."})
        original = Path(upload[0].replace("\\", "/")).name
        file_id, stored = str(uuid.uuid4()), str(uuid.uuid4()) + Path(original).suffix[:16]
        path = FILES_DIR / module / stored
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(upload[2])
        sha = hashlib.sha256(upload[2]).hexdigest()
        mime = upload[1] or mimetypes.guess_type(original)[0] or "application/octet-stream"
        with connect(module) as db:
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
            self.send_header("Set-Cookie", f"mm1_session={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age={SESSION_SECONDS}{self.secure_cookie_suffix()}")
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
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
