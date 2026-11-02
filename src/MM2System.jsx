import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './mm2-system.css';
import InventoryWorkspace from './InventoryWorkspace.jsx';

const statusOptions = ['Open', 'In progress', 'Complete', 'On hold'];
const fields = (items) => items.map(([key, label, type = 'text', options]) => ({ key, label, type, options }));
const definitions = {
  'mm2-01-pss-expenses': { api: 'mm2_pss_expenses', title: 'PSS Request & Expense Tracking', category: 'REQUEST CLEARING', icon: 'fa-clipboard-list', description: 'Track requests from MM4-01, clearing compliance, returns, rejections, and policy timeliness.', status: ['Submitted', 'Approved', 'Returned', 'Rejected', 'Cleared'], fields: fields([['reference','Request reference'],['route','Approval route'],['routeName','Route name'],['expense','Expense'],['section','Section'],['company','Company'],['requester','Requested by'],['purpose','Purpose','textarea'],['submittedAt','Submitted date','date'],['dueDate','Clearing due date','date'],['clearedAt','Cleared date','date'],['total','Total USD','number'],['step','Current step'],['advance','Advance status'],['overBudget','Over budget','select',['No','Yes']],['status','Status','select',['Submitted','Approved','Returned','Rejected','Cleared']],['rejections','Rejection events','number'],['reason','Reason / follow-up','textarea'],['notes','Notes','textarea'],['steps','MM4-01 steps','textarea']]), columns: ['reference','route','expense','company','requester','status','dueDate'] },
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
  if (moduleId === 'mm2-01-pss-expenses') {
    const sourceRows = seed.mm4_rows || seed.requests || seed;
    const annotations = seed.annots || {};
    return Object.entries(sourceRows).filter(([, row]) => row && typeof row === 'object' && !Array.isArray(row)).map(([id, row]) => {
      const annotation = annotations[id] || {};
      return { id: 'legacy-' + id, sourceId: row.id || id, sourceKey: row.key || '', sourceStatus: row.status || '', sourceRecord: row, reference: row.ref || row.key || id, route: row.route || '', routeName: row.routeName || '', expense: row.expense || '', section: row.section || '', company: row.company || '', requester: row.requester || '', purpose: row.purpose || '', submittedAt: row.submittedOn || '', clearedAt: row.completedOn || '', dueDate: row.dueDate || '', total: row.total ?? '', step: row.step || '', overBudget: row.overBudget ? 'Yes' : 'No', advance: row.advance || '', status: ({ DONE: 'Cleared', COMPLETE: 'Cleared', OPEN: 'Submitted', RETURNED: 'Returned', REJECTED: 'Rejected', APPROVED: 'Approved', SUBMITTED: 'Submitted', PENDING: 'Submitted' })[String(row.status || '').toUpperCase()] || 'Submitted', rejections: Number(row.rejections || 0), reason: annotation.reason || row.reason || '', notes: annotation.note || row.lastNote || '', steps: row.steps || '' };
    });
  }
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
    return ['overview', 'attention', 'dashboard', 'requests', 'alerts', 'history', 'users', 'access', 'lists', 'documents'].includes(saved?.view) ? saved.view : 'overview';
  } catch { return 'overview'; }
};

function pssState(record) {
  const complete = record.status === 'Cleared';
  const open = ['Submitted', 'Returned'].includes(record.status);
  const today = new Date().toLocaleDateString('en-CA');
  const end = complete && record.clearedAt ? record.clearedAt : today;
  const sla = { A:4, B:8, CLR:8, C:6, D:6, E:8, F1:8, F2:8 }[record.route] || 0;
  let days = null;
  if (record.submittedAt) {
    days = 0;
    const cursor = new Date(record.submittedAt + 'T00:00:00');
    const finish = new Date(end + 'T00:00:00');
    while (cursor < finish) { cursor.setDate(cursor.getDate() + 1); if (![0,6].includes(cursor.getDay())) days++; }
  }
  let timeliness = !record.submittedAt ? 'No date' : complete ? (days <= sla ? 'On time' : 'Late') : open ? (days > sla ? 'Overdue' : 'Within SLA') : 'Closed';
  if (record.route === 'CLR' && record.dueDate) {
    if (complete && record.clearedAt) timeliness = record.clearedAt <= record.dueDate ? 'On time' : 'Late';
    else if (open) timeliness = today > record.dueDate ? 'Overdue' : 'Within SLA';
  }
  return { complete, days, sla, pastDue: !!(record.dueDate && open && today > record.dueDate), overdue: timeliness === 'Overdue', late: timeliness === 'Late', timeliness };
}

