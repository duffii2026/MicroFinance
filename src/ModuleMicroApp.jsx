import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './module-entry.css';

const moduleFiles = {
  'central-database': 'central-database.html',
  'cpa-control': 'cpa-control.html',
  'access-credentials': 'access-credentials.html',
  'payment-gateways': 'payment-gateways.html',
  'communication-channel': 'communication-channel.html',
  'company-database': 'company-database.html',
  'mm2-01-pss-expenses': 'MM2/MM2-01 · PSS Request and Expense Tracking (1).html',
  'mm2-04-inventory': 'MM2/MM2-04 · Inventory Control.html',
  'mm2-05-account-service': 'MM2/MM2-05 · Account In Service Database.html',
  'mm2-06-cp-account-service': 'MM2/MM2-06 · CP Account In Service Database.html',
  'mm2-07-company-expenses': 'MM2/MM2-07 · Company and Legal Expense Tracking and Monitoring.html',
  'mm2-08-statements': 'MM2/MM2-08 · Accounts Balance and Statement Tracking.html',
  'mm2-09-cpa-expenses': 'MM2/MM2-09 · CPA Expense Tracking Salary  Commission.html',
  'mm2-12-gate-visa': 'MM2/MM2-12 · Gate and Visa Deposit Tracking and Monitoring.html',
  'mm2-13-fund-recovery': 'MM2/MM2-13 · Fund Recovery Tracking and Timeline FRTT.html',
  'mm4-01-pss-requests': 'MM4/MM4-01-PSS-Request-Approval-latest.html',
  'mm4-03-fund-transfers': 'MM4/MM4-03-Fund-Transfers-and-Settlement-latest.html',
  'mm4-03a-manual-cpa': 'MM4/MM4-03a-Manual-CPA-latest.html',
  'mm4-03b-auto-payment': 'MM4/MM4-03b_Auto_Payment_offline.html',
};

