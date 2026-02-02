import { escapeHtml } from '../../../utils/security.js';
import * as toast from '../../../utils/toast.js';
import { api } from '../../../utils/api.js';
import { state } from '../state.js';
import { renderBreadcrumb, setupBreadcrumbListeners } from '../utils/ui.js';

const navigateTo = (...args) => window.adminNavigate(...args);

let currentSettingsTab = 'general';

const SETTINGS_TABS = [
  { id: 'general', label: 'General', icon: 'settings' },
  { id: 'registration', label: 'Registration', icon: 'person_add' },
  { id: 'defaults', label: 'User Defaults', icon: 'tune' },
  { id: 'oauth', label: 'OAuth Providers', icon: 'login' },
  { id: 'api-keys', label: 'API Keys', icon: 'vpn_key' },
  { id: 'mail', label: 'Mail', icon: 'email' },
  { id: 'advanced', label: 'Advanced', icon: 'code' }
];

let mailConfigured = false;

export async function renderSettingsPage(container, username, loadView) {
  const urlParams = new URLSearchParams(window.location.search);
  currentSettingsTab = urlParams.get('tab') || 'general';
  
  try {
    const res = await api(`/api/admin/settings`);
    const data = await res.json();
    const config = data.config || {};
    mailConfigured = data.mailConfigured || false;
    
    container.innerHTML = `
      <div class="admin-header">
        ${renderBreadcrumb([{ label: 'Settings' }])}
      </div>
      
      <div class="settings-layout">
        <aside class="settings-sidebar">
          <nav class="settings-nav">
            ${SETTINGS_TABS.map(tab => `
              <button class="settings-nav-item ${currentSettingsTab === tab.id ? 'active' : ''}" data-tab="${tab.id}">
                <span class="material-icons-outlined">${tab.icon}</span>
                <span>${tab.label}</span>
              </button>
            `).join('')}
          </nav>
        </aside>
        
        <div class="settings-content" id="settings-content">
          <div class="loading-spinner"></div>
        </div>
      </div>
    `;
    
    setupBreadcrumbListeners(navigateTo);
    
    container.querySelectorAll('.settings-nav-item').forEach(btn => {
      btn.onclick = () => {
        currentSettingsTab = btn.dataset.tab;
        container.querySelectorAll('.settings-nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        history.replaceState(null, '', `/admin/settings?tab=${currentSettingsTab}`);
        renderSettingsContent(config);
      };
    });
    
    renderSettingsContent(config);
    
  } catch (e) {
    container.innerHTML = `<div class="error">Failed to load settings</div>`;
  }
}

async function renderSettingsContent(config) {
  const content = document.getElementById('settings-content');
  if (!content) return;
  
  switch (currentSettingsTab) {
    case 'general':
      renderGeneralSettings(content, config);
      break;
    case 'registration':
      renderRegistrationSettings(content, config);
      break;
    case 'defaults':
      renderDefaultsSettings(content, config);
      break;
    case 'oauth':
      renderOAuthSettings(content, config);
      break;
    case 'api-keys':
      renderApiKeysSettings(content, config);
      break;
    case 'mail':
      renderMailSettings(content, config);
      break;
    case 'advanced':
      renderAdvancedSettings(content, config);
      break;
    default:
      renderGeneralSettings(content, config);
  }
}

// ==================== GENERAL SETTINGS ====================

function renderGeneralSettings(content, config) {
  content.innerHTML = `
    <div class="settings-section">
      <div class="settings-section-header">
        <h2>General Settings</h2>
        <p>Configure basic panel information and branding.</p>
      </div>
      
      <form id="general-settings-form" class="settings-form">
        <div class="detail-card">
          <h3>Panel Information</h3>
          <div class="form-grid">
            <div class="form-group">
              <label>Panel Name</label>
              <input type="text" name="panel_name" value="${escapeHtml(config.panel?.name || 'Sodium Panel')}" />
              <small class="form-hint">Displayed in the browser title and navigation</small>
            </div>
            <div class="form-group">
              <label>Panel URL</label>
              <input type="url" name="panel_url" value="${escapeHtml(config.panel?.url || '')}" placeholder="https://panel.example.com" />
              <small class="form-hint">Used for OAuth callbacks and email links</small>
            </div>
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
            <label class="toggle-item">
              <input type="checkbox" name="disable_user_server_creation" ${config.features?.disableUserServerCreation ? 'checked' : ''} />
              <span class="toggle-content">
                <span class="toggle-title">Disable User Server Creation</span>
                <span class="toggle-desc">Prevent non-admin users from creating new servers</span>
              </span>
            </label>
          </div>
        </div>
        
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">
            <span class="material-icons-outlined">save</span>
            Save Changes
          </button>
        </div>
      </form>
    </div>
  `;
  
  document.getElementById('general-settings-form').onsubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    
    const newConfig = {
      panel: {
        name: form.panel_name.value,
        url: form.panel_url.value
      },
      features: {
        subusers: form.subusers_enabled.checked,
        disableUserServerCreation: form.disable_user_server_creation.checked
      }
    };
    
    await saveSettings(newConfig);
  };
}

