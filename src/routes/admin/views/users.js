import { escapeHtml } from '../../../utils/security.js';
import * as toast from '../../../utils/toast.js';
import * as modal from '../../../utils/modal.js';
import { api } from '../../../utils/api.js';
import { state } from '../state.js';
import { formatBytes, renderPagination, setupPaginationListeners, renderBreadcrumb, setupBreadcrumbListeners, renderSearchBox, setupSearchListeners } from '../utils/ui.js';

const navigateTo = (...args) => window.adminNavigate(...args);

export async function renderUsersList(container, username, loadView) {
  try {
    const search = state.searchQuery.users ? `&search=${encodeURIComponent(state.searchQuery.users)}` : '';
    const res = await api(`/api/admin/users?page=${state.currentPage.users}&per_page=${state.itemsPerPage.users}${search}`);
    const data = await res.json();
    
    container.innerHTML = `
      <div class="admin-header">
        ${renderBreadcrumb([{ label: 'Users' }])}
        <div class="admin-header-actions">
          ${renderSearchBox('users', 'Search by username, ID, or display name...')}
          <button class="btn btn-primary" id="create-user-btn">
            <span class="material-icons-outlined">person_add</span>
            Create User
          </button>
        </div>
      </div>
      
      <div class="admin-list">
        ${data.users.length === 0 ? `
          <div class="empty-state">
            <span class="material-icons-outlined">people</span>
            <p>No users yet</p>
          </div>
        ` : `
          <div class="list-table">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Limits</th>
                  <th>Subusers</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${data.users.map(u => `
                  <tr class="clickable-row" data-id="${u.id}">
                    <td>
                      <div class="user-cell">
                        <div class="user-avatar">${(u.username || 'U')[0].toUpperCase()}</div>
                        <div class="user-info">
                          <div class="cell-main">${escapeHtml(u.displayName || u.username)}</div>
                          <div class="cell-sub">@${escapeHtml(u.username)}</div>
                        </div>
                      </div>
                    </td>
                    <td><span class="role-badge ${u.isAdmin ? 'admin' : 'user'}">${u.isAdmin ? 'Admin' : 'User'}</span></td>
                    <td>
                      <div class="resource-pills">
                        <span class="pill">${u.limits?.servers || 2} servers</span>
                        <span class="pill">${formatBytes((u.limits?.memory || 2048) * 1024 * 1024)}</span>
                        <span class="pill">${u.limits?.backups ?? 3} backups</span>
                      </div>
                    </td>
                    <td><span class="status-indicator ${u.allowSubusers === false ? 'status-danger' : 'status-success'}"></span> ${u.allowSubusers === false ? 'Disabled' : 'Enabled'}</td>
                    <td>
                      <div class="action-buttons" onclick="event.stopPropagation()">
                        <button class="btn btn-xs btn-ghost" onclick="adminNavigate('users', '${u.id}')">Manage</button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          
          <div class="list-cards">
            ${data.users.map(u => `
              <div class="list-card" data-id="${u.id}">
                <div class="list-card-header">
                  <div class="user-avatar large">${(u.username || 'U')[0].toUpperCase()}</div>
                  <div class="list-card-title">
                    <h3>${escapeHtml(u.displayName || u.username)}</h3>
                    <span class="list-card-subtitle">@${escapeHtml(u.username)}</span>
                  </div>
                  <span class="role-badge ${u.isAdmin ? 'admin' : 'user'}">${u.isAdmin ? 'Admin' : 'User'}</span>
                </div>
                <div class="list-card-stats">
                  <div class="stat">
                    <span class="stat-label">Servers</span>
                    <span class="stat-value">${u.limits?.servers || 2}</span>
                  </div>
                  <div class="stat">
                    <span class="stat-label">Memory</span>
                    <span class="stat-value">${formatBytes((u.limits?.memory || 2048) * 1024 * 1024)}</span>
                  </div>
                  <div class="stat">
                    <span class="stat-label">Backups</span>
                    <span class="stat-value">${u.limits?.backups ?? 3}</span>
                  </div>
                  <div class="stat">
                    <span class="stat-label">Subusers</span>
                    <span class="stat-value">${u.allowSubusers === false ? 'No' : 'Yes'}</span>
                  </div>
                </div>
                <div class="list-card-footer">
                  <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation(); adminNavigate('users', '${u.id}')">
                    <span class="material-icons-outlined">settings</span>
                    Manage
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
        ${renderPagination(data.meta, 'users')}
      </div>
    `;
    
    setupBreadcrumbListeners(navigateTo);
    setupPaginationListeners('users', loadView);
    setupSearchListeners('users', loadView);
    
    document.querySelectorAll('.clickable-row[data-id], .list-card[data-id]').forEach(el => {
      el.onclick = () => navigateTo('users', el.dataset.id);
    });
    
    document.getElementById('create-user-btn')?.addEventListener('click', () => {
      showCreateUserModal(loadView);
    });
    
  } catch (e) {
    container.innerHTML = `<div class="error">Failed to load users</div>`;
  }
}

function showCreateUserModal(loadView) {
  const existing = document.getElementById('create-user-modal');
  if (existing) existing.remove();
  
  const modal = document.createElement('div');
  modal.id = 'create-user-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>Create User</h3>
        <button class="modal-close" id="close-user-modal">
          <span class="material-icons-outlined">close</span>
        </button>
      </div>
      <form id="create-user-form" class="modal-body">
        <div class="form-group">
          <label>Username *</label>
          <input type="text" name="username" required minlength="3" maxlength="20" placeholder="username" />
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" name="email" placeholder="user@example.com" />
        </div>
        <div class="form-group">
          <label>Password *</label>
          <input type="password" name="password" required minlength="6" placeholder="Min 6 characters" />
        </div>
        <div class="form-group">
          <label>Display Name</label>
          <input type="text" name="displayName" placeholder="Display Name" />
        </div>
        <div class="form-toggles">
          <label class="toggle-item">
            <input type="checkbox" name="isAdmin" />
            <span class="toggle-content">
              <span class="toggle-title">Administrator</span>
              <span class="toggle-desc">Grant full admin access</span>
            </span>
          </label>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" id="cancel-user-modal">Cancel</button>
          <button type="submit" class="btn btn-primary">Create User</button>
        </div>
      </form>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  document.getElementById('close-user-modal').onclick = () => modal.remove();
  document.getElementById('cancel-user-modal').onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  
  document.getElementById('create-user-form').onsubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons-outlined spinning">sync</span>';
    
    const user = {
      username: form.username.value,
      email: form.email.value || undefined,
      password: form.password.value,
      displayName: form.displayName.value || undefined,
      isAdmin: form.isAdmin.checked
    };
    
    try {
      const res = await api('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user })
      });
      const data = await res.json();
      
      if (data.success) {
        toast.success('User created successfully');
        modal.remove();
        loadView();
      } else {
        toast.error(data.error || 'Failed to create user');
        btn.disabled = false;
        btn.textContent = 'Create User';
      }
    } catch (err) {
      toast.error('Failed to create user');
      btn.disabled = false;
      btn.textContent = 'Create User';
    }
  };
}

export async function renderUserDetail(container, username, userId) {
  try {
    const res = await api(`/api/admin/users`);
    const data = await res.json();
    const user = data.users.find(u => u.id === userId);
    
    if (!user) {
      container.innerHTML = `<div class="error">User not found</div>`;
      return;
    }
    
    container.innerHTML = `
      <div class="admin-header">
        ${renderBreadcrumb([
          { label: 'Users', onClick: 'list-users' },
          { label: user.displayName || user.username }
        ])}
      </div>
      
      <div class="detail-tabs">
        <button class="detail-tab ${state.currentView.subTab === 'overview' ? 'active' : ''}" data-subtab="overview">Overview</button>
        <button class="detail-tab ${state.currentView.subTab === 'servers' ? 'active' : ''}" data-subtab="servers">Servers</button>
        <button class="detail-tab ${state.currentView.subTab === 'permissions' ? 'active' : ''}" data-subtab="permissions">Permissions</button>
        <button class="detail-tab ${state.currentView.subTab === 'limits' ? 'active' : ''}" data-subtab="limits">Resource Limits</button>
      </div>
      
      <div class="detail-content" id="user-detail-content"></div>
    `;
    
    setupBreadcrumbListeners(navigateTo);
    
    document.querySelectorAll('.detail-tab').forEach(tab => {
      tab.onclick = async () => {
        state.currentView.subTab = tab.dataset.subtab;
        document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        await renderUserSubTab(user, username);
      };
    });
    
    await renderUserSubTab(user, username);
    
  } catch (e) {
    container.innerHTML = `<div class="error">Failed to load user</div>`;
  }
}

async function renderUserSubTab(user, username) {
  const content = document.getElementById('user-detail-content');
  
  switch (state.currentView.subTab) {
    case 'overview':
      content.innerHTML = `
        <div class="detail-grid">
          <div class="detail-card">
            <h3>User Information</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Username</span>
                <span class="info-value">@${escapeHtml(user.username)}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Display Name</span>
                <span class="info-value">${escapeHtml(user.displayName || user.username)}</span>
              </div>
              <div class="info-item">
                <span class="info-label">User ID</span>
                <span class="info-value code">${user.id}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Role</span>
                <span class="info-value"><span class="role-badge ${user.isAdmin ? 'admin' : 'user'}">${user.isAdmin ? 'Administrator' : 'User'}</span></span>
              </div>
              <div class="info-item">
                <span class="info-label">Email</span>
                <span class="info-value">${user.email ? escapeHtml(user.email) : '<span class="text-muted">Not set</span>'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Email Verified</span>
                <span class="info-value">${user.emailVerified ? '<span class="status-success-text">Yes</span>' : '<span class="status-danger-text">No</span>'}</span>
              </div>
            </div>
          </div>
          
          <div class="detail-card">
            <h3>Resource Limits</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Max Servers</span>
                <span class="info-value">${user.limits?.servers || 2}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Max Memory</span>
                <span class="info-value">${formatBytes((user.limits?.memory || 2048) * 1024 * 1024)}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Max Disk</span>
                <span class="info-value">${formatBytes((user.limits?.disk || 10240) * 1024 * 1024)}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Max CPU</span>
                <span class="info-value">${user.limits?.cpu || 200}%</span>
              </div>
              <div class="info-item">
                <span class="info-label">Max Allocations</span>
                <span class="info-value">${user.limits?.allocations || 5}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Max Backups</span>
                <span class="info-value">${user.limits?.backups ?? 3}</span>
              </div>
            </div>
          </div>
        
        <div class="detail-card danger-card" style="margin-top: 24px;">
          <h3>Danger Zone</h3>
          <div class="danger-actions">
            <div class="danger-action">
              <div class="danger-info">
                <span class="danger-title">Delete User</span>
                <span class="danger-desc">Permanently delete this user and all their servers. This action cannot be undone.</span>
              </div>
              <button class="btn btn-danger btn-sm" id="delete-user-btn">Delete User</button>
            </div>
          </div>
        </div>
      `;
      
      document.getElementById('delete-user-btn')?.addEventListener('click', async () => {
        const confirmUsername = await modal.prompt(`Type "${user.username}" to confirm deletion:`, { title: 'Delete User', placeholder: user.username });
        if (confirmUsername !== user.username) {
          if (confirmUsername !== null) toast.error('Username does not match');
          return;
        }
        
        const btn = document.getElementById('delete-user-btn');
        btn.disabled = true;
        btn.innerHTML = '<span class="material-icons-outlined spinning">sync</span> Deleting...';
        
        try {
          const res = await api('/api/admin/users/' + user.id, { method: 'DELETE' });
          const data = await res.json();
          
          if (data.success) {
            toast.success('User deleted. ' + data.deletedServers + ' server(s) removed.');
            navigateTo('users');
          } else {
            toast.error(data.error || 'Failed to delete user');
            btn.disabled = false;
            btn.textContent = 'Delete User';
          }
        } catch (e) {
          toast.error('Failed to delete user');
          btn.disabled = false;
          btn.textContent = 'Delete User';
        }
      });
      break;
      
    case 'servers':
      content.innerHTML = '<div class="loading-spinner"></div>';
      try {
        const serversRes = await api('/api/admin/servers?per_page=100');
        const serversData = await serversRes.json();
        const userServers = serversData.servers.filter(s => s.user_id === user.id);
        
        content.innerHTML = `
          <div class="detail-card detail-card-wide">
            <h3>User Servers</h3>
            ${userServers.length === 0 ? `
              <div class="empty-state small">
                <span class="material-icons-outlined">storage</span>
                <p>This user has no servers</p>
              </div>
            ` : `
              <div class="user-servers-list">
                ${userServers.map(s => `
                  <div class="user-server-item" data-server-id="${s.id}">
                    <div class="user-server-info">
                      <span class="material-icons-outlined">dns</span>
                      <div class="user-server-details">
                        <span class="user-server-name">${escapeHtml(s.name)}</span>
                        <span class="user-server-meta">${s.node_name || 'Unknown Node'} • ${formatBytes((s.limits?.memory || 0) * 1024 * 1024)} RAM</span>
                      </div>
                    </div>
                    <div class="user-server-actions">
                      <span class="server-status-badge ${s.suspended ? 'suspended' : ''}">${s.suspended ? 'Suspended' : 'Active'}</span>
                      <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation(); adminNavigate('servers', '${s.id}')">
                        <span class="material-icons-outlined">settings</span>
                        Manage
                      </button>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        `;
        
        document.querySelectorAll('.user-server-item').forEach(el => {
          el.onclick = () => navigateTo('servers', el.dataset.serverId);
        });
      } catch (e) {
        content.innerHTML = '<div class="error">Failed to load servers</div>';
      }
      break;
      
    case 'permissions':
      content.innerHTML = `
        <div class="detail-card detail-card-wide">
          <h3>User Permissions</h3>
          <form id="user-permissions-form" class="settings-form">
            <div class="form-toggles">
              <label class="toggle-item">
                <input type="checkbox" name="isAdmin" ${user.isAdmin ? 'checked' : ''} />
                <span class="toggle-content">
                  <span class="toggle-title">Administrator</span>
                  <span class="toggle-desc">Grant full administrative access to the panel</span>
                </span>
              </label>
              <label class="toggle-item">
                <input type="checkbox" name="allowSubusers" ${user.allowSubusers !== false ? 'checked' : ''} />
                <span class="toggle-content">
                  <span class="toggle-title">Allow Subusers</span>
                  <span class="toggle-desc">Allow this user to add subusers to their servers</span>
                </span>
              </label>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">Save Permissions</button>
            </div>
          </form>
        </div>
      `;
      
      document.getElementById('user-permissions-form').onsubmit = async (e) => {
        e.preventDefault();
        const form = new FormData(e.target);
        const updates = {
          isAdmin: form.get('isAdmin') === 'on',
          allowSubusers: form.get('allowSubusers') === 'on'
        };
        
        try {
          await api(`/api/admin/users/${user.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates })
          });
          toast.success('Permissions updated');
          navigateTo('users', user.id, 'permissions');
        } catch (e) {
          toast.error('Failed to update permissions');
        }
      };
      break;
      
    case 'limits':
      content.innerHTML = `
        <div class="detail-card detail-card-wide">
          <h3>Resource Limits</h3>
          <p class="card-description">Set the maximum resources this user can allocate across all their servers.</p>
          <form id="user-limits-form" class="settings-form">
            <div class="form-grid">
              <div class="form-group">
                <label>Max Servers</label>
                <input type="number" name="servers" value="${user.limits?.servers || 2}" min="0" required />
              </div>
              <div class="form-group">
                <label>Max Memory (MB)</label>
                <input type="number" name="memory" value="${user.limits?.memory || 2048}" min="0" required />
              </div>
              <div class="form-group">
                <label>Max Disk (MB)</label>
                <input type="number" name="disk" value="${user.limits?.disk || 10240}" min="0" required />
              </div>
              <div class="form-group">
                <label>Max CPU (%)</label>
                <input type="number" name="cpu" value="${user.limits?.cpu || 200}" min="0" required />
              </div>
              <div class="form-group">
                <label>Max Allocations</label>
                <input type="number" name="allocations" value="${user.limits?.allocations || 5}" min="0" required />
              </div>
              <div class="form-group">
                <label>Max Backups</label>
                <input type="number" name="backups" value="${user.limits?.backups ?? 3}" min="0" required />
              </div>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">Update Limits</button>
            </div>
          </form>
        </div>
      `;
      
      document.getElementById('user-limits-form').onsubmit = async (e) => {
        e.preventDefault();
        const form = new FormData(e.target);
        const limits = {
          servers: parseInt(form.get('servers')),
          memory: parseInt(form.get('memory')),
          disk: parseInt(form.get('disk')),
          cpu: parseInt(form.get('cpu')),
          allocations: parseInt(form.get('allocations')),
          backups: parseInt(form.get('backups'))
        };
        
        try {
          await api(`/api/admin/users/${user.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates: { limits } })
          });
          toast.success('Limits updated');
          navigateTo('users', user.id, 'limits');
        } catch (e) {
          toast.error('Failed to update limits');
        }
      };
      break;
  }
}
