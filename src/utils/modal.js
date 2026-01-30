import { escapeHtml } from './security.js';

export function confirm(message, options = {}) {
  return new Promise((resolve) => {
    const { title = 'Confirm', confirmText = 'Confirm', cancelText = 'Cancel', danger = false } = options;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3>${escapeHtml(title)}</h3>
        </div>
        <div class="modal-body">
          <p>${escapeHtml(message)}</p>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" id="modal-cancel">${cancelText}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="modal-confirm">${confirmText}</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('active'));
    
    const close = (result) => {
      modal.classList.remove('active');
      setTimeout(() => modal.remove(), 150);
      resolve(result);
    };
    
    modal.querySelector('#modal-cancel').onclick = () => close(false);
    modal.querySelector('#modal-confirm').onclick = () => close(true);
    modal.querySelector('.modal-backdrop').onclick = () => close(false);
    
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        close(false);
        document.removeEventListener('keydown', handleKey);
      } else if (e.key === 'Enter') {
        close(true);
        document.removeEventListener('keydown', handleKey);
      }
    };
    document.addEventListener('keydown', handleKey);
    
    modal.querySelector('#modal-confirm').focus();
  });
}

export function prompt(message, options = {}) {
  return new Promise((resolve) => {
    const { title = 'Input', placeholder = '', defaultValue = '', confirmText = 'OK', cancelText = 'Cancel' } = options;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3>${escapeHtml(title)}</h3>
        </div>
        <div class="modal-body">
          <p>${escapeHtml(message)}</p>
          <input type="text" class="input" id="modal-input" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(defaultValue)}">
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" id="modal-cancel">${cancelText}</button>
          <button class="btn btn-primary" id="modal-confirm">${confirmText}</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('active'));
    
    const input = modal.querySelector('#modal-input');
    setTimeout(() => {
      input.focus();
      input.select();
    }, 50);
    
    const close = (result) => {
      modal.classList.remove('active');
      setTimeout(() => modal.remove(), 150);
      resolve(result);
    };
    
    modal.querySelector('#modal-cancel').onclick = () => close(null);
    modal.querySelector('#modal-confirm').onclick = () => close(input.value);
    modal.querySelector('.modal-backdrop').onclick = () => close(null);
    
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        close(input.value);
      } else if (e.key === 'Escape') {
        close(null);
      }
    });
  });
}

export function alert(message, options = {}) {
  return new Promise((resolve) => {
    const { title = 'Alert', confirmText = 'OK' } = options;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3>${escapeHtml(title)}</h3>
        </div>
        <div class="modal-body">
          <p>${escapeHtml(message)}</p>
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary" id="modal-confirm">${confirmText}</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('active'));
    
    const close = () => {
      modal.classList.remove('active');
      setTimeout(() => modal.remove(), 150);
      resolve();
    };
    
    modal.querySelector('#modal-confirm').onclick = close;
    modal.querySelector('.modal-backdrop').onclick = close;
    
    const handleKey = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        close();
        document.removeEventListener('keydown', handleKey);
      }
    };
    document.addEventListener('keydown', handleKey);
    
    modal.querySelector('#modal-confirm').focus();
  });
}
