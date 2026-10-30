import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './mm2-system.css';

const statusOptions = ['Open', 'In progress', 'Complete', 'On hold'];
const fields = (items) => items.map(([key, label, type = 'text', options]) => ({ key, label, type, options }));
const definitions = {
  'mm2-01-pss-expenses': { api: 'mm2_pss_expenses', title: 'PSS Request & Expense Tracking', category: 'REQUEST CLEARING', icon: 'fa-clipboard-list', description: 'Track request clearing, policy timeliness, returns, and approval outcomes. Amounts are intentionally not recorded in this tracker.', status: ['Submitted', 'Approved', 'Returned', 'Rejected', 'Cleared'], fields: fields([['reference','Request reference'],['requester','Requested by'],['route','Approval route'],['submittedAt','Submitted date','date'],['dueDate','Clearing due date','date'],['clearedAt','Cleared date','date'],['status','Status','select',['Submitted','Approved','Returned','Rejected','Cleared']],['notes','Notes','textarea']]), columns: ['reference','requester','route','dueDate','status'] },
  'mm2-04-inventory': { api: 'mm2_inventory', title: 'Inventory Control', category: 'STOCK OPERATIONS', icon: 'fa-boxes', description: 'Maintain stock items, their condition and location, and transfer or photo request status.', status: ['In stock', 'Issued', 'Transfer pending', 'Transferred', 'Photo requested', 'Retired'], fields: fields([['itemNo','Inventory number'],['name','Item name'],['category','Category'],['location','Stock location','select',['Stock1 BO','Stock2 BO','Stock3 TW','Transferred out']],['condition','Condition','select',['OK','Damaged','Lost']],['holder','Current holder'],['department','Department'],['status','Status','select',['In stock','Issued','Transfer pending','Transferred','Photo requested','Retired']],['description','Description','textarea']]), columns: ['itemNo','name','category','location','holder','status'] },
  'mm2-05-account-service': { api: 'mm2_account_service', title: 'Account In Service Database', category: 'ACCOUNT ASSIGNMENTS', icon: 'fa-user-tag', description: 'Track account service periods, project assignments, account status, and expense responsibility.', status: ['In service', 'Closed', 'Moved'], fields: fields([['accountNo','Account number'],['bank','Bank'],['holder','Account holder'],['project','Assigned project'],['company','Company'],['startedAt','Service start date','date'],['ageMonths','Age (months)','number'],['expensePayer','Expense paid by'],['status','Status','select',['In service','Closed','Moved']],['notes','Notes','textarea']]), columns: ['accountNo','bank','holder','project','startedAt','status'] },
  'mm2-06-cp-account-service': { api: 'mm2_cp_account_service', title: 'CP Account In Service Database', category: 'CP ACCOUNT ASSIGNMENTS', icon: 'fa-users', description: 'Track CP account service periods, project assignments, account status, and expense responsibility.', status: ['In service', 'Closed', 'Moved'], fields: fields([['accountNo','CP account number'],['bank','Bank'],['holder','Account holder'],['project','Assigned project'],['company','Company'],['startedAt','Service start date','date'],['ageMonths','Age (months)','number'],['expensePayer','Expense paid by'],['status','Status','select',['In service','Closed','Moved']],['notes','Notes','textarea']]), columns: ['accountNo','bank','holder','project','startedAt','status'] },
  'mm2-07-company-expenses': { api: 'mm2_company_expenses', title: 'Company & Legal Expenses', category: 'COMPANY OBLIGATIONS', icon: 'fa-file-invoice-dollar', description: 'Monitor company and legal obligations, invoice references, payments, and due dates.', status: ['Open', 'Part paid', 'Paid', 'Overdue', 'Cancelled'], fields: fields([['companyCode','Company code'],['company','Company name'],['group','Expense group','select',['Company','Legal']],['category','Category'],['payee','Payee'],['amount','Amount (USD)','number'],['dueDate','Due date','date'],['invoice','Invoice reference'],['paidAmount','Paid amount (USD)','number'],['status','Payment status','select',['Open','Part paid','Paid','Overdue','Cancelled']],['notes','Notes','textarea']]), columns: ['company','group','category','amount','dueDate','status'] },
  'mm2-08-statements': { api: 'mm2_account_statements', title: 'Account Balance & Statements', category: 'STATEMENT TRACKING', icon: 'fa-file-alt', description: 'Record statement delivery, reporting periods, last balances, and late statement follow-up.', status: ['Awaiting', 'Received', 'Late', 'Acknowledged'], fields: fields([['accountNo','Account number'],['bank','Bank'],['holder','Account holder'],['department','Department'],['statementMonth','Statement month','month'],['dueDate','Expected by','date'],['receivedAt','Received date','date'],['lastBalance','Closing balance','number'],['currency','Currency'],['status','Status','select',['Awaiting','Received','Late','Acknowledged']],['reason','Delay reason','textarea']]), columns: ['accountNo','holder','statementMonth','dueDate','receivedAt','status'] },
  'mm2-09-cpa-expenses': { api: 'mm2_cpa_expenses', title: 'CPA Salary & Commission', category: 'PAYROLL TRACKING', icon: 'fa-coins', description: 'Track CPA salary and commission payment schedules, receipt dates, late payments, and history. Payment amounts are not recorded in this tracker.', status: ['Pending', 'Paid on time', 'Paid late', 'Not due'], fields: fields([['agent','Agent'],['company','Company'],['person','Payee'],['payType','Payment type','select',['Salary','Commission']],['month','Payment month','month'],['expectedDate','Expected date','date'],['receivedDate','Date received','date'],['status','Status','select',['Pending','Paid on time','Paid late','Not due']],['reference','Payment reference'],['notes','Notes','textarea']]), columns: ['agent','person','payType','month','expectedDate','status'] },
  'mm2-12-gate-visa': { api: 'mm2_gate_visa', title: 'Gate & Visa Deposits', category: 'DEPOSIT MONITORING', icon: 'fa-id-card', description: 'Monitor monthly Gate OTP costs and Visa deposits by account, including request and payment status.', status: ['Open', 'Requested', 'Paid', 'Late'], fields: fields([['account','Account'],['type','Account type','select',['+Gate (OTP cost)','Visa deposit']],['project','Project'],['month','Month','month'],['depositAmount','Deposit amount','number'],['otpCost','OTP cost','number'],['requestedBy','Requested by'],['paidDate','Paid date','date'],['status','Status','select',['Open','Requested','Paid','Late']],['notes','Notes','textarea']]), columns: ['account','type','project','month','depositAmount','status'] },
  'mm2-13-fund-recovery': { api: 'mm2_fund_recovery', title: 'Fund Recovery Timeline', category: 'RECOVERY TRACKING', icon: 'fa-hand-holding-usd', description: 'Coordinate restricted-balance recovery, contact attempts, bank milestones, settlements, and rewards.', status: ['Open', 'Contacting', 'Bank review', 'Legal review', 'Cleared', 'Closed'], fields: fields([['account','Account name'],['accountNo','Account number'],['bank','Bank / wallet'],['holder','Holder'],['agent','Assigned agent'],['project','Project / PSS code'],['balance','Restricted balance (USD)','number'],['openedAt','Opened date','date'],['tier','Priority tier','select',['Tier 1','Tier 2','Tier 3']],['step','Current milestone','select',['Initial review','Contact holder','Submit documents','Bank follow-up','Legal review','Settlement']],['status','Recovery status','select',['Open','Contacting','Bank review','Legal review','Cleared','Closed']],['nextAction','Next action'],['nextActionDate','Next action date','date'],['clearedAmount','Cleared amount (USD)','number'],['clearedDate','Cleared date','date'],['notes','Case notes','textarea']]), columns: ['account','holder','agent','tier','step','status','nextActionDate'] },
};