const mm4StorageBindings = {
  'mm4-01-pss-requests': [{ module: 'mm4_pss_requests', keys: ['ir_pss_request_v1', 'irg-offline-MM4-01-PSS-Request-Approval-latest.html'] }],
  'mm4-03-fund-transfers': [{ module: 'mm4_fund_transfers', keys: ['irg-offline-MM4-03-Fund-Transfers-and-Settlement-latest.html', 'ir_pss_request_v1', 'irg-offline-MM4-01-PSS-Request-Approval-latest.html', 'irg-offline-MM4-03a-Manual-CPA-latest.html', 'mm403_offline_db_v1'] }],
  'mm4-03a-manual-cpa': [{ module: 'mm4_manual_cpa', keys: ['irg-offline-MM4-03a-Manual-CPA-latest.html'] }],
  'mm4-03b-auto-payment': [{ module: 'mm4_auto_payment', keys: ['mm403_offline_db_v1'] }],
};
const mm1StorageBindings = {
  'central-database': [{ module: 'central', keys: ['mm101_offline_db_v1'] }],
  'cpa-control': [{ module: 'cpa', keys: ['cpa_control_v1'] }],
  'access-credentials': [{ module: 'credentials', keys: ['mm103_offline_db_v1'] }],
  'payment-gateways': [{ module: 'gateways', keys: ['mm104_offline_db_v1'] }],
  'communication-channel': [{ module: 'communications', keys: ['irg-offline-communication-channel.html'] }],
  'company-database': [{ module: 'companies', keys: ['mm106_offline_db_v1'] }],
};
const mm2StorageBindings = {
  'mm2-01-pss-expenses': [{ module: 'mm2_pss_expenses', keys: ['irg-offline-MM2-01%20%C2%B7%20PSS%20Request%20and%20Expense%20Tracking%20(1).html'] }],
  'mm2-04-inventory': [{ module: 'mm2_inventory', keys: ['mm204_offline_db_v1'] }],
  'mm2-05-account-service': [{ module: 'mm2_account_service', keys: ['mm205_offline_db_v1'] }],
  'mm2-06-cp-account-service': [{ module: 'mm2_cp_account_service', keys: ['mm206_offline_db_v1'] }],
  'mm2-07-company-expenses': [{ module: 'mm2_company_expenses', keys: ['mm207_offline_db_v1'] }],
  'mm2-08-statements': [{ module: 'mm2_account_statements', keys: ['mm208_offline_db_v1'] }],
  'mm2-09-cpa-expenses': [{ module: 'mm2_cpa_expenses', keys: ['irg-offline-MM2-09%20%C2%B7%20CPA%20Expense%20Tracking%20Salary%20%20Commission.html'] }],
  'mm2-12-gate-visa': [{ module: 'mm2_gate_visa', keys: ['mm212_offline_db_v1'] }],
  // This module keeps its records in its own document store rather than a
  // browser-state key, but it still needs its independent API authentication.
  'mm2-13-fund-recovery': [{ module: 'mm2_fund_recovery', keys: [] }],
};
const legacySessionKeys = {
  'central-database': { key: 'cdb_user', storage: 'sessionStorage' }, 'cpa-control': { key: 'cpa_control_user', storage: 'sessionStorage' },
  'access-credentials': { key: 'aa_user' }, 'payment-gateways': { key: 'pg_user' },
  'communication-channel': { key: 'ex_user' }, 'company-database': { key: 'co_user' },
  'mm2-01-pss-expenses': { key: 'ex_user' }, 'mm2-04-inventory': { key: 'inv_user' }, 'mm2-05-account-service': { key: 'as_user' },
  'mm2-06-cp-account-service': { key: 'as_user' }, 'mm2-07-company-expenses': { key: 'mm207_user' }, 'mm2-08-statements': { key: 'sa_user' },
  'mm2-09-cpa-expenses': { key: 'ex_user' }, 'mm2-12-gate-visa': { key: 'mm212_user' }, 'mm2-13-fund-recovery': { key: 'frt_user' },
  'mm4-01-pss-requests': { key: 'ex_user' }, 'mm4-03-fund-transfers': { key: 'ex_user' }, 'mm4-03a-manual-cpa': { key: 'ex_user' },
  'mm4-03b-auto-payment': { key: 'fs_user' },
};
const moduleTitles = {
  'mm2-01-pss-expenses': 'MM2-01 PSS Request & Expense Tracking',
  'mm2-04-inventory': 'MM2-04 Inventory Control',
  'mm2-05-account-service': 'MM2-05 Account In Service Database',
  'mm2-06-cp-account-service': 'MM2-06 CP Account In Service Database',
  'mm2-07-company-expenses': 'MM2-07 Company & Legal Expenses',
  'mm2-08-statements': 'MM2-08 Account Balance & Statements',
  'mm2-09-cpa-expenses': 'MM2-09 CPA Salary & Commission',
  'mm2-12-gate-visa': 'MM2-12 Gate & Visa Deposits',
  'mm2-13-fund-recovery': 'MM2-13 Fund Recovery Timeline',
  'mm4-01-pss-requests': 'MM4-01 PSS Request & Approval',
  'mm4-03-fund-transfers': 'MM4-03 Fund Transfers & Settlement',
  'mm4-03a-manual-cpa': 'MM4-03a Manual CPA',
  'mm4-03b-auto-payment': 'MM4-03b Auto Payment',
};

function moduleApiRequest(path, options = {}) {
  return fetch('/api/v1' + path, { credentials: 'same-origin', ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) } }).then(async (response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(data.error || 'API request failed (' + response.status + ')'); error.status = response.status; throw error; }
    return data;
  });
}

