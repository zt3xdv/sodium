import { renderNav } from '../../components/nav.js';
import { renderAdminSidebar } from '../../components/sidebar.js';
import { icon } from '../../components/icon.js';
import { api } from '../../utils/api.js';
import { toast } from '../../components/toast.js';


export default function() {
  return `
    ${renderNav()}
    <div class="admin-layout">
      ${renderAdminSidebar('dashboard')}
      <main class="admin-content">
        <div class="admin-header">
          <h1>Admin Dashboard</h1>
          <p class="text-secondary">System overview and quick actions</p>
        </div>

        <div class="stats-grid" id="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">${icon('server', 24)}</div>
            <div class="stat-info">
              <span class="stat-value" id="stat-servers">—</span>
              <span class="stat-label">Servers</span>
              <span class="stat-sub text-secondary" id="stat-servers-online">— online</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon">${icon('hard-drive', 24)}</div>
            <div class="stat-info">
              <span class="stat-value" id="stat-nodes">—</span>
              <span class="stat-label">Nodes</span>
              <span class="stat-sub text-secondary" id="stat-nodes-online">— online</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon">${icon('users', 24)}</div>
            <div class="stat-info">
              <span class="stat-value" id="stat-users">—</span>
              <span class="stat-label">Users</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon">${icon('globe', 24)}</div>
            <div class="stat-info">
              <span class="stat-value" id="stat-allocations">—</span>
              <span class="stat-label">Allocations</span>
              <span class="stat-sub text-secondary" id="stat-allocations-used">— used</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon">${icon('package', 24)}</div>
            <div class="stat-info">
              <span class="stat-value" id="stat-eggs">—</span>
              <span class="stat-label">Eggs</span>
            </div>
          </div>
        </div>

        <div class="admin-grid">
          <section class="admin-section">
            <div class="section-header">
              <h2>System Status</h2>
              <button class="btn btn-ghost" id="refresh-status">${icon('refresh', 16)}</button>
            </div>
            <div class="status-list" id="status-list">
              <div class="status-item">
                <span class="status-indicator status-online"></span>
                <span>Panel</span>
                <span class="text-secondary">Operational</span>
              </div>

              <div class="status-item" id="db-status">
                <span class="status-indicator status-online"></span>
                <span>Database</span>
                <span class="text-secondary">Connected</span>
              </div>

              <div class="status-item" id="nodes-status">
                <span class="status-indicator status-online"></span>
                <span>Nodes</span>
                <span class="text-secondary" id="nodes-status-text">Checking...</span>
              </div>
            </div>
          </section>

          <section class="admin-section">
            <div class="section-header">
              <h2>Recent Servers</h2>
              <a href="/admin/servers" class="btn btn-ghost btn-sm">View All</a>
            </div>
            <div class="activity-list" id="recent-servers">
              <p class="text-secondary">Loading...</p>
            </div>
          </section>

          <section class="admin-section">
            <div class="section-header">
              <h2>Recent Users</h2>
              <a href="/admin/users" class="btn btn-ghost btn-sm">View All</a>
            </div>
            <div class="activity-list" id="recent-users">
              <p class="text-secondary">Loading...</p>
            </div>
          </section>

          <section class="admin-section">
            <div class="section-header">
              <h2>Quick Actions</h2>
            </div>
            <div class="quick-actions">
              <a href="/admin/servers/new" class="action-card">
                ${icon('plus', 20)}
                <span>New Server</span>
              </a>
              <a href="/admin/users/new" class="action-card">
                ${icon('user', 20)}
                <span>New User</span>
              </a>
              <a href="/admin/nodes" class="action-card">
                ${icon('hard-drive', 20)}
                <span>Manage Nodes</span>
              </a>
              <a href="/admin/eggs" class="action-card">
                ${icon('package', 20)}
                <span>Manage Eggs</span>
              </a>
              <a href="/admin/settings" class="action-card">
                ${icon('settings', 20)}
                <span>Settings</span>
              </a>
            </div>
          </section>
        </div>
      </main>
    </div>
  `;
}

function formatTimeAgo(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

function getStatusClass(status) {
  switch (status) {
    case 'online':
    case 'running':
      return 'status-online';
    case 'offline':
    case 'stopped':
      return 'status-offline';
    case 'starting':
    case 'stopping':
      return 'status-warning';
    default:
      return 'status-offline';
  }
}

export async function mount() {
  async function loadStats() {
    try {
      const res = await api.get('/admin/stats');
      const stats = res.data;

      // Update stat cards
      document.getElementById('stat-servers').textContent = stats.servers || 0;
      document.getElementById('stat-servers-online').textContent = `${stats.serversOnline || 0} online`;
      document.getElementById('stat-users').textContent = stats.users || 0;
      document.getElementById('stat-eggs').textContent = stats.eggs || 0;
      document.getElementById('stat-nodes').textContent = stats.nodes || 0;
      document.getElementById('stat-nodes-online').textContent = `${stats.nodesOnline || 0} online`;
      
      const allocs = stats.allocations || { total: 0, used: 0 };
      document.getElementById('stat-allocations').textContent = allocs.total;
      document.getElementById('stat-allocations-used').textContent = `${allocs.used} used`;

      // Update nodes status
      const nodesStatusText = document.getElementById('nodes-status-text');
      const nodesStatusItem = document.getElementById('nodes-status');
      if (stats.nodes === 0) {
        nodesStatusText.textContent = 'No nodes configured';
        nodesStatusItem.querySelector('.status-indicator').className = 'status-indicator status-warning';
      } else if (stats.nodesOnline === stats.nodes) {
        nodesStatusText.textContent = 'All nodes online';
        nodesStatusItem.querySelector('.status-indicator').className = 'status-indicator status-online';
      } else if (stats.nodesOnline === 0) {
        nodesStatusText.textContent = 'All nodes offline';
        nodesStatusItem.querySelector('.status-indicator').className = 'status-indicator status-offline';
      } else {
        nodesStatusText.textContent = `${stats.nodesOnline}/${stats.nodes} online`;
        nodesStatusItem.querySelector('.status-indicator').className = 'status-indicator status-warning';
      }

      // Render recent servers
      const recentServersEl = document.getElementById('recent-servers');
      if (stats.recentServers && stats.recentServers.length > 0) {
        recentServersEl.innerHTML = stats.recentServers.map(server => `
          <a href="/admin/servers/${server.id}" class="activity-item">
            <span class="status-indicator ${getStatusClass(server.status)}"></span>
            <div class="activity-info">
              <span class="activity-title">${server.name}</span>
              <span class="activity-meta text-secondary">${server.owner_name || 'Unknown'} • ${formatTimeAgo(server.created_at)}</span>
            </div>
          </a>
        `).join('');
      } else {
        recentServersEl.innerHTML = '<p class="text-secondary">No servers yet</p>';
      }

      // Render recent users
      const recentUsersEl = document.getElementById('recent-users');
      if (stats.recentUsers && stats.recentUsers.length > 0) {
        recentUsersEl.innerHTML = stats.recentUsers.map(user => `
          <a href="/admin/users/${user.id}" class="activity-item">
            <div class="activity-info">
              <span class="activity-title">${user.username}</span>
              <span class="activity-meta text-secondary">${user.role} • ${formatTimeAgo(user.created_at)}</span>
            </div>
          </a>
        `).join('');
      } else {
        recentUsersEl.innerHTML = '<p class="text-secondary">No users yet</p>';
      }
    } catch (err) {
      toast.error('Failed to load stats');
    }
  }

  document.getElementById('refresh-status')?.addEventListener('click', loadStats);

  await loadStats();
}
