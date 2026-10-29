<<<<<<< HEAD
# MicroFinance · MFS

A local workspace containing the six MM1 system modules, their original browser experiences, and a local MySQL/API/file backend.

## Start on Windows

### Easiest local setup: Docker Desktop

1. Install and start Docker Desktop.
2. Double-click `docker-start.bat`. On first run it creates `.env` and opens it so you can replace the example database passwords.
3. Save `.env`. The script starts the app and MySQL together. Open `http://127.0.0.1:8080`.
4. On first use, sign in with `admin` / `ChangeMe123!`, then change the password.

### Use an existing local MySQL server

1. Install Python 3.10 or newer and MySQL 8.0 or newer.
2. Run `setup.bat` once to install the MySQL connector and create `.env` from `.env.example`.
3. Configure `.env` with the connection details for your MySQL server and create the database/user if needed. The application account needs table creation and CRUD privileges in that database.
4. Double-click `start.bat` and open the address shown in the terminal (default `http://127.0.0.1:8080`).
5. On first use, sign in with `admin` / `ChangeMe123!`, then change the password.

### Docker option

Docker Desktop can run both services locally. Copy `.env.example` to `.env`, replace both example passwords, then run `docker compose up --build` (or double-click `docker-start.bat`). The app will be available on `http://127.0.0.1:8080`; MySQL is published only on localhost. Data persists in the Docker volume `mm1_mysql_data` and the local `data/` folder. Back up both before moving the system.

The server binds to `127.0.0.1` by default and does not expose the system to your network. It creates `data/files/` for uploaded files. API records, users, file metadata, settings, and audit entries are stored in the configured MySQL database.

Configure app and MySQL settings in `.env`; `MM1_APP_PORT` sets the app port and `MM1_DB_HOST`, `MM1_DB_PORT`, `MM1_DB_NAME`, `MM1_DB_USER`, and `MM1_DB_PASSWORD` set the connection. To use a different network interface, set `MM1_HOST` deliberately; binding beyond `127.0.0.1` makes the service reachable to other machines on that network.

## Module inventory and workflow

| Module | Main work | Workflow |
|---|---|---|
| MM1-01 Central Database | Main and merchant accounts, company/person references, gateways, messaging channels, exchange rates, daily upload, variance and average reporting, audit | Select a register, search/filter, add or update a record, attach documents, and export reports. The module includes a shared central overview and CPA links. |
| MM1-02 CPA Control System | Bank accounts, balances, holder/project assignments, payment control, changes/history, agent reports, export | Review accounts and current balances, assign or update records, record notes and changes, then export summaries. |
| MM1-03 Account Access Credentials | Account and portal credentials, linked email/mobile information, access type, department/PIC, documents, Excel import/export | Search accounts, open an access record, review or update secured fields, link related CPA accounts, and attach documents. |
| MM1-04 Payment Gateways | Gateway/merchant accounts, locations and rules, bank/company details, memos, uploaded evidence | Select a location or gateway, view account and company links, maintain rules and notes, and attach or download files. |
| MM1-05 Communication Channel | Communication channels, teams/users, positions and access definitions | Maintain channel records, configure the team/position lists, set access, and export channel information. |
| MM1-06 Company Database | Company profiles, registrations, accounts, contacts, contracts, communication details and supporting files | Search/select a company, maintain company and registration details, manage accounts and documents, then export. |

The module pages are preserved from the supplied HTML files and run locally in the unified shell. Their original offline data remains in each browser's local storage. The new backend is available for future migration and integration; the preserved module records have not been silently copied into the new database.

## Local data and API

The service uses MySQL with `utf8mb4` and InnoDB tables for API records, user accounts, file metadata, settings, and audit entries. Uploaded files are stored in `data/files/` under generated names. See [API.md](API.md) for routes and payloads.

## Security notes

The default account is for first-run local setup. Change its password before operational use. Session cookies are HttpOnly and SameSite=Strict. The initial module HTML files contain their own browser-storage behavior and use separate module sign-in controls; the shared API does not change those legacy permissions or migrate credentials automatically. Keep `.env` private and protect MySQL and the `data` folder with normal OS access controls. For access by multiple machines, HTTPS, role/permission enforcement, backups, and a security review should be added before exposing it beyond localhost.
=======
# MicroFinance
>>>>>>> origin/main
