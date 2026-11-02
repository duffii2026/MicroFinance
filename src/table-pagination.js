const PAGE_SIZE = 10;

function dataRows(table) {
  const body = table.tBodies[0];
  if (!body) return [];
  return [...body.rows].filter((row) => !row.querySelector('td[colspan]'));
}

export function installTablePagination(root, pageSize = PAGE_SIZE) {
  if (!root) return () => {};
  let queued = false;
  const refresh = () => {
    queued = false;
    root.querySelectorAll('table').forEach((table, tableIndex) => {
      const rows = dataRows(table);
      const host = table.parentElement;
      if (!host) return;
      const pagerId = `mfs-pager-${tableIndex}`;
      let pager = [...host.children].find((node) => node.dataset?.mfsPager === pagerId);
      if (rows.length <= pageSize) {
        rows.forEach((row) => { row.hidden = false; });
        pager?.remove();
        return;
      }
      const totalPages = Math.ceil(rows.length / pageSize);
      const current = Math.min(Math.max(Number(table.dataset.mfsPage || 1), 1), totalPages);
      table.dataset.mfsPage = String(current);
      rows.forEach((row, index) => { row.hidden = index < (current - 1) * pageSize || index >= current * pageSize; });
      if (!pager) {
        pager = document.createElement('nav');
        pager.className = 'mfs-table-pagination';
        pager.dataset.mfsPager = pagerId;
        pager.setAttribute('aria-label', 'Table pagination');
        pager.addEventListener('click', (event) => {
          const button = event.target.closest('button[data-page]');
          if (!button) return;
          table.dataset.mfsPage = button.dataset.page;
          refresh();
        });
        host.appendChild(pager);
      }
      const first = (current - 1) * pageSize + 1;
      const last = Math.min(current * pageSize, rows.length);
      pager.innerHTML = `<span>Showing ${first}–${last} of ${rows.length}</span><div><button type="button" data-page="${current - 1}" ${current === 1 ? 'disabled' : ''}>Previous</button><span>Page ${current} of ${totalPages}</span><button type="button" data-page="${current + 1}" ${current === totalPages ? 'disabled' : ''}>Next</button></div>`;
    });
  };
  const schedule = () => { if (!queued) { queued = true; queueMicrotask(refresh); } };
  const observer = new MutationObserver((changes) => {
    const changedOutsidePager = changes.some((change) => {
      const target = change.target instanceof Element ? change.target : null;
      return !target?.closest('.mfs-table-pagination');
    });
    if (changedOutsidePager) schedule();
  });
  observer.observe(root, { childList: true, subtree: true });
  refresh();
  return () => observer.disconnect();
}