// ==================== REGISTRATION SETTINGS ====================

function renderRegistrationSettings(content, config) {
  content.innerHTML = `
    <div class="settings-section">
      <div class="settings-section-header">
        <h2>Registration Settings</h2>
        <p>Control how new users can register on the panel.</p>
      </div>
      
      <form id="registration-settings-form" class="settings-form">
        <div class="detail-card">
          <h3>User Registration</h3>
          <div class="form-toggles">
            <label class="toggle-item">
              <input type="checkbox" name="registration_enabled" ${config.registration?.enabled ? 'checked' : ''} />
              <span class="toggle-content">
                <span class="toggle-title">Allow Registrations</span>
                <span class="toggle-desc">Allow new users to create accounts on the panel</span>
              </span>
            </label>
            <label class="toggle-item ${!mailConfigured ? 'disabled' : ''}">
              <input type="checkbox" name="email_verification" ${config.registration?.emailVerification ? 'checked' : ''} ${!mailConfigured ? 'disabled' : ''} />
              <span class="toggle-content">
                <span class="toggle-title">Email Verification</span>
                <span class="toggle-desc">${mailConfigured ? 'Require users to verify their email address' : 'Configure mail settings first'}</span>
              </span>
            </label>
            <label class="toggle-item">
              <input type="checkbox" name="captcha_enabled" ${config.registration?.captcha ? 'checked' : ''} />
              <span class="toggle-content">
                <span class="toggle-title">Captcha Protection</span>
                <span class="toggle-desc">Require captcha verification on registration</span>
              </span>
            </label>
          </div>
        </div>
        
        <div class="detail-card">
          <h3>Restrictions</h3>
          <div class="form-group">
            <label>Allowed Email Domains</label>
            <input type="text" name="allowed_domains" value="${escapeHtml(config.registration?.allowedDomains || '')}" placeholder="example.com, company.org" />
            <small class="form-hint">Comma-separated list. Leave empty to allow all domains.</small>
          </div>
          <div class="form-group">
            <label>Blocked Email Domains</label>
            <input type="text" name="blocked_domains" value="${escapeHtml(config.registration?.blockedDomains || '')}" placeholder="tempmail.com, disposable.org" />
            <small class="form-hint">Comma-separated list of domains to block.</small>
          </div>
        </div>
        
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">
            <span class="material-icons-outlined">save</span>
            Save Changes
          </button>
        </div>
      </form>
    </div>
  `;
  
  document.getElementById('registration-settings-form').onsubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    
    const newConfig = {
      registration: {
        enabled: form.registration_enabled.checked,
        emailVerification: form.email_verification.checked,
        captcha: form.captcha_enabled.checked,
        allowedDomains: form.allowed_domains.value,
        blockedDomains: form.blocked_domains.value
      }
    };
    
    await saveSettings(newConfig);
  };
}

// ==================== DEFAULTS SETTINGS ====================

