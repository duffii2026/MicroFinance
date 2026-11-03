# MicroFinance · MFS

A local workspace containing ten system modules across MM1 and MM4, a React workspace, and a local MySQL/API/file backend.

## Start on Windows

### Easiest local setup: Docker Desktop

1. Install and start Docker Desktop.
2. Double-click `docker-start.bat`. On first run it creates `.env` and opens it so you can replace the example database passwords.
3. Save `.env`. The script starts the app and MySQL together. Open `http://127.0.0.1:8080`.
4. On first use, sign in with `admin` / the value configured in `MM1_ADMIN_PASSWORD`, then change the password.

### Use an existing local MySQL server

1. Install Python 3.10 or newer and MySQL 8.0 or newer.
2. Install Node.js 22 or newer, enable pnpm with `corepack enable`, then run `setup.bat` once. It installs the React build dependencies, builds the web frontend, installs the MySQL connector, and creates `.env` from `.env.example`.
3. Configure `.env` with the connection details for your MySQL server and create the database/user if needed. The application account needs table creation and CRUD privileges in that database.
4. Double-click `start.bat` and open the address shown in the terminal (default `http://127.0.0.1:8080`).
5. On first use, sign in with `admin` / the value configured in `MM1_ADMIN_PASSWORD`, then change the password.

### Docker option

Docker Desktop can run both services locally. Copy `.env.example` to `.env`, replace both example passwords, then run `docker compose up --build` (or double-click `docker-start.bat`). The app will be available on `http://127.0.0.1:8080`; MySQL is published only on localhost. Data persists in the Docker volume `mm1_mysql_data` and the local `data/` folder. Back up both before moving the system.

The server binds to `127.0.0.1` by default and does not expose the system to your network. It creates `data/files/` for uploaded files. API records, users, file metadata, settings, and audit entries are stored in the configured MySQL database.

Configure app and MySQL settings in `.env`; `MM1_APP_PORT` sets the app port and `MM1_DB_HOST`, `MM1_DB_PORT`, `MM1_DB_NAME`, `MM1_DB_USER`, and `MM1_DB_PASSWORD` set the connection. To use a different network interface, set `MM1_HOST` deliberately; binding beyond `127.0.0.1` makes the service reachable to other machines on that network.

## One database instance per module (optional)

Each module already has its own schema. If you also want each **database connection** on its own port — for firewall rules or stricter separation — give a module its own MySQL instance:

```powershell
powershell -File tools\mysql-module-instances.ps1 -Action provision -Module central
```

That creates a data directory under `data/mysql/central`, starts a dedicated mysqld on **8301**, and creates the module database plus the app account. Then point the app at it:

```ini
MM1_DB_MODULE_PORTS=central=8301,cpa=8302
```

Ports follow the module order: 8301 (MM1-01) … 8319 (MM4-03b). Modules not listed keep using `MM1_DB_HOST`/`MM1_DB_PORT`. On first start the server creates the module tables and copies that module's existing rows from the shared database, so nothing is lost.

Other actions: `-Action start|stop|status|remove -Module central`, and `-Action status` (no module) shows every instance.

**Cost:** each mysqld reserves roughly 300–400 MB of RAM. Nineteen instances need ~6–8 GB, which fits a workstation but **not** the current 2 GB production server — there, keep one MySQL (or use fewer instances for the modules that need the separation).
## One port per module (optional)

Set `MM1_MODULE_PORT_BASE=8100` in `.env` and every module also listens on its own port, in module order:

| Port | Module | Port | Module |
|---|---|---|---|
| 8101 | MM1-01 Central Database | 8111 | MM2-07 Company & Legal Expenses |
| 8102 | MM1-02 CPA Control System | 8112 | MM2-08 Account Balance & Statements |
| 8103 | MM1-03 Account Access Credentials | 8113 | MM2-09 CPA Salary & Commission |
| 8104 | MM1-04 Payment Gateways | 8114 | MM2-12 Gate & Visa Deposits |
| 8105 | MM1-05 Communication Channel | 8115 | MM2-13 Fund Recovery Timeline |
| 8106 | MM1-06 Company Database | 8116 | MM4-01 PSS Request & Approval |
| 8107 | MM2-01 PSS Request & Expense Tracking | 8117 | MM4-03 Fund Transfers & Settlement |
| 8108 | MM2-04 Inventory Control | 8118 | MM4-03a Manual CPA |
| 8109 | MM2-05 Account In Service Database | 8119 | MM4-03b Auto Payment |
| 8110 | MM2-06 CP Account In Service Database | | |

