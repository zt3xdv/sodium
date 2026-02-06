import { getTheme, setTheme, getAvailableThemes } from '../utils/theme.js';
import { clearAuth, api } from '../utils/api.js';
import * as modal from '../utils/modal.js';

export function renderSettings() {
  const app = document.getElementById('app');
  app.className = 'settings-page';
  
  const username = localStorage.getItem('username');
  
  app.innerHTML = `
    <div class="settings-container">
      <div class="settings-header">
        <h1>Settings</h1>
        <p>Manage your account preferences</p>
      </div>
      
      <div class="settings-content">
        <div class="settings-section">
          <div class="section-header">
            <span class="material-icons-outlined">palette</span>
            <h3>Appearance</h3>
          </div>
          
          <div class="theme-grid" id="theme-grid">
            ${getAvailableThemes().map(t => `
              <button class="theme-card ${getTheme() === t.id ? 'active' : ''}" data-theme="${t.id}">
                <div class="theme-preview" data-preview="${t.id}">
                  <div class="preview-sidebar"></div>
                  <div class="preview-content">
                    <div class="preview-header"></div>
                    <div class="preview-cards">
                      <div class="preview-card"></div>
                      <div class="preview-card"></div>
                    </div>
                  </div>
                </div>
                <span class="theme-name">${t.name}</span>
              </button>
            `).join('')}
          </div>
        </div>
        
        <div class="settings-section">
          <div class="section-header">
            <span class="material-icons-outlined">notifications</span>
            <h3>Notifications</h3>
          </div>
          
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-title">Push Notifications</span>
              <span class="setting-description">Receive notifications about activity</span>
            </div>
            <div class="setting-control">
              <label class="toggle">
                <input type="checkbox" id="notifications-toggle" checked>
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>
        
        <div class="settings-section">
          <div class="section-header">
            <span class="material-icons-outlined">lock</span>
            <h3>Privacy</h3>
          </div>
          
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-title">Profile Visibility</span>
              <span class="setting-description">Control who can see your profile</span>
            </div>
            <div class="setting-control">
              <select id="privacy-select" class="select-input">
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </div>
          </div>
        </div>
        
        <div class="settings-section">
          <div class="section-header">
            <span class="material-icons-outlined">security</span>
            <h3>Security</h3>
          </div>
          
          <div class="setting-item" id="2fa-setting">
            <div class="setting-info">
              <span class="setting-title">Two-Factor Authentication</span>
              <span class="setting-description" id="2fa-description">Require email verification code on login</span>
            </div>
            <div class="setting-control">
              <label class="toggle">
                <input type="checkbox" id="2fa-toggle" disabled>
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
          
          <div class="setting-item clickable" id="change-password-btn">
            <div class="setting-info">
              <span class="setting-title">Change Password</span>
              <span class="setting-description">Update your account password</span>
            </div>
            <span class="material-icons-outlined">chevron_right</span>
          </div>
        </div>
        
        <div class="settings-section">
          <div class="section-header">
            <span class="material-icons-outlined">key</span>
            <h3>SSH Keys</h3>
          </div>
          
          <div class="ssh-keys-container">
            <div class="ssh-keys-header">
              <p class="setting-description">SSH keys for SFTP authentication</p>
              <button class="btn btn-primary btn-sm" id="add-ssh-key-btn">
                <span class="material-icons-outlined">add</span>
                <span>Add Key</span>
              </button>
            </div>
            <div class="ssh-keys-list" id="ssh-keys-list">
              <div class="loading-spinner">
                <span class="material-icons-outlined spinning">sync</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="settings-section">
          <div class="section-header">
            <span class="material-icons-outlined">vpn_key</span>
            <h3>API Keys</h3>
          </div>
          
          <div class="api-keys-container">
            <div class="api-keys-header">
              <p class="setting-description">Manage API keys to access the Sodium API programmatically</p>
              <button class="btn btn-primary btn-sm" id="create-api-key-btn">
                <span class="material-icons-outlined">add</span>
                <span>Create Key</span>
              </button>
            </div>
            <div class="api-keys-list" id="api-keys-list">
              <div class="loading-spinner">
                <span class="material-icons-outlined spinning">sync</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="settings-section">
          <div class="section-header">
            <span class="material-icons-outlined">webhook</span>
            <h3>Webhooks</h3>
          </div>
          
          <div class="webhooks-container">
            <div class="webhooks-header">
              <p class="setting-description">Send notifications to Discord, Slack, or custom URLs when events occur</p>
              <button class="btn btn-primary btn-sm" id="create-webhook-btn">
                <span class="material-icons-outlined">add</span>
                <span>Add Webhook</span>
              </button>
            </div>
            <div class="webhooks-list" id="webhooks-list">
              <div class="loading-spinner">
                <span class="material-icons-outlined spinning">sync</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="settings-section danger-section">
          <div class="section-header">
            <span class="material-icons-outlined">warning</span>
            <h3>Danger Zone</h3>
          </div>
          
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-title">Sign Out</span>
              <span class="setting-description">Sign out of your account on this device</span>
            </div>
            <button class="btn btn-danger" id="logout-btn">
              <span class="material-icons-outlined">logout</span>
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <div class="modal" id="api-key-modal">
      <div class="modal-backdrop"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3>Create API Key</h3>
          <button class="modal-close" id="close-api-key-modal">
            <span class="material-icons-outlined">close</span>
          </button>
        </div>
        <form id="api-key-form">
          <div class="form-group">
            <label for="api-key-name">Key Name</label>
            <div class="input-wrapper">
              <span class="material-icons-outlined">label</span>
              <input type="text" id="api-key-name" required maxlength="50" placeholder="My API Key">
            </div>
          </div>
          <div class="form-group">
            <label>Permissions</label>
            <div class="permissions-grid" id="permissions-grid"></div>
          </div>
          <div class="message" id="api-key-message"></div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" id="cancel-api-key-modal">Cancel</button>
            <button type="submit" class="btn btn-primary">Create Key</button>
          </div>
        </form>
      </div>
    </div>
    
    <div class="modal" id="api-key-created-modal">
      <div class="modal-backdrop"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3>API Key Created</h3>
          <button class="modal-close" id="close-api-key-created-modal">
            <span class="material-icons-outlined">close</span>
          </button>
        </div>
        <div class="api-key-created-content">
          <div class="warning-box">
            <span class="material-icons-outlined">warning</span>
            <p>Make sure to copy your API key now. You won't be able to see it again!</p>
          </div>
          <div class="api-key-display">
            <code id="created-api-key-token"></code>
            <button type="button" class="btn btn-icon" id="copy-api-key-btn">
              <span class="material-icons-outlined">content_copy</span>
            </button>
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-primary" id="done-api-key-btn">Done</button>
        </div>
      </div>
    </div>
    
    <div class="modal" id="password-modal">
      <div class="modal-backdrop"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3>Change Password</h3>
          <button class="modal-close" id="close-modal">
            <span class="material-icons-outlined">close</span>
          </button>
        </div>
        <form id="password-form">
          <div class="form-group">
            <label for="current-password">Current Password</label>
            <div class="input-wrapper">
              <span class="material-icons-outlined">lock</span>
              <input type="password" id="current-password" required>
            </div>
          </div>
          <div class="form-group">
            <label for="new-password">New Password</label>
            <div class="input-wrapper">
              <span class="material-icons-outlined">lock</span>
              <input type="password" id="new-password" required minlength="6">
            </div>
          </div>
          <div class="form-group">
            <label for="confirm-password">Confirm New Password</label>
            <div class="input-wrapper">
              <span class="material-icons-outlined">lock</span>
              <input type="password" id="confirm-password" required>
            </div>
          </div>
          <div class="message" id="password-message"></div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" id="cancel-modal">Cancel</button>
            <button type="submit" class="btn btn-primary">Update Password</button>
          </div>
        </form>
      </div>
    </div>
    
    <div class="modal" id="webhook-modal">
      <div class="modal-backdrop"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3>Add Webhook</h3>
          <button class="modal-close" id="close-webhook-modal">
            <span class="material-icons-outlined">close</span>
          </button>
        </div>
        <form id="webhook-form">
          <div class="form-group">
            <label for="webhook-name">Name</label>
            <div class="input-wrapper">
              <span class="material-icons-outlined">label</span>
              <input type="text" id="webhook-name" required maxlength="50" placeholder="My Webhook">
            </div>
          </div>
          <div class="form-group">
            <label for="webhook-url">Webhook URL</label>
            <div class="input-wrapper">
              <span class="material-icons-outlined">link</span>
              <input type="url" id="webhook-url" required placeholder="https://discord.com/api/webhooks/...">
            </div>
          </div>
          <div class="form-group">
            <label for="webhook-type">Type</label>
            <select id="webhook-type" class="select-input">
              <option value="discord">Discord</option>
              <option value="slack">Slack</option>
              <option value="generic">Generic (JSON)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Events</label>
            <div class="webhook-events-grid" id="webhook-events-grid"></div>
          </div>
          <div class="message" id="webhook-message"></div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" id="cancel-webhook-modal">Cancel</button>
            <button type="submit" class="btn btn-primary">Create Webhook</button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  loadSettings();
  load2FAStatus();
  loadSshKeys();
  setupSshKeysHandlers();
  loadApiKeys();
  setupApiKeysHandlers();
  loadWebhooks();
  setupWebhooksHandlers();
  
  const logoutBtn = app.querySelector('#logout-btn');
  logoutBtn.addEventListener('click', () => {
    clearAuth();
    window.router.navigateTo('/auth');
  });
  
  const themeGrid = app.querySelector('#theme-grid');
  themeGrid.addEventListener('click', (e) => {
    const card = e.target.closest('.theme-card');
    if (!card) return;
    const theme = card.dataset.theme;
    setTheme(theme);
    themeGrid.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    saveSettings({ theme });
  });
  
  const notificationsToggle = app.querySelector('#notifications-toggle');
  notificationsToggle.addEventListener('change', () => {
    saveSettings({ notifications: notificationsToggle.checked });
  });
  
  const privacySelect = app.querySelector('#privacy-select');
  privacySelect.addEventListener('change', () => {
    saveSettings({ privacy: privacySelect.value });
  });
  
  const modal = app.querySelector('#password-modal');
  const changePasswordBtn = app.querySelector('#change-password-btn');
  const closeModal = app.querySelector('#close-modal');
  const cancelModal = app.querySelector('#cancel-modal');
  const backdrop = modal.querySelector('.modal-backdrop');
  
  changePasswordBtn.addEventListener('click', () => {
    modal.classList.add('active');
  });
  
  const closeModalFn = () => {
    modal.classList.remove('active');
    modal.querySelector('form').reset();
    modal.querySelector('#password-message').textContent = '';
  };
  
  closeModal.addEventListener('click', closeModalFn);
  cancelModal.addEventListener('click', closeModalFn);
  backdrop.addEventListener('click', closeModalFn);
  
  const passwordForm = app.querySelector('#password-form');
  passwordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const currentPassword = passwordForm.querySelector('#current-password').value;
    const newPassword = passwordForm.querySelector('#new-password').value;
    const confirmPassword = passwordForm.querySelector('#confirm-password').value;
    const messageEl = passwordForm.querySelector('#password-message');
    const btn = passwordForm.querySelector('button[type="submit"]');
    
    if (newPassword !== confirmPassword) {
      messageEl.textContent = 'Passwords do not match';
      messageEl.className = 'message error';
      return;
    }
    
    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons-outlined spinning">sync</span>';
    
    try {
      const res = await api('/api/user/password', {
        method: 'PUT',
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });
      
      const data = await res.json();
      
      if (data.error) {
        messageEl.textContent = data.error;
        messageEl.className = 'message error';
      } else {
        messageEl.textContent = 'Password updated successfully!';
        messageEl.className = 'message success';
        
        setTimeout(() => {
          closeModalFn();
        }, 1500);
      }
    } catch (err) {
      messageEl.textContent = 'Connection error. Please try again.';
      messageEl.className = 'message error';
    }
    
    btn.disabled = false;
    btn.innerHTML = 'Update Password';
  });
}

async function loadSettings() {
  try {
    const res = await fetch(`/api/user/profile?username=${encodeURIComponent(localStorage.getItem('username'))}`);
    const data = await res.json();
    
    if (data.user?.settings) {
      const { theme, notifications, privacy } = data.user.settings;
      
      const notificationsToggle = document.getElementById('notifications-toggle');
      const privacySelect = document.getElementById('privacy-select');
      
      if (theme) {
        setTheme(theme);
        const themeGrid = document.getElementById('theme-grid');
        if (themeGrid) {
          themeGrid.querySelectorAll('.theme-card').forEach(c => {
            c.classList.toggle('active', c.dataset.theme === theme);
          });
        }
      }
      if (notificationsToggle) notificationsToggle.checked = notifications !== false;
      if (privacySelect && privacy) privacySelect.value = privacy;
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

async function saveSettings(settings) {
  try {
    await api('/api/user/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings })
    });
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
}

// ==================== 2FA ====================

async function load2FAStatus() {
  const toggle = document.getElementById('2fa-toggle');
  const description = document.getElementById('2fa-description');
  if (!toggle) return;
  
  try {
    const res = await api('/api/user/2fa');
    const data = await res.json();
    
    if (!data.mailConfigured) {
      toggle.disabled = true;
      description.textContent = 'Mail not configured by administrator';
      return;
    }
    
    if (!data.hasEmail) {
      toggle.disabled = true;
      description.textContent = 'Add an email address to enable 2FA';
      return;
    }
    
    if (!data.emailVerified) {
      toggle.disabled = true;
      description.textContent = 'Verify your email address to enable 2FA';
      return;
    }
    
    if (data.required) {
      toggle.checked = true;
      toggle.disabled = true;
      description.textContent = 'Required by administrator';
      return;
    }
    
    toggle.disabled = false;
    toggle.checked = data.enabled;
    description.textContent = 'Require email verification code on login';
    
    toggle.addEventListener('change', async () => {
      toggle.disabled = true;
      try {
        const res = await api('/api/user/2fa', {
          method: 'PUT',
          body: JSON.stringify({ enabled: toggle.checked })
        });
        const result = await res.json();
        if (result.error) {
          toggle.checked = !toggle.checked;
          description.textContent = result.error;
        }
      } catch (e) {
        toggle.checked = !toggle.checked;
      }
      toggle.disabled = false;
    });
  } catch (err) {
    console.error('Failed to load 2FA status:', err);
    toggle.disabled = true;
    description.textContent = 'Failed to load 2FA status';
  }
}

// ==================== SSH KEYS ====================

async function loadSshKeys() {
  const list = document.getElementById('ssh-keys-list');
  if (!list) return;
  
  try {
    const res = await api('/api/user/ssh-keys');
    const data = await res.json();
    const keys = data.keys || [];
    
    if (keys.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <span class="material-icons-outlined">key</span>
          <p>No SSH keys added</p>
        </div>
      `;
      return;
    }
    
    list.innerHTML = keys.map(key => `
      <div class="ssh-key-item" data-id="${key.id}">
        <div class="ssh-key-info">
          <span class="ssh-key-name">${key.name}</span>
          <span class="ssh-key-fingerprint">${key.fingerprint}</span>
          <span class="ssh-key-meta">
            Added ${new Date(key.created_at).toLocaleDateString()}
            ${key.last_used ? `• Last used ${new Date(key.last_used).toLocaleDateString()}` : ''}
          </span>
        </div>
        <button class="btn btn-icon btn-danger delete-ssh-key-btn" data-id="${key.id}">
          <span class="material-icons-outlined">delete</span>
        </button>
      </div>
    `).join('');
    
    list.querySelectorAll('.delete-ssh-key-btn').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const confirmed = await modal.confirm({ title: 'Delete SSH Key', message: 'Delete this SSH key?', danger: true });
        if (!confirmed) return;
        try {
          await api(`/api/user/ssh-keys/${btn.dataset.id}`, { method: 'DELETE' });
          loadSshKeys();
        } catch (e) {
          console.error('Failed to delete SSH key:', e);
        }
      };
    });
  } catch (e) {
    list.innerHTML = `<div class="error">Failed to load SSH keys</div>`;
  }
}

