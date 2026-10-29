(() => {
  const MIN_TEXT_PX = 15;
  const UI_FONT = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
  const skip = 'i, svg, path, canvas, [aria-hidden="true"], .brand small, input[type="checkbox"], input[type="radio"], input[type="range"], .fa, .fas, .far, .fab';

  function tune(root) {
    const nodes = [];
    if (root.nodeType === Node.ELEMENT_NODE) nodes.push(root);
    if (root.querySelectorAll) nodes.push(...root.querySelectorAll('*'));
    for (const element of nodes) {
      if (element.matches(skip)) continue;
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const size = Number.parseFloat(style.fontSize);
      if (Number.isFinite(size) && size < MIN_TEXT_PX) {
        element.style.setProperty('font-size', `${MIN_TEXT_PX}px`, 'important');
      }
      if (!element.closest('pre, code, kbd, samp') && element.style.getPropertyValue('font-family') !== UI_FONT) {
        element.style.setProperty('font-family', UI_FONT, 'important');
      }
    }
  }

  function start() {
    tune(document.documentElement);
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => tune(document.documentElement), 120);
    }, { passive: true });
    const observer = new MutationObserver((changes) => {
      for (const change of changes) {
        if (change.type === 'childList') change.addedNodes.forEach(tune);
        else tune(change.target);
      }
    });
    observer.observe(document.documentElement, {
      subtree: true, childList: true, attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'],
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

