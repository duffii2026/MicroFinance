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
};

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

function ReactDocument({ sourceUrl, title }) {
  const rootRef = useRef(null);
  const [markup, setMarkup] = useState('');
  const [styles, setStyles] = useState([]);
  const [resources, setResources] = useState([]);
  const [scripts, setScripts] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch(sourceUrl, { credentials: 'same-origin' }).then((response) => {
      if (!response.ok) throw new Error('Could not load ' + title + ' (' + response.status + ').');
      return response.text();
    }).then(async (html) => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const css = [...doc.querySelectorAll('style')].map((style) => style.textContent || '').filter(Boolean);
      const links = [...doc.querySelectorAll('link[rel="stylesheet"]')].map((link) => new URL(link.getAttribute('href'), new URL(sourceUrl, location.href)).href);
      const localStyles = await Promise.all(links.filter((href) => new URL(href).origin === location.origin).map(async (href) => {
        const response = await fetch(href, { credentials: 'same-origin' });
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
    const headNodes = [];
    const injectedStyle = document.createElement('style');
    injectedStyle.dataset.mfsModuleStyles = '';
    injectedStyle.textContent = styles.map(scopeCss).join('\n');
    document.head.appendChild(injectedStyle); headNodes.push(injectedStyle);
    resources.filter((href) => new URL(href).origin !== location.origin).forEach((href) => {
      const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = href; link.dataset.mfsModuleResource = '';
      document.head.appendChild(link); headNodes.push(link);
    });
    const runScripts = async () => {
      for (const item of scripts) {
        if (!root.isConnected) break;
        const script = document.createElement('script');
        if (item.type) script.type = item.type;
        if (item.src) {
          script.src = new URL(item.src, new URL(sourceUrl, location.href)).href;
          script.async = false;
          await new Promise((resolve, reject) => { script.onload = resolve; script.onerror = () => reject(new Error('A module script could not be loaded.')); document.body.appendChild(script); });
        } else {
          script.textContent = item.text;
          document.body.appendChild(script);
        }
      }
      if (root.isConnected) {
        document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
        window.dispatchEvent(new Event('load'));
        root.dispatchEvent(new Event('mfs:module-ready', { bubbles: true }));
      }
    };
    runScripts().catch((cause) => {
      if (root.isConnected) root.insertAdjacentHTML('afterbegin', '<div class="micro-app-script-error" role="alert">Some features could not finish loading. Refresh this page or check the local connection.</div>');
      console.error('MFS module startup failed:', cause);
    });
    return () => {
      headNodes.forEach((node) => node.remove());
      document.querySelectorAll('script[src]').forEach((script) => { if (script.src.includes('/legacy/') || script.src.includes('xlsx.full.min.js')) script.remove(); });
    };
  }, [markup, styles, resources, scripts, sourceUrl, error]);

  if (error) return <main className="micro-app-error" role="alert"><h1>{title}</h1><p>{error}</p></main>;
  if (!markup) return <main className="micro-app-loading" aria-live="polite">Loading {title}…</main>;
  return <div id="mfs-module-root" ref={rootRef} dangerouslySetInnerHTML={{ __html: markup }} />;
}

function ModuleEntry() {
  const params = new URLSearchParams(location.search);
  const guide = params.get('guide') === 'api';
  const moduleId = params.get('module') || 'central-database';
  const file = guide ? '../legacy/api-guide.html' : '../legacy/modules/' + (moduleFiles[moduleId] || moduleFiles['central-database']);
  const title = guide ? 'MFS Developer API Guide' : moduleId.replaceAll('-', ' ');
  useEffect(() => { document.title = title + ' · MFS'; }, [title]);
  return <ReactDocument sourceUrl={file} title={title} />;
}

createRoot(document.getElementById('module-root')).render(<ModuleEntry />);
