import { renderNav } from '../../components/nav.js';
import { icon } from '../../components/icon.js';
import { api } from '../../utils/api.js';
import { toast } from '../../components/toast.js';
import { formatDate } from '../../utils/format.js';
import { openModal, closeModal, confirmModal } from '../../components/modal.js';

export default function() {
  return `
    ${renderNav()}
    <main class="main-content">
      <div class="container">
        <div class="page-header">
          <div>
            <h1>API Keys</h1>
            <p class="text-secondary">Manage your API access credentials</p>
          </div>
          <button class="btn btn-primary" id="btn-create-key">
            ${icon('plus', 18)} Create API Key
          </button>
        </div>

        <div class="api-keys-list" id="api-keys-list">
          <div class="loading">Loading API keys...</div>
        </div>
      </div>
    </main>
  `;
}

export async function mount() {
  const keysList = document.getElementById('api-keys-list');
  let keys = [];

  async function loadKeys() {
    try {
      const res = await api.get('/account/api-keys');
      keys = res.data || [];
      renderKeys();
    } catch (err) {
      toast.error('Failed to load API keys');
      keysList.innerHTML = '<div class="empty-state">Failed to load</div>';
    }
  }

  function renderKeys() {
    if (keys.length === 0) {
      keysList.innerHTML = `
        <div class="empty-state">
          ${icon('key', 48)}
          <h3>No API keys</h3>
          <p class="text-secondary">Create an API key to access Sodium programmatically</p>
        </div>
      `;
      return;
    }

    keysList.innerHTML = keys.map(key => `
      <div class="api-key-item card" data-id="${key.uuid}">
        <div class="key-header">
          <div class="key-icon">${icon('key', 24)}</div>
          <div class="key-info">
            <h4>${key.description}</h4>
            <p class="text-secondary font-mono">${key.identifier}</p>
          </div>
          <div class="key-meta">
            ${key.expires_at ? `
              <span class="badge ${new Date(key.expires_at) < new Date() ? 'badge-danger' : 'badge-warning'}">
                Expires ${formatDate(key.expires_at)}
              </span>
            ` : '<span class="badge badge-success">No expiration</span>'}
          </div>
        </div>
        <div class="key-details">
          <p class="text-sm text-secondary">
            Created ${formatDate(key.created_at)}
            ${key.last_used_at ? ` • Last used ${formatDate(key.last_used_at)}` : ' • Never used'}
          </p>
          <div class="permission-tags">
            ${key.permissions.slice(0, 5).map(p => `<span class="tag">${p}</span>`).join('')}
            ${key.permissions.length > 5 ? `<span class="tag">+${key.permissions.length - 5} more</span>` : ''}
          </div>
        </div>
        <div class="key-actions">
          <button class="btn btn-ghost btn-sm edit-btn" data-id="${key.uuid}">
            ${icon('edit', 14)} Edit
          </button>
          <button class="btn btn-ghost btn-sm delete-btn" data-id="${key.uuid}">
            ${icon('trash', 14)} Delete
          </button>
        </div>
      </div>
    `).join('');

    attachListeners();
  }

  function attachListeners() {
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = keys.find(k => k.uuid === btn.dataset.id);
        showKeyModal(key);
      });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const confirmed = await confirmModal('Delete API Key', 'This will immediately revoke access for this key.');
        if (!confirmed) return;

        try {
          await api.delete(`/account/api-keys/${btn.dataset.id}`);
          toast.success('API key deleted');
          loadKeys();
        } catch (err) {
          toast.error('Failed to delete API key');
        }
      });
    });
  }

  async function showKeyModal(key = null) {
    const isEdit = !!key;
    let permissionsData = [];

    try {
      const res = await api.get('/account/api-keys/permissions');
      permissionsData = res.data || [];
    } catch {}

    const permGroups = {};
    permissionsData.forEach(p => {
      const [group] = p.split('.');
      if (!permGroups[group]) permGroups[group] = [];
      permGroups[group].push(p);
    });

    const permissionsHtml = Object.entries(permGroups).map(([group, perms]) => `
      <div class="permission-group">
        <strong>${group}</strong>
        <div class="permission-items">
          ${perms.map(p => `
            <label class="permission-item">
              <input type="checkbox" name="permissions" value="${p}" ${key?.permissions?.includes(p) ? 'checked' : ''}>
              <span>${p.split('.')[1]}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `).join('');

    openModal({
      title: isEdit ? 'Edit API Key' : 'Create API Key',
      content: `
        <form id="api-key-form">
          <div class="form-group">
            <label for="description">Description</label>
            <input type="text" id="description" class="input" value="${key?.description || ''}" 
                   placeholder="My API Key" required>
          </div>
          ${!isEdit ? `
            <div class="form-group">
              <label for="expires">Expiration</label>
              <select id="expires" class="input">
                <option value="">Never</option>
                <option value="7">7 days</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="365">1 year</option>
              </select>
            </div>
          ` : ''}
          <div class="form-group">
            <label for="allowed_ips">Allowed IPs (optional)</label>
            <input type="text" id="allowed_ips" class="input" 
                   value="${key?.allowed_ips?.join(', ') || ''}"
                   placeholder="Leave empty for any IP">
            <p class="form-hint">Comma-separated list of IPs</p>
          </div>
          <div class="form-group">
            <label>Permissions</label>
            <div class="permissions-grid">
              ${permissionsHtml}
            </div>
          </div>
        </form>
      `,
      actions: [
        { label: 'Cancel', class: 'btn-ghost', action: closeModal },
        { label: isEdit ? 'Save' : 'Create', class: 'btn-primary', action: async () => {
          const checked = document.querySelectorAll('input[name="permissions"]:checked');
          const permissions = Array.from(checked).map(c => c.value);
          const ipsInput = document.getElementById('allowed_ips').value.trim();
          const allowed_ips = ipsInput ? ipsInput.split(',').map(ip => ip.trim()) : null;

          const data = {
            description: document.getElementById('description').value,
            permissions,
            allowed_ips
          };

          if (!isEdit) {
            const expires = document.getElementById('expires').value;
            if (expires) data.expires_in_days = parseInt(expires);
          }

          try {
            if (isEdit) {
              await api.put(`/account/api-keys/${key.uuid}`, data);
              toast.success('API key updated');
            } else {
              const res = await api.post('/account/api-keys', data);
              closeModal();
              showTokenModal(res.data.token);
              loadKeys();
              return;
            }
            closeModal();
            loadKeys();
          } catch (err) {
            toast.error(err.message || 'Failed to save API key');
          }
        }}
      ]
    });
  }

  function showTokenModal(token) {
    openModal({
      title: 'API Key Created',
      content: `
        <div class="token-display">
          <p class="text-warning"><strong>Save this token now!</strong> It will not be shown again.</p>
          <div class="token-box">
            <code id="token-value">${token}</code>
            <button class="btn btn-ghost btn-sm" id="copy-token">${icon('copy', 16)}</button>
          </div>
        </div>
      `,
      actions: [
        { label: 'Done', class: 'btn-primary', action: closeModal }
      ]
    });

    document.getElementById('copy-token').addEventListener('click', () => {
      navigator.clipboard.writeText(token);
      toast.success('Token copied to clipboard');
    });
  }

  document.getElementById('btn-create-key').addEventListener('click', () => showKeyModal());

  await loadKeys();
}
