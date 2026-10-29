const MODULES = [
  { id: 'central', code: 'MM1-01', short: '01', icon: 'fa-database', mark: 'PGD', title: 'Central Database', file: 'modules/central-database.html', group: 'DATABASE & REPORTING', description: 'The main operations register for accounts, people, companies, gateways, channels, reference codes, currency, and audit activity.', tasks: 'Accounts · People · Reports', collections: ['people','companies','gateways','merchant-accounts','accounts','rates','reference-codes','systems','uploads'], apiGuide: 'Financial registers, people, companies, gateway and merchant accounts, reference codes, exchange rates, systems, imports, and snapshots. The legacy screen keeps separate registers such as mac, mca, pc, skac, and skap; choose a mapping and preserve source IDs.' },
  { id: 'cpa', code: 'MM1-02', short: '02', icon: 'fa-university', mark: 'CPA', title: 'CPA Control System', file: 'modules/cpa-control.html', group: 'BANKING & PAYMENTS', description: 'Manage bank accounts, balances, assignments, payment control, activity history, and finance reporting.', tasks: 'Banking · Balances · Payment control', collections: ['accounts','people','agents','pay-statements','uploads','snapshots','audit'], apiGuide: 'Bank and payment accounts, account balances and status history, people and agent assignments, payroll/commission statements, uploads, date snapshots, and audit activity. The screen state groups accounts, persons, agents, companies, pay statements, uploads, and snapshots.' },
  { id: 'credentials', code: 'MM1-03', short: '03', icon: 'fa-key', mark: 'ACC', title: 'Account Access Credentials', file: 'modules/access-credentials.html', group: 'ACCESS & SECURITY', description: 'Organize portal and account access details, linked accounts, credentials, mobile information, and supporting documents.', tasks: 'Accounts · Access · Documents', collections: ['accounts','access','users','settings','history','log','documents','memos'], apiGuide: 'Linked accounts and access entries, access type/status, staff permissions, attached files, memos, and change history. Internal screen buckets include accounts, access, users, settings, hist/log, and document data.' },
  { id: 'gateways', code: 'MM1-04', short: '04', icon: 'fa-exchange-alt', mark: 'PAY', title: 'Payment Gateways', file: 'modules/payment-gateways.html', group: 'PAYMENT OPERATIONS', description: 'Maintain gateway and merchant records, location rules, account information, notes, and attachments.', tasks: 'Gateways · Rules · Files', collections: ['gateways','merchants','locations','rules','contracts','rates','memos','documents'], apiGuide: 'Gateway setup, merchant relationships, locations, CPA mapping rules, contracts/rates, memos, and related files. Merchant links should use stable gateway IDs; internal buckets include gateways, merchants, settings, history, log, and document data.' },
  { id: 'communications', code: 'MM1-05', short: '05', icon: 'fa-comments', mark: 'COM', title: 'Communication Channel', file: 'modules/communication-channel.html', group: 'TEAM COMMUNICATION', description: 'Maintain team communication channels, positions, user access, and channel ownership information.', tasks: 'Channels · Team access · Positions', collections: ['channels','users','settings','log'], apiGuide: 'Channel/contact records with type, address, project, purpose, owner, linked service, status, sheet/group number, notes, and date added. The source screen stores channel data plus settings, user access, and activity log.' },
  { id: 'companies', code: 'MM1-06', short: '06', icon: 'fa-building', mark: 'CO', title: 'Company Database', file: 'modules/company-database.html', group: 'COMPANY RECORDS', description: 'Manage company profiles, registrations, accounts, contacts, contracts, communication details, and documents.', tasks: 'Companies · Registrations · Files', collections: ['companies','users','history','log','documents','memos'], apiGuide: 'Company profiles, ownership/contact details, registrations and linked accounts/merchant records, files, memos, and history. Preserve stable company IDs when linking a company to its gateway or merchant records.' },
];

const $ = (selector) => document.querySelector(selector);
const nav = $('#moduleNav');
const grid = $('#moduleGrid');
const state = { user: null, keyItems: [] };
const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