function PssSidebar({ module, user, view, setView, alerts, onPassword, onUsers, onSignOut }) {
  const items = [['dashboard', 'fa-chart-pie', 'Dashboard'], ['requests', 'fa-clipboard-list', 'All requests'], ['alerts', 'fa-triangle-exclamation', `Alerts (${alerts})`], ['history', 'fa-clock-rotate-left', 'History']];
  return <aside className="pss-sidebar"><div className="pss-brand"><b>{module.group}-{module.no} · PSS Request and Expense Tracking</b><small>IR Group · PSS Department</small></div><div className="pss-nav-label">MONITOR</div><nav>{items.map(([id, icon, label]) => <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}><i className={`fas ${icon}`} /> <span>{label}</span></button>)}</nav>{user.role.toLowerCase() === 'admin' && <><div className="pss-nav-label pss-tools-label">TOOLS</div><nav><button onClick={onUsers}><i className="fas fa-users" /> <span>Users</span></button><button className={view === 'access' ? 'active' : ''} onClick={() => setView('access')}><i className="fas fa-user-shield" /> <span>Access control</span></button><button className={view === 'lists' ? 'active' : ''} onClick={() => setView('lists')}><i className="fas fa-list" /> <span>Dropdown lists</span></button></nav></>}<div className="pss-nav-label pss-tools-label">DOCUMENTS</div><nav><button className={view === 'documents' ? 'active' : ''} onClick={() => setView('documents')}><i className="fas fa-upload" /> <span>Upload docs</span></button></nav><div className="pss-side-foot"><strong>{user.role.toLowerCase() === 'admin' ? 'Administrator' : user.username}</strong><small>{user.role === 'Admin' ? 'Master Admin' : user.role}</small><div><button onClick={onPassword}>Password</button><button onClick={onSignOut}>Sign out</button></div></div></aside>;
}

function PssAccessControl() {
  const menus = [['dash','Dashboard'],['req','All requests'],['alerts','Alerts'],['hist','History']];
  const actions = [['edit','Add reasons and notes'],['export','Excel export']];
  const defaults = { Editor:{menus:menus.map(([key])=>key),acts:['edit','export']}, Viewer:{menus:menus.map(([key])=>key),acts:[]} };
  const [positions,setPositions] = useState(defaults);
  const [users,setUsers] = useState([]);
  const [name,setName] = useState('');
  const [message,setMessage] = useState('');
  const [ready,setReady] = useState(false);
  useEffect(()=>{let live=true; Promise.all([api('/modules/mm2_pss_expenses/collections/settings'),api('/modules/mm2_pss_expenses/auth/users')]).then(([settings,accounts])=>{if(!live)return;const row=settings.items?.find(item=>item.id==='pss-positions');if(row?.data?.list)setPositions({...defaults,...row.data.list});setUsers(accounts.items||[]);setReady(true);}).catch(error=>{if(live)setMessage(error.message)});return()=>{live=false}},[]);
  const names=['Admin',...Object.keys(positions)];
  const toggle=(position,type,key)=>setPositions(current=>({...current,[position]:{...current[position],[type]:current[position][type].includes(key)?current[position][type].filter(value=>value!==key):[...current[position][type],key]}}));
  async function save(){try{await api('/modules/mm2_pss_expenses/collections/settings/pss-positions',{method:'POST',body:JSON.stringify({list:positions,updatedAt:new Date().toISOString()})});setMessage('Access saved successfully.')}catch(error){setMessage(error.message)}}
  function add(){const value=name.trim();if(!value||names.some(item=>item.toLowerCase()===value.toLowerCase())||value.toLowerCase()==='master admin'){setMessage('Enter a unique position name.');return}setPositions(current=>({...current,[value]:{menus:menus.map(([key])=>key),acts:[]}}));setName('')}
  function remove(position){if(users.some(user=>user.role===position)){setMessage('Move this position’s users to another position first.');return}if(!window.confirm('Remove position '+position+'?'))return;setPositions(current=>Object.fromEntries(Object.entries(current).filter(([key])=>key!==position)))}
  return <section className="pss-access"><div className="pss-access-help"><b>How it works:</b> each column is a position. Tick what that position can open and do, then press <b>Save access</b>. Give a position to a person in <b>Users</b>. Users and Access control are always for the Master Admin only.</div><div className="pss-table-wrap"><table style={{minWidth:650}}><thead><tr><th>Permission</th>{names.map(position=><th key={position}>{position==='Admin'?'Master Admin':position}<small style={{display:'block'}}>{users.filter(user=>user.role===position).length} users</small>{!['Admin','Editor','Viewer'].includes(position)&&<button onClick={()=>remove(position)}>Remove</button>}</th>)}</tr></thead><tbody>{[['Menus they can open','menus',menus],['What they can do','acts',actions]].map(([label,type,items])=><React.Fragment key={type}><tr><td colSpan={names.length+1}><b>{label}</b></td></tr>{items.map(([key,title])=><tr key={key}><td>{title}</td>{names.map(position=><td key={position}><input type="checkbox" aria-label={`${position}: ${title}`} disabled={position==='Admin'||!ready} checked={position==='Admin'||positions[position][type].includes(key)} onChange={()=>toggle(position,type,key)}/></td>)}</tr>)}</React.Fragment>)}</tbody></table></div><div className="pss-access-actions"><input value={name} onChange={event=>setName(event.target.value)} maxLength={30} placeholder="New position, for example Finance"/><button className="mm2-button secondary" disabled={!ready} onClick={add}>+ Add position</button><button className="mm2-button primary" disabled={!ready} onClick={save}>Save access</button></div>{message&&<p role="status">{message}</p>}</section>;
}