// The former MM2 HTML pages carried these records in offlineSeed JSON. Keep
// those original values in MySQL and map the account/statement rows into the
// React tables so the converted screens do not open as empty registers.
const legacySeedFiles = {
  'mm2-01-pss-expenses': 'MM2-01 · PSS Request and Expense Tracking (1).html',
  'mm2-04-inventory': 'MM2-04 · Inventory Control.html',
  'mm2-05-account-service': 'MM2-05 · Account In Service Database.html',
  'mm2-06-cp-account-service': 'MM2-06 · CP Account In Service Database.html',
  'mm2-07-company-expenses': 'MM2-07 · Company and Legal Expense Tracking and Monitoring.html',
  'mm2-08-statements': 'MM2-08 · Accounts Balance and Statement Tracking.html',
  'mm2-09-cpa-expenses': 'MM2-09 · CPA Expense Tracking Salary  Commission.html',
  'mm2-12-gate-visa': 'MM2-12 · Gate and Visa Deposit Tracking and Monitoring.html',
  'mm2-13-fund-recovery': 'MM2-13 · Fund Recovery Tracking and Timeline FRTT.html',
};
const legacyStateKeys = {
  'mm2-05-account-service': ['mm205_offline_db_v1'],
  'mm2-06-cp-account-service': ['mm206_offline_db_v1'],
  'mm2-08-statements': ['mm208_offline_db_v1'],
};

