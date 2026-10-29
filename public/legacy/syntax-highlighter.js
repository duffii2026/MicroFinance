(() => {
  const escapeHtml = (text) => text.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const tokens = /(\/\/[^\n]*|#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b(?:const|let|var|async|await|function|return|throw|new|process|true|false|null|undefined)\b|\b(?:GET|POST|PATCH|DELETE|OPTIONS)\b|-[A-Za-z]+|\b\d+(?:\.\d+)?\b|[{}()[\],.:;])/g;

  function paint(element) {
    if (element.dataset.syntaxReady === 'true') return;
    const source = element.textContent;
    const jsonMode = source.trimStart().startsWith('{');
    let html = '', lastIndex = 0;
    for (const match of source.matchAll(tokens)) {
      const token = match[0], index = match.index;
      html += escapeHtml(source.slice(lastIndex, index));
      let type = 'punct';
      if (token.startsWith('//') || token.startsWith('#')) type = 'comment';
      else if (/^["'`]/.test(token)) type = jsonMode && /^\s*:/.test(source.slice(index + token.length)) ? 'key' : 'string';
      else if (/^(const|let|var|async|await|function|return|throw|new|process|true|false|null|undefined)$/.test(token)) type = 'keyword';
      else if (/^(GET|POST|PATCH|DELETE|OPTIONS)$/.test(token)) type = 'method';
      else if (/^-[A-Za-z]+$/.test(token)) type = 'flag';
      else if (/^\d/.test(token)) type = 'number';
      html += `<span class="tok-${type}">${escapeHtml(token)}</span>`;
      lastIndex = index + token.length;
    }
    html += escapeHtml(source.slice(lastIndex));
    element.innerHTML = html;
    element.dataset.syntaxReady = 'true';
  }

  function highlight(root = document) {
    const candidates = [];
    if (root.matches?.('pre.api-code')) candidates.push(root);
    candidates.push(...(root.querySelectorAll?.('.code-wrap pre code, pre.api-code') || []));
    candidates.forEach(paint);
  }

  window.mfsHighlightCode = highlight;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => highlight(), { once: true });
  else highlight();
})();