function PssDropdownLists({ records }) {
  const defaults=['Waiting for approval','Missing documents','Funds not ready','Approver away','Other'];
  const [items,setItems]=useState(defaults);
  const [newChoice,setNewChoice]=useState('');
  const [editing,setEditing]=useState(-1);
  const [draft,setDraft]=useState('');
  const [message,setMessage]=useState('');
  const [ready,setReady]=useState(false);
  useEffect(()=>{let live=true;api('/modules/mm2_pss_expenses/collections/settings').then(result=>{if(!live)return;const saved=result.items?.find(row=>row.id==='pss-dropdown-lists');if(Array.isArray(saved?.data?.lateReasonsReq?.items))setItems(saved.data.lateReasonsReq.items);setReady(true)}).catch(error=>setMessage(error.message));return()=>{live=false}},[]);
  const count=value=>records.filter(record=>record.reason===value).length;
  async function persist(next){await api('/modules/mm2_pss_expenses/collections/settings/pss-dropdown-lists',{method:'POST',body:JSON.stringify({lateReasonsReq:{items:next,updatedAt:new Date().toISOString()}})});setItems(next)}
  async function change(action,index){setMessage('');try{
    if(action==='add'){const value=newChoice.trim();if(!value||items.some(item=>item.toLowerCase()===value.toLowerCase()))throw new Error('Enter a unique choice.');await persist([...items,value]);setNewChoice('')}
    if(action==='delete'){if(count(items[index]))throw new Error('This choice is in use. Rename it or change those records first.');if(items.length<2)throw new Error('Keep at least one choice.');if(!window.confirm('Delete '+items[index]+'?'))return;await persist(items.filter((_,i)=>i!==index))}
    if(action==='up'||action==='down'){const next=[...items],other=index+(action==='up'?-1:1);[next[index],next[other]]=[next[other],next[index]];await persist(next)}
    if(action==='rename'){const value=draft.trim(),old=items[index];if(!value||items.some((item,i)=>i!==index&&item.toLowerCase()===value.toLowerCase()))throw new Error('Enter a unique choice.');if(count(old)&&!window.confirm('Rename this choice and update all '+count(old)+' records using it?'))return;for(const record of records.filter(row=>row.reason===old)){const {id,...data}=record;await api('/modules/mm2_pss_expenses/collections/records/'+encodeURIComponent(id),{method:'POST',body:JSON.stringify({...data,reason:value})});record.reason=value}await persist(items.map((item,i)=>i===index?value:item));setEditing(-1)}
    if(action==='reset'){if(!window.confirm('Restore the original choices? Existing records keep their values.'))return;await persist(defaults)}
    setMessage('Saved successfully.');
  }catch(error){setMessage(error.message)}}
  return <section className="pss-access"><div className="pss-access-help"><b>Lists.</b> Add, rename, reorder or delete dropdown choices. Rename updates records that use the choice. Delete is available only when the choice is unused.</div><article className="pss-history"><h2>Late reason</h2><p>Chosen when a request or clearing is late.</p><div className="pss-table-wrap"><table style={{minWidth:500}}><thead><tr><th>Choice</th><th>In use</th><th>Actions</th></tr></thead><tbody>{items.map((item,index)=><tr key={index}><td>{editing===index?<input value={draft} onChange={event=>setDraft(event.target.value)} maxLength={60}/>:item}</td><td>{count(item)}</td><td>{editing===index?<><button onClick={()=>change('rename',index)}>Save</button> <button onClick={()=>setEditing(-1)}>Cancel</button></>:<><button disabled={!ready||index===0} onClick={()=>change('up',index)} aria-label="Move up">↑</button> <button disabled={!ready||index===items.length-1} onClick={()=>change('down',index)} aria-label="Move down">↓</button> <button disabled={!ready} onClick={()=>{setEditing(index);setDraft(item)}}>Rename</button> <button disabled={!ready} onClick={()=>change('delete',index)}>Delete</button></>}</td></tr>)}</tbody></table></div><div className="pss-access-actions"><input value={newChoice} onChange={event=>setNewChoice(event.target.value)} maxLength={60} placeholder="Add a new choice…"/><button disabled={!ready} className="mm2-button primary" onClick={()=>change('add')}>Add</button><button disabled={!ready} className="mm2-button secondary" onClick={()=>change('reset')}>Reset to default</button></div>{message&&<p role="status">{message}</p>}</article></section>;
}