function buildLegacyAuthScript(moduleId, authModuleId, user, mode) {
  const legacySession = legacySessionKeys[moduleId];
  const setLegacySession = legacySession ? (legacySession.storage || 'localStorage') + '.setItem(' + JSON.stringify(legacySession.key) + ', user.u);' : '';
  const userLiteral = JSON.stringify(user);
  const moduleLiteral = JSON.stringify(authModuleId);
  const sessionKey = JSON.stringify('__mfsVerifiedUser_' + authModuleId);
  const applyUser = 'var row=Object.assign({},user,{active:true,mustChange:false});try{sessionStorage.setItem("mfs_module_user_"+' + moduleLiteral + ',user.u);' + setLegacySession + '}catch(e){}if(typeof DATA!=="undefined"&&DATA.users)DATA.users[user.u]=Object.assign({},DATA.users[user.u]||{},row);if(typeof D!=="undefined"&&D.users)D.users[user.u]=Object.assign({},D.users[user.u]||{},row);if(typeof S!=="undefined"&&Array.isArray(S.users)){var item=S.users.find(function(x){return x.u===user.u});if(item)Object.assign(item,row);else S.users.push(row)}';
  const guard = 'window[' + sessionKey + ']=user;var guardName=' + JSON.stringify('__mfsCheckGuard_' + authModuleId) + ';if(typeof window.checkSession==="function"&&!window[guardName]){var previousCheckSession=window.checkSession;window.checkSession=function(){var verified=window[' + sessionKey + '];if(verified){var trusted=Object.assign({},verified,{active:true,mustChange:false});if(typeof DATA!=="undefined"&&DATA.users)DATA.users[verified.u]=Object.assign({},DATA.users[verified.u]||{},trusted);if(typeof D!=="undefined"&&D.users)D.users[verified.u]=Object.assign({},D.users[verified.u]||{},trusted);if(typeof S!=="undefined"&&Array.isArray(S.users)){var current=S.users.find(function(x){return x.u===verified.u});if(current)Object.assign(current,trusted);else S.users.push(trusted)}}return previousCheckSession.apply(this,arguments)};window[guardName]=true}var logoutGuard=' + JSON.stringify('__mfsLogoutGuard_' + authModuleId) + ';if(typeof window.logout==="function"&&!window[logoutGuard]){var previousLogout=window.logout;window.logout=function(){window[' + sessionKey + ']=null;return previousLogout.apply(this,arguments)};window[logoutGuard]=true}';
  const activate = mode === 'login'
    ? 'if(typeof window.__mfsModuleSignIn==="function")window.__mfsModuleSignIn(user);else if(typeof USER!=="undefined"){USER=Object.assign({},typeof S!=="undefined"&&S&&S.users?S.users.find(function(x){return x.u===user.u}):row,row);if(typeof startApp==="function")startApp()}else if(typeof checkSession==="function")checkSession();else if(typeof ME!=="undefined"){ME=row;if(typeof enterApp==="function")enterApp()}else{var login=document.querySelector("#login"),app=document.querySelector("#app");if(login)login.classList.add("hidden");if(app)app.classList.remove("hidden")} '
    : 'if(typeof window.__mfsModuleSignIn==="function")window.__mfsModuleSignIn(user);else if(typeof USER!=="undefined"){USER=Object.assign({},typeof S!=="undefined"&&S&&S.users?S.users.find(function(x){return x.u===user.u}):row,row);if(typeof startApp==="function")startApp()}else if(typeof checkSession==="function")checkSession();else if(typeof ME!=="undefined"){ME=row;if(typeof enterApp==="function")enterApp()}';
  const forceVisible = 'var verifiedLogin=document.querySelector("#login"),verifiedApp=document.querySelector("#app");if(verifiedLogin)verifiedLogin.classList.add("hidden");if(verifiedApp)verifiedApp.classList.remove("hidden");';
  return '(function(user){' + applyUser + guard + activate + forceVisible + '})(' + userLiteral + ');';
}

