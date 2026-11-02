/**
 * Shared table pagination for every module (legacy MM1/MM4 screens and the
 * native React screens).
 *
 * The bar is rendered with a stable skeleton and only its inner parts are
 * re-rendered, so focus survives page changes and screen readers get one live
 * region instead of a rebuilt subtree.
 *
 * Markup produced:
 *   <nav class="mfs-pager" aria-label="Table pagination">
 *     <p class="mfs-pager__summary" aria-live="polite">Showing 1–10 of 47</p>
 *     <div class="mfs-pager__controls">
 *       <label class="mfs-pager__size">Rows <select>…</select></label>
 *       <div class="mfs-pager__pages"> « ‹ 1 2 … 5 › » </div>
 *       <span class="mfs-pager__status">Page 1 of 5</span>
 *     </div>
 *   </nav>
 *
 * Styling lives in public/ui-kit.css so iframes and the React shell match.
 */

const PAGE_SIZE = 10;
const PAGE_SIZES = [10, 25, 50, 100];
const GAP = 'gap';

function dataRows(table) {
  const body = table.tBodies[0];
  if (!body) return [];
  return [...body.rows].filter((row) => !row.querySelector('td[colspan]'));
}

/** 1 … 4 5 6 … 12 */
function pageList(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push(GAP);
  for (let page = start; page <= end; page += 1) pages.push(page);
  if (end < total - 1) pages.push(GAP);
  pages.push(total);
  return pages;
}

const icon = (name) => {
  const paths = {
    first: 'M18 6l-6 6 6 6M7 6v12',
    prev: 'M15 6l-6 6 6 6',
    next: 'M9 6l6 6-6 6',
    last: 'M6 6l6 6-6 6M17 6v12',
  };
  return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]}"/></svg>`;
};

function renderPager(pager, table, rows, pageSize, current, totalPages) {
  const first = (current - 1) * pageSize + 1;
  const last = Math.min(current * pageSize, rows.length);

  const summary = pager.querySelector('[data-mfs-pager-summary]');
  summary.textContent = `Showing ${first}–${last} of ${rows.length}`;

  const select = pager.querySelector('[data-mfs-pager-size]');
  if (!select.dataset.mfsBuilt) {
    select.innerHTML = PAGE_SIZES.map((size) => `<option value="${size}">${size}</option>`).join('');
    select.dataset.mfsBuilt = '1';
  }
  // A size stored by an older version (or set programmatically) must still show.
  const sizeValue = String(pageSize);
  if (![...select.options].some((option) => option.value === sizeValue)) {
    select.insertAdjacentHTML('afterbegin', `<option value="${sizeValue}">${sizeValue}</option>`);
  }
  select.value = sizeValue;

  const atFirst = current === 1;
  const atLast = current === totalPages;
  const pages = pager.querySelector('[data-mfs-pager-pages]');
  pages.innerHTML = [
    `<button type="button" data-mfs-page="1" data-action="first" aria-label="First page" ${atFirst ? 'disabled' : ''}>${icon('first')}</button>`,
    `<button type="button" data-mfs-page="${current - 1}" data-action="prev" aria-label="Previous page" ${atFirst ? 'disabled' : ''}>${icon('prev')}</button>`,
    ...pageList(current, totalPages).map((page) => (page === GAP
      ? '<span class="mfs-pager__gap" aria-hidden="true">…</span>'
      : `<button type="button" data-mfs-page="${page}" data-action="page" ${page === current ? 'aria-current="page"' : ''} aria-label="Page ${page}">${page}</button>`)),
    `<button type="button" data-mfs-page="${current + 1}" data-action="next" aria-label="Next page" ${atLast ? 'disabled' : ''}>${icon('next')}</button>`,
    `<button type="button" data-mfs-page="${totalPages}" data-action="last" aria-label="Last page" ${atLast ? 'disabled' : ''}>${icon('last')}</button>`,
  ].join('');

  pager.querySelector('[data-mfs-pager-status]').textContent = `Page ${current} of ${totalPages}`;
}