Opening `http://host:8108/` lands in that module. Each port serves **only that module's API** — requests for another module return `403` — so a firewall rule on one port really does gate one module. The workspace (all modules, API keys, account settings) stays on the main port. Use `MM1_MODULE_PORTS="central=9000,cpa=9001"` to assign ports explicitly.
## Module inventory and workflow

| Module | Main work | Workflow |
|---|---|---|
| MM1-01 Central Database | Main and merchant accounts, company/person references, gateways, messaging channels, exchange rates, daily upload, variance and average reporting, audit | Select a register, search/filter, add or update a record, attach documents, and export reports. The module includes a shared central overview and CPA links. |
| MM1-02 CPA Control System | Bank accounts, balances, holder/project assignments, payment control, changes/history, agent reports, export | Review accounts and current balances, assign or update records, record notes and changes, then export summaries. |
| MM1-03 Account Access Credentials | Account and portal credentials, linked email/mobile information, access type, department/PIC, documents, Excel import/export | Search accounts, open an access record, review or update secured fields, link related CPA accounts, and attach documents. |
| MM1-04 Payment Gateways | Gateway/merchant accounts, locations and rules, bank/company details, memos, uploaded evidence | Select a location or gateway, view account and company links, maintain rules and notes, and attach or download files. |
| MM1-05 Communication Channel | Communication channels, teams/users, positions and access definitions | Maintain channel records, configure the team/position lists, set access, and export channel information. |
| MM1-06 Company Database | Company profiles, registrations, accounts, contacts, contracts, communication details and supporting files | Search/select a company, maintain company and registration details, manage accounts and documents, then export. |

The main workspace, dashboard, API key manager, and account settings are built with React. The six MM1 systems and four MM4 systems load through isolated React entries while preserving their existing workflows. Their browser data stores synchronize to each module’s MySQL `browser-state` records after that module’s own sign-in; the bridge retries when the database is unavailable. No MFS workspace sign-in is required for module data. MM4-03 reads the related data stores for settlement summaries. The nine MM2 screens use module-specific MySQL records and logins. Original HTML/JavaScript assets remain in the compatibility runtime for MM1 and MM4.

## Local data and API

The service uses MySQL with `utf8mb4` and InnoDB tables for API records, user accounts, file metadata, settings, and audit entries. Uploaded files are stored in `data/files/` under generated names. See [API.md](API.md) for routes and payloads.

## Security notes

The default account is for first-run local setup. Change its password before operational use. Session cookies are HttpOnly and SameSite=Strict. The initial module HTML files contain their own browser-storage behavior and use separate module sign-in controls; the shared API does not change those legacy permissions or migrate credentials automatically. Keep `.env` private and protect MySQL and the `data` folder with normal OS access controls. For access by multiple machines, HTTPS, role/permission enforcement, backups, and a security review should be added before exposing it beyond localhost.


## Production deployment

The included `Caddyfile` serves `tonchet.com` with automatic HTTPS and proxies traffic to the app container. Docker builds the React frontend as part of the image. Point the domain A record to the server, allow inbound ports 80 and 443, and run Docker Compose on the server. Set unique values for `MM1_ADMIN_PASSWORD`, `MM1_DB_PASSWORD`, and `MM1_MYSQL_ROOT_PASSWORD` in the server-only `.env`; set `MM1_COOKIE_SECURE=1`. Never copy a local `.env` into the public repository. Administrator sign-in is available from the top bar for API key and account management, while MySQL and the app port stay bound to localhost.


MM2 contributes nine native React system screens in the dashboard. See [MODULES.md](MODULES.md) for workflow summaries and [API.md](API.md) for module scopes and integration instructions.

Each module retains a separate username/password login and user list. MM2 accounts are stored independently in MySQL by module; each MM2 administrator account starts as `admin` / `admin` and can be changed from inside its module. MM1 and MM4 retain their source module sign-in flows.
