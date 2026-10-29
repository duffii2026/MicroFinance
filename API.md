# MFS Developer API Guide

**Audience:** developers integrating another application with MFS.  
**API version:** v1  
**Local base URL:** `http://127.0.0.1:8081/api/v1` (the active port is set by `MM1_APP_PORT` in `.env`).

> **Current integration boundary:** this API is the shared MySQL JSON record and file service. The six original module screens retain their own existing storage behavior and are **not automatically synchronized** with these API collections. Integrators should write through this API and explicitly agree a mapping or migration before expecting changes to appear in a legacy screen. Collection names and sample fields below describe a practical mapping to each module workflow; the API accepts JSON and does not validate module-specific business rules.

## Integration walkthrough

### 1. Choose the module and records you need

Use the module ID in the URL and choose a collection name. Pick the narrowest module access needed. The server currently supports six IDs: `central`, `cpa`, `credentials`, `gateways`, `communications`, and `companies`.

### 2. Create a key in the dashboard

Open **API Center → API keys**, sign in with an administrator account, enter an integration name, choose the module scopes, and set an expiry. Copy the full key when it is shown; it is displayed only once. You can rename it, change its scopes or expiry, or revoke it later from the same page.

Keys use `Authorization: Bearer <key>`. Store the value in a server-side secret store or environment variable. A key embedded in browser JavaScript can be read by every user of that frontend. For a browser-only development app, allow its origin using `MM1_CORS_ORIGINS` in `.env`; the default allows `http://localhost:3000` and `http://127.0.0.1:3000`.

### 3. Check service availability

`GET /health` is public and does not need a key:

```sh
curl http://127.0.0.1:8081/api/v1/health
```

A healthy response includes `"ok": true` and `"database": "mysql"`.

### 4. Make an authenticated request

Example: read account records from the Central Database collection:

```sh
curl "http://127.0.0.1:8081/api/v1/modules/central/collections/accounts" \
  -H "Authorization: Bearer $MFS_API_KEY" \
  -H "Accept: application/json"
```

JavaScript example for a trusted server-side integration:

```js
const MFS_BASE_URL = process.env.MFS_BASE_URL ?? "http://127.0.0.1:8081/api/v1";
const MFS_API_KEY = process.env.MFS_API_KEY;

async function mfsRequest(path, options = {}) {
  const response = await fetch(`${MFS_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${MFS_API_KEY}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`MFS ${response.status}: ${body.error ?? "Request failed"}`);
  return body;
}
```

### 5. Create, read, update, and delete records

Each record is one JSON object. New records receive a UUID unless the caller supplies `id`. Updates replace the complete JSON object, so include every field you need to keep.

```js
const path = "/modules/companies/collections/companies";
const created = await mfsRequest(path, {
  method: "POST",
  body: JSON.stringify({ name: "Example Company", status: "Active", country: "KH" }),
});
const record = await mfsRequest(`${path}/${created.id}`);
await mfsRequest(`${path}/${created.id}`, {
  method: "POST",
  body: JSON.stringify({ name: "Example Company", status: "Reviewed", country: "KH" }),
});
await mfsRequest(`${path}/${created.id}`, { method: "DELETE" });
```

Responses use `{ "items": [...] }` for a collection and `{ "id", "data", "createdAt", "updatedAt" }` for one record. Mutations are written to the local audit log.

### 6. Attach files when needed

`POST /files` accepts `multipart/form-data` with a `file`, a `module` ID, and optional `recordId`. Maximum upload size is 25 MB. Store the returned file `id` with the related record in your integration. `GET /files?module=companies&recordId=<id>` lists permitted file metadata; `GET /files/<file-id>` downloads a file. API-key scopes apply to file upload, listing, and download.

### 7. Handle errors and key lifecycle

| Status | Meaning | Developer action |
|---|---|---|
| 400 | Invalid JSON or request fields | Fix the request body or multipart fields |
| 401 | Missing, expired, or revoked key/session | Check the configured key; ask an MFS administrator to issue a new one |
| 403 | Key does not include the requested module, or operation requires administrator browser sign-in | Request the required scope; key-admin routes must be used in the signed-in dashboard |
| 404 | Unknown route, module, or record | Check the URL, module ID, collection, and record ID |
| 503 | Service or MySQL unavailable | Check that the local MFS service and MySQL are running |

Keys can be revoked immediately in the dashboard. Key administration is not available through API keys themselves.

## Module mapping reference

The source module screens use different record shapes. The shared API accepts JSON as-is and does not enforce these example fields. Use stable record IDs for relationships, retain the source module’s identifiers where practical, and agree on field names before building more than one integration.

| Module | API module ID | Screen workflow and practical collection mapping |
|---|---|---|
| **MM1-01 Central Database** | `central` | Financial registers, people, companies, gateways, merchant accounts, operating accounts, reference codes, exchange rates, systems, uploads, and snapshots. Practical collections may include `people`, `companies`, `gateways`, `merchant-accounts`, `accounts`, `rates`, `reference-codes`, `systems`, and `uploads`. The legacy screen internally distinguishes account registers such as `mac`, `mca`, `pc`, `skac`, and `skap`; choose whether to preserve these names or normalize them before integrating. |
| **MM1-02 CPA Control System** | `cpa` | Bank/payment account records, people and agent assignments, balances and status history, salary/commission statements, uploads, snapshots, and audit history. Suggested collections: `accounts`, `people`, `agents`, `pay-statements`, `uploads`, `snapshots`, `audit`. An account may map fields such as `bank`, `accountName`, `accountNumber`, `balance`, `status`, `project`, `holder`, `personId`, `history`, and `updatedAt`. |
| **MM1-03 Account Access Credentials** | `credentials` | Linked accounts, access types/status, credential/account details, staff access, supporting documents, and change history. The current screen’s internal buckets include `accounts`, `access`, `users`, `settings`, `hist`, `log`, `docs`, `docdata`, and `memos`. Keep sensitive values in restricted services and use the narrowest possible key scope. |
| **MM1-04 Payment Gateways** | `gateways` | Gateway configuration, merchants, locations, contacts, contracts/rates, rules, memos, and related files. The current screen internally uses `gateways`, `merchants`, `settings`, `hist`, `log`, `docs`, `docdata`, and `memos`. Merchant-to-gateway relationships should use stable gateway IDs. |
| **MM1-05 Communication Channel** | `communications` | Team communication channel/contact directory, including type, address, project, purpose, owner, linked service, status, sheet/group number, notes, and date added. Suggested collection: `channels`; internal supporting buckets include settings, users, and log. |
| **MM1-06 Company Database** | `companies` | Company profiles, ownership and contacts, registrations, linked accounts/MCA details, supporting documents, notes/memos, and history. The current screen internally uses `companies`, `users`, `hist`, `log`, `docs`, `docdata`, and `memos`. Preserve links to gateway/merchant records using stable IDs. |

The API collection names in URLs are caller-selected labels. For example, `/modules/cpa/collections/accounts` stores JSON rows under module `cpa`, collection `accounts`; it does not read the CPA screen’s local browser storage.

## Endpoint reference

### Health and browser session

| Method | Route | Authentication |
|---|---|---|
| GET | `/health` | Public; reports service and MySQL status |
| GET | `/session` | Browser session status only; bearer keys do not sign into the dashboard |
| POST | `/auth/login` | Browser login using username/password |
| POST | `/auth/logout` | Browser session |
| POST | `/auth/password` | Browser session; new password must not be empty |

### Module records (all six module IDs)

| Method | Route | Purpose |
|---|---|---|
| GET | `/modules/{module}` | Read module metadata |
| GET | `/modules/{module}/collections/{collection}` | List collection records, newest updated first |
| GET | `/modules/{module}/collections/{collection}/{id}` | Read one record |
| POST | `/modules/{module}/collections/{collection}` | Create a record with a JSON object |
| POST | `/modules/{module}/collections/{collection}/{id}` | Replace one record’s JSON payload |
| DELETE | `/modules/{module}/collections/{collection}/{id}` | Delete one record |

### Files

| Method | Route | Purpose |
|---|---|---|
| POST | `/files` | Upload multipart fields `file`, `module`, and optional `recordId` (25 MB maximum) |
| GET | `/files?module={module}&recordId={id}` | List file metadata; both filters are optional |
| GET | `/files/{id}` | Download file content |

### Administrator API-key management (browser session only)

| Method | Route | Purpose |
|---|---|---|
| GET | `/admin/api-keys` | List key metadata and lifecycle status; never returns key secrets |
| POST | `/admin/api-keys` | Create key with `{"name":"Reporting integration","modules":["central","companies"],"expiresInDays":90}`; `null` means no expiration. The full `apiKey` is returned once |
| PATCH | `/admin/api-keys/{id}` | Update `name`, `modules`, and optional `expiresInDays` (`null` means no expiry; omission keeps the current expiry) |
| DELETE | `/admin/api-keys/{id}` | Revoke a key immediately |

API keys are stored as SHA-256 hashes in MySQL. Their module selection authorizes read/write/delete operations for records and file access within those modules. A key cannot administer other keys.

## MySQL storage

`records` stores JSON payloads grouped by module and collection; `files` stores upload metadata while file content is saved under local storage; `users` stores salted PBKDF2 password hashes; `api_keys` stores hashed keys, module scopes, and lifecycle timestamps; `audit_log` records API mutations and key administration; `settings` stores local service settings. The local service initializes the InnoDB tables in the configured MySQL database on startup. MySQL 8.0+ is recommended.