nav.innerHTML = MODULES.map((m) => `<button class="module-nav" data-module="${m.id}"><span class="mini-no">${m.short}</span><span class="mini-name">${esc(m.title)}</span></button>`).join('');
grid.innerHTML = MODULES.map((m) => `<article class="module-card" role="button" tabindex="0" data-module="${m.id}" aria-label="Open ${esc(m.title)}"><div class="card-top"><span class="card-symbol" aria-hidden="true"><i class="fas ${m.icon}"></i></span><span class="card-arrow">↗</span></div><div class="card-code">${m.code} · ${m.group}</div><h3>${esc(m.title)}</h3><p>${esc(m.description)}</p><div class="card-footer"><span>${m.tasks}</span><span>Open system&nbsp; →</span></div></article>`).join('');

async function api(path, options = {}) {
  const response = await fetch(`/api/v1${path}`, { credentials: 'same-origin', ...options, headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(options.headers || {}) } });
  const type = response.headers.get('content-type') || '';
  const result = type.includes('json') ? await response.json() : await response.blob();
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
  return result;
}

function showHome() {
  $('#homeView').hidden = false;
  $('#moduleView').hidden = true;
  $('#apiView').hidden = true;
  $('#accountView').hidden = true;
  $('#returnHome').hidden = true;
  $('#crumbRoot').textContent = 'Workspace';
  $('#crumbTitle').textContent = 'System overview';
  document.querySelectorAll('.nav-item,.module-nav').forEach((item) => item.classList.toggle('active', item.dataset.page === 'home'));
  history.replaceState(null, '', '#home');
  $('#sidebar').classList.remove('open');
}

function showApiCenter() {
  $('#homeView').hidden = true; $('#moduleView').hidden = true; $('#apiView').hidden = false;
  $('#accountView').hidden = true;
  $('#returnHome').hidden = true; $('#crumbRoot').textContent = 'Workspace';
  $('#crumbTitle').textContent = 'API Center';
  document.querySelectorAll('.nav-item,.module-nav').forEach((item) => item.classList.toggle('active', item.dataset.page === 'api'));
  history.replaceState(null, '', '#api'); $('#sidebar').classList.remove('open');
  $('#apiBaseUrl').textContent = `${location.origin}/api/v1`;
  renderApiDocs(); window.mfsHighlightCode?.($('#quickStartCode')); updateKeyAccess();
  if (state.user?.role?.toLowerCase() === 'admin') loadApiKeys();
}

function showAccount() {
  if (!state.user) { showLogin(); return; }
  $('#homeView').hidden = true; $('#moduleView').hidden = true; $('#apiView').hidden = true; $('#accountView').hidden = false;
  $('#returnHome').hidden = true; $('#crumbRoot').textContent = 'Workspace';
  $('#crumbTitle').textContent = 'Account settings';
  document.querySelectorAll('.nav-item,.module-nav').forEach((item) => item.classList.remove('active'));
  $('#accountName').textContent = state.user.username;
  $('#accountRole').textContent = state.user.role;
  $('#accountAvatar').textContent = state.user.username?.[0]?.toUpperCase() || 'A';
  history.replaceState(null, '', '#account'); $('#sidebar').classList.remove('open');
}

function renderApiDocs() {
  $('#moduleApiList').innerHTML = MODULES.map((m, index) => `<details class="module-api-item" ${index === 0 ? 'open' : ''}><summary><span class="module-api-icon"><i class="fas ${m.icon}"></i></span><span class="module-api-name"><b>${m.code} · ${esc(m.title)}</b><small>${esc(m.group)}</small></span><span class="collection-count">${m.collections.length} COLLECTIONS</span><i class="fas fa-chevron-down api-chevron"></i></summary><div class="module-api-body"><p><b>Workflow mapping:</b> ${esc(m.apiGuide)}</p><p>API module ID: <code>${m.id}</code> · Suggested collection labels: ${m.collections.map((c) => `<code>${esc(c)}</code>`).join(' ')}</p><p>Example base route: <code>/modules/${m.id}/collections/{collection}</code></p>${['GET','POST','POST','DELETE'].map((method, i) => `<div class="endpoint-row"><span class="method method-${method.toLowerCase()}">${method}</span><code>${['/modules/'+m.id+'/collections/{collection}','/modules/'+m.id+'/collections/{collection}','/modules/'+m.id+'/collections/{collection}/{id}','/modules/'+m.id+'/collections/{collection}/{id}'][i]}</code><small>${['List records','Create record','Replace record','Delete record'][i]}</small></div>`).join('')}</div></details>`).join('');
  $('#moduleApiCount').textContent = `${String(MODULES.length).padStart(2,'0')} MODULES`;
  $('#quickStartCode').removeAttribute('data-syntax-ready');
  $('#quickStartCode').textContent = `curl "${location.origin}/api/v1/modules/central/collections/accounts" \\\n  -H "Authorization: Bearer YOUR_MFS_API_KEY" \\\n  -H "Accept: application/json"`;
}

