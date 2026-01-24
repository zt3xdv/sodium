import { icon } from './icon.js';

let activeDropdown = null;

export function dropdown({ id, trigger, items = [], align = 'left' }) {
  const menuItems = items.map(item => {
    if (item.divider) {
      return '<div class="dropdown-divider"></div>';
    }

    const className = [
      'dropdown-item',
      item.danger ? 'dropdown-item-danger' : '',
      item.disabled ? 'dropdown-item-disabled' : ''
    ].filter(Boolean).join(' ');

    return `
      <button 
        class="${className}" 
        data-action="${item.action || ''}"
        ${item.disabled ? 'disabled' : ''}
      >
        ${item.icon ? icon(item.icon, 16) : ''}
        <span>${item.label}</span>
        ${item.shortcut ? `<span class="dropdown-shortcut">${item.shortcut}</span>` : ''}
      </button>
    `;
  }).join('');

  return `
    <div class="dropdown" data-dropdown="${id}">
      <button class="dropdown-trigger" data-dropdown-trigger="${id}">
        ${trigger}
      </button>
      <div class="dropdown-menu dropdown-${align}" id="${id}">
        ${menuItems}
      </div>
    </div>
  `;
}

export function dropdownMenu(items, align = 'left') {
  const menuItems = items.map(item => {
    if (item.divider) {
      return '<div class="dropdown-divider"></div>';
    }

    const className = [
      'dropdown-item',
      item.danger ? 'dropdown-item-danger' : '',
      item.disabled ? 'dropdown-item-disabled' : ''
    ].filter(Boolean).join(' ');

    if (item.href) {
      return `
        <a href="${item.href}" class="${className}">
          ${item.icon ? icon(item.icon, 16) : ''}
          <span>${item.label}</span>
        </a>
      `;
    }

    return `
      <button 
        class="${className}" 
        data-action="${item.action || ''}"
        ${item.disabled ? 'disabled' : ''}
      >
        ${item.icon ? icon(item.icon, 16) : ''}
        <span>${item.label}</span>
      </button>
    `;
  }).join('');

  return `<div class="dropdown-menu dropdown-${align}">${menuItems}</div>`;
}

function openDropdown(dropdownEl) {
  closeAllDropdowns();
  dropdownEl.classList.add('open');
  activeDropdown = dropdownEl;
}

function closeDropdown(dropdownEl) {
  dropdownEl?.classList.remove('open');
  if (activeDropdown === dropdownEl) {
    activeDropdown = null;
  }
}

function closeAllDropdowns() {
  document.querySelectorAll('.dropdown.open').forEach(d => {
    d.classList.remove('open');
  });
  activeDropdown = null;
}

export function initDropdown() {
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-dropdown-trigger]');
    
    if (trigger) {
      e.stopPropagation();
      const id = trigger.dataset.dropdownTrigger;
      const dropdownEl = document.querySelector(`[data-dropdown="${id}"]`);
      
      if (dropdownEl?.classList.contains('open')) {
        closeDropdown(dropdownEl);
      } else {
        openDropdown(dropdownEl);
      }
      return;
    }

    const dropdownItem = e.target.closest('.dropdown-item');
    if (dropdownItem && !dropdownItem.disabled) {
      closeAllDropdowns();
      return;
    }

    if (!e.target.closest('.dropdown-menu')) {
      closeAllDropdowns();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activeDropdown) {
      closeAllDropdowns();
    }
  });
}

export { closeAllDropdowns };