function createApiStorageBridge(bindings, onStatus, group = 'MM4') {
  const allowedKeys = new Set(bindings.flatMap((binding) => binding.keys));
  const rowIds = new Map();
  const debounces = new Map();
  let active = false;
  let stopped = false;
  let connecting = false;
  let connected = false;
  let queue = Promise.resolve();
  let authModuleId = '';
  const keyId = (module, key) => module + ':' + key;
  const resetId = (module, key) => 'mfs-' + group.toLowerCase() + '-reset:' + module + ':' + key;
  const endpoint = (module) => '/modules/' + encodeURIComponent(module) + '/collections/browser-state';
  const rawSet = Storage.prototype.setItem;
  const rawGet = Storage.prototype.getItem;
  const rawRemove = Storage.prototype.removeItem;
  const hydrated = new Map();

  function parseSnapshot(value) {
    if (typeof value !== 'string') return null;
    try { const parsed = JSON.parse(value); return parsed && typeof parsed === 'object' ? parsed : null; } catch { return null; }
  }

  async function persist(module, key, value) {
    const existingId = rowIds.get(keyId(module, key));
    const path = existingId ? endpoint(module) + '/' + encodeURIComponent(existingId) : endpoint(module);
    const body = existingId ? { key, value } : { key, value };
    try {
      const result = await moduleApiRequest(path, { method: 'POST', body: JSON.stringify(body) });
      if (result.id) rowIds.set(keyId(module, key), result.id);
      onStatus({ kind: 'connected', message: '' });
    } catch (error) {
      active = false;
      connected = false;
      onStatus({ kind: 'local', message: error.status === 401 || error.status === 403 ? '' : 'The MySQL database is unavailable. ' + group + ' changes remain in this browser and will retry automatically.' });
    }
  }

  function schedule(module, key, value) {
    if (!active || stopped) return;
    if (window.localStorage.getItem(resetId(module, key)) === '1') return;
    clearTimeout(debounces.get(key));
    debounces.set(key, setTimeout(() => {
      queue = queue.then(() => persist(module, key, value));
    }, 450));
  }

  const wrappedSet = function (key, value) {
    rawSet.call(this, key, value);
    if (this === window.localStorage && allowedKeys.has(String(key)) && active) {
      hydrated.set(String(key), String(value));
      const binding = bindings.find((item) => item.keys.includes(String(key)));
      if (binding) schedule(binding.module, String(key), String(value));
    }
  };
  const wrappedGet = function (key) {
    const value = rawGet.call(this, key);
    if (this === window.localStorage && hydrated.has(String(key))) return hydrated.get(String(key));
    return value;
  };
  const wrappedRemove = function (key) {
    rawRemove.call(this, key);
    if (this === window.localStorage && allowedKeys.has(String(key)) && active) {
      const binding = bindings.find((item) => item.keys.includes(String(key)));
      if (binding) rawSet.call(window.localStorage, resetId(binding.module, String(key)), '1');
    }
  };

  Object.defineProperty(Storage.prototype, 'setItem', { configurable: true, writable: true, value: wrappedSet });
  Object.defineProperty(Storage.prototype, 'getItem', { configurable: true, writable: true, value: wrappedGet });
  Object.defineProperty(Storage.prototype, 'removeItem', { configurable: true, writable: true, value: wrappedRemove });

  async function start() {
    if (stopped || connected) return connected;
    while (connecting && !stopped) await new Promise((resolve) => setTimeout(resolve, 30));
    if (stopped || connected) return connected;
    connecting = true;
    try {
      if (authModuleId) {
        const session = await moduleApiRequest('/modules/' + encodeURIComponent(authModuleId) + '/auth/session');
        if (!session.authenticated) {
          onStatus({ kind: 'local', message: '' });
          return false;
        }
      }
      onStatus({ kind: 'pending', message: 'Connecting ' + group + ' data to MySQL…' });
      for (const binding of bindings) {
        const response = await moduleApiRequest(endpoint(binding.module));
        const remote = new Map((response.items || []).map((item) => [item.data.key, item]));
        for (const key of binding.keys) {
          const saved = remote.get(key);
          const localValue = window.localStorage.getItem(key);
          if (window.localStorage.getItem(resetId(binding.module, key)) === '1') {
            if (saved) await moduleApiRequest(endpoint(binding.module) + '/' + encodeURIComponent(saved.id), { method: 'DELETE' });
            rowIds.delete(keyId(binding.module, key));
            rawRemove.call(window.localStorage, resetId(binding.module, key));
            continue;
          }
          if (saved) {
            rowIds.set(keyId(binding.module, key), saved.id);
            const remoteValue = typeof saved.data.value === 'string' ? saved.data.value : JSON.stringify(saved.data.value ?? {});
            hydrated.set(key, remoteValue);
            const remoteSnapshot = parseSnapshot(remoteValue);
            if (remoteSnapshot) {
              // MySQL is the system of record. Replacing the browser copy also
              // repairs older "[object Object]" snapshots and stale local data.
              if (localValue !== remoteValue) rawSet.call(window.localStorage, key, remoteValue);
              if (typeof saved.data.value !== 'string') await persist(binding.module, key, remoteValue);
            } else if (localValue === null) {
              continue;
            } else {
              // Keep a readable local snapshot if the stored API payload is malformed.
              const localSnapshot = parseSnapshot(localValue);
              if (!localSnapshot) continue;
            }
          } else if (localValue !== null) {
            await persist(binding.module, key, localValue);
          }
        }
      }
      active = true;
      connected = true;
      onStatus({ kind: 'connected', message: '' });
      return true;
    } catch (error) {
      active = false;
      onStatus({ kind: 'local', message: error.status === 401 || error.status === 403 ? '' : 'The MySQL database is unavailable. ' + group + ' changes remain in this browser and will retry automatically.' });
      return false;
    } finally {
      connecting = false;
    }
  }

  const retryTimer = setInterval(() => { if (!connected && !connecting && !stopped) start(); }, 1500);
  return { start, setAuthModule(module) { authModuleId = module; }, reconnect() { if (!stopped) { connected = false; return start(); } return Promise.resolve(); }, destroy() { stopped = true; active = false; clearInterval(retryTimer); debounces.forEach(clearTimeout); Object.defineProperty(Storage.prototype, 'setItem', { configurable: true, writable: true, value: rawSet }); Object.defineProperty(Storage.prototype, 'getItem', { configurable: true, writable: true, value: rawGet }); Object.defineProperty(Storage.prototype, 'removeItem', { configurable: true, writable: true, value: rawRemove }); } };
}