function PssUsers() {
  const [users,setUsers]=useState([]),[profiles,setProfiles]=useState([]),[editing,setEditing]=useState(null),[message,setMessage]=useState('');
  async function load(){try{const [accounts,details]=await Promise.all([api('/modules/mm2_pss_expenses/auth/users'),api('/modules/mm2_pss_expenses/collections/user-profiles')]);setUsers(accounts.items||[]);setProfiles(details.items||[])}catch(error){setMessage(error.message)}}
  useEffect(()=>{load()},[]);
  async function save(event){event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget));try{if(editing.username){await api('/modules/mm2_pss_expenses/auth/users/'+encodeURIComponent(editing.username),{method:'PATCH',body:JSON.stringify({role:data.role,active:data.active==='true',...(data.password?{password:data.password}:{})})})}else{await api('/modules/mm2_pss_expenses/auth/users',{method:'POST',body:JSON.stringify({username:data.username,password:data.password,role:data.role})})}await api('/modules/mm2_pss_expenses/collections/user-profiles/'+encodeURIComponent(data.username),{method:'POST',body:JSON.stringify({name:data.name})});setEditing(null);setMessage('User saved successfully.');await load()}catch(error){setMessage(error.message)}}
  return <section><div className="pss-table-tools"><span>Master Admin: manage who can sign in.</span><button className="mm2-button primary" onClick={()=>setEditing({})}>+ Add user</button></div>{message&&<p role="status">{message}</p>}<div className="pss-table-wrap"><table style={{minWidth:650}}><thead><tr>{['Username','Name','Role','Status','Last sign-in'].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{users.map(user=>{const profile=profiles.find(row=>row.id===user.username)?.data||{};return <tr key={user.username} tabIndex={0} style={{cursor:'pointer'}} onClick={()=>setEditing({...user,...profile})} onKeyDown={event=>{if(event.key==='Enter')setEditing({...user,...profile})}}><td>{user.username}</td><td>{profile.name||user.username}</td><td>{user.role==='Admin'?'Master Admin':user.role}</td><td>{user.active?'Active':'Disabled'}</td><td>{user.lastLogin||'Never'}</td></tr>})}</tbody></table></div>{editing&&<div className="mm2-modal-shade"><section className="mm2-modal" role="dialog" aria-modal="true" aria-label="Edit module user"><header><h2>{editing.username?'Edit user':'Add user'}</h2><button onClick={()=>setEditing(null)}>×</button></header><form onSubmit={save}><div className="mm2-form-grid"><label>Username<input name="username" defaultValue={editing.username||''} readOnly={!!editing.username} required/></label><label>Full name<input name="name" defaultValue={editing.name||''} required/></label><label>Role<select name="role" defaultValue={editing.role||'User'}><option value="Admin">Master Admin</option><option value="User">User</option></select></label><label>Status<select name="active" defaultValue={String(editing.active!==false)}><option value="true">Active</option><option value="false">Disabled</option></select></label><label>{editing.username?'Reset password (leave blank to keep)':'Temporary password'}<input name="password" type="password" required={!editing.username} autoComplete="new-password"/></label></div><footer><button type="button" className="mm2-button secondary" onClick={()=>setEditing(null)}>Cancel</button><button className="mm2-button primary">Save user</button></footer></form></section></div>}</section>;
}

