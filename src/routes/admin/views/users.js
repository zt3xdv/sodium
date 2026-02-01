import { escapeHtml } from '../../../utils/security.js';
import * as toast from '../../../utils/toast.js';
import { api } from '../../../utils/api.js';
import { state } from '../state.js';
import { formatBytes, renderPagination, setupPaginationListeners, renderBreadcrumb, setupBreadcrumbListeners } from '../utils/ui.js';

const navigateTo = (...args) => window.adminNavigate(...args);

export async function renderUsersList(container, username, loadView) {
  try {
    const res = await api(`/api/admin/users?page=${state.currentPage.users}&per_page=${state.itemsPerPage.users}`);
    const data = await res.json();
    
    container.innerHTML = `
      <div class="admin-header">
        ${renderBreadcrumb([{ label: 'Users' }])}
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
    
    document.querySelectorAll('.clickable-row[data-id], .list-card[data-id]').forEach(el => {
      el.onclick = () => navigateTo('users', el.dataset.id);
    });
    
  } catch (e) {
    container.innerHTML = `<div class="error">Failed to load users</div>`;
  }
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
            </div>
          </div>
        </div>
      `;
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
          cpu: parseInt(form.get('cpu'))
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
