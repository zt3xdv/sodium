import { icon } from './icon.js';

let activeModal = null;
let modalContainer = null;

function ensureContainer() {
  if (!modalContainer) {
    modalContainer = document.createElement('div');
    modalContainer.id = 'modal-container';
    document.body.appendChild(modalContainer);
  }
  return modalContainer;
}

export function openModal(options) {
  closeModal();
  
  const {
    title = 'Modal',
    content = '',
    actions = [],
    size = 'md',
    closable = true
  } = options;

  const sizeClass = size === 'large' ? 'modal-lg' : size === 'sm' ? 'modal-sm' : 'modal-md';

  const actionButtons = actions.map((action, index) => {
    const btnClass = action.class || 'btn-secondary';
    return `
      <button class="btn ${btnClass}" data-action-index="${index}">
        ${action.label}
      </button>
    `;
  }).join('');

  const html = `
    <div class="modal-backdrop">
      <div class="modal ${sizeClass}">
        <div class="modal-header">
          <h3 class="modal-title">${title}</h3>
          ${closable ? `
            <button class="modal-close" data-modal-close>
              ${icon('x', 20)}
            </button>
          ` : ''}
        </div>
        <div class="modal-body">
          ${content}
        </div>
        ${actions.length > 0 ? `
          <div class="modal-footer">
            ${actionButtons}
          </div>
        ` : ''}
      </div>
    </div>
  `;

  ensureContainer().innerHTML = html;
  activeModal = modalContainer.querySelector('.modal-backdrop');
  document.body.classList.add('modal-open');

  requestAnimationFrame(() => {
    activeModal?.classList.add('open');
  });

  activeModal.addEventListener('click', (e) => {
    if (e.target.closest('[data-modal-close]')) {
      closeModal();
      return;
    }

    if (e.target === activeModal && closable) {
      closeModal();
      return;
    }

    const actionBtn = e.target.closest('[data-action-index]');
    if (actionBtn) {
      const index = parseInt(actionBtn.dataset.actionIndex);
      const action = actions[index];
      if (action && typeof action.action === 'function') {
        action.action();
      }
    }
  });

  document.addEventListener('keydown', handleEscape);
}

function handleEscape(e) {
  if (e.key === 'Escape' && activeModal) {
    closeModal();
  }
}

export function closeModal() {
  if (activeModal) {
    activeModal.classList.remove('open');
    document.body.classList.remove('modal-open');
    document.removeEventListener('keydown', handleEscape);

    setTimeout(() => {
      if (modalContainer) {
        modalContainer.innerHTML = '';
      }
      activeModal = null;
    }, 200);
  }
}

export async function confirmModal(title, message) {
  return new Promise((resolve) => {
    openModal({
      title,
      content: `<p>${message}</p>`,
      size: 'sm',
      actions: [
        { 
          label: 'Cancel', 
          class: 'btn-ghost', 
          action: () => {
            closeModal();
            resolve(false);
          }
        },
        { 
          label: 'Confirm', 
          class: 'btn-danger', 
          action: () => {
            closeModal();
            resolve(true);
          }
        }
      ]
    });
  });
}

export function initModal() {
  ensureContainer();
}