export function installTablePagination(root, defaultPageSize = PAGE_SIZE) {
  if (!root) return () => {};
  let queued = false;
  let focusedAction = null;

  const refresh = () => {
    queued = false;
    root.querySelectorAll('table').forEach((table, tableIndex) => {
      const rows = dataRows(table);
      const host = table.parentElement;
      if (!host) return;
      // Wide legacy tables use a horizontal-scroll wrapper: keep the pager
      // outside it so it never scrolls sideways with the table.
      const pagerHost = host.classList.contains('tw') && host.parentElement ? host.parentElement : host;
      const pagerId = `mfs-pager-${tableIndex}`;
      let pager = root.querySelector(`[data-mfs-pager="${pagerId}"]`);
      const pageSize = Math.max(5, Number(table.dataset.mfsPageSize) || defaultPageSize);

      // Keep the bar (and its page-size control) as long as the table *could*
      // paginate at the smallest size; otherwise it just takes up room.
      if (rows.length <= PAGE_SIZES[0]) {
        rows.forEach((row) => { row.hidden = false; });
        pager?.remove();
        return;
      }

      const totalPages = Math.ceil(rows.length / pageSize);
      const current = Math.min(Math.max(Number(table.dataset.mfsPage || 1), 1), totalPages);
      table.dataset.mfsPage = String(current);
      rows.forEach((row, index) => {
        row.hidden = index < (current - 1) * pageSize || index >= current * pageSize;
      });

      if (!pager) {
        pager = document.createElement('div');
        pager.className = 'mfs-pager';
        pager.dataset.mfsPager = pagerId;
        pager.setAttribute('role', 'navigation');
        pager.setAttribute('aria-label', 'Table pagination');
        pager.innerHTML = `
          <p class="mfs-pager__summary" data-mfs-pager-summary aria-live="polite"></p>
          <div class="mfs-pager__controls">
            <label class="mfs-pager__size">Rows
              <select data-mfs-pager-size aria-label="Rows per page"></select>
            </label>
            <div class="mfs-pager__pages" data-mfs-pager-pages></div>
            <span class="mfs-pager__status" data-mfs-pager-status aria-hidden="true"></span>
          </div>`;

        pager.addEventListener('click', (event) => {
          const button = event.target.closest('button[data-mfs-page]');
          if (!button || button.disabled) return;
          focusedAction = button.dataset.action;
          table.dataset.mfsPage = button.dataset.mfsPage;
          refresh();
        });

        pager.addEventListener('change', (event) => {
          const select = event.target.closest('select[data-mfs-pager-size]');
          if (!select) return;
          table.dataset.mfsPageSize = select.value;
          table.dataset.mfsPage = '1';
          refresh();
        });
      }

      if (pager.parentElement !== pagerHost) pagerHost.appendChild(pager);
      renderPager(pager, table, rows, pageSize, current, totalPages);

      // Keep keyboard focus on the equivalent control after a re-render.
      if (focusedAction) {
        const action = focusedAction;
        focusedAction = null;
        const target = pager.querySelector(`button[data-action="${action}"]:not([disabled])`)
          || pager.querySelector('button[data-action="page"][aria-current="page"]')
          || pager.querySelector('button:not([disabled])');
        target?.focus({ preventScroll: true });
      }
    });
  };

  const schedule = () => { if (!queued) { queued = true; queueMicrotask(refresh); } };
  const observer = new MutationObserver((changes) => {
    const changedOutsidePager = changes.some((change) => {
      const target = change.target instanceof Element ? change.target : null;
      return !target?.closest('.mfs-pager');
    });
    if (changedOutsidePager) schedule();
  });
  observer.observe(root, { childList: true, subtree: true });
  refresh();
  return () => observer.disconnect();
}