function legacyRows(moduleId, seed) {
  if (moduleId === 'mm2-01-pss-expenses') return Object.entries(seed).map(([id, row]) => ({ id: 'legacy-' + id, reference: row.ref || row.key || id, requester: row.requester || '', route: row.routeName || row.route || '', submittedAt: row.submittedOn || '', dueDate: row.dueDate || '', clearedAt: row.completedOn || '', status: ({ DONE: 'Cleared', COMPLETE: 'Cleared', RETURNED: 'Returned', REJECTED: 'Rejected', APPROVED: 'Approved', SUBMITTED: 'Submitted', PENDING: 'Submitted' })[String(row.status || '').toUpperCase()] || 'Submitted', notes: [row.purpose, row.lastNote].filter(Boolean).join(' · ') }));
  if (moduleId === 'mm2-04-inventory') return Object.entries(seed.items || {}).map(([id, row]) => ({ id: 'legacy-' + id, itemNo: row.invNo || row.serial || id, name: row.name || '', category: row.category || '', location: ({ S1: 'Stock1 BO', S2: 'Stock2 BO', S3: 'Stock3 TW', OUT: 'Transferred out' })[row.location] || row.location || '', condition: row.condition || 'OK', holder: row.holderName || '', department: row.holderDept || '', status: row.location === 'OUT' ? 'Transferred' : row.condition === 'Lost' ? 'Retired' : row.holderName ? 'Issued' : 'In stock', description: row.description || row.serial || '' }));
  if (moduleId === 'mm2-07-company-expenses') return Object.entries(seed.expenses || {}).map(([id, row]) => ({ id: 'legacy-' + id, companyCode: row.companyCode || '', company: seed.companies?.[row.companyCode]?.name || row.companyCode || '', group: String(row.group || '').toLowerCase().includes('legal') ? 'Legal' : 'Company', category: row.category || '', payee: row.payee || '', amount: row.amount ?? '', dueDate: row.dueDate || '', invoice: row.invoiceNo || row.ref || '', paidAmount: row.paidAmount ?? '', status: row.status || (Number(row.paidAmount || 0) >= Number(row.amount || 0) && Number(row.amount || 0) > 0 ? 'Paid' : Number(row.paidAmount || 0) > 0 ? 'Part paid' : 'Open'), notes: row.note || '' }));
  if (moduleId === 'mm2-05-account-service' || moduleId === 'mm2-06-cp-account-service') {
    return Object.entries(seed.accounts || {}).map(([id, a]) => {
      const assignment = Object.values(seed.lines || {}).find((line) => line.acctId === id && !line.end);
      const originalStatus = String(a.status || a.cdbStatus || '').toLowerCase();
      return { id: 'legacy-' + id, accountNo: a.accNo || a.code || id, bank: a.bank || '', holder: a.holder || a.name || '', project: assignment?.project || a.cdbProject || '', company: assignment?.company || '', startedAt: assignment?.start || a.openedAt || '', ageMonths: '', expensePayer: '', status: originalStatus.includes('close') ? 'Closed' : originalStatus.includes('mov') ? 'Moved' : 'In service', notes: assignment?.note || a.remark || a.cdbRemark || '' };
    });
  }
  if (moduleId === 'mm2-08-statements') {
    const accounts = seed.accounts || {};
    return Object.entries(seed.stmts || {}).map(([id, row]) => {
      const account = accounts[row.acctId] || {};
      return { id: 'legacy-' + id, accountNo: account.accNo || account.code || row.acctId || '', bank: account.bank || '', holder: account.name || '', department: account.dept || '', statementMonth: row.month || '', dueDate: '', receivedAt: row.receivedDate || '', lastBalance: row.balance ?? '', currency: row.currency || '', status: row.receivedDate ? 'Received' : 'Awaiting', reason: '' };
    });
  }
  if (moduleId === 'mm2-09-cpa-expenses') return (seed.persons || []).flatMap((person, index) => ['Salary', 'Commission'].map((payType) => ({ id: `legacy-person-${String(index + 1).padStart(3, '0')}-${payType.toLowerCase()}`, agent: person.agent || '', company: person.company || '', person: person.name || '', payType, month: '', expectedDate: '', receivedDate: '', status: 'Not due', reference: person.project || '', notes: [person.banks && `Banks: ${person.banks}`, person.holder && `Holder: ${person.holder}`, person.remark].filter(Boolean).join(' · ') })));
  if (moduleId === 'mm2-12-gate-visa') {
    const accounts = seed.accounts || {};
    return Object.entries(seed.entries || {}).map(([id, row]) => {
      const account = accounts[row.accountId] || {};
      const kind = row.kind || account.kind || '';
      return { id: 'legacy-' + id, account: account.name || row.accountId || '', type: kind === 'gate' ? '+Gate (OTP cost)' : 'Visa deposit', project: account.project || '', month: row.month || '', depositAmount: row.deposit ?? '', otpCost: row.amount ?? '', requestedBy: row.requested ? row.requestBy || '' : '', paidDate: row.paidOn || '', status: row.paidOn ? 'Paid' : row.requested ? 'Requested' : 'Open', notes: row.tax ? `Tax: ${row.tax}` : '' };
    });
  }
  if (moduleId === 'mm2-13-fund-recovery') return Object.entries(seed.accounts || {}).map(([id, row]) => ({ id: 'legacy-' + id, account: row.acctName || '', accountNo: row.acctNo || '', bank: row.bank || '', holder: row.acctName || '', agent: row.agent || '', project: row.project || '', balance: row.balance ?? '', openedAt: row.openedAt || row.createdAt || '', tier: ({ A: 'Tier 1', B: 'Tier 2', C: 'Tier 3' })[row.triage] || 'Tier 3', step: row.step ? (['Initial review','Contact holder','Submit documents','Bank follow-up','Legal review','Settlement'][(Number(row.step) - 1 + 6) % 6]) : 'Initial review', status: ({ Active: 'Open', Blocked: 'Bank review', 'Stop Use': 'Closed', 'Sign Out': 'Closed' })[row.status] || (row.status === 'Closed' ? 'Closed' : 'Open'), nextAction: row.nextAction || '', nextActionDate: row.nextActionDate || '', clearedAmount: row.clearedAmount ?? '', clearedDate: row.clearedDate || '', notes: row.pssNote || '' }));
  return [];
}