function renderDefaultsSettings(content, config) {
  content.innerHTML = `
    <div class="settings-section">
      <div class="settings-section-header">
        <h2>User Defaults</h2>
        <p>Default resource limits applied to new users when they register.</p>
      </div>
      
      <form id="defaults-settings-form" class="settings-form">
        <div class="detail-card">
          <h3>Resource Limits</h3>
          <div class="form-grid">
            <div class="form-group">
              <label>Max Servers</label>
              <input type="number" name="default_servers" value="${config.defaults?.servers || 2}" min="0" />
              <small class="form-hint">Maximum number of servers a user can create</small>
            </div>
            <div class="form-group">
              <label>Max Memory (MB)</label>
              <input type="number" name="default_memory" value="${config.defaults?.memory || 2048}" min="0" step="128" />
              <small class="form-hint">Total memory allocation across all servers</small>
            </div>
            <div class="form-group">
              <label>Max Disk (MB)</label>
              <input type="number" name="default_disk" value="${config.defaults?.disk || 10240}" min="0" step="1024" />
              <small class="form-hint">Total disk space across all servers</small>
            </div>
            <div class="form-group">
              <label>Max CPU (%)</label>
              <input type="number" name="default_cpu" value="${config.defaults?.cpu || 200}" min="0" step="25" />
              <small class="form-hint">Total CPU allocation (100% = 1 core)</small>
            </div>
          </div>
        </div>
        
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">
            <span class="material-icons-outlined">save</span>
            Save Changes
          </button>
        </div>
      </form>
    </div>
  `;
  
  document.getElementById('defaults-settings-form').onsubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    
    const newConfig = {
      defaults: {
        servers: parseInt(form.default_servers.value) || 2,
        memory: parseInt(form.default_memory.value) || 2048,
        disk: parseInt(form.default_disk.value) || 10240,
        cpu: parseInt(form.default_cpu.value) || 200
      }
    };
    
    await saveSettings(newConfig);
  };
}

// ==================== OAUTH SETTINGS ====================

function renderOAuthSettings(content, config) {
  content.innerHTML = `
    <div class="settings-section">
      <div class="settings-section-header">
        <div class="settings-section-header-row">
          <div>
            <h2>OAuth Providers</h2>
            <p>Configure third-party authentication providers.</p>
          </div>
          <button class="btn btn-primary" id="add-oauth-provider-btn">
            <span class="material-icons-outlined">add</span>
            Add Provider
          </button>
        </div>
      </div>
      
      <div class="oauth-providers-grid" id="oauth-providers-list">
        <div class="loading-spinner">
          <span class="material-icons-outlined spinning">sync</span>
        </div>
      </div>
    </div>
  `;
  
  loadOAuthProviders();
  setupOAuthHandlers();
}

const providerIcons = {
  discord: 'chat',
  google: 'mail',
  github: 'code',
  gitlab: 'source',
  microsoft: 'window',
  twitter: 'tag',
  facebook: 'people',
  apple: 'phone_iphone',
  twitch: 'videogame_asset',
  slack: 'forum',
  linkedin: 'work',
  spotify: 'music_note',
  reddit: 'forum',
  bitbucket: 'code',
  custom: 'key'
};

const providerColors = {
  discord: '#5865F2',
  google: '#4285F4',
  github: '#24292e',
  gitlab: '#FC6D26',
  microsoft: '#00a4ef',
  twitter: '#000',
  facebook: '#1877f2',
  apple: '#000',
  twitch: '#9146ff',
  slack: '#4a154b',
  linkedin: '#0a66c2',
  spotify: '#1db954',
  reddit: '#ff4500',
  bitbucket: '#0052cc',
  custom: '#6366f1'
};

