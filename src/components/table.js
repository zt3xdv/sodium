import { icon } from './icon.js';

export function table({ columns = [], data = [], loading = false, emptyMessage = 'No data found', sortable = false, sortBy = null, sortDir = 'asc', onSort = null }) {
  if (loading) {
    return `
      <div class="table-container">
        <div class="table-loading">
          <div class="spinner"></div>
          <span>Loading...</span>
        </div>
      </div>
    `;
  }

  if (data.length === 0) {
    return `
      <div class="table-container">
        <div class="table-empty">
          ${icon('inbox', 48)}
          <p>${emptyMessage}</p>
        </div>
      </div>
    `;
  }

  const headerCells = columns.map(col => {
    const isSorted = sortBy === col.key;
    const sortIcon = isSorted 
      ? (sortDir === 'asc' ? icon('chevron-up', 14) : icon('chevron-down', 14))
      : '';
    
    const sortAttr = sortable && col.sortable !== false 
      ? `data-sort="${col.key}"` 
      : '';
    
    const sortClass = sortable && col.sortable !== false ? 'sortable' : '';
    const activeClass = isSorted ? 'sorted' : '';
    
    return `
      <th class="${sortClass} ${activeClass} ${col.align || ''}" ${sortAttr} style="${col.width ? `width: ${col.width}` : ''}">
        <span class="th-content">
          ${col.label}
          ${sortIcon}
        </span>
      </th>
    `;
  }).join('');

  const rows = data.map(row => {
    const cells = columns.map(col => {
      let value = row[col.key];
      
      if (col.render) {
        value = col.render(value, row);
      } else if (value === null || value === undefined) {
        value = '-';
      }
      
      return `<td class="${col.align || ''}">${value}</td>`;
    }).join('');
    
    return `<tr data-id="${row.id || ''}">${cells}</tr>`;
  }).join('');

  return `
    <div class="table-container">
      <table class="table">
        <thead>
          <tr>${headerCells}</tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

export function initTable(container, { onSort } = {}) {
  container?.addEventListener('click', (e) => {
    const th = e.target.closest('[data-sort]');
    if (th && onSort) {
      const key = th.dataset.sort;
      const currentDir = th.classList.contains('sorted') 
        ? (th.querySelector('.icon') ? 'asc' : 'desc')
        : null;
      const newDir = currentDir === 'asc' ? 'desc' : 'asc';
      onSort(key, newDir);
    }
  });
}

export function statusBadge(status) {
  const statusMap = {
    online: { class: 'success', label: 'Online' },
    running: { class: 'success', label: 'Running' },
    offline: { class: 'danger', label: 'Offline' },
    stopped: { class: 'danger', label: 'Stopped' },
    starting: { class: 'warning', label: 'Starting' },
    stopping: { class: 'warning', label: 'Stopping' },
    installing: { class: 'info', label: 'Installing' },
    error: { class: 'danger', label: 'Error' }
  };

  const info = statusMap[status] || { class: 'secondary', label: status };
  return `<span class="badge badge-${info.class}">${info.label}</span>`;
}

export function actionButtons(actions) {
  return `
    <div class="table-actions">
      ${actions.map(action => `
        <button 
          class="btn btn-icon btn-${action.variant || 'ghost'}" 
          data-action="${action.id}"
          title="${action.label}"
          ${action.disabled ? 'disabled' : ''}
        >
          ${icon(action.icon, 16)}
        </button>
      `).join('')}
    </div>
  `;
}