function PssDocuments({ records }) {
  const [files,setFiles]=useState([]),[target,setTarget]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const load=()=>api('/files?module=mm2_pss_expenses').then(result=>setFiles(result.items||[])).catch(error=>setMessage(error.message));
  useEffect(()=>{load()},[]);
  async function upload(event){event.preventDefault();const form=event.currentTarget;const selected=form.elements.documents.files;if(!selected.length)return;setBusy(true);try{for(const file of selected){const body=new FormData();body.append('module','mm2_pss_expenses');body.append('recordId',target);body.append('file',file);const response=await fetch('/api/v1/files',{method:'POST',credentials:'same-origin',body});const result=await response.json();if(!response.ok)throw new Error(result.error||'Upload failed.')}form.reset();await load();setMessage('Documents uploaded successfully.')}catch(error){setMessage(error.message)}finally{setBusy(false)}}
  return <section><div className="pss-access-help">Upload supporting documents and link them to a request. Saved files can be downloaded from the list below.</div><form className="pss-access-actions" onSubmit={upload}><select value={target} onChange={event=>setTarget(event.target.value)}><option value="">General documents</option>{records.map(record=><option key={record.id} value={record.id}>{record.reference}</option>)}</select><input name="documents" type="file" multiple required/><button className="mm2-button primary" disabled={busy}>{busy?'Uploading…':'Upload documents'}</button></form>{message&&<p role="status">{message}</p>}<div className="pss-table-wrap"><table><thead><tr><th>Name</th><th>Request</th><th>Size</th><th>Uploaded</th><th>Download</th></tr></thead><tbody>{files.map(file=><tr key={file.id}><td>{file.original_name}</td><td>{records.find(record=>record.id===file.record_id)?.reference||'General'}</td><td>{Math.ceil(file.size/1024)} KB</td><td>{file.created_at}</td><td><a href={'/api/v1/files/'+encodeURIComponent(file.id)+'?module=mm2_pss_expenses'}>Download</a></td></tr>)}{!files.length&&<tr><td colSpan={5}>No documents uploaded yet.</td></tr>}</tbody></table></div></section>;
}

function PssHistory() {
  const [rows,setRows]=useState([]);const [query,setQuery]=useState('');const [error,setError]=useState('');
  useEffect(()=>{
    let live=true;
    async function recover(){
      // Original HTML history is a separate log bucket, never request data.
      const sources=[];
      const file=legacySeedFiles['mm2-01-pss-expenses'];
      for(const key of ['irg-offline-'+file,'irg-offline-'+encodeURIComponent(file)]){
        try{const value=JSON.parse(localStorage.getItem(key)||'null');if(value?.log)sources.push(value.log)}catch{}
      }
      const snapshots=await api('/modules/mm2_pss_expenses/collections/legacy-source');
      for(const item of snapshots.items||[]){if(item.data?.seed?.log)sources.push(item.data.seed.log);if(item.data?.browserState?.value?.log)sources.push(item.data.browserState.value.log)}
      const result=await api('/modules/mm2_pss_expenses/collections/log');
      const existing=new Set((result.items||[]).map(item=>item.id));
      for(const source of sources)for(const [id,data] of Object.entries(source)){
        if(!data||typeof data!=='object'||existing.has(id))continue;
        await api('/modules/mm2_pss_expenses/collections/log',{method:'POST',body:JSON.stringify({...data,id})});existing.add(id);
      }
      const recovered=await api('/modules/mm2_pss_expenses/collections/log');
      if(live)setRows((recovered.items||[]).map(item=>item.data).sort((a,b)=>String(b.at||'').localeCompare(a.at||'')));
    }
    recover().catch(cause=>{if(live)setError(cause.message)});return()=>{live=false};
  },[]);
  return <section><div className="pss-table-tools"><label>Search<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Person, action, record…"/></label><span>Last 200 changes</span></div>{error&&<p role="alert">{error}</p>}<div className="pss-table-wrap"><table><thead><tr>{['When','User','Action','Record','Detail'].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{rows.filter(row=>JSON.stringify(row).toLowerCase().includes(query.toLowerCase())).slice(0,200).map((row,index)=><tr key={index}><td>{row.at ? new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Phnom_Penh'}).format(new Date(row.at)) : '—'}</td><td>{row.name||row.by}</td><td>{row.action}</td><td>{row.target}</td><td>{row.detail}</td></tr>)}{!rows.length&&<tr><td colSpan={5}>No changes yet.</td></tr>}</tbody></table></div></section>;
}

