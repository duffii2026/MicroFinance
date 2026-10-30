# MFS Developer API Guide

**Audience:** developers integrating another application with MFS.  
**API version:** v1  
**Local base URL:** `http://127.0.0.1:8081/api/v1` (the active port is set by `MM1_APP_PORT` in `.env`).

> **Data integration:** every module has a dedicated MySQL database, account list, session store, file metadata, and audit log. Each module screen signs into its own account and stores its data only in that module’s database. No MFS workspace administrator sign-in is required for module data synchronization. Integrations use the module IDs and scoped API keys below; the API accepts JSON and does not validate module-specific business rules.

## Integration walkthrough

### 1. Choose the module and records you need

Use the module ID in the URL and choose a collection name. Pick the narrowest module access needed. The server supports these IDs: `central`, `cpa`, `credentials`, `gateways`, `communications`, `companies`, `mm4_pss_requests`, `mm4_fund_transfers`, `mm4_manual_cpa`, and `mm4_auto_payment`; MM2 IDs are `mm2_pss_expenses`, `mm2_inventory`, `mm2_account_service`, `mm2_cp_account_service`, `mm2_company_expenses`, `mm2_account_statements`, `mm2_cpa_expenses`, `mm2_gate_visa`, and `mm2_fund_recovery`.

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
| **MM2-01 PSS Request & Expense Tracking** | `mm2_pss_expenses` | Request clearing, due dates, policy timeliness, returns and rejection outcomes. The native React screen saves request and clearing records in the `records` collection. |
| **MM2-04 Inventory Control** | `mm2_inventory` | Inventory items, item identifiers/photos, stock locations, department transfers, stock requests and approvals. The native React screen saves inventory records in the `records` collection. |
| **MM2-05 Account In Service Database** | `mm2_account_service` | Account age, project assignment and expense responsibility. The native React screen saves account service records in the `records` collection. |
| **MM2-06 CP Account In Service Database** | `mm2_cp_account_service` | CP account age, project assignment and expense responsibility. The native React screen saves CP account service records in the `records` collection. |
| **MM2-07 Company & Legal Expense Tracking** | `mm2_company_expenses` | Company/legal expenses, invoices, due dates, payments and overdue alerts, including links to MM1-06 company records. The native React screen saves company and legal expense records in the `records` collection. |
| **MM2-08 Account Balance & Statement Tracking** | `mm2_account_statements` | Statement receipt, last reported balance, delivery delays and recurring lateness. The native React screen saves statement records in the `records` collection. |
| **MM2-09 CPA Salary & Commission Tracking** | `mm2_cpa_expenses` | Salary and commission payment timing and history. The native React screen saves salary and commission tracking records in the `records` collection. |
| **MM2-12 Gate & Visa Deposit Monitoring** | `mm2_gate_visa` | Gate OTP costs and Visa deposits, monthly amounts, request status and payment timeliness. The native React screen saves deposit tracking records in the `records` collection. |
| **MM2-13 Fund Recovery Tracking & Timeline** | `mm2_fund_recovery` | Restricted balances, account holders, contact attempts, bank actions, settlement, timeline, alerts and rewards. The native React screen saves fund recovery records in the `records` collection. |
| **MM4-01 PSS Request & Approval** | `mm4_pss_requests` | Request submissions, approval routes, decision history, and clearing. The React-hosted module syncs its `ir_pss_request_v1` and shared request state as `browser-state` records after signing into that module. |
| **MM4-03 Fund Transfers & Settlement** | `mm4_fund_transfers` | Fund transfer records and settlement history stored in this module’s own database. |
| **MM4-03a Manual CPA** | `mm4_manual_cpa` | Imported merchant-to-CPA batches, paid status, bank references, and history. The module syncs its stored state through the `browser-state` collection after signing into that module. |
| **MM4-03b Auto Payment** | `mm4_auto_payment` | P2P transfers and merchant, CPA, and main account tracking. The module syncs `mm403_offline_db_v1` through the `browser-state` collection after signing into that module. |

