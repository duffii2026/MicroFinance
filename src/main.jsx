import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './account-service.css';
import './mm2-system.css';
import './visual-safety.css';
import './responsive.css';
import { installTablePagination } from './table-pagination.js';
import ModulePasswordDialog from './ModulePasswordDialog.jsx';

// Native MM2 systems are loaded only when opened so the dashboard stays fast.
const MM2System = lazy(() => import('./MM2System.jsx'));
const AccountService = lazy(() => import('./AccountService.jsx'));
const CompanyExpenses = lazy(() => import('./CompanyExpenses.jsx'));
const StatementTracker = lazy(() => import('./StatementTracker.jsx'));
const CpaExpenseTracker = lazy(() => import('./CpaExpenseTracker.jsx'));
const GateVisaTracker = lazy(() => import('./GateVisaTracker.jsx'));
const FundRecoveryTracker = lazy(() => import('./FundRecoveryTracker.jsx'));

const modules = [
  { id: 'central-database', apiId: 'central', group: 'MM1', no: '01', name: 'Central Database', category: 'DATABASE & REPORTING', description: 'The main operations register for accounts, people, companies, gateways, channels, reference codes, currency, and audit activity.', tags: 'Accounts · People · Reports', icon: 'fa-database', file: 'central-database.html', tint: 'blue' },
  { id: 'cpa-control', apiId: 'cpa', group: 'MM1', no: '02', name: 'CPA Control System', category: 'BANKING & PAYMENTS', description: 'Manage bank accounts, balances, assignments, payment control, activity history, and finance reporting.', tags: 'Banking · Balances · Payment control', icon: 'fa-university', file: 'cpa-control.html', tint: 'sky' },
  { id: 'access-credentials', apiId: 'credentials', group: 'MM1', no: '03', name: 'Account Access Credentials', category: 'ACCESS & SECURITY', description: 'Organize portal and account access details, linked accounts, credentials, mobile information, and supporting documents.', tags: 'Accounts · Access · Documents', icon: 'fa-key', file: 'access-credentials.html', tint: 'violet' },
  { id: 'payment-gateways', apiId: 'gateways', group: 'MM1', no: '04', name: 'Payment Gateways', category: 'PAYMENT OPERATIONS', description: 'Maintain gateway and merchant records, location rules, account information, notes, and attachments.', tags: 'Gateways · Rules · Files', icon: 'fa-exchange-alt', file: 'payment-gateways.html', tint: 'mint' },
  { id: 'communication-channel', apiId: 'communications', group: 'MM1', no: '05', name: 'Communication Channel', category: 'TEAM COMMUNICATION', description: 'Maintain team communication channels, positions, user access, and channel ownership information.', tags: 'Channels · Team access · Positions', icon: 'fa-comments', file: 'communication-channel.html', tint: 'blue' },
  { id: 'company-database', apiId: 'companies', group: 'MM1', no: '06', name: 'Company Database', category: 'COMPANY RECORDS', description: 'Manage company profiles, registrations, accounts, contacts, contracts, communication details, and documents.', tags: 'Companies · Registrations · Files', icon: 'fa-building', file: 'company-database.html', tint: 'violet' },
  { id: 'mm2-01-pss-expenses', apiId: 'mm2_pss_expenses', group: 'MM2', no: '01', name: 'PSS Request & Expense Tracking', category: 'REQUEST CLEARING', description: 'Track PSS requests, expense clearing, returns, due dates, and policy timeliness.', tags: 'PSS · Clearing · Timeliness', icon: 'fa-clipboard-list', file: 'MM2-01 · PSS Request and Expense Tracking (1).html', tint: 'blue' },
  { id: 'mm2-04-inventory', apiId: 'mm2_inventory', group: 'MM2', no: '04', name: 'Inventory Control', category: 'STOCK OPERATIONS', description: 'Record stock, item photos, department transfers, and inventory requests.', tags: 'Stock · Transfers · Requests', icon: 'fa-boxes', file: 'MM2-04 · Inventory Control.html', tint: 'mint' },
  { id: 'mm2-05-account-service', apiId: 'mm2_account_service', group: 'MM2', no: '05', name: 'Account In Service Database', category: 'ACCOUNT ASSIGNMENTS', description: 'Track account age, project assignments, and expense responsibility.', tags: 'Accounts · Projects · Expenses', icon: 'fa-user-tag', file: 'MM2-05 · Account In Service Database.html', tint: 'sky' },
  { id: 'mm2-06-cp-account-service', apiId: 'mm2_cp_account_service', group: 'MM2', no: '06', name: 'CP Account In Service Database', category: 'CP ACCOUNT ASSIGNMENTS', description: 'Track CP account age, project assignments, and expense responsibility.', tags: 'CP accounts · Projects · Expenses', icon: 'fa-users', file: 'MM2-06 · CP Account In Service Database.html', tint: 'violet' },
  { id: 'mm2-07-company-expenses', apiId: 'mm2_company_expenses', group: 'MM2', no: '07', name: 'Company & Legal Expenses', category: 'COMPANY OBLIGATIONS', description: 'Monitor company and legal expenses, invoices, due dates, payments, and overdue items.', tags: 'Companies · Legal · Due dates', icon: 'fa-file-invoice-dollar', file: 'MM2-07 · Company and Legal Expense Tracking and Monitoring.html', tint: 'blue' },
  { id: 'mm2-08-statements', apiId: 'mm2_account_statements', group: 'MM2', no: '08', name: 'Account Balance & Statements', category: 'STATEMENT TRACKING', description: 'Track account statement delivery, last balances, delays, and recurring lateness.', tags: 'Balances · Statements · Delays', icon: 'fa-file-alt', file: 'MM2-08 · Accounts Balance and Statement Tracking.html', tint: 'sky' },
  { id: 'mm2-09-cpa-expenses', apiId: 'mm2_cpa_expenses', group: 'MM2', no: '09', name: 'CPA Salary & Commission', category: 'PAYROLL TRACKING', description: 'Track CPA salary and commission payments, timeliness, and payment history.', tags: 'CPA · Salary · Commission', icon: 'fa-coins', file: 'MM2-09 · CPA Expense Tracking Salary  Commission.html', tint: 'mint' },
  { id: 'mm2-12-gate-visa', apiId: 'mm2_gate_visa', group: 'MM2', no: '12', name: 'Gate & Visa Deposits', category: 'DEPOSIT MONITORING', description: 'Monitor Gate OTP costs, Visa deposits, monthly amounts, requests, and payment timeliness.', tags: 'Gate · Visa · Deposits', icon: 'fa-id-card', file: 'MM2-12 · Gate and Visa Deposit Tracking and Monitoring.html', tint: 'violet' },
  { id: 'mm2-13-fund-recovery', apiId: 'mm2_fund_recovery', group: 'MM2', no: '13', name: 'Fund Recovery Timeline', category: 'RECOVERY TRACKING', description: 'Track restricted balances, contacts, bank actions, settlements, timelines, and rewards.', tags: 'Recovery · Timeline · Settlement', icon: 'fa-hand-holding-usd', file: 'MM2-13 · Fund Recovery Tracking and Timeline FRTT.html', tint: 'blue' },
  { id: 'mm4-01-pss-requests', apiId: 'mm4_pss_requests', group: 'MM4', no: '01', name: 'PSS Request & Approval', category: 'REQUESTS & APPROVALS', description: 'Raise, approve, and track PSS requests and expenses from submission through clearing.', tags: 'Requests · Routes · Approval', icon: 'fa-clipboard-check', file: 'MM4-01-PSS-Request-Approval-latest.html', tint: 'blue' },
  { id: 'mm4-03-fund-transfers', apiId: 'mm4_fund_transfers', group: 'MM4', no: '03', name: 'Fund Transfers & Settlement', category: 'SETTLEMENT REPORTING', description: 'Review payment and settlement totals across Manual CPA and Auto Payment workflows.', tags: 'Summary · Settlement · History', icon: 'fa-chart-line', file: 'MM4-03-Fund-Transfers-and-Settlement-latest.html', tint: 'sky' },
  { id: 'mm4-03a-manual-cpa', apiId: 'mm4_manual_cpa', group: 'MM4', no: '03a', name: 'Manual CPA', category: 'MANUAL PAYMENTS', description: 'Import merchant-to-CPA payment batches, mark payments paid, and retain bank references.', tags: 'Batches · Import · Paid status', icon: 'fa-file-invoice-dollar', file: 'MM4-03a-Manual-CPA-latest.html', tint: 'violet' },
  { id: 'mm4-03b-auto-payment', apiId: 'mm4_auto_payment', group: 'MM4', no: '03b', name: 'Auto Payment', category: 'PAYMENT OPERATIONS', description: 'Track P2P transfers and related merchant, CPA, and main account activity.', tags: 'Transfers · Stats · Accounts', icon: 'fa-random', file: 'MM4-03b_Auto_Payment_offline.html', tint: 'mint' },
];
const moduleUrl = (id) => '/module-entry.html?module=' + encodeURIComponent(id);
const ROUTE_STORAGE_KEY = 'mfs-active-route';
const isValidRoute = (route) => route === 'home' || route === 'api' || route === 'account' || (route.startsWith('module/') && modules.some((module) => module.id === route.slice(7)));
const readRoute = () => {
  const fromHash = window.location.hash.slice(1);
  if (isValidRoute(fromHash)) return fromHash;
  try {
    const savedRoute = window.sessionStorage.getItem(ROUTE_STORAGE_KEY);
    if (savedRoute && isValidRoute(savedRoute)) return savedRoute;
  } catch {}
  return 'home';
};