function setupSshKeysHandlers() {
  const addBtn = document.getElementById('add-ssh-key-btn');
  if (!addBtn) return;
  
  addBtn.onclick = () => {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'ssh-key-modal';
    modal.innerHTML = `
      <div class="modal-backdrop" onclick="this.parentElement.remove()"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3>Add SSH Key</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">
            <span class="material-icons-outlined">close</span>
          </button>
        </div>
        <form id="ssh-key-form">
          <div class="form-group">
            <label>Key Name</label>
            <input type="text" name="name" required placeholder="My Laptop" maxlength="50" />
          </div>
          <div class="form-group">
            <label>Public Key</label>
            <textarea name="public_key" required rows="5" placeholder="ssh-ed25519 AAAA... user@host"></textarea>
            <small class="form-hint">Paste your public key (id_ed25519.pub, id_rsa.pub, etc.)</small>
          </div>
          <div class="message" id="ssh-key-message"></div>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" onclick="this.closest('.modal').remove()">Cancel</button>
            <button type="submit" class="btn btn-primary">Add Key</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
    
    modal.querySelector('#ssh-key-form').onsubmit = async (e) => {
      e.preventDefault();
      const form = new FormData(e.target);
      const messageEl = modal.querySelector('#ssh-key-message');
      const btn = e.target.querySelector('button[type="submit"]');
      
      btn.disabled = true;
      btn.innerHTML = '<span class="material-icons-outlined spinning">sync</span>';
      
      try {
        const res = await api('/api/user/ssh-keys', {
          method: 'POST',
          body: JSON.stringify({
            name: form.get('name'),
            public_key: form.get('public_key')
          })
        });
        
        const data = await res.json();
        
        if (data.error) {
          messageEl.textContent = data.error;
          messageEl.className = 'message error';
          btn.disabled = false;
          btn.textContent = 'Add Key';
        } else {
          modal.remove();
          loadSshKeys();
        }
      } catch (e) {
        messageEl.textContent = 'Failed to add key';
        messageEl.className = 'message error';
        btn.disabled = false;
        btn.textContent = 'Add Key';
      }
    };
  };
}

let availablePermissions = [];

async function loadApiKeys() {
  const list = document.getElementById('api-keys-list');
  
  try {
    const [keysRes, permsRes] = await Promise.all([
      api('/api/api-keys'),
      api('/api/api-keys/permissions')
    ]);
    
    const keysData = await keysRes.json();
    const permsData = await permsRes.json();
    
    availablePermissions = permsData.user || [];
    
    if (!keysData.keys || keysData.keys.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <span class="material-icons-outlined">vpn_key</span>
          <p>No API keys yet</p>
        </div>
      `;
      return;
    }
    
    list.innerHTML = keysData.keys.map(key => `
      <div class="api-key-item" data-id="${key.id}">
        <div class="api-key-info">
          <span class="api-key-name">${key.name}</span>
          <span class="api-key-meta">
            Created ${new Date(key.createdAt).toLocaleDateString()}
            ${key.lastUsedAt ? `• Last used ${new Date(key.lastUsedAt).toLocaleDateString()}` : '• Never used'}
          </span>
        </div>
        <div class="api-key-permissions">
          ${key.permissions.slice(0, 3).map(p => `<span class="permission-tag">${p}</span>`).join('')}
          ${key.permissions.length > 3 ? `<span class="permission-tag">+${key.permissions.length - 3}</span>` : ''}
        </div>
        <button class="btn btn-icon btn-danger delete-api-key-btn" data-id="${key.id}">
          <span class="material-icons-outlined">delete</span>
        </button>
      </div>
    `).join('');
    
    list.querySelectorAll('.delete-api-key-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const confirmed = await modal.confirm({ title: 'Delete API Key', message: 'Are you sure you want to delete this API key?', danger: true });
        if (!confirmed) return;
        
        try {
          await api(`/api/api-keys/${id}`, { method: 'DELETE' });
          loadApiKeys();
        } catch (err) {
          console.error('Failed to delete API key:', err);
        }
      });
    });
  } catch (err) {
    console.error('Failed to load API keys:', err);
    list.innerHTML = `
      <div class="empty-state error">
        <span class="material-icons-outlined">error</span>
        <p>Failed to load API keys</p>
      </div>
    `;
  }
}

