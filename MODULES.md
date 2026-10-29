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

## Shared architecture added

`index.html` and `src/main.jsx` provide the React workspace, dashboard, API center, and account settings. `module-entry.html` and `src/ModuleMicroApp.jsx` mount each system and the developer guide inside isolated React entry pages. The superseded standalone dashboard files have been removed. The six module screens and their business logic still use the preserved HTML/JavaScript assets under `public/legacy/` while they are migrated, so their browser-side data remains separate and is not automatically written to MySQL. `server.py` provides the Python HTTP service, MySQL record storage, user sessions, audit events, and local file uploads.