async function api(path, options = {}) {
  const response = await fetch('/api/v1' + path, { credentials: 'same-origin', ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

const formatValue = (value) => value === undefined || value === null || value === '' ? '—' : String(value);
const mm2ViewStorageKey = (moduleId) => 'mfs-module-view:' + moduleId;
const readMm2View = (moduleId) => {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(mm2ViewStorageKey(moduleId)) || 'null');
    return saved?.view === 'attention' ? 'attention' : 'overview';
  } catch { return 'overview'; }
};

export default function MM2System({ module }) {
  const config = definitions[module.id];
  const [records, setRecords] = useState([]);
  const [view, setView] = useState(() => readMm2View(module.id));
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [moduleUser, setModuleUser] = useState(null);
  const [authError, setAuthError] = useState('');
  const [accountPanel, setAccountPanel] = useState('');
  const [moduleUsers, setModuleUsers] = useState([]);

  useEffect(() => { setView(readMm2View(module.id)); }, [module.id]);
  useEffect(() => {
    try { window.sessionStorage.setItem(mm2ViewStorageKey(module.id), JSON.stringify({ view })); } catch {}
  }, [module.id, view]);

  const importLegacySeed = useCallback(async () => {
    const file = legacySeedFiles[module.id];
    if (!moduleUser || !file) return;
    const marker = `mfs:${module.id}:legacy-seed-v2`;
    const createIfMissing = async (collection, data) => {
      try { return await api(`/modules/${config.api}/collections/${collection}`, { method: 'POST', body: JSON.stringify(data) }); }
      catch (error) {
        if (!data.id) throw error;
        try { return await api(`/modules/${config.api}/collections/${collection}/${encodeURIComponent(data.id)}`); }
        catch { throw error; }
      }
    };
    try {
      const check = await api(`/modules/${config.api}/collections/import-meta/${encodeURIComponent(marker)}`);
      if (check.data?.imported) return;
    } catch {}
    const response = await fetch('/legacy/MM2/converted-seeds.json', { credentials: 'same-origin' });
    if (!response.ok) throw new Error('Could not read original HTML seed data for ' + module.id + '.');
    const allSeeds = await response.json();
    const source = allSeeds[module.id];
    if (!source) return;
    const readLocalState = () => {
      const keys = [...(legacyStateKeys[module.id] || [])];
      if (module.id === 'mm2-01-pss-expenses' || module.id === 'mm2-09-cpa-expenses') {
        keys.push('irg-offline-' + file, 'irg-offline-' + encodeURIComponent(file));
      }
      for (const key of keys) {
        try { const value = window.localStorage.getItem(key); if (value) { const parsed = JSON.parse(value); if (parsed && typeof parsed === 'object') return { key, value: parsed }; } } catch {}
      }
      return null;
    };
    const seed = source.seed || {};
    const local = readLocalState();
    const localState = local?.value || null;
    const mergedSeed = { ...seed };
    if (localState && !Array.isArray(localState)) {
      for (const [key, value] of Object.entries(localState)) {
        if (key === 'users') continue;
        if (value && typeof value === 'object' && !Array.isArray(value) && mergedSeed[key] && typeof mergedSeed[key] === 'object' && !Array.isArray(mergedSeed[key])) mergedSeed[key] = { ...mergedSeed[key], ...value };
        else mergedSeed[key] = value;
      }
    }
    // The HTML demo includes authentication hashes. Keep business data only.
    const { users: _legacyUsers, ...businessSeed } = mergedSeed;
    const sourceId = `legacy-source-${config.api}`;
    const existing = await api(`/modules/${config.api}/collections/legacy-source`);
    const sourceRow = (existing.items || []).find((item) => item.id === sourceId || item.data?.sourceFile === file);
    const sourceData = { sourceFile: file, sourceVersion: 2, seed: businessSeed, browserState: localState ? { key: local.key, value: Object.fromEntries(Object.entries(localState).filter(([key]) => key !== 'users')) } : null };
    if (sourceRow) await api(`/modules/${config.api}/collections/legacy-source/${encodeURIComponent(sourceRow.id)}`, { method: 'POST', body: JSON.stringify(sourceData) });
    else await createIfMissing('legacy-source', { id: sourceId, ...sourceData });
    const existingRows = await api(`/modules/${config.api}/collections/records`);
    const existingIds = new Set((existingRows.items || []).map((item) => item.id));
    const rows = legacyRows(module.id, mergedSeed).map(({ id: sourceRowId, ...data }) => {
      const oldPssId = module.id === 'mm2-01-pss-expenses' ? sourceRowId.replace(/^legacy-/, 'legacy-') : '';
      const preferredId = oldPssId && existingIds.has(oldPssId) ? oldPssId : `legacy-${module.id}-${sourceRowId.replace(/^legacy-/, '')}`;
      return { id: preferredId, ...data };
    });
    for (let start = 0; start < rows.length; start += 100) {
      await api(`/modules/${config.api}/collections/records/bulk`, { method: 'POST', body: JSON.stringify({ items: rows.slice(start, start + 100), updateExisting: true }) });
    }
    await createIfMissing('import-meta', { id: marker, imported: true, sourceFile: file, importedAt: new Date().toISOString() });
  }, [module.id, moduleUser, config.api]);

  const load = useCallback(async () => {
    if (!moduleUser) { setRecords([]); return; }
    setBusy(true); setError('');
    try { const data = await api(`/modules/${config.api}/collections/records`); setRecords((data.items || []).map((item) => ({ id: item.id, ...item.data }))); }
    catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  }, [config.api, moduleUser]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { let live = true; api(`/modules/${config.api}/auth/session`).then((result) => { if (live && result.authenticated) setModuleUser(result.user); }).catch((cause) => { if (live) setAuthError(cause.message); }); return () => { live = false; }; }, [config.api]);
  useEffect(() => { if (!moduleUser) return; importLegacySeed().then(load).catch((cause) => setError('Original data import failed: ' + cause.message)); }, [moduleUser, importLegacySeed, load]);

  async function signIn(event) {
    event.preventDefault(); const form = event.currentTarget; const data = Object.fromEntries(new FormData(form)); setBusy(true); setAuthError('');
    try { const result = await api(`/modules/${config.api}/auth/login`, { method: 'POST', body: JSON.stringify(data) }); setModuleUser(result.user); form.reset(); }
    catch (cause) { setAuthError(cause.message); }
    finally { setBusy(false); }
  }
  async function signOut() {
    try { await api(`/modules/${config.api}/auth/logout`, { method: 'POST', body: '{}' }); setModuleUser(null); setRecords([]); setNotice('Signed out of this module.'); }
    catch (cause) { setAuthError(cause.message); }
  }
  async function changePassword(event) {
    event.preventDefault(); const form = event.currentTarget; const data = Object.fromEntries(new FormData(form));
    if (data.newPassword !== data.repeatPassword) { setError('The new passwords do not match.'); return; }
    setBusy(true); setError('');
    try { await api(`/modules/${config.api}/auth/password`, { method: 'POST', body: JSON.stringify({ currentPassword: data.currentPassword, newPassword: data.newPassword }) }); setNotice('This module password was changed.'); setAccountPanel(''); }
    catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  }
  async function loadModuleUsers() {
    try { const result = await api(`/modules/${config.api}/auth/users`); setModuleUsers(result.items || []); setAccountPanel('users'); }
    catch (cause) { setError(cause.message); }
  }
  async function createModuleUser(event) {
    event.preventDefault(); const form = event.currentTarget; const data = Object.fromEntries(new FormData(form));
    try { await api(`/modules/${config.api}/auth/users`, { method: 'POST', body: JSON.stringify(data) }); await loadModuleUsers(); form.reset(); setNotice('Module user added.'); }
    catch (cause) { setError(cause.message); }
  }
  async function updateModuleUser(account, patch) {
    try { await api(`/modules/${config.api}/auth/users/${encodeURIComponent(account.username)}`, { method: 'PATCH', body: JSON.stringify(patch) }); await loadModuleUsers(); setNotice('Module user updated.'); }
    catch (cause) { setError(cause.message); }
  }
  async function removeModuleUser(account) {
    if (!window.confirm(`Remove ${account.username} from ${module.group}-${module.no}?`)) return;
    try { await api(`/modules/${config.api}/auth/users/${encodeURIComponent(account.username)}`, { method: 'DELETE' }); await loadModuleUsers(); setNotice('Module user removed.'); }
    catch (cause) { setError(cause.message); }
  }

  const attention = useMemo(() => records.filter((record) => {
    const status = String(record.status || '').toLowerCase();
    const due = record.dueDate || record.nextActionDate || record.expectedDate;
    return ['late','overdue','rejected','returned','pending','awaiting','open','in progress','requested','bank review','legal review'].some((word) => status.includes(word)) || (due && due < new Date().toISOString().slice(0,10) && !['paid','cleared','complete','closed','received','acknowledged'].some((word) => status.includes(word)));
  }), [records]);
  const visibleRecords = useMemo(() => {
    const source = view === 'attention' ? attention : records;
    const q = query.trim().toLowerCase();
    return source.filter((record) => (statusFilter === 'All statuses' || record.status === statusFilter) && (!q || Object.values(record).some((value) => String(value ?? '').toLowerCase().includes(q))));
  }, [records, attention, query, statusFilter, view]);

  async function save(event) {
    event.preventDefault(); const form = event.currentTarget; const data = Object.fromEntries(new FormData(form));
    config.fields.forEach((field) => { if (field.type === 'number') data[field.key] = data[field.key] === '' ? '' : Number(data[field.key]); });
    setBusy(true); setError(''); setNotice('');
    try {
      if (editing?.id) await api(`/modules/${config.api}/collections/records/${encodeURIComponent(editing.id)}`, { method: 'POST', body: JSON.stringify(data) });
      else await api(`/modules/${config.api}/collections/records`, { method: 'POST', body: JSON.stringify(data) });
      setEditing(null); setNotice(editing?.id ? 'Record updated.' : 'Record added.'); await load();
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  }
  async function remove(record) {
    if (!window.confirm('Delete this record? This cannot be undone.')) return;
    try { await api(`/modules/${config.api}/collections/records/${encodeURIComponent(record.id)}`, { method: 'DELETE' }); setNotice('Record deleted.'); await load(); }
    catch (cause) { setError(cause.message); }
  }
  function exportCsv() {
    const cols = config.fields.filter((field) => field.type !== 'textarea');
    const quote = (value) => `"${String(value ?? '').replaceAll('"','""')}"`;
    const csv = [cols.map((field) => quote(field.label)).join(','), ...visibleRecords.map((record) => cols.map((field) => quote(record[field.key])).join(','))].join('\r\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); link.download = `${module.id}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }
  if (!config) return <section className="mm2-page"><h1>Module unavailable</h1><p>This MM2 system is not configured.</p></section>;

  return <div className="mm2-page">
    {moduleUser && <header className="mm2-heading"><div className="mm2-title-icon"><i className={`fas ${config.icon}`} /></div><div className="mm2-heading-copy"><div className="mm2-eyebrow">{module.group}-{module.no} · {config.category}</div><h1>{config.title}</h1><p>{config.description}</p></div><button className="mm2-button secondary" onClick={load} disabled={busy}><i className="fas fa-sync-alt" /> Refresh</button></header>}
    {!moduleUser ? <section className="mm2-login-shell"><div className="mm2-login-art"><div><div className="mm2-login-overline">IR Group · PSS Department</div><h1>{module.group}-{module.no} · {config.title}</h1><p>{config.description}</p></div><div className="mm2-login-codes"><span>{config.category}</span><span>PRIVATE MODULE</span><span>MYSQL</span></div></div><div className="mm2-login-form"><form onSubmit={signIn}><h2>Sign in</h2><label>Username<input name="username" autoComplete="username" required /></label><label>Password<input name="password" type="password" autoComplete="current-password" required /></label>{authError&&<div className="mm2-form-error" role="alert">{authError}</div>}<button className="mm2-button primary" type="submit" disabled={busy}>{busy?'Signing in…':'Sign in'}</button><p className="mm2-login-hint">Ask your administrator for an account for this module.</p></form></div></section> : <div className="mm2-module-account"><span><i className="fas fa-user-circle" /> {moduleUser.username} · {moduleUser.role}</span><button onClick={()=>{setError('');setAccountPanel('password')}}>Change password</button>{moduleUser.role.toLowerCase()==='admin'&&<button onClick={loadModuleUsers}>Module users</button>}<button onClick={signOut}>Sign out of {module.group}-{module.no}</button></div>}
    {notice && <div className="mm2-notice success" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}
    {error && <div className="mm2-notice error" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss">×</button></div>}
    {moduleUser && <><section className="mm2-metrics"><article><span>Total records</span><b>{records.length}</b><small>Saved in MySQL</small></article><article><span>Needs attention</span><b>{attention.length}</b><small>Open, late, or due</small></article><article><span>Completed</span><b>{records.filter((record) => ['paid','cleared','complete','closed','received','acknowledged','paid on time'].includes(String(record.status||'').toLowerCase())).length}</b><small>Resolved records</small></article><article><span>Data service</span><b className="mm2-service"><i /> MySQL</b><small>Private · {config.api}</small></article></section>
    <section className="mm2-workspace">
      <div className="mm2-toolbar"><div className="mm2-tabs"><button className={view==='overview'?'active':''} onClick={()=>setView('overview')}>All records</button><button className={view==='attention'?'active':''} onClick={()=>{setView('attention');setStatusFilter('All statuses')}}>Needs attention <span>{attention.length}</span></button></div><div className="mm2-tools"><label className="mm2-search"><i className="fas fa-search" /><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search records" /></label><button className="mm2-button secondary" onClick={exportCsv}><i className="fas fa-file-export" /> Export</button><button className="mm2-button primary" onClick={()=>setEditing({})}><i className="fas fa-plus" /> Add record</button></div></div>
      <div className="mm2-filters"><span>{view==='attention'?'Follow-up list':'Record register'}</span><label>Status<select value={statusFilter} onChange={(event)=>setStatusFilter(event.target.value)}><option>All statuses</option>{config.status.map((status)=><option key={status}>{status}</option>)}</select></label><span className="mm2-result-count">{visibleRecords.length} records</span></div>
      <div className="mm2-table-wrap"><table className="mm2-table"><thead><tr>{config.columns.map((key)=>{const field=config.fields.find((item)=>item.key===key);return <th key={key}>{field?.label || key}</th>})}<th>Actions</th></tr></thead><tbody>{visibleRecords.map((record)=><tr key={record.id}>{config.columns.map((key)=><td key={key}>{key==='status'?<span className={'mm2-status status-'+String(record.status||'').toLowerCase().replace(/[^a-z]+/g,'-')}>{formatValue(record[key])}</span>:formatValue(record[key])}</td>)}<td><div className="mm2-row-actions"><button onClick={()=>setEditing(record)} aria-label="Edit record"><i className="fas fa-pen" /></button><button onClick={()=>remove(record)} aria-label="Delete record"><i className="fas fa-trash" /></button></div></td></tr>)}{!visibleRecords.length&&<tr><td className="mm2-empty" colSpan={config.columns.length+1}>{busy?'Loading records…':view==='attention'?'No records need attention.':'No records yet. Add a record to start this register.'}</td></tr>}</tbody></table></div>
    </section>
    <footer className="mm2-footer"><span>{module.group}-{module.no} · {config.title}</span><span>Changes are stored in this module’s private MySQL records and audit log.</span></footer></>}
    {editing && <div className="mm2-modal-shade" onMouseDown={(event)=>{if(event.target===event.currentTarget)setEditing(null)}}><section className="mm2-modal" role="dialog" aria-modal="true" aria-labelledby="mm2-form-title"><header><div><span className="mm2-eyebrow">{module.group}-{module.no} · RECORD</span><h2 id="mm2-form-title">{editing.id?'Edit record':'Add record'}</h2></div><button onClick={()=>setEditing(null)} aria-label="Close">×</button></header><form onSubmit={save}><div className="mm2-form-grid">{config.fields.map((field)=><label className={field.type==='textarea'?'wide':''} key={field.key}>{field.label}{field.type==='select'?<select name={field.key} defaultValue={editing[field.key]||field.options[0]}>{field.options.map((option)=><option key={option}>{option}</option>)}</select>:field.type==='textarea'?<textarea name={field.key} rows="3" defaultValue={editing[field.key]||''}/>:<input name={field.key} type={field.type} min={field.type==='number'?'0':undefined} step={field.type==='number'?'any':undefined} defaultValue={editing[field.key]||''} required={['reference','itemNo','accountNo','company','account','person','holder','payee','agent'].includes(field.key)} />}</label>)}</div>{error&&<div className="mm2-form-error">{error}</div>}<footer><button type="button" className="mm2-button secondary" onClick={()=>setEditing(null)}>Cancel</button><button type="submit" className="mm2-button primary" disabled={busy}>{busy?'Saving…':'Save record'}</button></footer></form></section></div>}
    {accountPanel==='password'&&<div className="mm2-modal-shade" onMouseDown={(event)=>{if(event.target===event.currentTarget)setAccountPanel('')}}><section className="mm2-modal mm2-account-modal" role="dialog" aria-modal="true" aria-labelledby="mm2-password-title"><header><div><span className="mm2-eyebrow">{module.group}-{module.no} · MODULE ACCOUNT</span><h2 id="mm2-password-title">Change module password</h2></div><button onClick={()=>setAccountPanel('')} aria-label="Close">×</button></header><form onSubmit={changePassword}><div className="mm2-form-grid"><label>Current password<input type="password" name="currentPassword" autoComplete="current-password" required /></label><label>New password<input type="password" name="newPassword" autoComplete="new-password" required /></label><label>Repeat new password<input type="password" name="repeatPassword" autoComplete="new-password" required /></label></div>{error&&<div className="mm2-form-error">{error}</div>}<footer><button type="button" className="mm2-button secondary" onClick={()=>setAccountPanel('')}>Cancel</button><button className="mm2-button primary" disabled={busy}>{busy?'Saving…':'Change password'}</button></footer></form></section></div>}
    {accountPanel==='users'&&<div className="mm2-modal-shade" onMouseDown={(event)=>{if(event.target===event.currentTarget)setAccountPanel('')}}><section className="mm2-modal" role="dialog" aria-modal="true" aria-labelledby="mm2-users-title"><header><div><span className="mm2-eyebrow">{module.group}-{module.no} · ACCESS CONTROL</span><h2 id="mm2-users-title">Users for this module</h2></div><button onClick={()=>setAccountPanel('')} aria-label="Close">×</button></header><div className="mm2-user-list">{moduleUsers.map((account)=><div key={account.username}><b>{account.username}</b><span>{account.role}</span><small>{account.active?'Active':'Disabled'}</small><button type="button" onClick={()=>{const password=window.prompt(`New password for ${account.username}:`);if(password)updateModuleUser(account,{password})}}>Reset password</button>{account.username!==moduleUser.username&&<><button type="button" onClick={()=>updateModuleUser(account,{active:!account.active})}>{account.active?'Disable':'Enable'}</button><button type="button" onClick={()=>removeModuleUser(account)}>Remove</button></>}</div>)}</div><form onSubmit={createModuleUser}><div className="mm2-form-grid"><label>Username<input name="username" autoComplete="off" required /></label><label>Temporary password<input name="password" type="password" autoComplete="new-password" required /></label><label>Role<select name="role"><option>User</option><option>Admin</option></select></label></div><footer><button type="button" className="mm2-button secondary" onClick={()=>setAccountPanel('')}>Close</button><button className="mm2-button primary">Add module user</button></footer></form></section></div>}
  </div>;
}
