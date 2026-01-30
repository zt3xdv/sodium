import { escapeHtml } from '../../../utils/security.js';
import { formatBytes } from '../../../utils/format.js';
import { state } from '../state.js';

export { formatBytes };

export function jsonToYaml(obj, indent = 0) {
  let yaml = '';
  const spaces = '  '.repeat(indent);
  
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      yaml += `${spaces}${key}: null\n`;
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      yaml += `${spaces}${key}:\n${jsonToYaml(value, indent + 1)}`;
    } else if (Array.isArray(value)) {
      yaml += `${spaces}${key}:\n`;
      value.forEach(item => {
        if (typeof item === 'object') {
          yaml += `${spaces}  -\n${jsonToYaml(item, indent + 2)}`;
        } else {
          yaml += `${spaces}  - ${item}\n`;
        }
      });
    } else if (typeof value === 'string') {
      yaml += `${spaces}${key}: "${value}"\n`;
    } else {
      yaml += `${spaces}${key}: ${value}\n`;
    }
  }
  return yaml;
}

export function renderPagination(meta, tab) {
  if (!meta || meta.total === 0) return '';
  
  let pageNumbers = '';
  const maxVisible = 5;
  let startPage = Math.max(1, meta.current_page - Math.floor(maxVisible / 2));
  let endPage = Math.min(meta.total_pages, startPage + maxVisible - 1);
  
  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }
  
  if (startPage > 1) {
    pageNumbers += `<button class="page-num" data-page="1">1</button>`;
    if (startPage > 2) pageNumbers += `<span class="page-ellipsis">...</span>`;
  }
  
  for (let i = startPage; i <= endPage; i++) {
    pageNumbers += `<button class="page-num ${i === meta.current_page ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }
  
  if (endPage < meta.total_pages) {
    if (endPage < meta.total_pages - 1) pageNumbers += `<span class="page-ellipsis">...</span>`;
    pageNumbers += `<button class="page-num" data-page="${meta.total_pages}">${meta.total_pages}</button>`;
  }
  
  return `
    <div class="pagination">
      <div class="pagination-left">
        <select class="per-page-select" data-tab="${tab}">
          <option value="10" ${meta.per_page === 10 ? 'selected' : ''}>10</option>
          <option value="25" ${meta.per_page === 25 ? 'selected' : ''}>25</option>
          <option value="50" ${meta.per_page === 50 ? 'selected' : ''}>50</option>
        </select>
        <span class="per-page-label">per page</span>
      </div>
      
      <div class="pagination-center">
        <button class="page-btn" data-page="${meta.current_page - 1}" ${meta.current_page <= 1 ? 'disabled' : ''}>
          <span class="material-icons-outlined">chevron_left</span>
        </button>
        <div class="page-numbers">${pageNumbers}</div>
        <button class="page-btn" data-page="${meta.current_page + 1}" ${meta.current_page >= meta.total_pages ? 'disabled' : ''}>
          <span class="material-icons-outlined">chevron_right</span>
        </button>
      </div>
      
      <div class="pagination-right">
        <span class="goto-label">Go to</span>
        <input type="number" class="goto-input" min="1" max="${meta.total_pages}" value="${meta.current_page}" data-tab="${tab}" />
        <span class="page-total">of ${meta.total_pages} (${meta.total} items)</span>
      </div>
    </div>
  `;
}

export function setupPaginationListeners(tab, loadViewCallback) {
  document.querySelectorAll('.pagination .page-btn').forEach(btn => {
    btn.onclick = () => {
      const page = parseInt(btn.dataset.page);
      if (page >= 1) {
        state.currentPage[tab] = page;
        loadViewCallback();
      }
    };
  });
  
  document.querySelectorAll('.pagination .page-num').forEach(btn => {
    btn.onclick = () => {
      state.currentPage[tab] = parseInt(btn.dataset.page);
      loadViewCallback();
    };
  });
  
  const perPageSelect = document.querySelector('.per-page-select');
  if (perPageSelect) {
    perPageSelect.onchange = (e) => {
      state.itemsPerPage[tab] = parseInt(e.target.value);
      state.currentPage[tab] = 1;
      loadViewCallback();
    };
  }
  
  const gotoInput = document.querySelector('.goto-input');
  if (gotoInput) {
    gotoInput.onkeypress = (e) => {
      if (e.key === 'Enter') {
        let page = parseInt(gotoInput.value);
        const max = parseInt(gotoInput.max);
        if (page < 1) page = 1;
        if (page > max) page = max;
        state.currentPage[tab] = page;
        loadViewCallback();
      }
    };
  }
}

export function renderBreadcrumb(items) {
  return `
    <nav class="admin-breadcrumb">
      ${items.map((item, idx) => `
        ${idx > 0 ? '<span class="material-icons-outlined">chevron_right</span>' : ''}
        ${item.onClick ? `<a href="#" class="breadcrumb-item" data-action="${item.onClick}">${escapeHtml(item.label)}</a>` : `<span class="breadcrumb-item current">${escapeHtml(item.label)}</span>`}
      `).join('')}
    </nav>
  `;
}

export function setupBreadcrumbListeners(navigateToCallback) {
  document.querySelectorAll('.breadcrumb-item[data-action]').forEach(el => {
    el.onclick = (e) => {
      e.preventDefault();
      const action = el.dataset.action;
      if (action === 'list-nodes') navigateToCallback('nodes');
      else if (action === 'list-servers') navigateToCallback('servers');
      else if (action === 'list-users') navigateToCallback('users');
      else if (action === 'list-nests') navigateToCallback('nests');
      else if (action === 'list-locations') navigateToCallback('locations');
    };
  });
}