function setupApiKeysHandlers() {
  const createBtn = document.getElementById('create-api-key-btn');
  const modal = document.getElementById('api-key-modal');
  const createdModal = document.getElementById('api-key-created-modal');
  const form = document.getElementById('api-key-form');
  const permissionsGrid = document.getElementById('permissions-grid');
  
  const closeModal = () => {
    modal.classList.remove('active');
    form.reset();
    document.getElementById('api-key-message').textContent = '';
  };
  
  const closeCreatedModal = () => {
    createdModal.classList.remove('active');
    loadApiKeys();
  };
  
  createBtn.addEventListener('click', () => {
    permissionsGrid.innerHTML = availablePermissions.map(p => `
      <label class="permission-checkbox">
        <input type="checkbox" name="permissions" value="${p}">
        <span>${p}</span>
      </label>
    `).join('');
    modal.classList.add('active');
  });
  
  modal.querySelector('#close-api-key-modal').addEventListener('click', closeModal);
  modal.querySelector('#cancel-api-key-modal').addEventListener('click', closeModal);
  modal.querySelector('.modal-backdrop').addEventListener('click', closeModal);
  
  createdModal.querySelector('#close-api-key-created-modal').addEventListener('click', closeCreatedModal);
  createdModal.querySelector('#done-api-key-btn').addEventListener('click', closeCreatedModal);
  createdModal.querySelector('.modal-backdrop').addEventListener('click', closeCreatedModal);
  
  createdModal.querySelector('#copy-api-key-btn').addEventListener('click', () => {
    const token = document.getElementById('created-api-key-token').textContent;
    navigator.clipboard.writeText(token);
    const btn = createdModal.querySelector('#copy-api-key-btn');
    btn.innerHTML = '<span class="material-icons-outlined">check</span>';
    setTimeout(() => {
      btn.innerHTML = '<span class="material-icons-outlined">content_copy</span>';
    }, 2000);
  });
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('api-key-name').value.trim();
    const checkboxes = form.querySelectorAll('input[name="permissions"]:checked');
    const permissions = Array.from(checkboxes).map(cb => cb.value);
    const messageEl = document.getElementById('api-key-message');
    const btn = form.querySelector('button[type="submit"]');
    
    if (permissions.length === 0) {
      messageEl.textContent = 'Select at least one permission';
      messageEl.className = 'message error';
      return;
    }
    
    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons-outlined spinning">sync</span>';
    
    try {
      const res = await api('/api/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name, permissions })
      });
      
      const data = await res.json();
      
      if (data.error) {
        messageEl.textContent = data.error;
        messageEl.className = 'message error';
      } else {
        closeModal();
        document.getElementById('created-api-key-token').textContent = data.token;
        createdModal.classList.add('active');
      }
    } catch (err) {
      messageEl.textContent = 'Failed to create API key';
      messageEl.className = 'message error';
    }
    
    btn.disabled = false;
    btn.innerHTML = 'Create Key';
  });
}