function updateKeyAccess() {
  const isAdmin = state.user?.role?.toLowerCase() === 'admin';
  $('#keyAdminGate').hidden = isAdmin; $('#keyAdminContent').hidden = !isAdmin;
  $('#keyScopes').innerHTML = MODULES.map((m) => `<label class="scope-option"><input type="checkbox" name="module" value="${m.id}" checked><span>${m.short}</span>${esc(m.title)}</label>`).join('');
}

async function loadApiKeys() {
  if (state.user?.role?.toLowerCase() !== 'admin') return;
  const list = $('#apiKeyList'); list.innerHTML = '<div class="key-empty">Loading API keys…</div>';
  try { const result = await api('/admin/api-keys'); state.keyItems = result.items; renderApiKeys(); }
  catch (error) { list.innerHTML = `<div class="key-empty">${esc(error.message)}</div>`; }
}

function renderApiKeys() {
  const list = $('#apiKeyList');
  if (!state.keyItems.length) { list.innerHTML = '<div class="key-empty"><i class="fas fa-key"></i><b>No API keys yet</b><span>Generate a key for your first integration.</span></div>'; return; }
  list.innerHTML = state.keyItems.map((key) => { const revoked = !!key.revokedAt, expired = key.expiresAt && new Date(key.expiresAt.replace(' ', 'T')) < new Date(); const status = revoked ? 'Revoked' : expired ? 'Expired' : 'Active'; return `<article class="api-key-item ${revoked || expired ? 'key-inactive' : ''}"><div class="api-key-main"><span class="key-status ${status.toLowerCase()}"></span><div><b>${esc(key.name)}</b><code>${esc(key.prefix)}••••••••</code><small>${key.modules.length} modules · ${key.lastUsedAt ? `Last used ${esc(key.lastUsedAt)}` : 'Never used'}</small></div><span class="key-status-label">${status}</span></div><div class="api-key-actions">${!revoked && !expired ? `<button data-key-edit="${key.id}"><i class="fas fa-sliders-h"></i> Edit access</button><button class="revoke-key" data-key-revoke="${key.id}"><i class="fas fa-ban"></i> Revoke</button>` : ''}</div></article>`; }).join('');
}

function showGeneratedKey(key) {
  const list = $('#apiKeyList');
  const row = document.createElement('div'); row.className = 'new-key-notice';
  row.innerHTML = `<b><i class="fas fa-check-circle"></i> API key created</b><p>Copy it now. The full key cannot be shown again.</p><div class="new-key-value"><code>${esc(key)}</code><button type="button" aria-label="Copy API key"><i class="far fa-copy"></i> Copy</button></div>`;
  list.prepend(row); row.querySelector('button').addEventListener('click', async () => { await navigator.clipboard.writeText(key); row.querySelector('button').innerHTML = '<i class="fas fa-check"></i> Copied'; });
}

function openModule(id) {
  const module = MODULES.find((item) => item.id === id);
  if (!module) return;
  $('#homeView').hidden = true;
  $('#moduleView').hidden = false;
  $('#apiView').hidden = true;
  $('#accountView').hidden = true;
  $('#returnHome').hidden = false;
  $('#crumbRoot').textContent = 'MFS';
  $('#crumbTitle').textContent = module.title;
  document.querySelectorAll('.nav-item,.module-nav').forEach((item) => item.classList.toggle('active', item.dataset.module === id));
  $('#frameLoading').classList.remove('done');
  const frame = $('#moduleFrame');
  frame.src = module.file;
  frame.onload = () => $('#frameLoading').classList.add('done');
  history.replaceState(null, '', `#${id}`);
  setSidebarCollapsed(true);
}