function PssDashboard({ records, view, setView, query, setQuery, editing, setEditing, exportCsv, onUsers, onUpload }) {
  const evaluated = records.map((record) => ({ record, state: pssState(record) }));
  const alerts = evaluated.filter(({ record, state }) => state.overdue || state.late || state.pastDue || (!state.complete && record.dueDate && (Date.parse(record.dueDate+'T00:00:00')-Date.parse(new Date().toLocaleDateString('en-CA')+'T00:00:00'))/86400000 >= 0 && (Date.parse(record.dueDate+'T00:00:00')-Date.parse(new Date().toLocaleDateString('en-CA')+'T00:00:00'))/86400000 <= 3));
  const completed = evaluated.filter(({ state }) => state.complete);
  const targets = { A: '2–4 days', B: '5–8 days', CLR: '5–8 days', C: '3–6 days', D: '3–6 days', E: '5–8 days', F1: '5–8 days', F2: '5–8 days' };
  const routeStats = [...new Set(records.map((record) => record.route || 'Other'))].map((route) => {
    const rows = evaluated.filter(({ record }) => (record.route || 'Other') === route);
    return { route, good: rows.filter(({ state }) => ['On time','Within SLA'].includes(state.timeliness)).length, bad: rows.filter(({ state }) => ['Late', 'Overdue'].includes(state.timeliness)).length };
  });
  const openRequests = () => setView('requests');
  if (view === 'users') return <PssUsers />;
  if (view === 'dashboard') return <>{alerts.length > 0 && <button className="pss-alert-banner" onClick={() => setView('alerts')}><span>ALERTS</span><b>{alerts.length} alert{alerts.length === 1 ? '' : 's'}</b><small>Overdue, late, or due within 3 days and not finished. Click to open.</small></button>}<section className="pss-cards"><button onClick={openRequests}><span>REQUESTS</span><b>{records.length}</b><small>{completed.length} completed · {records.length - completed.length} open</small></button><button onClick={() => setView('alerts')}><span>OVERDUE NOW</span><b>{evaluated.filter(({ state }) => state.overdue).length}</b><small>Open past the working-day target</small></button><button onClick={() => setView('alerts')}><span>LATE (COMPLETED)</span><b>{evaluated.filter(({ state }) => state.late).length}</b><small>Finished after the target</small></button><button onClick={() => setView('alerts')}><span>PAST DUE DATE</span><b>{evaluated.filter(({ record, state }) => state.pastDue).length}</b><small>Open and after the due date</small></button></section><section className="pss-dashboard-grid"><article><h2>On time vs late, by route</h2>{routeStats.length ? routeStats.map(({ route, good, bad }) => <div className="pss-route-group" key={route}><div className="pss-route"><span>{route} · target {targets[route] || 'policy days'}</span><div><i style={{ width: `${Math.max(0, (good / Math.max(1, good + bad)) * 100)}%` }} /></div><b>{good}</b></div><div className="pss-route"><span>late / overdue</span><div><em style={{ width: `${(bad / Math.max(1, good + bad)) * 100}%` }} /></div><b>{bad}</b></div></div>) : <p>No submitted requests yet.</p>}</article><article><h2>Clearing and returns</h2><dl><div><dt>Clearings on time</dt><dd>{evaluated.filter(({ record, state }) => record.route === 'CLR' && state.timeliness === 'On time').length} · late: {evaluated.filter(({ record, state }) => record.route === 'CLR' && state.timeliness === 'Late').length} · overdue: {evaluated.filter(({ record, state }) => record.route === 'CLR' && state.timeliness === 'Overdue').length}</dd></div><div><dt>Monthly invoices done by the 25th</dt><dd>{records.filter((record) => record.route === 'A' && String(record.status).toLowerCase() === 'cleared' && record.clearedAt && Number(record.clearedAt.slice(8, 10)) <= 25).length} · after: {records.filter((record) => record.route === 'A' && String(record.status).toLowerCase() === 'cleared' && record.clearedAt && Number(record.clearedAt.slice(8, 10)) > 25).length}</dd></div><div><dt>Returns and rejections</dt><dd>{records.reduce((sum, record) => sum + Number(record.rejections || 0), 0)} events on {records.filter((record) => Number(record.rejections || 0) > 0).length} requests</dd></div><div><dt>Over budget requests</dt><dd>{records.filter((record) => (record.overBudget === true || record.overBudget === 'Yes')).length}</dd></div></dl></article></section></>;
  const source = view === 'alerts' ? alerts : evaluated;
  const filtered = source.filter(({ record }) => !query || Object.values(record).some((value) => String(value || '').toLowerCase().includes(query.toLowerCase())));
  if (view === 'history') return <PssHistory />;
  if (view === 'access') return <PssAccessControl />;
  if (view === 'lists') return <PssDropdownLists records={records} />;
  if (view === 'documents') return <PssDocuments records={records} />;
  return <><section className="pss-table-tools"><label><i className="fas fa-search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ref, expense, company, requester…" /></label>{view === 'requests' && <><button className="mm2-button secondary" onClick={exportCsv}><i className="fas fa-file-export" /> Export</button><button className="mm2-button primary" onClick={() => setEditing({})}><i className="fas fa-plus" /> Add record</button></>}<span>{filtered.length} records</span></section><section className="pss-table-wrap"><table><thead><tr><th>Ref</th><th>Route</th><th>Expense</th><th>Company</th><th>Requester</th><th>Status</th><th>Submitted</th><th>Due</th><th>Timeliness</th><th>Rejections</th><th /></tr></thead><tbody>{filtered.map(({ record, state }) => <tr key={record.id}><td><b>{record.reference}</b></td><td>{record.route || '—'}</td><td>{record.expense || '—'}</td><td>{record.company || '—'}</td><td>{record.requester || '—'}</td><td><span className="mm2-status">{record.status}</span></td><td>{record.submittedAt || '—'}</td><td>{record.dueDate || '—'}</td><td><span className={`pss-timeliness ${state.timeliness.toLowerCase().replaceAll(' ', '-')}`}>{state.timeliness}</span></td><td>{record.rejections || 0}</td><td><button className="pss-edit" onClick={() => setEditing(record)} aria-label="Edit request"><i className="fas fa-pen" /></button></td></tr>)}{!filtered.length && <tr><td className="mm2-empty" colSpan="11">No requests match this view.</td></tr>}</tbody></table></section></>;
}