// ==================== WEBHOOKS ====================

const WEBHOOK_EVENTS = [
  { id: 'server.created', label: 'Server Created' },
  { id: 'server.deleted', label: 'Server Deleted' },
  { id: 'server.started', label: 'Server Started' },
  { id: 'server.stopped', label: 'Server Stopped' },
  { id: 'server.crashed', label: 'Server Crashed' },
  { id: 'server.suspended', label: 'Server Suspended' },
  { id: 'server.backup.created', label: 'Backup Created' }
];

async function loadWebhooks() {
  const container = document.getElementById('webhooks-list');
  if (!container) return;
  
  try {
    const res = await api('/api/webhooks');
    const data = await res.json();
    
    if (!data.webhooks || data.webhooks.length === 0) {
      container.innerHTML = `
        <div class="empty-state small">
          <span class="material-icons-outlined">webhook</span>
          <p>No webhooks configured</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = data.webhooks.map(webhook => `
      <div class="list-item webhook-item" data-id="${webhook.id}">
        <div class="item-icon">
          <span class="material-icons-outlined">${getWebhookIcon(webhook.type)}</span>
        </div>
        <div class="item-info">
          <span class="item-name">${escapeHtml(webhook.name)}</span>
          <span class="item-meta">${webhook.type} • ${webhook.events.length} events</span>
        </div>
        <div class="item-actions">
          <button class="btn btn-icon btn-sm test-webhook-btn" title="Test">
            <span class="material-icons-outlined">send</span>
          </button>
          <label class="toggle small">
            <input type="checkbox" class="toggle-webhook-btn" ${webhook.enabled ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
          <button class="btn btn-icon btn-sm btn-danger delete-webhook-btn" title="Delete">
            <span class="material-icons-outlined">delete</span>
          </button>
        </div>
      </div>
    `).join('');
    
    container.querySelectorAll('.delete-webhook-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const item = e.target.closest('.webhook-item');
        const id = item.dataset.id;
        const confirmed = await modal.confirm({ title: 'Delete Webhook', message: 'Delete this webhook?', danger: true });
        if (!confirmed) return;
        
        try {
          await api(`/api/webhooks/${id}`, { method: 'DELETE' });
          loadWebhooks();
        } catch (err) {
          console.error('Failed to delete webhook:', err);
        }
      });
    });
    
    container.querySelectorAll('.test-webhook-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const item = e.target.closest('.webhook-item');
        const id = item.dataset.id;
        btn.disabled = true;
        btn.innerHTML = '<span class="material-icons-outlined spinning">sync</span>';
        
        try {
          const res = await api(`/api/webhooks/${id}/test`, { method: 'POST' });
          const data = await res.json();
          btn.innerHTML = '<span class="material-icons-outlined">check</span>';
          setTimeout(() => {
            btn.innerHTML = '<span class="material-icons-outlined">send</span>';
            btn.disabled = false;
          }, 2000);
        } catch (err) {
          btn.innerHTML = '<span class="material-icons-outlined">error</span>';
          setTimeout(() => {
            btn.innerHTML = '<span class="material-icons-outlined">send</span>';
            btn.disabled = false;
          }, 2000);
        }
      });
    });
    
    container.querySelectorAll('.toggle-webhook-btn').forEach(toggle => {
      toggle.addEventListener('change', async (e) => {
        const item = e.target.closest('.webhook-item');
        const id = item.dataset.id;
        
        try {
          await api(`/api/webhooks/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ enabled: e.target.checked })
          });
        } catch (err) {
          e.target.checked = !e.target.checked;
        }
      });
    });
    
  } catch (err) {
    container.innerHTML = '<div class="error">Failed to load webhooks</div>';
  }
}