The API collection names in URLs are caller-selected labels. For example, `/modules/cpa/collections/accounts` stores integration rows under module `cpa`, collection `accounts`; the CPA screen’s bridged app snapshot is in `/modules/cpa/collections/browser-state`. The local browser copy remains available during database recovery; the React-hosted page shows the MySQL sync status and retries synchronization automatically.

## Endpoint reference

### Health and browser session

| Method | Route | Authentication |
|---|---|---|
| GET | `/health` | Public; reports service and MySQL status |
| GET | `/session` | Browser session status only; bearer keys do not sign into the dashboard |
| POST | `/auth/login` | Browser login using username/password |
| POST | `/auth/logout` | Browser session |
| POST | `/auth/password` | Browser session; new password must not be empty |

### Per-module user accounts

Every module has an independent `module_users` account list and its own HTTP-only session cookie. The module’s own sign-in establishes the MySQL session used for its data; no MFS workspace administrator sign-in is needed. A login in one module does not sign a user into another. Each newly initialized module account receives a separate `admin` account with password `admin`; administrators can manage module accounts through these endpoints.

| Method | Route | Purpose |
|---|---|---|
| POST | `/modules/{module}/auth/login` | Sign in to one module with `{"username":"admin","password":"admin"}`; sets that module’s cookie |
| GET | `/modules/{module}/auth/session` | Check the current module-specific login |
| POST | `/modules/{module}/auth/logout` | Sign out of that module only |
| POST | `/modules/{module}/auth/password` | Change the signed-in module account password |
| GET | `/modules/{module}/auth/users` | List users; module administrator only |
| POST | `/modules/{module}/auth/users` | Add a user to this module; module administrator only |
| PATCH | `/modules/{module}/auth/users/{username}` | Change role, active status, or password; module administrator only |
| DELETE | `/modules/{module}/auth/users/{username}` | Remove a user; module administrator only |

MM2 screen data is stored under the `records` collection in its module database. MM1 and MM4 compatibility screens synchronize app state to their own module’s `browser-state` collection. A module login creates only that module’s session cookie and cannot access another module’s database. API keys continue to use their selected module scopes and do not create a browser module login.

### Module records (all supported module IDs)

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
| GET | `/files?module={module}&recordId={id}` | List file metadata; module is required and record ID is optional |
| GET | `/files/{id}?module={module}` | Download file content from the named module |

### Administrator API-key management (browser session only)

| Method | Route | Purpose |
|---|---|---|
| GET | `/admin/api-keys` | List key metadata and lifecycle status; never returns key secrets |
| POST | `/admin/api-keys` | Create key with `{"name":"Reporting integration","modules":["central","companies"],"expiresInDays":90}`; `null` means no expiration. The full `apiKey` is returned once |
| PATCH | `/admin/api-keys/{id}` | Update `name`, `modules`, and optional `expiresInDays` (`null` means no expiry; omission keeps the current expiry) |
| DELETE | `/admin/api-keys/{id}` | Revoke a key immediately |

API keys are stored as SHA-256 hashes in MySQL. Their module selection authorizes read/write/delete operations for records and file access within those modules. A key cannot administer other keys.

## MySQL storage

The configured database (for example, `mm1_microfinance`) holds the MFS workspace account, API keys, and service settings. Each module uses its own database named `{MM1_DB_NAME}_{module}` (for example, `mm1_microfinance_central` or `mm1_microfinance_mm2_inventory`). Those databases contain only that module’s records, files metadata, module users, sessions, and audit log. On first startup, the service copies that module’s existing rows from the legacy shared database; the original rows remain as a rollback copy. New module changes go only to the module database. Docker’s MySQL initialization provisions all module databases; an existing MySQL installation needs the module database grants before startup. MySQL 8.0+ is recommended.