function setSidebarCollapsed(collapsed) {
  document.body.classList.toggle('sidebar-collapsed', collapsed);
  const toggle = $('#mobileMenu');
  toggle.setAttribute('aria-expanded', String(!collapsed));
  toggle.setAttribute('aria-label', collapsed ? 'Show navigation' : 'Hide navigation');
  toggle.title = collapsed ? 'Show navigation' : 'Hide navigation';
  toggle.textContent = collapsed ? '☰' : '‹';
  try { localStorage.setItem('mfs-sidebar-collapsed', String(collapsed)); } catch {}
}

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-module]');
  if (target) openModule(target.dataset.module);
  if (event.target.closest('[data-page="home"]') || event.target.closest('#returnHome')) showHome();
  if (event.target.closest('[data-page="api"]') || event.target.closest('#apiDocs')) showApiCenter();
  if (event.target.closest('#accountLink, #topUser')) showAccount();
  const revoke = event.target.closest('[data-key-revoke]');
  if (revoke) { const key = state.keyItems.find((item) => item.id === revoke.dataset.keyRevoke); if (key && window.confirm(`Revoke access for “${key.name}”? Existing integrations will stop working.`)) api(`/admin/api-keys/${key.id}`, { method: 'DELETE' }).then(loadApiKeys).catch((e) => alert(e.message)); }
  const edit = event.target.closest('[data-key-edit]');
  if (edit) {
    const key = state.keyItems.find((item) => item.id === edit.dataset.keyEdit); if (!key) return;
    const name = window.prompt('Integration name:', key.name); if (name === null) return;
    const scopes = window.prompt(`Allowed module IDs separated by commas:\n${MODULES.map((m) => `${m.id} — ${m.title}`).join('\n')}`, key.modules.join(', ')); if (scopes === null) return;
    const expiry = window.prompt('Expiration: enter a number of days, "never", or leave blank to keep current expiry.', ''); if (expiry === null) return;
    const body = { name, modules: scopes.split(',').map((s) => s.trim()).filter(Boolean) };
    if (expiry.trim()) body.expiresInDays = expiry.trim().toLowerCase() === 'never' ? null : Number(expiry.trim());
    api(`/admin/api-keys/${key.id}`, { method: 'PATCH', body: JSON.stringify(body) }).then(loadApiKeys).catch((e) => alert(e.message));
  }
});
grid.addEventListener('keydown', (event) => {
  if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-module]')) {
    event.preventDefault(); openModule(event.target.dataset.module);
  }
});
$('#mobileMenu').addEventListener('click', () => {
  if (window.matchMedia('(max-width: 680px)').matches) {
    const sidebar = $('#sidebar');
    const opened = sidebar.classList.toggle('open');
    $('#mobileMenu').setAttribute('aria-expanded', String(opened));
    $('#mobileMenu').setAttribute('aria-label', opened ? 'Hide navigation' : 'Show navigation');
    return;
  }
  setSidebarCollapsed(!document.body.classList.contains('sidebar-collapsed'));
});
$('#copyBaseUrl').addEventListener('click', async () => { await navigator.clipboard.writeText($('#apiBaseUrl').textContent); $('#copyBaseUrl').innerHTML = '<i class="fas fa-check"></i>'; });
$('#copyQuickStart').addEventListener('click', async () => { await navigator.clipboard.writeText($('#quickStartCode').textContent); $('#copyQuickStart').innerHTML = '<i class="fas fa-check"></i> Copied'; });
$('#accountReturn').addEventListener('click', showHome);
$('#passwordForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const formElement = event.currentTarget;
  const form = new FormData(formElement);
  const currentPassword = String(form.get('currentPassword') || '');
  const newPassword = String(form.get('newPassword') || '');
  const confirmPassword = String(form.get('confirmPassword') || '');
  $('#passwordError').textContent = ''; $('#passwordSuccess').hidden = true;
  if (!newPassword) { $('#passwordError').textContent = 'New password cannot be empty.'; return; }
  if (newPassword !== confirmPassword) { $('#passwordError').textContent = 'The new password and confirmation do not match.'; return; }
  const button = $('#savePassword'); button.disabled = true;
  try {
    await api('/auth/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
    formElement.reset(); $('#passwordSuccess').hidden = false;
  } catch (error) { $('#passwordError').textContent = error.message; }
  finally { button.disabled = false; }
});
$('#refreshKeys').addEventListener('click', loadApiKeys);
$('#apiSignIn').addEventListener('click', showLogin);
$('#createKeyForm').addEventListener('submit', async (event) => {
  event.preventDefault(); $('#keyFormError').textContent = '';
  const form = new FormData(event.currentTarget); const modules = form.getAll('module');
  try { const result = await api('/admin/api-keys', { method: 'POST', body: JSON.stringify({ name: form.get('name'), modules, expiresInDays: form.get('expiresInDays') === 'never' ? null : Number(form.get('expiresInDays')) }) }); await loadApiKeys(); showGeneratedKey(result.apiKey); event.currentTarget.reset(); event.currentTarget.querySelectorAll('[name="module"]').forEach((input) => { input.checked = true; }); }
  catch (error) { $('#keyFormError').textContent = error.message; }
});