function splitSelectors(value) {
  const out = []; let depth = 0; let start = 0;
  for (let i = 0; i < value.length; i += 1) {
    if (value[i] === '(' || value[i] === '[') depth += 1;
    else if (value[i] === ')' || value[i] === ']') depth -= 1;
    else if (value[i] === ',' && depth === 0) { out.push(value.slice(start, i).trim()); start = i + 1; }
  }
  out.push(value.slice(start).trim());
  return out.filter(Boolean);
}

function scopedSelector(selector) {
  const root = '#mfs-module-root';
  let result = selector.replace(/(^|\s)(?:html|body|:root)(?=$|[\s.#:[>])/g, '$1' + root);
  result = result.replace(/#mfs-module-root\s+#mfs-module-root/g, root);
  return result.startsWith(root) ? result : root + ' ' + result;
}

function scopeCss(css) {
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css.replace(/@import\s+[^;]+;/g, ''));
    const renderRules = (rules) => [...rules].map((rule) => {
      if (rule.type === CSSRule.STYLE_RULE) {
        const selector = splitSelectors(rule.selectorText).map(scopedSelector).join(',');
        return selector + '{' + rule.style.cssText + '}';
      }
      if (rule.type === CSSRule.KEYFRAMES_RULE || rule.type === CSSRule.FONT_FACE_RULE || rule.type === CSSRule.PAGE_RULE) return rule.cssText;
      if (rule.cssRules) {
        const head = rule.conditionText ? '@' + rule.constructor.name.replace('CSS', '').replace('Rule', '').toLowerCase() + ' ' + rule.conditionText : rule.cssText.slice(0, rule.cssText.indexOf('{')).trim();
        return head + '{' + renderRules(rule.cssRules) + '}';
      }
      return rule.cssText;
    }).join('\n');
    return renderRules(sheet.cssRules);
  } catch (error) {
    console.warn('MFS module stylesheet could not be scoped:', error);
    return '';
  }
}

function isExecutable(script) {
  const type = (script.getAttribute('type') || '').trim().toLowerCase();
  return !type || ['text/javascript', 'application/javascript', 'module'].includes(type);
}

const moduleViewStorageKey = (moduleId) => 'mfs-module-view:' + moduleId;

function readSavedModuleView(moduleId) {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(moduleViewStorageKey(moduleId)) || 'null');
    return saved && typeof saved === 'object' ? saved : null;
  } catch { return null; }
}