async function loadOAuthProviders() {
  const list = document.getElementById('oauth-providers-list');
  if (!list) return;
  
  try {
    const res = await api('/api/admin/oauth/providers');
    const data = await res.json();
    const providers = data.providers || [];
    
    if (providers.length === 0) {
      list.innerHTML = `
        <div class="empty-state-card">
          <span class="material-icons-outlined">login</span>
          <h3>No OAuth Providers</h3>
          <p>Add a provider to allow users to sign in with their existing accounts.</p>
          <button class="btn btn-primary" onclick="document.getElementById('add-oauth-provider-btn').click()">
            <span class="material-icons-outlined">add</span>
            Add Your First Provider
          </button>
        </div>
      `;
      return;
    }
    
    list.innerHTML = providers.map(p => `
      <div class="oauth-provider-card" data-id="${p.id}">
        <div class="oauth-provider-card-header" style="border-left-color: ${providerColors[p.type] || '#6366f1'}">
          <div class="oauth-provider-icon" style="background: ${providerColors[p.type] || '#6366f1'}">
            <span class="material-icons-outlined">${providerIcons[p.type] || 'key'}</span>
          </div>
          <div class="oauth-provider-info">
            <span class="oauth-provider-name">${escapeHtml(p.name)}</span>
            <span class="oauth-provider-type">${p.type.charAt(0).toUpperCase() + p.type.slice(1)}</span>
          </div>
          <span class="status-badge ${p.enabled ? 'active' : 'inactive'}">${p.enabled ? 'Active' : 'Disabled'}</span>
        </div>
        <div class="oauth-provider-card-footer">
          <span class="oauth-provider-meta">
            <span class="material-icons-outlined">key</span>
            ${p.client_id ? 'Configured' : 'Not configured'}
          </span>
          <div class="oauth-provider-actions">
            <button class="btn btn-sm btn-ghost edit-oauth-btn" data-id="${p.id}">
              <span class="material-icons-outlined">edit</span>
              Edit
            </button>
            <button class="btn btn-sm btn-ghost btn-danger delete-oauth-btn" data-id="${p.id}">
              <span class="material-icons-outlined">delete</span>
            </button>
          </div>
        </div>
      </div>
    `).join('');
    
    list.querySelectorAll('.edit-oauth-btn').forEach(btn => {
      btn.onclick = () => showOAuthModal(btn.dataset.id);
    });
    
    list.querySelectorAll('.delete-oauth-btn').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Delete this OAuth provider?')) return;
        try {
          await api(`/api/admin/oauth/providers/${btn.dataset.id}`, { method: 'DELETE' });
          toast.success('Provider deleted');
          loadOAuthProviders();
        } catch (e) {
          toast.error('Failed to delete provider');
        }
      };
    });
  } catch (e) {
    list.innerHTML = `<div class="error">Failed to load providers</div>`;
  }
}

function setupOAuthHandlers() {
  const addBtn = document.getElementById('add-oauth-provider-btn');
  if (addBtn) {
    addBtn.onclick = () => showOAuthModal(null);
  }
}

