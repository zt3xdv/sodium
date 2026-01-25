import { renderNav } from '../../components/nav.js';
import { renderServerSidebar } from '../../components/sidebar.js';
import { icon } from '../../components/icon.js';
import { api } from '../../utils/api.js';
import { toast } from '../../components/toast.js';
import { openModal, closeModal, confirmModal } from '../../components/modal.js';

const PERMISSION_GROUPS = {
  'Control': ['control.console', 'control.start', 'control.stop', 'control.restart'],
  'Files': ['file.read', 'file.create', 'file.update', 'file.delete', 'file.archive'],
  'Backups': ['backup.read', 'backup.create', 'backup.delete', 'backup.restore'],
  'Schedules': ['schedule.read', 'schedule.create', 'schedule.update', 'schedule.delete'],
  'Databases': ['database.read', 'database.create', 'database.delete'],
  'Settings': ['settings.read', 'settings.update', 'startup.read', 'startup.update'],
  'Users': ['user.read', 'user.create', 'user.update', 'user.delete']
};

export default function(params) {
  const serverId = params.id;
  
  return `
    ${renderNav()}
    <div class="server-layout">
      ${renderServerSidebar(serverId, 'users')}
      <main class="server-content">
        <div class="page-container">
          <div class="page-header">
            <div>
              <h1>Subusers</h1>
              <p class="text-secondary">Manage users who can access this server</p>
            </div>
            <button class="btn btn-primary" id="btn-add-user">
              ${icon('user-plus', 18)} Add User
            </button>
          </div>

          <div class="subusers-list" id="subusers-list">
            <div class="loading">Loading subusers...</div>
          </div>
        </div>
      </main>
    </div>
  `;
}

export async function mount(params) {
  const serverId = params.id;
  const usersList = document.getElementById('subusers-list');
  let subusers = [];

  async function loadSubusers() {
    try {
      const res = await api.get(`/servers/${serverId}/users`);
      subusers = res.data || [];
      renderSubusers();
    } catch (err) {
      toast.error('Failed to load subusers');
      usersList.innerHTML = '<div class="empty-state">Failed to load</div>';
    }
  }

  function renderSubusers() {
    if (subusers.length === 0) {
      usersList.innerHTML = `
        <div class="empty-state">
          ${icon('users', 48)}
          <h3>No subusers</h3>
          <p class="text-secondary">Add users to give them access to this server</p>
        </div>
      `;
      return;
    }

    usersList.innerHTML = subusers.map(user => `
      <div class="subuser-item card" data-id="${user.uuid}">
        <div class="user-header">
          <div class="user-avatar">${user.username?.charAt(0).toUpperCase() || 'U'}</div>
          <div class="user-info">
            <h4>${user.username}</h4>
            <p class="text-secondary">${user.email}</p>
          </div>
        </div>
        <div class="user-permissions">
          <p class="text-sm text-secondary">
            ${user.permissions.length} permission${user.permissions.length !== 1 ? 's' : ''}
          </p>
          <div class="permission-tags">
            ${getPermissionSummary(user.permissions)}
          </div>
        </div>
        <div class="user-actions">
          <button class="btn btn-ghost btn-sm edit-btn" data-id="${user.uuid}">
            ${icon('edit', 14)} Edit
          </button>
          <button class="btn btn-ghost btn-sm delete-btn" data-id="${user.uuid}">
            ${icon('trash', 14)} Remove
          </button>
        </div>
      </div>
    `).join('');

    attachListeners();
  }

  function getPermissionSummary(perms) {
    const groups = [];
    for (const [group, groupPerms] of Object.entries(PERMISSION_GROUPS)) {
      const hasAll = groupPerms.every(p => perms.includes(p));
      const hasSome = groupPerms.some(p => perms.includes(p));
      if (hasAll) groups.push(`<span class="tag tag-success">${group}</span>`);
      else if (hasSome) groups.push(`<span class="tag tag-warning">${group} (partial)</span>`);
    }
    return groups.join('') || '<span class="tag">No permissions</span>';
  }

  function attachListeners() {
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const user = subusers.find(u => u.uuid === btn.dataset.id);
        showUserModal(user);
      });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const confirmed = await confirmModal('Remove Subuser', 'This user will lose access to this server.');
        if (!confirmed) return;

        try {
          await api.delete(`/servers/${serverId}/users/${btn.dataset.id}`);
          toast.success('Subuser removed');
          loadSubusers();
        } catch (err) {
          toast.error('Failed to remove subuser');
        }
      });
    });
  }

  function showUserModal(user = null) {
    const isEdit = !!user;
    const currentPerms = user?.permissions || [];

    const permissionsHtml = Object.entries(PERMISSION_GROUPS).map(([group, perms]) => `
      <div class="permission-group">
        <label class="permission-group-header">
          <input type="checkbox" class="group-toggle" data-group="${group}">
          <strong>${group}</strong>
        </label>
        <div class="permission-items">
          ${perms.map(p => `
            <label class="permission-item">
              <input type="checkbox" name="permissions" value="${p}" ${currentPerms.includes(p) ? 'checked' : ''}>
              <span>${p.split('.')[1]}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `).join('');

    openModal({
      title: isEdit ? 'Edit Subuser' : 'Add Subuser',
      content: `
        <form id="subuser-form">
          ${!isEdit ? `
            <div class="form-group">
              <label for="email">User Email</label>
              <input type="email" id="email" class="input" placeholder="user@example.com" required>
              <p class="form-hint">User must already have an account</p>
            </div>
          ` : `
            <div class="form-group">
              <label>User</label>
              <p><strong>${user.username}</strong> (${user.email})</p>
            </div>
          `}
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
        { label: isEdit ? 'Save' : 'Add', class: 'btn-primary', action: async () => {
          const checked = document.querySelectorAll('input[name="permissions"]:checked');
          const permissions = Array.from(checked).map(c => c.value);

          try {
            if (isEdit) {
              await api.put(`/servers/${serverId}/users/${user.uuid}`, { permissions });
            } else {
              const email = document.getElementById('email').value;
              await api.post(`/servers/${serverId}/users`, { email, permissions });
            }
            toast.success(isEdit ? 'Subuser updated' : 'Subuser added');
            closeModal();
            loadSubusers();
          } catch (err) {
            toast.error(err.message || 'Failed to save subuser');
          }
        }}
      ]
    });

    document.querySelectorAll('.group-toggle').forEach(toggle => {
      const group = toggle.dataset.group;
      const perms = PERMISSION_GROUPS[group];
      const checkboxes = document.querySelectorAll(`input[name="permissions"]`);
      const groupCheckboxes = Array.from(checkboxes).filter(c => perms.includes(c.value));
      
      toggle.checked = groupCheckboxes.every(c => c.checked);
      toggle.indeterminate = !toggle.checked && groupCheckboxes.some(c => c.checked);

      toggle.addEventListener('change', () => {
        groupCheckboxes.forEach(c => c.checked = toggle.checked);
      });
    });
  }

  document.getElementById('btn-add-user').addEventListener('click', () => showUserModal());

  await loadSubusers();
}