const backdrop = $('#modalBackdrop');
function showLogin() { backdrop.hidden = false; $('#formError').textContent = ''; $('#modalTitle').textContent = 'Sign in to MFS'; $('#modalIntro').textContent = 'Use the local administrator account to access the API and file service.'; $('#loginForm').elements.password.value = ''; }
function closeLogin() { backdrop.hidden = true; }
$('#modalClose').addEventListener('click', closeLogin);
$('#loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const submit = event.currentTarget.querySelector('button[type="submit"]');
  submit.disabled = true;
  $('#formError').textContent = '';
  try {
    const result = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: form.get('username'), password: form.get('password') }) });
    closeLogin(); setUser(result.user);
    if (location.hash === '#account') showAccount();
    else if (MODULES.some((m) => m.id === location.hash.slice(1))) openModule(location.hash.slice(1));
  } catch (error) { $('#formError').textContent = error.message; }
  finally { submit.disabled = false; }
});

function setUser(user) {
  state.user = user;
  $('#userName').textContent = user?.username || 'Local workspace';
  $('#userRole').textContent = user?.role || 'Not signed in';
  $('#userAvatar').textContent = user?.username?.[0]?.toUpperCase() || 'A';
  $('#accountName').textContent = user?.username || 'Local workspace';
  $('#accountRole').textContent = user?.role || '';
  $('#accountAvatar').textContent = user?.username?.[0]?.toUpperCase() || 'A';
  $('#topUser').hidden = !user;
  $('#topUserName').textContent = user?.username || '';
  $('#signOut').hidden = !user;
  updateKeyAccess();
  if (!$('#apiView').hidden && user?.role?.toLowerCase() === 'admin') loadApiKeys();
}
$('#signOut').addEventListener('click', async () => {
  try { await api('/auth/logout', { method: 'POST', body: '{}' }); } catch {}
  setUser(null); showLogin();
});

async function refreshHealth() {
  try {
    const state = await api('/health');
    $('#statusDot').classList.add('online'); $('#serverStatus').textContent = 'Local service online';
    $('#healthBadge').classList.add('online'); $('#healthBadge').textContent = 'Online'; $('#apiState').textContent = `${state.service} · ${state.version}`;
  } catch {
    $('#statusDot').classList.remove('online'); $('#serverStatus').textContent = 'Service unavailable';
    $('#healthBadge').classList.remove('online'); $('#healthBadge').textContent = 'Offline'; $('#apiState').textContent = 'Start the local service';
  }
}
async function refreshSession() {
  try {
    const session = await api('/session');
    if (session.authenticated) {
      setUser(session.user);
      if (location.hash === '#account') { closeLogin(); showAccount(); }
      else if (MODULES.some((m) => m.id === location.hash.slice(1))) openModule(location.hash.slice(1));
    } else {
      setUser(null);
      showLogin();
    }
  } catch { setUser(null); }
}

try { setSidebarCollapsed(localStorage.getItem('mfs-sidebar-collapsed') === 'true'); } catch {}
const route = location.hash.slice(1);
if (route === 'api') showApiCenter();
else if (route === 'account') { /* wait for the restored sign-in session */ }
else if (!MODULES.some((m) => m.id === route)) showHome();
refreshHealth(); refreshSession();