function getWebhookIcon(type) {
  switch (type) {
    case 'discord': return 'chat';
    case 'slack': return 'tag';
    default: return 'webhook';
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function setupWebhooksHandlers() {
  const modal = document.getElementById('webhook-modal');
  const createBtn = document.getElementById('create-webhook-btn');
  const form = document.getElementById('webhook-form');
  const eventsGrid = document.getElementById('webhook-events-grid');
  
  if (!modal || !createBtn) return;
  
  // Populate events grid
  eventsGrid.innerHTML = WEBHOOK_EVENTS.map(event => `
    <label class="checkbox-item">
      <input type="checkbox" name="webhook-events" value="${event.id}">
      <span>${event.label}</span>
    </label>
  `).join('');
  
  const closeModal = () => {
    modal.classList.remove('active');
    form.reset();
    document.getElementById('webhook-message').textContent = '';
  };
  
  createBtn.addEventListener('click', () => modal.classList.add('active'));
  document.getElementById('close-webhook-modal').addEventListener('click', closeModal);
  document.getElementById('cancel-webhook-modal').addEventListener('click', closeModal);
  modal.querySelector('.modal-backdrop').addEventListener('click', closeModal);
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('webhook-name').value.trim();
    const url = document.getElementById('webhook-url').value.trim();
    const type = document.getElementById('webhook-type').value;
    const checkboxes = form.querySelectorAll('input[name="webhook-events"]:checked');
    const events = Array.from(checkboxes).map(cb => cb.value);
    const messageEl = document.getElementById('webhook-message');
    const btn = form.querySelector('button[type="submit"]');
    
    if (events.length === 0) {
      messageEl.textContent = 'Select at least one event';
      messageEl.className = 'message error';
      return;
    }
    
    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons-outlined spinning">sync</span>';
    
    try {
      const res = await api('/api/webhooks', {
        method: 'POST',
        body: JSON.stringify({ name, url, type, events })
      });
      
      const data = await res.json();
      
      if (data.error) {
        messageEl.textContent = data.error;
        messageEl.className = 'message error';
      } else {
        closeModal();
        loadWebhooks();
      }
    } catch (err) {
      messageEl.textContent = 'Failed to create webhook';
      messageEl.className = 'message error';
    }
    
    btn.disabled = false;
    btn.innerHTML = 'Create Webhook';
  });
}
