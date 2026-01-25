import { renderNav } from '../../components/nav.js';
import { renderAdminSidebar } from '../../components/sidebar.js';
import { icon } from '../../components/icon.js';
import { api } from '../../utils/api.js';
import { toast } from '../../components/toast.js';
import { formatDate } from '../../utils/format.js';
import { openModal, closeModal, confirmModal } from '../../components/modal.js';

export default function() {
  return `
    ${renderNav()}
    <div class="admin-layout">
      ${renderAdminSidebar('users')}
      <main class="admin-content">
        <div class="admin-header">
          <div>
            <h1>Users</h1>
            <p class="text-secondary">Manage user accounts</p>
          </div>
          <button class="btn btn-primary" id="btn-new-user">
            ${icon('user-plus', 18)} New User
          </button>
        </div>

        <div class="table-container">
          <table class="table" id="users-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Servers</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="users-list">
              <tr><td colspan="6" class="loading">Loading...</td></tr>
            </tbody>
          </table>
        </div>
      </main>
    </div>
  `;
}

export async function mount() {
  const usersList = document.getElementById('users-list');
  let users = [];

  async function loadUsers() {
    try {
      const res = await api.get('/admin/users');
      users = res.data || [];
      renderUsers();
    } catch (err) {
      toast.error('Failed to load users');
      usersList.innerHTML = '<tr><td colspan="6" class="empty">Failed to load users</td></tr>';
    }
  }

  function renderUsers() {
    if (users.length === 0) {
      usersList.innerHTML = '<tr><td colspan="6" class="empty">No users found</td></tr>';
      return;
    }

    usersList.innerHTML = users.map(user => `
      <tr data-id="${user.id}">
        <td>
          <div class="user-cell">
            <div class="avatar">${user.username.charAt(0).toUpperCase()}</div>
            <span>${user.username}</span>
          </div>
        </td>
        <td>${user.email}</td>
        <td>
          <span class="badge badge-${user.role === 'admin' ? 'primary' : 'secondary'}">${user.role}</span>
        </td>
        <td>${user.server_count || 0}</td>
        <td>${formatDate(user.created_at)}</td>
        <td class="actions-cell">
          <button class="btn btn-ghost btn-sm edit-btn" title="Edit">
            ${icon('edit', 14)}
          </button>
          <button class="btn btn-ghost btn-sm delete-btn" title="Delete">
            ${icon('trash', 14)}
          </button>
        </td>
      </tr>
    `).join('');

    attachListeners();
  }

  function attachListeners() {
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = btn.closest('tr');
        const user = users.find(u => u.id == row.dataset.id);
        editUser(user);
      });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const row = btn.closest('tr');
        const user = users.find(u => u.id == row.dataset.id);
        await deleteUser(user);
      });
    });
  }

  function showUserModal(user = null) {
    const isEdit = !!user;
    
    openModal({
      title: isEdit ? 'Edit User' : 'New User',
      size: 'lg',
      content: `
        <form id="user-form">
          <div class="form-section">
            <h4>Account Information</h4>
            <div class="form-row">
              <div class="form-group">
                <label for="username">Username</label>
                <input type="text" id="username" class="input" value="${user?.username || ''}" required>
              </div>
              <div class="form-group">
                <label for="email">Email</label>
                <input type="email" id="email" class="input" value="${user?.email || ''}" required>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="password">Password ${isEdit ? '(leave blank to keep)' : ''}</label>
                <input type="password" id="password" class="input" ${isEdit ? '' : 'required'}>
              </div>
              <div class="form-group">
                <label for="role">Role</label>
                <select id="role" class="input">
                  <option value="user" ${user?.role === 'user' ? 'selected' : ''}>User</option>
                  <option value="admin" ${user?.role === 'admin' ? 'selected' : ''}>Admin</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="display_name">Display Name</label>
                <input type="text" id="display_name" class="input" value="${user?.display_name || ''}" placeholder="Optional">
              </div>
              <div class="form-group">
                <label for="bio">Bio</label>
                <input type="text" id="bio" class="input" value="${user?.bio || ''}" placeholder="Optional">
              </div>
            </div>
          </div>
          
          <div class="form-section">
            <h4>Resource Limits <span class="text-muted text-sm">(0 = unlimited)</span></h4>
            <div class="form-row">
              <div class="form-group">
                <label for="limit_servers">Servers</label>
                <input type="number" id="limit_servers" class="input" value="${user?.limit_servers ?? 0}" min="0">
              </div>
              <div class="form-group">
                <label for="limit_cpu">CPU (%)</label>
                <input type="number" id="limit_cpu" class="input" value="${user?.limit_cpu ?? 0}" min="0">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="limit_memory">Memory (MB)</label>
                <input type="number" id="limit_memory" class="input" value="${user?.limit_memory ?? 0}" min="0">
              </div>
              <div class="form-group">
                <label for="limit_disk">Disk (MB)</label>
                <input type="number" id="limit_disk" class="input" value="${user?.limit_disk ?? 0}" min="0">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="limit_databases">Databases</label>
                <input type="number" id="limit_databases" class="input" value="${user?.limit_databases ?? 0}" min="0">
              </div>
              <div class="form-group">
                <label for="limit_backups">Backups</label>
                <input type="number" id="limit_backups" class="input" value="${user?.limit_backups ?? 0}" min="0">
              </div>
              <div class="form-group">
                <label for="limit_allocations">Allocations</label>
                <input type="number" id="limit_allocations" class="input" value="${user?.limit_allocations ?? 0}" min="0">
              </div>
            </div>
          </div>
        </form>
      `,
      actions: [
        { label: 'Cancel', class: 'btn-ghost', action: closeModal },
        { label: isEdit ? 'Save' : 'Create', class: 'btn-primary', action: async () => {
          const data = {
            username: document.getElementById('username').value,
            email: document.getElementById('email').value,
            role: document.getElementById('role').value,
            display_name: document.getElementById('display_name').value || null,
            bio: document.getElementById('bio').value || null,
            limit_servers: parseInt(document.getElementById('limit_servers').value) || 0,
            limit_cpu: parseInt(document.getElementById('limit_cpu').value) || 0,
            limit_memory: parseInt(document.getElementById('limit_memory').value) || 0,
            limit_disk: parseInt(document.getElementById('limit_disk').value) || 0,
            limit_databases: parseInt(document.getElementById('limit_databases').value) || 0,
            limit_backups: parseInt(document.getElementById('limit_backups').value) || 0,
            limit_allocations: parseInt(document.getElementById('limit_allocations').value) || 0
          };
          
          const password = document.getElementById('password').value;
          if (password) data.password = password;

          try {
            if (isEdit) {
              await api.put(`/admin/users/${user.id}`, data);
              toast.success('User updated');
            } else {
              await api.post('/admin/users', data);
              toast.success('User created');
            }
            closeModal();
            loadUsers();
          } catch (err) {
            toast.error(err.message || 'Failed to save user');
          }
        }}
      ]
    });
  }

  function editUser(user) {
    showUserModal(user);
  }

  async function deleteUser(user) {
    const confirmed = await confirmModal('Delete User', `Are you sure you want to delete "${user.username}"? This will also delete all their servers.`);
    if (!confirmed) return;

    try {
      await api.delete(`/admin/users/${user.id}`);
      toast.success('User deleted');
      loadUsers();
    } catch (err) {
      toast.error('Failed to delete user');
    }
  }

  document.getElementById('btn-new-user').addEventListener('click', () => showUserModal());

  await loadUsers();
}