export default function MM2System({ module }) {
  const config = definitions[module.id];
  const isPss = module.id === 'mm2-01-pss-expenses';
  const [records, setRecords] = useState([]);
  const [view, setView] = useState(() => { const restored = readMm2View(module.id); return isPss && restored === 'overview' ? 'dashboard' : restored; });
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

  useEffect(() => { const restored = readMm2View(module.id); setView(module.id === 'mm2-01-pss-expenses' && restored === 'overview' ? 'dashboard' : restored); }, [module.id]);
  useEffect(() => {
    try { window.sessionStorage.setItem(mm2ViewStorageKey(module.id), JSON.stringify({ view })); } catch {}
  }, [module.id, view]);

  const importLegacySeed = useCallback(async () => {
    const file = legacySeedFiles[module.id];
    if (!moduleUser || !file) return;
    // Version 4 imports both the original demo rows and real HTML browser
    // state (mm4_rows + annotations), retaining the untouched source record.
    const marker = `mfs:${module.id}:legacy-seed-${module.id === 'mm2-01-pss-expenses' ? 'original-reset-v5' : 'v4'}`;
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
    const local = module.id === 'mm2-01-pss-expenses' ? null : readLocalState();
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
    const sourceData = { sourceFile: file, sourceVersion: 4, seed: businessSeed, browserState: localState ? { key: local.key, value: Object.fromEntries(Object.entries(localState).filter(([key]) => key !== 'users')) } : null };
    if (sourceRow) await api(`/modules/${config.api}/collections/legacy-source/${encodeURIComponent(sourceRow.id)}`, { method: 'POST', body: JSON.stringify(sourceData) });
    else await createIfMissing('legacy-source', { id: sourceId, ...sourceData });
    const existingRows = await api(`/modules/${config.api}/collections/records`);
    if (module.id === 'mm2-01-pss-expenses') {
      // Retain a recovery snapshot before the explicitly requested reset.
      await createIfMissing('migration-backups', { id: 'before-original-reset-v5', items: existingRows.items || [], savedAt: new Date().toISOString() });
      for (const item of existingRows.items || []) {
        await api(`/modules/${config.api}/collections/records/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
      }
    }
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
    if (isPss) { setAccountPanel(''); setEditing(null); setView('users'); return; }
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
      if (editing?.id) { const {id,...previous}=editing; await api(`/modules/${config.api}/collections/records/${encodeURIComponent(id)}`, { method: 'POST', body: JSON.stringify({...previous,...data}) }); }
      else await api(`/modules/${config.api}/collections/records`, { method: 'POST', body: JSON.stringify(data) });
      if(isPss) await api(`/modules/${config.api}/collections/log`,{method:'POST',body:JSON.stringify({at:new Date().toISOString(),by:moduleUser.username,name:moduleUser.username,action:editing?.id?'Edit request':'Add request',target:data.reference,detail:data.expense||''})});
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
  async function uploadPssDocument(file) {
    if (!file) return;
    setBusy(true); setError('');
    try {
      const body = new FormData(); body.append('module', config.api); body.append('file', file);
      const response = await fetch('/api/v1/files', { method: 'POST', credentials: 'same-origin', body });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Document upload failed.');
      setNotice(`Document “${result.name || file.name}” uploaded successfully.`);
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  }
  if (!config) return <section className="mm2-page"><h1>Module unavailable</h1><p>This MM2 system is not configured.</p></section>;

  const content = <div className={'mm2-page ' + (isPss && moduleUser ? 'pss-page' : '')}>
    {moduleUser && !isPss && <header className="mm2-heading"><div className="mm2-title-icon"><i className={`fas ${config.icon}`} /></div><div className="mm2-heading-copy"><div className="mm2-eyebrow">{module.group}-{module.no} · {config.category}</div><h1>{config.title}</h1><p>{config.description}</p></div><button className="mm2-button secondary" onClick={load} disabled={busy}><i className="fas fa-sync-alt" /> Refresh</button></header>}
    {!moduleUser ? <section className="mm2-login-shell"><div className="mm2-login-art"><div><div className="mm2-login-overline">IR Group · PSS Department</div><h1>{module.group}-{module.no} · {config.title}</h1><p>{config.description}</p></div><div className="mm2-login-codes"><span>{config.category}</span><span>PRIVATE MODULE</span><span>MYSQL</span></div></div><div className="mm2-login-form"><form onSubmit={signIn}><h2>Sign in</h2><label>Username<input name="username" autoComplete="username" required /></label><label>Password<input name="password" type="password" autoComplete="current-password" required /></label>{authError&&<div className="mm2-form-error" role="alert">{authError}</div>}<button className="mm2-button primary" type="submit" disabled={busy}>{busy?'Signing in…':'Sign in'}</button><p className="mm2-login-hint">Ask your administrator for an account for this module.</p></form></div></section> : isPss ? <div className="pss-module-shell"><PssSidebar module={module} user={moduleUser} view={view} setView={setView} alerts={attention.length} onPassword={()=>{setError('');setAccountPanel('password')}} onUsers={loadModuleUsers} onSignOut={signOut} /><main className="pss-main"><header className="pss-topbar"><div><h1>{{dashboard:'Dashboard',requests:'All requests',alerts:'Alerts',history:'History',access:'Access control',lists:'Dropdown lists',documents:'Upload docs'}[view] || 'Dashboard'}</h1><p>{view === 'dashboard' ? 'Requests from MM4-01: on time, late, overdue, clearing and returns' : view === 'requests' ? 'Every request from MM4-01, connected to this module database.' : view === 'alerts' ? 'Overdue, late, returned and rejected requests that need follow-up.' : 'Manage this module’s records and supporting information.'}</p></div><button className="mm2-button secondary" onClick={load} disabled={busy}><i className="fas fa-sync-alt" /> Refresh</button></header><PssDashboard records={records} view={view} setView={setView} query={query} setQuery={setQuery} editing={editing} setEditing={setEditing} exportCsv={exportCsv} onUsers={loadModuleUsers} onUpload={uploadPssDocument} /></main></div> : <div className="mm2-module-account"><span><i className="fas fa-user-circle" /> {moduleUser.username} · {moduleUser.role}</span><button onClick={()=>{setError('');setAccountPanel('password')}}>Change password</button>{moduleUser.role.toLowerCase()==='admin'&&<button onClick={loadModuleUsers}>Module users</button>}<button onClick={signOut}>Sign out of {module.group}-{module.no}</button></div>}
    {notice && <div className="mm2-notice success" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}
    {error && <div className="mm2-notice error" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss">×</button></div>}
    {moduleUser && !isPss && <><section className="mm2-metrics"><article><span>Total records</span><b>{records.length}</b><small>Saved in MySQL</small></article><article><span>Needs attention</span><b>{attention.length}</b><small>Open, late, or due</small></article><article><span>Completed</span><b>{records.filter((record) => ['paid','cleared','complete','closed','received','acknowledged','paid on time'].includes(String(record.status||'').toLowerCase())).length}</b><small>Resolved records</small></article><article><span>Data service</span><b className="mm2-service"><i /> MySQL</b><small>Private · {config.api}</small></article></section>
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
  return module.id==='mm2-04-inventory'&&moduleUser ? <InventoryWorkspace module={module} user={moduleUser}>{content}</InventoryWorkspace> : content;
}