function ReactDocument({ sourceUrl, title, apiBindings = [], moduleId }) {
  const rootRef = useRef(null);
  const [markup, setMarkup] = useState('');
  const [styles, setStyles] = useState([]);
  const [resources, setResources] = useState([]);
  const [scripts, setScripts] = useState([]);
  const [error, setError] = useState('');
  const [moduleApiId, setModuleApiId] = useState('');
  const [apiStatus, setApiStatus] = useState({ kind: 'pending', message: 'Module data is stored in this browser.' });

  useEffect(() => {
    let active = true;
    fetch(sourceUrl, { credentials: 'same-origin', cache: 'no-store' }).then((response) => {
      if (!response.ok) throw new Error('Could not load ' + title + ' (' + response.status + ').');
      return response.text();
    }).then(async (html) => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const css = [...doc.querySelectorAll('style')].map((style) => style.textContent || '').filter(Boolean);
      const links = [...doc.querySelectorAll('link[rel="stylesheet"]')].map((link) => new URL(link.getAttribute('href'), new URL(sourceUrl, location.href)).href);
      const localStyles = await Promise.all(links.filter((href) => new URL(href).origin === location.origin).map(async (href) => {
        const response = await fetch(href, { credentials: 'same-origin', cache: 'no-store' });
        if (!response.ok) throw new Error('Could not load a stylesheet (' + response.status + ').');
        return response.text();
      }));
      css.push(...localStyles);
      const code = [...doc.querySelectorAll('script')].filter(isExecutable).map((script) => ({ src: script.getAttribute('src'), type: script.getAttribute('type') || '', text: script.textContent || '' })).filter((script) => !script.src || !script.src.endsWith('/font-accessibility.js'));
      doc.querySelectorAll('style,link[rel="stylesheet"]').forEach((element) => element.remove());
      doc.querySelectorAll('script').forEach((script) => { if (isExecutable(script)) script.remove(); });
      doc.querySelectorAll('title,meta,base').forEach((element) => element.remove());
      if (active) { setMarkup(doc.body.innerHTML); setStyles(css); setResources(links); setScripts(code); }
    }).catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [sourceUrl, title]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !markup || error) return undefined;
    // A legacy screen lives inside this React page. Keep its selected left-nav
    // item separately, because the parent workspace refreshes the legacy DOM.
    // Several original modules already use a hash; the rest use data-* buttons.
    const savedModuleView = readSavedModuleView(moduleId);
    if (!window.location.hash && savedModuleView?.hash) {
      window.history.replaceState({}, '', window.location.pathname + window.location.search + '#' + savedModuleView.hash);
    }
    const saveModuleView = (nav = null) => {
      try {
        const current = readSavedModuleView(moduleId) || {};
        const hash = window.location.hash.slice(1);
        window.sessionStorage.setItem(moduleViewStorageKey(moduleId), JSON.stringify({ ...current, ...(hash ? { hash } : {}), ...(nav ? { nav } : {}) }));
      } catch {}
    };
    const rememberNavigation = (event) => {
      const target = event.target instanceof Element ? event.target.closest('[data-p], [data-page], [data-tab], [data-tabgo]') : null;
      if (!target || !root.contains(target)) return;
      const attribute = ['data-p', 'data-page', 'data-tab', 'data-tabgo'].find((name) => target.hasAttribute(name));
      const value = attribute && target.getAttribute(attribute);
      if (!attribute || !value) return;
      // Original event handlers can update the hash or redraw the menu. Save
      // after they run, rather than recording the view that was just replaced.
      window.setTimeout(() => saveModuleView({ attribute, value }), 0);
    };
    const restoreNavigation = () => {
      const saved = readSavedModuleView(moduleId);
      if (!saved?.nav?.attribute || !saved.nav.value) return false;
      const target = [...root.querySelectorAll('[' + saved.nav.attribute + ']')].find((item) => item.getAttribute(saved.nav.attribute) === saved.nav.value);
      if (!target || target.getAttribute('aria-current') === 'page') return !!target;
      target.click();
      return true;
    };
    root.addEventListener('click', rememberNavigation, true);
    const reportScriptError = (event) => {
      if (!root.isConnected) return;
      const existing = root.querySelector('.micro-app-script-error');
      const alert = existing || document.createElement('div');
      alert.className = 'micro-app-script-error';
      alert.setAttribute('role', 'alert');
      alert.textContent = 'Module startup error: ' + (event?.error?.message || event?.message || 'Unknown browser error');
      if (!existing) root.prepend(alert);
    };
    window.addEventListener('error', reportScriptError);
    const headNodes = [];
    const injectedStyle = document.createElement('style');
    injectedStyle.dataset.mfsModuleStyles = '';
    injectedStyle.textContent = styles.map(scopeCss).join('\n');
    document.head.appendChild(injectedStyle); headNodes.push(injectedStyle);
    resources.filter((href) => new URL(href).origin !== location.origin).forEach((href) => {
      const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = href; link.dataset.mfsModuleResource = '';
      document.head.appendChild(link); headNodes.push(link);
    });
    const group = sourceUrl.includes('/MM2/') ? 'MM2' : sourceUrl.includes('/MM4/') ? 'MM4' : 'MM1';
    const authModuleId = moduleId === 'mm4-03-fund-transfers' ? 'mm4_fund_transfers' : (apiBindings[0]?.module || '');
    setModuleApiId(authModuleId);
    const bridge = apiBindings.length ? createApiStorageBridge(apiBindings, setApiStatus, group) : null;
    bridge?.setAuthModule(authModuleId);
    let moduleSignOutClick = null;
    const runScripts = async () => {
      if (bridge) await bridge.start();
      const legacySession = legacySessionKeys[moduleId];
      if (legacySession) {
        try { window[legacySession.storage || 'localStorage'].removeItem(legacySession.key); } catch {}
      }
      // Each module owns a separate in-memory adapter. Clear the previous
      // module adapter before its legacy bootstrap code runs.
      try { if (window.claude) delete window.claude; } catch {}
      for (const item of scripts) {
        if (!root.isConnected) break;
        const script = document.createElement('script');
        if (item.type) script.type = item.type;
        if (item.src) {
          const resolvedSrc = new URL(item.src, new URL(sourceUrl, location.href));
          // Keep module startup local and deterministic. External libraries
          // such as the optional Excel exporter must never hold the dashboard
          // behind a network request or prevent its legacy scripts running.
          if (resolvedSrc.origin !== location.origin) continue;
          script.src = resolvedSrc.href;
          script.async = false;
          await new Promise((resolve) => {
            script.onload = resolve;
            // Optional legacy dependencies (for example the Excel export
            // library) must not prevent the module dashboard from starting.
            script.onerror = () => { console.warn('Optional module dependency could not be loaded:', script.src); resolve(); };
            document.body.appendChild(script);
          });
        } else {
          const filename = new URL(sourceUrl, location.href).pathname.split('/').pop();
          script.textContent = item.text.replaceAll("location.pathname.split('/').pop()", JSON.stringify(filename));
          document.body.appendChild(script);
        }
      }
      if (root.isConnected) {
        if (authModuleId) {
          const signedOutKey = 'mfs_module_signed_out_' + authModuleId;
          const markModuleSignedOut = () => {
            try {
              localStorage.setItem(signedOutKey, '1');
              sessionStorage.removeItem('mfs_module_user_' + authModuleId);
              const legacy = legacySessionKeys[moduleId];
              if (legacy) window[legacy.storage || 'localStorage'].removeItem(legacy.key);
            } catch {}
            return moduleApiRequest('/modules/' + encodeURIComponent(authModuleId) + '/auth/logout', { method: 'POST', body: '{}', keepalive: true }).catch(() => {});
          };
          const originalLogin = window.doLogin;
          const originalLogout = window.logout;
          if (typeof originalLogout === 'function') {
            window.logout = function (...args) {
              markModuleSignedOut();
              return originalLogout.apply(this, args);
            };
          }
          // A few legacy modules bind their button before the global logout
          // function is wrapped. Capture every known sign-out control so the
          // independent backend cookie is always cleared as well.
          moduleSignOutClick = (event) => {
            const button = event.target.closest('button, a');
            if (!button) return;
            const id = button.id;
            if (id === 'btnOut' || id === 'btnLogout' || id === 'out' || /^sign out$/i.test(button.textContent.trim())) markModuleSignedOut();
          };
          root.addEventListener('click', moduleSignOutClick, true);
          const loginForm = root.querySelector('#loginForm');
          if (loginForm) {
            loginForm.addEventListener('submit', async (event) => {
              event.preventDefault(); event.stopImmediatePropagation();
              const username = root.querySelector('#lu')?.value?.trim().toLowerCase() || '';
              const password = root.querySelector('#lp')?.value || '';
              try {
                const result = await moduleApiRequest('/modules/' + encodeURIComponent(authModuleId) + '/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
                localStorage.removeItem(signedOutKey);
                sessionStorage.setItem('mfs_module_user_' + authModuleId, result.user.username);
                const errorBox = root.querySelector('#loginErr'); if (errorBox) errorBox.textContent = '';
                const user = { u: result.user.username, name: result.user.name || result.user.username, role: result.user.role, mm4role: result.user.role.toLowerCase() === 'admin' ? 'ADM' : undefined };
                const dataReady = await bridge?.reconnect();
                // The legacy screens read their database once during startup.
                // Reload after MySQL has hydrated browser state so both the
                // page data and session are initialized from the same snapshot.
                if (bridge && dataReady) { window.location.reload(); return; }
                const script = document.createElement('script');
                script.textContent = buildLegacyAuthScript(moduleId, authModuleId, user, 'login');
                document.body.appendChild(script); script.remove();
                if (typeof originalLogin !== 'function') {
                  const login = root.querySelector('#login'), app = root.querySelector('#app');
                  if (login) login.classList.add('hidden'); if (app) app.classList.remove('hidden');
                }
              } catch (loginError) {
                const errorBox = root.querySelector('#loginErr');
                if (errorBox) errorBox.textContent = loginError.status === 401 ? 'Username or password is incorrect.' : 'Could not connect to the module database. Please try again.';
              }
            }, true);
          }
        }
        document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
        window.dispatchEvent(new Event('load'));
        root.dispatchEvent(new Event('mfs:module-ready', { bubbles: true }));
        if (authModuleId) {
          moduleApiRequest('/modules/' + encodeURIComponent(authModuleId) + '/auth/session').then((session) => {
            if (!root.isConnected || !session.authenticated) return;
            if (localStorage.getItem('mfs_module_signed_out_' + authModuleId) === '1') {
              moduleApiRequest('/modules/' + encodeURIComponent(authModuleId) + '/auth/logout', { method: 'POST', body: '{}', keepalive: true }).catch(() => {});
              return;
            }
            const user = { u: session.user.username, name: session.user.name || session.user.username, role: session.user.role };
            const resumeModuleApp = document.createElement('script');
            resumeModuleApp.textContent = buildLegacyAuthScript(moduleId, authModuleId, user, 'resume');
            document.body.appendChild(resumeModuleApp); resumeModuleApp.remove();
          }).catch(() => {});
        }
      }
    };
    runScripts().catch((cause) => {
      if (root.isConnected) root.insertAdjacentHTML('afterbegin', '<div class="micro-app-script-error" role="alert">Some features could not finish loading. Refresh this page or check the local connection.</div>');
      console.error('MFS module startup failed:', cause);
    });
    // Authentication restoration can create the legacy navigation after the
    // initial scripts run. Retry briefly until the saved navigation exists.
    let restoreAttempts = 0;
    const restoreTimer = window.setInterval(() => {
      restoreAttempts += 1;
      if (restoreNavigation() || restoreAttempts >= 15) window.clearInterval(restoreTimer);
    }, 160);
    return () => {
      window.removeEventListener('error', reportScriptError);
      root.removeEventListener('click', rememberNavigation, true);
      window.clearInterval(restoreTimer);
      if (moduleSignOutClick) root.removeEventListener('click', moduleSignOutClick, true);
      headNodes.forEach((node) => node.remove());
      bridge?.destroy();
      document.querySelectorAll('script[src]').forEach((script) => { if (script.src.includes('/legacy/') || script.src.includes('xlsx.full.min.js')) script.remove(); });
    };
  }, [markup, styles, resources, scripts, sourceUrl, error]);

  if (error) return <main className="micro-app-error" role="alert"><h1>{title}</h1><p>{error}</p></main>;
  if (!markup) return <main className="micro-app-loading" aria-live="polite">Loading {title}…</main>;
  return <>{apiBindings.length > 0 && apiStatus.message && <div className={'module-api-status ' + apiStatus.kind} role="status" aria-live="polite">{apiStatus.message}</div>}<div id="mfs-module-root" ref={rootRef} dangerouslySetInnerHTML={{ __html: markup }} /></>;
}

function ModuleEntry() {
  const params = new URLSearchParams(location.search);
  const guide = params.get('guide') === 'api';
  const moduleId = params.get('module') || 'central-database';
  const file = guide ? '../legacy/api-guide.html' : (moduleId.startsWith('mm4-') || moduleId.startsWith('mm2-') ? '../legacy/' + moduleFiles[moduleId] : '../legacy/modules/' + (moduleFiles[moduleId] || moduleFiles['central-database']));
  const title = guide ? 'MFS Developer API Guide' : (moduleTitles[moduleId] || moduleId.replaceAll('-', ' '));
  useEffect(() => { document.title = title + ' · MFS'; }, [title]);
  return <ReactDocument sourceUrl={file} title={title} moduleId={moduleId} apiBindings={mm2StorageBindings[moduleId] || mm4StorageBindings[moduleId] || mm1StorageBindings[moduleId] || []} />;
}

createRoot(document.getElementById('module-root')).render(<ModuleEntry />);
