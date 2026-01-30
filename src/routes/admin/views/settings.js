import { escapeHtml } from '../../../utils/security.js';
import * as toast from '../../../utils/toast.js';
import { api } from '../../../utils/api.js';
import { state } from '../state.js';
import { renderBreadcrumb, setupBreadcrumbListeners } from '../utils/ui.js';

const navigateTo = (...args) => window.adminNavigate(...args);

export async function renderSettingsPage(container, username, loadView) {
  try {
    const res = await api(`/api/admin/settings`);
    const data = await res.json();
    const config = data.config || {};
    
    container.innerHTML = `
      <div class="admin-header">
        ${renderBreadcrumb([{ label: 'Settings' }])}
      </div>
      
      <div class="settings-page">
        <form id="panel-settings-form" class="settings-form">
          <div class="detail-card">
            <h3>General Settings</h3>
            <div class="form-grid">
              <div class="form-group">
                <label>Panel Name</label>
                <input type="text" name="panel_name" value="${escapeHtml(config.panel?.name || 'Sodium Panel')}" />
              </div>
              <div class="form-group">
                <label>Panel URL</label>
                <input type="url" name="panel_url" value="${escapeHtml(config.panel?.url || '')}" placeholder="https://panel.example.com" />
              </div>
            </div>
          </div>
          
          <div class="detail-card">
            <h3>Registration</h3>
            <div class="form-toggles">
              <label class="toggle-item">
                <input type="checkbox" name="registration_enabled" ${config.registration?.enabled ? 'checked' : ''} />
                <span class="toggle-content">
                  <span class="toggle-title">Allow Registrations</span>
                  <span class="toggle-desc">Allow new users to register on the panel</span>
                </span>
              </label>
            </div>
          </div>
          
          <div class="detail-card">
            <h3>Features</h3>
            <div class="form-toggles">
              <label class="toggle-item">
                <input type="checkbox" name="subusers_enabled" ${config.features?.subusers !== false ? 'checked' : ''} />
                <span class="toggle-content">
                  <span class="toggle-title">Subusers</span>
                  <span class="toggle-desc">Allow users to share server access with others</span>
                </span>
              </label>
            </div>
          </div>
          
          <div class="detail-card">
            <h3>Default User Limits</h3>
            <p class="card-description">These limits are applied to new users when they register.</p>
            <div class="form-grid">
              <div class="form-group">
                <label>Max Servers</label>
                <input type="number" name="default_servers" value="${config.defaults?.servers || 2}" min="0" />
              </div>
              <div class="form-group">
                <label>Max Memory (MB)</label>
                <input type="number" name="default_memory" value="${config.defaults?.memory || 2048}" min="0" />
              </div>
              <div class="form-group">
                <label>Max Disk (MB)</label>
                <input type="number" name="default_disk" value="${config.defaults?.disk || 10240}" min="0" />
              </div>
              <div class="form-group">
                <label>Max CPU (%)</label>
                <input type="number" name="default_cpu" value="${config.defaults?.cpu || 200}" min="0" />
              </div>
            </div>
          </div>
          
          <div class="form-actions">
            <button type="submit" class="btn btn-primary btn-large">Save Settings</button>
          </div>
        </form>
        
        <div class="detail-card" style="margin-top: 1.5rem;">
          <div class="card-header-row">
            <h3>Application API Keys</h3>
            <button class="btn btn-primary btn-sm" id="create-app-key-btn">
              <span class="material-icons-outlined">add</span>
              Create Key
            </button>
          </div>
          <p class="card-description">Application keys have full access to the admin API for automation and integrations.</p>
          <div class="api-keys-list" id="app-api-keys-list">
            <div class="loading-spinner">
              <span class="material-icons-outlined spinning">sync</span>
            </div>
          </div>
        </div>
        
        <div class="modal" id="app-api-key-modal">
          <div class="modal-backdrop"></div>
          <div class="modal-content">
            <div class="modal-header">
              <h3>Create Application Key</h3>
              <button class="modal-close" id="close-app-key-modal">
                <span class="material-icons-outlined">close</span>
              </button>
            </div>
            <form id="app-api-key-form">
              <div class="form-group">
                <label for="app-key-name">Key Name</label>
                <input type="text" id="app-key-name" required maxlength="50" placeholder="CI/CD Integration">
              </div>
              <div class="form-group">
                <label>Permissions</label>
                <div class="permissions-grid" id="app-permissions-grid"></div>
              </div>
              <div class="message" id="app-key-message"></div>
              <div class="modal-actions">
                <button type="button" class="btn btn-secondary" id="cancel-app-key-modal">Cancel</button>
                <button type="submit" class="btn btn-primary">Create Key</button>
              </div>
            </form>
          </div>
        </div>
        
        <div class="modal" id="app-key-created-modal">
          <div class="modal-backdrop"></div>
          <div class="modal-content">
            <div class="modal-header">
              <h3>Application Key Created</h3>
              <button class="modal-close" id="close-app-key-created-modal">
                <span class="material-icons-outlined">close</span>
              </button>
            </div>
            <div class="api-key-created-content">
              <div class="warning-box">
                <span class="material-icons-outlined">warning</span>
                <p>Make sure to copy your API key now. You won't be able to see it again!</p>
              </div>
              <div class="api-key-display">
                <code id="created-app-key-token"></code>
                <button type="button" class="btn btn-icon" id="copy-app-key-btn">
                  <span class="material-icons-outlined">content_copy</span>
                </button>
              </div>
            </div>
            <div class="modal-actions">
              <button type="button" class="btn btn-primary" id="done-app-key-btn">Done</button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    setupBreadcrumbListeners(navigateTo);
    loadAppApiKeys();
    setupAppApiKeysHandlers();
    
    document.getElementById('panel-settings-form').onsubmit = async (e) => {
      e.preventDefault();
      const form = e.target;
      
      const newConfig = {
        panel: {
          name: form.panel_name.value,
          url: form.panel_url.value
        },
        registration: {
          enabled: form.registration_enabled.checked
        },
        features: {
          subusers: form.subusers_enabled.checked
        },
        defaults: {
          servers: parseInt(form.default_servers.value) || 2,
          memory: parseInt(form.default_memory.value) || 2048,
          disk: parseInt(form.default_disk.value) || 10240,
          cpu: parseInt(form.default_cpu.value) || 200
        }
      };
      
      try {
        const saveRes = await api('/api/admin/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config: newConfig })
        });
        
        if (saveRes.ok) {
          toast.success('Settings saved');
        } else {
          toast.error('Failed to save settings');
        }
      } catch (e) {
        toast.error('Failed to save settings');
      }
    };
    
  } catch (e) {
    container.innerHTML = `<div class="error">Failed to load settings</div>`;
  }
}

let appPermissions = [];

async function loadAppApiKeys() {
  const list = document.getElementById('app-api-keys-list');
  if (!list) return;
  
  try {
    const [keysRes, permsRes] = await Promise.all([
      api('/api/api-keys/application'),
      api('/api/api-keys/permissions')
    ]);
    
    const keysData = await keysRes.json();
    const permsData = await permsRes.json();
    
    appPermissions = permsData.application || [];
    
    if (!keysData.keys || keysData.keys.length === 0) {
      list.innerHTML = `
        <div class="empty-state small">
          <span class="material-icons-outlined">vpn_key</span>
          <p>No application keys</p>
        </div>
      `;
      return;
    }
    
    list.innerHTML = keysData.keys.map(key => `
      <div class="api-key-item" data-id="${key.id}">
        <div class="api-key-info">
          <span class="api-key-name">${escapeHtml(key.name)}</span>
          <span class="api-key-meta">
            Created by ${escapeHtml(key.createdBy)} on ${new Date(key.createdAt).toLocaleDateString()}
            ${key.lastUsedAt ? `• Last used ${new Date(key.lastUsedAt).toLocaleDateString()}` : '• Never used'}
          </span>
        </div>
        <div class="api-key-permissions">
          ${key.permissions.slice(0, 3).map(p => `<span class="permission-tag">${escapeHtml(p)}</span>`).join('')}
          ${key.permissions.length > 3 ? `<span class="permission-tag">+${key.permissions.length - 3}</span>` : ''}
        </div>
        <button class="btn btn-icon btn-danger delete-app-key-btn" data-id="${key.id}">
          <span class="material-icons-outlined">delete</span>
        </button>
      </div>
    `).join('');
    
    list.querySelectorAll('.delete-app-key-btn').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (!confirm('Are you sure you want to delete this application key?')) return;
        
        try {
          await api(`/api/api-keys/application/${id}`, { method: 'DELETE' });
          loadAppApiKeys();
          toast.success('Application key deleted');
        } catch (err) {
          toast.error('Failed to delete key');
        }
      };
    });
  } catch (err) {
    list.innerHTML = `
      <div class="empty-state small error">
        <span class="material-icons-outlined">error</span>
        <p>Failed to load keys</p>
      </div>
    `;
  }
}

function setupAppApiKeysHandlers() {
  const createBtn = document.getElementById('create-app-key-btn');
  const modal = document.getElementById('app-api-key-modal');
  const createdModal = document.getElementById('app-key-created-modal');
  const form = document.getElementById('app-api-key-form');
  const permissionsGrid = document.getElementById('app-permissions-grid');
  
  if (!createBtn || !modal) return;
  
  const closeModal = () => {
    modal.classList.remove('active');
    form.reset();
    document.getElementById('app-key-message').textContent = '';
  };
  
  const closeCreatedModal = () => {
    createdModal.classList.remove('active');
    loadAppApiKeys();
  };
  
  createBtn.onclick = () => {
    permissionsGrid.innerHTML = appPermissions.map(p => `
      <label class="permission-checkbox">
        <input type="checkbox" name="permissions" value="${p}">
        <span>${escapeHtml(p)}</span>
      </label>
    `).join('');
    modal.classList.add('active');
  };
  
  modal.querySelector('#close-app-key-modal').onclick = closeModal;
  modal.querySelector('#cancel-app-key-modal').onclick = closeModal;
  modal.querySelector('.modal-backdrop').onclick = closeModal;
  
  createdModal.querySelector('#close-app-key-created-modal').onclick = closeCreatedModal;
  createdModal.querySelector('#done-app-key-btn').onclick = closeCreatedModal;
  createdModal.querySelector('.modal-backdrop').onclick = closeCreatedModal;
  
  createdModal.querySelector('#copy-app-key-btn').onclick = () => {
    const token = document.getElementById('created-app-key-token').textContent;
    navigator.clipboard.writeText(token);
    const btn = createdModal.querySelector('#copy-app-key-btn');
    btn.innerHTML = '<span class="material-icons-outlined">check</span>';
    setTimeout(() => {
      btn.innerHTML = '<span class="material-icons-outlined">content_copy</span>';
    }, 2000);
  };
  
  form.onsubmit = async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('app-key-name').value.trim();
    const checkboxes = form.querySelectorAll('input[name="permissions"]:checked');
    const permissions = Array.from(checkboxes).map(cb => cb.value);
    const messageEl = document.getElementById('app-key-message');
    const btn = form.querySelector('button[type="submit"]');
    
    if (permissions.length === 0) {
      messageEl.textContent = 'Select at least one permission';
      messageEl.className = 'message error';
      return;
    }
    
    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons-outlined spinning">sync</span>';
    
    try {
      const res = await api('/api/api-keys/application', {
        method: 'POST',
        body: JSON.stringify({ name, permissions })
      });
      
      const data = await res.json();
      
      if (data.error) {
        messageEl.textContent = data.error;
        messageEl.className = 'message error';
      } else {
        closeModal();
        document.getElementById('created-app-key-token').textContent = data.token;
        createdModal.classList.add('active');
      }
    } catch (err) {
      messageEl.textContent = 'Failed to create key';
      messageEl.className = 'message error';
    }
    
    btn.disabled = false;
    btn.innerHTML = 'Create Key';
  };
}