function showOAuthModal(editId) {
  const isEdit = !!editId;
  
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.id = 'oauth-modal';
  modal.innerHTML = `
    <div class="modal-backdrop" onclick="this.parentElement.remove()"></div>
    <div class="modal-content modal-large">
      <div class="modal-header">
        <h3>${isEdit ? 'Edit OAuth Provider' : 'Add OAuth Provider'}</h3>
        <button class="modal-close" onclick="this.closest('.modal').remove()">
          <span class="material-icons-outlined">close</span>
        </button>
      </div>
      <form id="oauth-form" class="modal-form">
        <div class="form-grid">
          <div class="form-group">
            <label>Provider Name</label>
            <input type="text" name="name" required placeholder="My Discord Login" />
          </div>
          <div class="form-group">
            <label>Provider Type</label>
            <select name="type" required>
              <option value="discord">Discord</option>
              <option value="google">Google</option>
              <option value="github">GitHub</option>
              <option value="gitlab">GitLab</option>
              <option value="microsoft">Microsoft</option>
              <option value="twitter">Twitter / X</option>
              <option value="facebook">Facebook</option>
              <option value="apple">Apple</option>
              <option value="twitch">Twitch</option>
              <option value="slack">Slack</option>
              <option value="linkedin">LinkedIn</option>
              <option value="spotify">Spotify</option>
              <option value="reddit">Reddit</option>
              <option value="bitbucket">Bitbucket</option>
              <option value="custom">Custom</option>
            </select>
          </div>
        </div>
        
        <div class="form-grid">
          <div class="form-group">
            <label>Client ID</label>
            <input type="text" name="client_id" required placeholder="Your OAuth Client ID" />
          </div>
          <div class="form-group">
            <label>Client Secret</label>
            <input type="password" name="client_secret" ${isEdit ? '' : 'required'} placeholder="${isEdit ? 'Leave blank to keep current' : 'Your OAuth Client Secret'}" />
          </div>
        </div>
        
        <div id="custom-oauth-fields" style="display: none;">
          <h4>Custom Provider Settings</h4>
          <div class="form-group">
            <label>Authorization URL</label>
            <input type="url" name="authorize_url" placeholder="https://provider.com/oauth/authorize" />
          </div>
          <div class="form-group">
            <label>Token URL</label>
            <input type="url" name="token_url" placeholder="https://provider.com/oauth/token" />
          </div>
          <div class="form-group">
            <label>User Info URL</label>
            <input type="url" name="userinfo_url" placeholder="https://provider.com/api/user" />
          </div>
          <div class="form-group">
            <label>Scopes</label>
            <input type="text" name="scopes" placeholder="openid email profile" />
          </div>
        </div>
        
        <div class="form-toggles">
          <label class="toggle-item">
            <input type="checkbox" name="enabled" checked />
            <span class="toggle-content">
              <span class="toggle-title">Enabled</span>
              <span class="toggle-desc">Allow users to login with this provider</span>
            </span>
          </label>
        </div>
        
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" onclick="this.closest('.modal').remove()">Cancel</button>
          <button type="submit" class="btn btn-primary">${isEdit ? 'Save' : 'Add Provider'}</button>
        </div>
      </form>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  const typeSelect = modal.querySelector('select[name="type"]');
  const customFields = modal.querySelector('#custom-oauth-fields');
  
  typeSelect.onchange = () => {
    customFields.style.display = typeSelect.value === 'custom' ? 'block' : 'none';
  };
  
  modal.querySelector('#oauth-form').onsubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    
    const providerData = {
      name: form.get('name'),
      type: form.get('type'),
      client_id: form.get('client_id'),
      enabled: form.get('enabled') === 'on'
    };
    
    if (form.get('client_secret')) {
      providerData.client_secret = form.get('client_secret');
    }
    
    if (form.get('type') === 'custom') {
      providerData.authorize_url = form.get('authorize_url');
      providerData.token_url = form.get('token_url');
      providerData.userinfo_url = form.get('userinfo_url');
      providerData.scopes = form.get('scopes');
    }
    
    try {
      if (isEdit) {
        await api(`/api/admin/oauth/providers/${editId}`, {
          method: 'PUT',
          body: JSON.stringify({ provider: providerData })
        });
        toast.success('Provider updated');
      } else {
        await api('/api/admin/oauth/providers', {
          method: 'POST',
          body: JSON.stringify({ provider: providerData })
        });
        toast.success('Provider added');
      }
      modal.remove();
      loadOAuthProviders();
    } catch (e) {
      toast.error('Failed to save provider');
    }
  };
}

// ==================== API KEYS SETTINGS ====================

let appPermissions = [];

function renderApiKeysSettings(content, config) {
  content.innerHTML = `
    <div class="settings-section">
      <div class="settings-section-header">
        <div class="settings-section-header-row">
          <div>
            <h2>Application API Keys</h2>
            <p>Create API keys for automation, integrations, and external applications.</p>
          </div>
          <button class="btn btn-primary" id="create-app-key-btn">
            <span class="material-icons-outlined">add</span>
            Create Key
          </button>
        </div>
      </div>
      
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
  `;
  
  loadAppApiKeys();
  setupAppApiKeysHandlers();
}

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
        <div class="empty-state-card">
          <span class="material-icons-outlined">vpn_key</span>
          <h3>No API Keys</h3>
          <p>Create an API key to integrate external applications with the panel.</p>
          <button class="btn btn-primary" onclick="document.getElementById('create-app-key-btn').click()">
            <span class="material-icons-outlined">add</span>
            Create Your First Key
          </button>
        </div>
      `;
      return;
    }
    
    list.innerHTML = keysData.keys.map(key => `
      <div class="api-key-card" data-id="${key.id}">
        <div class="api-key-card-main">
          <div class="api-key-icon">
            <span class="material-icons-outlined">vpn_key</span>
          </div>
          <div class="api-key-info">
            <span class="api-key-name">${escapeHtml(key.name)}</span>
            <span class="api-key-meta">
              Created by ${escapeHtml(key.createdBy)} on ${new Date(key.createdAt).toLocaleDateString()}
              ${key.lastUsedAt ? ` • Last used ${new Date(key.lastUsedAt).toLocaleDateString()}` : ' • Never used'}
            </span>
          </div>
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
          toast.success('API key deleted');
          loadAppApiKeys();
        } catch (err) {
          toast.error('Failed to delete key');
        }
      };
    });
  } catch (err) {
    console.error('Failed to load API keys:', err);
    list.innerHTML = `<div class="error">Failed to load API keys</div>`;
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
        <span>${p}</span>
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
    toast.success('Copied to clipboard');
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

// ==================== MAIL SETTINGS ====================

function renderMailSettings(content, config) {
  content.innerHTML = `
    <div class="settings-section">
      <div class="settings-section-header">
        <h2>Mail Settings</h2>
        <p>Configure email delivery for notifications and password resets.</p>
      </div>
      
      <form id="mail-settings-form" class="settings-form">
        <div class="detail-card">
          <h3>SMTP Configuration</h3>
          <div class="form-grid">
            <div class="form-group">
              <label>SMTP Host</label>
              <input type="text" name="smtp_host" value="${escapeHtml(config.mail?.host || '')}" placeholder="smtp.example.com" />
            </div>
            <div class="form-group">
              <label>SMTP Port</label>
              <input type="number" name="smtp_port" value="${config.mail?.port || 587}" placeholder="587" />
            </div>
            <div class="form-group">
              <label>Username</label>
              <input type="text" name="smtp_user" value="${escapeHtml(config.mail?.user || '')}" placeholder="user@example.com" />
            </div>
            <div class="form-group">
              <label>Password</label>
              <input type="password" name="smtp_pass" placeholder="Leave blank to keep current" />
            </div>
          </div>
          <div class="form-toggles" style="margin-top: 1rem;">
            <label class="toggle-item">
              <input type="checkbox" name="smtp_secure" ${config.mail?.secure ? 'checked' : ''} />
              <span class="toggle-content">
                <span class="toggle-title">Use TLS/SSL</span>
                <span class="toggle-desc">Enable secure connection</span>
              </span>
            </label>
          </div>
        </div>
        
        <div class="detail-card">
          <h3>Sender Information</h3>
          <div class="form-grid">
            <div class="form-group">
              <label>From Name</label>
              <input type="text" name="mail_from_name" value="${escapeHtml(config.mail?.fromName || 'Sodium Panel')}" />
            </div>
            <div class="form-group">
              <label>From Email</label>
              <input type="email" name="mail_from_email" value="${escapeHtml(config.mail?.fromEmail || '')}" placeholder="noreply@example.com" />
            </div>
          </div>
        </div>
        
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="test-mail-btn">
            <span class="material-icons-outlined">send</span>
            Send Test Email
          </button>
          <button type="submit" class="btn btn-primary">
            <span class="material-icons-outlined">save</span>
            Save Changes
          </button>
        </div>
      </form>
    </div>
  `;
  
  document.getElementById('mail-settings-form').onsubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    
    const newConfig = {
      mail: {
        host: form.smtp_host.value,
        port: parseInt(form.smtp_port.value) || 587,
        user: form.smtp_user.value,
        secure: form.smtp_secure.checked,
        fromName: form.mail_from_name.value,
        fromEmail: form.mail_from_email.value
      }
    };
    
    if (form.smtp_pass.value) {
      newConfig.mail.pass = form.smtp_pass.value;
    }
    
    await saveSettings(newConfig);
  };
  
  document.getElementById('test-mail-btn').onclick = async () => {
    const email = prompt('Enter email address to send test to:');
    if (!email) return;
    
    const btn = document.getElementById('test-mail-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons-outlined spinning">sync</span> Sending...';
    
    try {
      const res = await api('/api/admin/mail/test', { 
        method: 'POST',
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Test email sent successfully');
      } else {
        toast.error(data.error || 'Failed to send test email');
      }
    } catch (e) {
      toast.error('Failed to send test email');
    }
    
    btn.disabled = false;
    btn.innerHTML = '<span class="material-icons-outlined">send</span> Send Test Email';
  };
}

// ==================== ADVANCED SETTINGS ====================

function renderAdvancedSettings(content, config) {
  content.innerHTML = `
    <div class="settings-section">
      <div class="settings-section-header">
        <h2>Advanced Settings</h2>
        <p>Advanced configuration options. Be careful when modifying these settings.</p>
      </div>
      
      <form id="advanced-settings-form" class="settings-form">
        <div class="detail-card">
          <h3>Performance</h3>
          <div class="form-grid">
            <div class="form-group">
              <label>Console History Lines</label>
              <input type="number" name="console_lines" value="${config.advanced?.consoleLines || 1000}" min="100" max="10000" />
              <small class="form-hint">Number of console lines to keep in memory</small>
            </div>
            <div class="form-group">
              <label>File Manager Max Size (MB)</label>
              <input type="number" name="max_upload_size" value="${config.advanced?.maxUploadSize || 100}" min="1" />
              <small class="form-hint">Maximum file upload size</small>
            </div>
          </div>
        </div>
        
        <div class="detail-card">
          <h3>Two-Factor Authentication</h3>
          <div class="form-toggles">
            <label class="toggle-item ${!mailConfigured ? 'disabled' : ''}">
              <input type="checkbox" name="require_2fa" ${config.security?.require2fa ? 'checked' : ''} ${!mailConfigured ? 'disabled' : ''} />
              <span class="toggle-content">
                <span class="toggle-title">Require 2FA for All Users</span>
                <span class="toggle-desc">${mailConfigured ? 'Force all users to verify with email code on login' : 'Configure mail settings first'}</span>
              </span>
            </label>
            <label class="toggle-item ${!mailConfigured ? 'disabled' : ''}">
              <input type="checkbox" name="require_2fa_admin" ${config.security?.require2faAdmin ? 'checked' : ''} ${!mailConfigured ? 'disabled' : ''} />
              <span class="toggle-content">
                <span class="toggle-title">Require 2FA for Admins Only</span>
                <span class="toggle-desc">${mailConfigured ? 'Force only administrators to verify with email code' : 'Configure mail settings first'}</span>
              </span>
            </label>
          </div>
          ${mailConfigured ? '<small class="form-hint" style="margin-top: 0.75rem; display: block;">Users must have a verified email to use 2FA.</small>' : ''}
        </div>
        
        <div class="detail-card">
          <h3>Logging</h3>
          <div class="form-toggles">
            <label class="toggle-item">
              <input type="checkbox" name="audit_logging" ${config.advanced?.auditLogging !== false ? 'checked' : ''} />
              <span class="toggle-content">
                <span class="toggle-title">Audit Logging</span>
                <span class="toggle-desc">Log all administrative actions</span>
              </span>
            </label>
          </div>
        </div>
        
        <div class="detail-card danger-card">
          <h3>Danger Zone</h3>
          <div class="danger-actions">
            <div class="danger-action">
              <div class="danger-info">
                <span class="danger-title">Clear All Cache</span>
                <span class="danger-desc">Clear all cached data including sessions</span>
              </div>
              <button type="button" class="btn btn-danger btn-sm" id="clear-cache-btn">Clear Cache</button>
            </div>
            <div class="danger-action">
              <div class="danger-info">
                <span class="danger-title">Rebuild Database Indexes</span>
                <span class="danger-desc">Rebuild search indexes for better performance</span>
              </div>
              <button type="button" class="btn btn-danger btn-sm" id="rebuild-indexes-btn">Rebuild</button>
            </div>
          </div>
        </div>
        
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">
            <span class="material-icons-outlined">save</span>
            Save Changes
          </button>
        </div>
      </form>
    </div>
  `;
  
  document.getElementById('advanced-settings-form').onsubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    
    const newConfig = {
      advanced: {
        consoleLines: parseInt(form.console_lines.value) || 1000,
        maxUploadSize: parseInt(form.max_upload_size.value) || 100,
        auditLogging: form.audit_logging.checked
      },
      security: {
        require2fa: form.require_2fa.checked,
        require2faAdmin: form.require_2fa_admin.checked
      }
    };
    
    await saveSettings(newConfig);
  };
  
  document.getElementById('clear-cache-btn').onclick = async () => {
    if (!confirm('Clear all cache? Users may need to log in again.')) return;
    toast.info('Clearing cache...');
    try {
      await api('/api/admin/cache/clear', { method: 'POST' });
      toast.success('Cache cleared');
    } catch (e) {
      toast.error('Failed to clear cache');
    }
  };
  
  document.getElementById('rebuild-indexes-btn').onclick = async () => {
    if (!confirm('Rebuild database indexes? This may take a moment.')) return;
    toast.info('Rebuilding indexes...');
    try {
      await api('/api/admin/database/rebuild', { method: 'POST' });
      toast.success('Indexes rebuilt');
    } catch (e) {
      toast.error('Failed to rebuild indexes');
    }
  };
}

// ==================== HELPERS ====================

async function saveSettings(newConfig) {
  try {
    const res = await api('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: newConfig })
    });
    
    if (res.ok) {
      toast.success('Settings saved');
    } else {
      toast.error('Failed to save settings');
    }
  } catch (e) {
    toast.error('Failed to save settings');
  }
}
