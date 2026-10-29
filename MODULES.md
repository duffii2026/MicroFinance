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

`index.html` presents a single module directory. `app.js` opens the preserved tools inside a module workspace. `server.py` provides a Python HTTP service, MySQL metadata/record storage, user sessions, audit events, and local file uploads. API record storage is a future integration target: the six legacy modules currently retain their own browser-side storage and have not been modified to write into MySQL. That keeps existing module behavior and sample data intact while making the new backend ready for incremental integration.