async function request(path, options = {}) {
  const res = await fetch('/api/v1' + path, { credentials: 'same-origin', ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed (' + res.status + ')');
  return data;
}

function Icon({ name }) { return <i className={'fas ' + name} aria-hidden="true" />; }
function App() {
  const [page, setPage] = useState(readRoute);
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 680);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginStatus, setLoginStatus] = useState({ kind: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const activeModule = page.startsWith('module/') ? modules.find((m) => m.id === page.slice(7)) : null;

  const navigate = useCallback((route) => {
    const target = isValidRoute(route) ? route : 'home';
    try { window.sessionStorage.setItem(ROUTE_STORAGE_KEY, target); } catch {}
    setPage(target);
    const nextHash = '#' + target;
    if (window.location.hash !== nextHash) window.history.pushState({}, '', window.location.pathname + window.location.search + nextHash);
    if (target.startsWith('module/')) setSidebarOpen(false); else if (window.innerWidth <= 680) setSidebarOpen(false);
  }, []);
  useEffect(() => {
    const syncRoute = () => setPage(readRoute());
    window.addEventListener('popstate', syncRoute);
    window.addEventListener('hashchange', syncRoute);
    request('/session').then((d) => setUser(d.user || null)).catch(() => {});
    return () => { window.removeEventListener('popstate', syncRoute); window.removeEventListener('hashchange', syncRoute); };
  }, []);
  useEffect(() => {
    if (!isValidRoute(page)) return;
    try { window.sessionStorage.setItem(ROUTE_STORAGE_KEY, page); } catch {}
    const expectedHash = '#' + page;
    if (window.location.hash !== expectedHash) window.history.replaceState({}, '', window.location.pathname + window.location.search + expectedHash);
  }, [page]);
  useEffect(() => { if (activeModule) setSidebarOpen(false); }, [activeModule?.id]);
  useEffect(() => { document.title = activeModule?.name || (page === 'api' ? 'API Center' : page === 'account' ? 'Account settings' : 'Micro Finance Systems'); }, [page, activeModule?.name]);
  useEffect(() => installTablePagination(document.getElementById('root')), []);

  async function signIn(event) { event.preventDefault(); const form = event.currentTarget; const fd = new FormData(form); setBusy(true); setLoginStatus({ kind: '', message: '' }); try { const d = await request('/auth/login', { method: 'POST', body: JSON.stringify({ username: fd.get('username'), password: fd.get('password') }) }); setUser(d.user); setLoginOpen(false); setLoginStatus({ kind: 'success', message: 'Signed in successfully.' }); form.reset(); } catch (e) { setLoginStatus({ kind: 'error', message: e.message }); } finally { setBusy(false); } }
  async function signOut() { setBusy(true); try { await request('/auth/logout', { method: 'POST', body: '{}' }); setUser(null); navigate('home'); setNotice('You have signed out.'); } catch (e) { setNotice(e.message); } finally { setBusy(false); } }
  async function updatePassword(event) { event.preventDefault(); const form = event.currentTarget; const fd = new FormData(form); const submit = form.querySelector('button[type=submit]'); setBusy(true); submit.disabled = true; try { await request('/auth/password', { method: 'POST', body: JSON.stringify({ currentPassword: fd.get('currentPassword'), newPassword: fd.get('newPassword') }) }); form.reset(); setNotice('Password updated successfully.'); } catch (e) { setNotice('Password update failed: ' + e.message); } finally { setBusy(false); submit.disabled = false; } }

  const navItem = (route, title, icon) => <button className={'side-link ' + (page === route ? 'active' : '')} onClick={() => navigate(route)} key={route}><span className="nav-icon"><Icon name={icon} /></span>{title}</button>;
  return <div className={'workspace ' + (sidebarOpen ? '' : 'sidebar-closed')}>
    <style>{`.api-react-page{padding:32px clamp(20px,3.4vw,52px) 42px}.api-react-head{margin-bottom:22px}.api-react-layout{gap:24px}.api-guide-frame,.api-keys-panel{border-radius:14px;box-shadow:0 8px 24px rgba(19,45,68,.07)}.api-keys-panel{padding:25px}.api-guide-frame>div{padding:16px!important}@media(max-width:1000px){.api-react-page{padding:24px 20px 34px}.api-react-layout{gap:18px}.api-keys-panel{padding:21px}}@media(max-width:680px){.api-react-page{padding:18px 14px 28px}.api-react-head{margin-bottom:15px}.api-react-layout{gap:14px}.api-guide-frame,.api-keys-panel{border-radius:10px}.api-guide-frame>div{padding:10px!important}.api-keys-panel{padding:17px 14px}}`}</style>
    <aside className="sidebar" style={sidebarOpen ? { width: '320px', flexBasis: '320px' } : undefined}>
      <a className="brand" href="#home" aria-label="Return to System Overview" onClick={(e) => { e.preventDefault(); navigate('home'); }}><span className="brand-mark">MFS</span><span><strong>Micro Finance Systems</strong><small>WORKSPACE</small></span></a>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="side-nav" aria-label="Workspace navigation">
        {navItem('home', 'System overview', 'fa-th-large')}{navItem('api', 'API Center', 'fa-code')}
        {['MM1', 'MM2', 'MM4'].map((group) => <React.Fragment key={group}><div className="nav-heading">{group} <span>{modules.filter((m) => m.group === group).length.toString().padStart(2, '0')}</span></div>{modules.filter((m) => m.group === group).map((m) => <button key={m.id} className={'module-link ' + (activeModule?.id === m.id ? 'active' : '')} onClick={() => navigate('module/' + m.id)}><span className="module-no">{m.no}</span><span className="module-link-name">{m.name}</span></button>)}</React.Fragment>)}
      </nav>
    </aside>
    <main className="main-area">
      <header className="topbar">
        <button className="menu-toggle" onClick={() => setSidebarOpen((v) => !v)} aria-label={sidebarOpen ? 'Hide navigation' : 'Show navigation'}><Icon name="fa-bars" /></button>
        <div className="breadcrumb"><span>Workspace</span><span className="slash">/</span><b>{activeModule?.name || (page === 'api' ? 'API Center' : page === 'account' ? 'Account settings' : 'System overview')}</b></div>
        <div className="top-actions">
          {activeModule && <button className="plain-action" onClick={() => navigate('home')}><Icon name="fa-arrow-left" /> All systems</button>}
          {user && <><button className="user-action" onClick={() => navigate('account')} aria-label="Open account settings"><Icon name="fa-user-circle" /> {user.username}</button><button className="logout-action" onClick={signOut} disabled={busy}><Icon name="fa-sign-out-alt" /> Log out</button></>}
        </div>
      </header>
      {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}
      {page === 'home' && <HomePage modules={modules} onOpen={(id) => navigate('module/' + id)} />}
      {activeModule && <section className={'module-page ' + (activeModule.group === 'MM2' ? 'native-module-page' : '')}>{activeModule.group === 'MM2' ? <Suspense fallback={<div className="module-loading" role="status">Loading module…</div>}><NativeMM2Module module={activeModule} /></Suspense> : <CompatibilityFrame title={activeModule.name} src={moduleUrl(activeModule.id)} />}</section>}
      {page === 'api' && <ApiPage user={user} onSignIn={() => { setLoginStatus({ kind: '', message: '' }); setLoginOpen(true); }} />}
      {page === 'account' && <AccountPage user={user} onPassword={updatePassword} busy={busy} />}
    </main>
    {loginOpen && <div className="modal-shade" onMouseDown={(e) => { if (e.target === e.currentTarget) setLoginOpen(false); }}><section className="login-modal" role="dialog" aria-modal="true" aria-labelledby="login-title"><button className="modal-close" onClick={() => setLoginOpen(false)} aria-label="Close sign-in">×</button><div className="eyebrow">MFS ADMINISTRATION</div><h2 id="login-title">Administrator sign in</h2><p>Sign in to manage API keys and account settings.</p><form onSubmit={signIn}><label>Username<input name="username" autoComplete="username" required /></label><label>Password<input name="password" type="password" autoComplete="current-password" required /></label>{loginStatus.message && <div className={'form-status ' + loginStatus.kind} role="status">{loginStatus.message}</div>}<button type="submit" className="primary-button" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button></form></section></div>}
  </div>;
}

function NativeMM2Module({ module }) {
  if (['mm2-05-account-service', 'mm2-06-cp-account-service'].includes(module.id)) return <AccountService key={module.id} module={module} />;
  if (module.id === 'mm2-07-company-expenses') return <CompanyExpenses key={module.id} module={module} />;
  if (module.id === 'mm2-08-statements') return <StatementTracker key={module.id} module={module} />;
  if (module.id === 'mm2-09-cpa-expenses') return <CpaExpenseTracker key={module.id} module={module} />;
  if (module.id === 'mm2-12-gate-visa') return <GateVisaTracker key={module.id} module={module} />;
  if (module.id === 'mm2-13-fund-recovery') return <NativePasswordSupport module={module}><FundRecoveryTracker key={module.id} module={module} /></NativePasswordSupport>;
  return <MM2System key={module.id} module={module} />;
}

function NativePasswordSupport({ module, children }) {
  const hostRef = useRef(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const addControl = () => {
      const footer = host.querySelector('.as-sidebar footer, .pss-sidebar footer');
      if (!footer || footer.querySelector('[data-mfs-password]')) return;
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = 'Password'; button.dataset.mfsPassword = 'true';
      button.addEventListener('click', () => setPasswordOpen(true));
      footer.insertBefore(button, footer.querySelector('button') || null);
    };
    addControl();
    const observer = new MutationObserver(addControl);
    observer.observe(host, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [module.id]);
  const moduleRequest = (path, options = {}) => request('/modules/' + encodeURIComponent(module.apiId) + '/' + path, options);
  return <div ref={hostRef}>{children}{passwordOpen && <ModulePasswordDialog request={moduleRequest} onClose={() => setPasswordOpen(false)} />}</div>;
}

function HomePage({ modules: list, onOpen }) {
  return <div className="home-content">
    <section className="welcome"><div><div className="eyebrow">IR GROUP · PSS DEPARTMENT</div><h1>MFS<br /><span>Micro Finance Systems</span></h1><p>One workspace for your financial operations, records, access, and communication tools.</p></div><div className="welcome-seal"><b>MFS</b><span>WORKSPACE</span></div></section>
    <section className="section-heading"><div><div className="eyebrow">YOUR WORKSPACE</div><h2>System modules</h2></div><span className="module-count">{list.length.toString().padStart(2, '0')} SYSTEMS</span></section>
    {['MM1', 'MM2', 'MM4'].map((group) => { const groupModules = list.filter((m) => m.group === group); return <section className="system-group" key={group}><div className="group-heading"><h3>{group}</h3><span>{groupModules.length.toString().padStart(2, '0')} systems</span></div><div className="module-grid">{groupModules.map((m) => <button className={'module-card tint-' + m.tint} key={m.id} onClick={() => onOpen(m.id)}><span className="card-symbol"><Icon name={m.icon} /></span><span className="card-code">{m.group}-{m.no} · {m.category}</span><strong>{m.name}</strong><p>{m.description}</p><span className="card-footer"><span>{m.tags}</span><span className="open-label">Open system <Icon name="fa-arrow-right" /></span></span></button>)}</div></section>; })}
    <footer className="page-footer"><span>MFS · MICRO FINANCE SYSTEMS</span><span>SECURE OPERATIONS WORKSPACE</span></footer>
  </div>;
}
function AccountPage({ user, onPassword, busy }) {
  return <div className="account-content"><div className="eyebrow">ACCOUNT SETTINGS</div><h1>Administrator account</h1><p className="account-intro">Manage your sign-in details.</p><div className="account-grid"><section className="account-card profile-card"><div className="profile-avatar"><Icon name="fa-user" /></div><div><h2>{user?.username || 'Not signed in'}</h2><p>{user?.role || 'Sign in to manage this account.'}</p></div></section><section className="account-card"><h2>Change password</h2><p>Choose a new password for your administrator account.</p><form className="password-form" onSubmit={onPassword}><label>Current password<input type="password" name="currentPassword" autoComplete="current-password" required /></label><label>New password<input type="password" name="newPassword" autoComplete="new-password" required /></label><button type="submit" className="primary-button" disabled={!user || busy}>{busy ? 'Saving…' : 'Update password'}</button></form></section></div></div>;
}

function ApiPage({ user, onSignIn }) {
  const [keys, setKeys] = useState([]); const [keyError, setKeyError] = useState(''); const [keyBusy, setKeyBusy] = useState(false); const [generated, setGenerated] = useState(''); const [scopes, setScopes] = useState(modules.map((m) => m.apiId));
  const isAdmin = user?.role?.toLowerCase() === 'admin';
  const refresh = useCallback(async () => { if (!isAdmin) return; setKeyBusy(true); setKeyError(''); try { const data = await request('/admin/api-keys'); setKeys(data.items || []); } catch (e) { setKeyError(e.message); } finally { setKeyBusy(false); } }, [isAdmin]);
  useEffect(() => { refresh(); }, [refresh]);
  async function createKey(event) { event.preventDefault(); const form = event.currentTarget; const fd = new FormData(form); if (!scopes.length) { setKeyError('Select at least one module.'); return; } setKeyBusy(true); setKeyError(''); setGenerated(''); try { const data = await request('/admin/api-keys', { method: 'POST', body: JSON.stringify({ name: fd.get('name'), modules: scopes, expiresInDays: fd.get('expiresInDays') === 'never' ? null : Number(fd.get('expiresInDays')) }) }); setGenerated(data.apiKey); await refresh(); form.reset(); setScopes(modules.map((m) => m.apiId)); } catch (e) { setKeyError(e.message); } finally { setKeyBusy(false); } }
  async function revokeKey(key) { if (!window.confirm('Revoke access for “' + key.name + '”? Existing integrations will stop working.')) return; try { await request('/admin/api-keys/' + key.id, { method: 'DELETE' }); await refresh(); } catch (e) { setKeyError(e.message); } }
  async function editKey(key) { const name = window.prompt('Integration name:', key.name); if (name === null) return; const selected = window.prompt('Allowed module IDs separated by commas:\n' + modules.map((m) => m.apiId + ' — ' + m.name).join('\n'), key.modules.join(', ')); if (selected === null) return; const expiry = window.prompt('Expiration: enter days, “never”, or leave blank to keep current expiry.', ''); if (expiry === null) return; const body = { name, modules: selected.split(',').map((m) => m.trim()).filter(Boolean) }; if (expiry.trim()) body.expiresInDays = expiry.trim().toLowerCase() === 'never' ? null : Number(expiry.trim()); try { await request('/admin/api-keys/' + key.id, { method: 'PATCH', body: JSON.stringify(body) }); await refresh(); } catch (e) { setKeyError(e.message); } }
  async function copyKey() { try { await navigator.clipboard.writeText(generated); setKeyError('API key copied. Store it securely; it will not be shown again.'); } catch { setKeyError('Copy was blocked by the browser. Select and copy the key manually.'); } }
  return <section className="api-react-page"><div className="api-react-head"><div><div className="eyebrow">DEVELOPER INTEGRATION</div><h1>API Center</h1><p>Manage scoped integration keys and follow the implementation guide.</p></div><span className="module-count">API VERSION 1</span></div><div className="api-react-layout"><section className="api-guide-frame"><CompatibilityFrame title="MFS step-by-step API guide" src="/module-entry.html?guide=api" /></section><aside className="api-keys-panel"><div className="eyebrow">ACCESS MANAGEMENT</div><h2>API keys</h2><p>Create integration keys, select module access, and revoke keys when no longer needed.</p>{!isAdmin ? <div className="key-gate"><p>Sign in with an administrator account to manage API keys.</p><button className="primary-button" onClick={onSignIn}><Icon name="fa-lock" /> Administrator sign in</button></div> : <><form className="key-create-form" onSubmit={createKey}><label>Integration name<input name="name" maxLength="128" placeholder="e.g. Finance reporting" required /></label><label>Expiration<select name="expiresInDays" defaultValue="90"><option value="30">30 days</option><option value="90">90 days</option><option value="365">1 year</option><option value="never">Never expires</option></select></label><div className="scope-heading">MODULE ACCESS <small>Select one or more</small></div><div className="scope-list">{modules.map((m) => <label key={m.apiId}><input type="checkbox" checked={scopes.includes(m.apiId)} onChange={(e) => setScopes((old) => e.target.checked ? [...old, m.apiId] : old.filter((id) => id !== m.apiId))} /><span>{m.group}-{m.no}</span>{m.name}</label>)}</div><button className="primary-button" type="submit" disabled={keyBusy}><Icon name="fa-plus" /> {keyBusy ? 'Working…' : 'Generate API key'}</button></form><div className="key-feedback" role="status">{keyError}</div>{generated && <div className="generated-key"><b>API key created</b><p>Copy it now. The full key cannot be shown again.</p><code>{generated}</code><button className="primary-button" onClick={copyKey}>Copy API key</button></div>}<div className="issued-heading"><b>Issued keys</b><button onClick={refresh} disabled={keyBusy} aria-label="Refresh keys"><Icon name="fa-sync-alt" /></button></div><div className="issued-list">{keys.map((key) => { const expired = key.expiresAt && new Date(key.expiresAt.replace(' ', 'T')) < new Date(); const state = key.revokedAt ? 'Revoked' : expired ? 'Expired' : 'Active'; return <article className="issued-key" key={key.id}><div className="issued-main"><i className={'key-status ' + state.toLowerCase()} /><div><b>{key.name}</b><code>{key.prefix}••••••••</code><small>{key.modules.length} modules · {key.lastUsedAt ? 'Last used ' + key.lastUsedAt : 'Never used'}</small></div><span>{state}</span></div>{state === 'Active' && <div className="issued-actions"><button onClick={() => editKey(key)}>Edit access</button><button onClick={() => revokeKey(key)}>Revoke</button></div>}</article>; })}{!keys.length && !keyBusy && <p className="empty-keys">No API keys have been generated yet.</p>}</div></>}</aside></div></section>;
}

function CompatibilityFrame({ title, src }) {
  const frameSrc = src === '/module-entry.html?guide=api' ? '/legacy/api-guide.html' : src;
  const isApiGuide = title === 'MFS step-by-step API guide';
  const [guideHeight, setGuideHeight] = useState(null);
  function enforceTextSize(event) {
    try {
      const doc = event.currentTarget.contentDocument;
      if (!doc || doc.getElementById('mfs-readable-type')) return;
      const style = doc.createElement('style');
      style.id = 'mfs-readable-type';
      doc.head.appendChild(style);
      const raiseSmallText = (root) => {
        if (root.nodeType === 1 && Number.parseFloat(doc.defaultView.getComputedStyle(root).fontSize) < 15) root.style.setProperty('font-size', '15px', 'important');
        if (root.querySelectorAll) root.querySelectorAll('*').forEach((node) => { if (Number.parseFloat(doc.defaultView.getComputedStyle(node).fontSize) < 15) node.style.setProperty('font-size', '15px', 'important'); });
      };
      raiseSmallText(doc.body);
      new MutationObserver((changes) => changes.forEach((change) => change.addedNodes.forEach(raiseSmallText))).observe(doc.body, { childList: true, subtree: true });
      if (isApiGuide) {
        setGuideHeight(Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight, 900));
        if (!doc.documentElement.dataset.mfsScrollBridge) {
          doc.documentElement.dataset.mfsScrollBridge = 'true';
          doc.addEventListener('wheel', (wheelEvent) => {
            const pageScroller = window.document.querySelector('.api-react-page');
            if (!pageScroller) return;
            pageScroller.scrollBy({ top: wheelEvent.deltaY, left: wheelEvent.deltaX, behavior: 'auto' });
            wheelEvent.preventDefault();
          }, { passive: false });
        }
      }
    } catch {}
  }
  if (isApiGuide) return <div style={{ padding: '12px', background: '#f7fafc' }}><iframe title={title} src={frameSrc} scrolling="no" onLoad={enforceTextSize} style={{ height: guideHeight ? `${guideHeight}px` : '900px' }} /></div>;
  return <iframe title={title} src={frameSrc} scrolling="yes" onLoad={enforceTextSize} />;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
