import { icon } from './icon.js';

let container = null;
let toastId = 0;

const typeConfig = {
  success: { icon: 'check', class: 'toast-success' },
  error: { icon: 'x', class: 'toast-error' },
  warning: { icon: 'alert-triangle', class: 'toast-warning' },
  info: { icon: 'info', class: 'toast-info' }
};

function ensureContainer() {
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

function createToast(message, type = 'info', duration = 4000) {
  const id = ++toastId;
  const config = typeConfig[type] || typeConfig.info;
  
  const toastEl = document.createElement('div');
  toastEl.className = `toast ${config.class}`;
  toastEl.dataset.toastId = id;
  toastEl.innerHTML = `
    <span class="toast-icon">${icon(config.icon, 18)}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close" data-action="close-toast">
      ${icon('x', 14)}
    </button>
  `;

  toastEl.querySelector('[data-action="close-toast"]').addEventListener('click', () => {
    dismissToast(toastEl);
  });

  ensureContainer().appendChild(toastEl);
  
  requestAnimationFrame(() => {
    toastEl.classList.add('show');
  });

  if (duration > 0) {
    setTimeout(() => dismissToast(toastEl), duration);
  }

  return id;
}

function dismissToast(toastEl) {
  if (!toastEl || toastEl.classList.contains('hiding')) return;
  
  toastEl.classList.add('hiding');
  toastEl.classList.remove('show');
  
  setTimeout(() => {
    toastEl.remove();
    if (container && container.children.length === 0) {
      container.remove();
      container = null;
    }
  }, 300);
}

export const toast = {
  success(message, duration) {
    return createToast(message, 'success', duration);
  },
  
  error(message, duration = 6000) {
    return createToast(message, 'error', duration);
  },
  
  warning(message, duration) {
    return createToast(message, 'warning', duration);
  },
  
  info(message, duration) {
    return createToast(message, 'info', duration);
  },
  
  dismiss(id) {
    const toastEl = container?.querySelector(`[data-toast-id="${id}"]`);
    if (toastEl) dismissToast(toastEl);
  },
  
  dismissAll() {
    container?.querySelectorAll('.toast').forEach(dismissToast);
  }
};

export function initToast() {
  ensureContainer();
}
