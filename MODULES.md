# MM1 module review

The folder contained **six** HTML systems (not five). The six supplied files were reviewed and retained as standalone module assets under `modules/`; the originals at the project root were left unchanged.

## MM1-01 · PGD Central Database

This is the group-wide register and reporting hub. Its navigation covers a dashboard, search, MAC/MCA/SKA-C/SKA-P/petty cash registers, CPA links, daily upload, variance/average reporting, companies, people, gateways, channels, reference codes, and exchange rates. Record forms include account ownership/status/balance/source details; the tool also includes history/audit, notes/checklists, upload management, Excel output, access positions, and currency controls. It uses an embedded offline seed and a local-storage-backed browser data adapter.

## MM1-02 · CPA Control System

This system controls bank and payment accounts. Its workflows cover account search and filtering, balances, bank/project/holder assignment, payment-related review, account history and notes, agent distributions/reports, exports, and print views. It uses a separate browser-store key and also contains an optional Supabase/PostgREST configuration path. The bundled SQL excerpt creates one JSONB state row; its policy excerpt allows unrestricted reads/writes, so that hosted configuration should not be exposed as-is.

## MM1-03 · Account Access Credentials Database

This is the sensitive access register: portal credentials, email links, phone/SIM details, account and CPA links, account type/department/PIC, access state, documents, and Excel import/export. The UI includes reveal/hide controls and password-protected access gates. It uses local browser storage. Treat its data as sensitive and keep access limited to trusted users.

## MM1-04 · Payment Gateways Database

This manages gateway and merchant records with location groupings/rules, bank/CPA references, account and company details, rates/collection fees, memos, uploads, and spreadsheet/PDF-related workflows. It links back to CPA for information rather than copying CPA records. It uses local browser storage.

## MM1-05 · Communication Channel

This maintains communication channel information and team access configuration: channel records, platform/project/purpose, access users and positions, search, ordering, and Excel export. It uses a path-scoped browser local-storage key and has its own sign-in/access workflow.

## MM1-06 · Company Database

This maintains company identity and operational records: registrations, company accounts, contacts, communication channels, contracts and other attachments, memos, and Excel output. The workflow is to locate a company, edit profile and linked information, upload/view/download documents, and export a register. It uses local browser storage.

## MM4 systems

- **MM4-01 · PSS Request & Approval:** request submission, policy approval routes, expense tracking, clearing, dashboard, settings, and history. The module syncs its request and shared state to the `mm4_pss_requests` API `browser-state` collection after signing into MM4-01.
- **MM4-03 · Fund Transfers and Settlement:** summary and history for payment and settlement activity across Manual CPA and Auto Payment. It reads the related MM4 API-backed state; integrations need scopes for the source modules.
- **MM4-03a · Manual CPA:** Excel batch imports, merchant-to-CPA payment tracking, paid status, bank references, and history. Stored state syncs to `mm4_manual_cpa` after signing into that module.
- **MM4-03b · Auto Payment:** P2P transfer tracking and statistics for merchant, CPA, and main accounts. Its `mm403_offline_db_v1` state syncs to `mm4_auto_payment` after signing into that module.

## Shared architecture added

`index.html` and `src/main.jsx` provide the React workspace, dashboard, API center, and account settings. `module-entry.html` and `src/ModuleMicroApp.jsx` mount MM1 and MM4 systems and the developer guide inside React entry pages. Their main browser data stores sync to module-specific MySQL `browser-state` collections after each module’s own sign-in; the pages show the current sync state and retry connection. MM2 systems are native React pages using module-specific MySQL `records` collections and user sessions. `server.py` provides the Python HTTP service, MySQL record storage, user sessions, audit events, and local file uploads.

## MM2 systems

The nine supplied systems now open as native React screens in the MFS dashboard. Each screen has module-specific fields and status choices, a searchable record table, an attention view, CSV export, and record create/edit/delete. Data is stored through the MySQL API in each module’s `records` collection. The original HTML files remain in `MM2/` as source references; the dashboard no longer loads them.

- **MM2-01 · PSS Request & Expense Tracking:** request and clearing compliance, due dates, returns, and timeliness against policy; links to MM4-01.
- **MM2-04 · Inventory Control:** stock records, item identifiers/photos, transfer between locations/departments, and requests/approvals.
- **MM2-05 · Account In Service Database:** account age, project assignment, and which project/company pays expenses.
- **MM2-06 · CP Account In Service Database:** the equivalent service and expense assignment register for CP accounts.
- **MM2-07 · Company & Legal Expense Tracking:** expense records, invoices, due dates, payments, and overdue alerts linked to MM1-06 companies.
- **MM2-08 · Account Balance & Statement Tracking:** statement delivery, last balance, late statements, and repeated lateness.
- **MM2-09 · CPA Salary & Commission:** payment timeliness and history for CPA salary and commission.
- **MM2-12 · Gate & Visa Deposit Tracking:** Gate OTP costs and Visa deposits, monthly amounts, request status, and timeliness.
- **MM2-13 · Fund Recovery Tracking & Timeline:** restricted balances, holders, contact attempts, bank actions, settlement, alerts, and rewards.

Each MM2 module has an API scope (`mm2_*`) for external integrations, a separate login and user list, and private records in its own MySQL module scope. Sign in separately to each module; each MM2 module administrator account is initialized as `admin` / `admin` and can be changed inside that module. The screens persist records through that module’s API in the `records` collection. Field definitions and user-session endpoints are documented in `API.md`. MM2-07 company references may also need the `companies` scope.
