import { renderNav } from '../../components/nav.js';
import { renderAdminSidebar } from '../../components/sidebar.js';
import { icon } from '../../components/icon.js';
import { api } from '../../utils/api.js';
import { toast } from '../../components/toast.js';
import { navigate } from '../../router.js';
import { formatBytes, formatDate } from '../../utils/format.js';
import { confirmModal } from '../../components/modal.js';

export default function(params) {
  const nodeId = params.id;
  
  return `
    ${renderNav()}
    <div class="admin-layout">
      ${renderAdminSidebar('nodes')}
      <main class="admin-content">
        <div class="page-header-back">
          <a href="/admin/nodes" class="btn btn-ghost btn-sm">
            ${icon('arrow-left', 16)} Back to Nodes
          </a>
        </div>

        <div class="node-header" id="node-header">
          <div class="node-title">
            <h1 id="node-name">Loading...</h1>
            <span class="badge" id="node-status">—</span>
          </div>
          <div class="node-actions">
            <button class="btn btn-ghost" id="btn-refresh" title="Refresh">
              ${icon('refresh', 18)}
            </button>
            <button class="btn btn-warning" id="btn-maintenance">
              ${icon('tool', 18)} Maintenance Mode
            </button>
            <button class="btn btn-danger" id="btn-delete">
              ${icon('trash', 18)} Delete
            </button>
          </div>
        </div>

        <div class="tabs-container">
          <div class="tabs" id="node-tabs">
            <button class="tab active" data-tab="about">About</button>
            <button class="tab" data-tab="settings">Settings</button>
            <button class="tab" data-tab="configuration">Configuration</button>
            <button class="tab" data-tab="allocations">Allocations</button>
            <button class="tab" data-tab="servers">Servers</button>
          </div>
        </div>

        <div class="tab-panels">
          <!-- About Tab -->
          <div class="tab-panel active" data-tab="about">
            <div class="panel-grid">
              <section class="panel-section card">
                <h3>System Information</h3>
                <div class="info-grid" id="system-info">
                  <div class="info-item">
                    <span class="info-label">Connection Status</span>
                    <span class="info-value" id="info-connection">—</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Last Seen</span>
                    <span class="info-value" id="info-last-seen">—</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">CPU Usage</span>
                    <span class="info-value" id="info-cpu">—</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Memory Usage</span>
                    <span class="info-value" id="info-memory">—</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Disk Usage</span>
                    <span class="info-value" id="info-disk">—</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Daemon Version</span>
                    <span class="info-value" id="info-version">—</span>
                  </div>
                </div>
              </section>

              <section class="panel-section card">
                <h3>Resource Allocation</h3>
                <div class="resource-bars" id="resource-bars">
                  <div class="resource-item">
                    <div class="resource-header">
                      <span>Memory</span>
                      <span id="mem-usage">0 / 0 MB</span>
                    </div>
                    <div class="progress-bar">
                      <div class="progress-fill" id="mem-bar" style="width: 0%"></div>
                    </div>
                  </div>
                  <div class="resource-item">
                    <div class="resource-header">
                      <span>Disk</span>
                      <span id="disk-usage">0 / 0 MB</span>
                    </div>
                    <div class="progress-bar">
                      <div class="progress-fill" id="disk-bar" style="width: 0%"></div>
                    </div>
                  </div>
                  <div class="resource-item">
                    <div class="resource-header">
                      <span>Allocations</span>
                      <span id="alloc-usage">0 / 0</span>
                    </div>
                    <div class="progress-bar">
                      <div class="progress-fill" id="alloc-bar" style="width: 0%"></div>
                    </div>
                  </div>
                </div>
              </section>

              <section class="panel-section card full-width">
                <h3>Node Details</h3>
                <div class="details-grid" id="node-details">
                  <div class="detail-item">
                    <span class="detail-label">FQDN</span>
                    <code class="detail-value" id="detail-fqdn">—</code>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Daemon Port</span>
                    <code class="detail-value" id="detail-port">—</code>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">SSL Enabled</span>
                    <span class="detail-value" id="detail-ssl">—</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Total Servers</span>
                    <span class="detail-value" id="detail-servers">—</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Created</span>
                    <span class="detail-value" id="detail-created">—</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">UUID</span>
                    <code class="detail-value" id="detail-uuid">—</code>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <!-- Settings Tab -->
          <div class="tab-panel" data-tab="settings">
            <form id="settings-form" class="settings-form card">
              <h3>General Settings</h3>
              <div class="form-row">
                <div class="form-group">
                  <label for="set-name">Name</label>
                  <input type="text" id="set-name" class="input" required>
                </div>
                <div class="form-group">
                  <label for="set-fqdn">FQDN / IP Address</label>
                  <input type="text" id="set-fqdn" class="input" required>
                </div>
              </div>
              <div class="form-group">
                <label for="set-description">Description</label>
                <textarea id="set-description" class="input" rows="2"></textarea>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="set-scheme">Scheme</label>
                  <select id="set-scheme" class="input">
                    <option value="http">HTTP</option>
                    <option value="https">HTTPS</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="set-daemon-port">Daemon Port</label>
                  <input type="number" id="set-daemon-port" class="input" value="8080">
                </div>
              </div>

              <h3>Resource Limits</h3>
              <div class="form-row">
                <div class="form-group">
                  <label for="set-memory">Total Memory (MB)</label>
                  <input type="number" id="set-memory" class="input" min="256">
                </div>
                <div class="form-group">
                  <label for="set-disk">Total Disk (MB)</label>
                  <input type="number" id="set-disk" class="input" min="256">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="set-memory-overalloc">Memory Over-allocation (%)</label>
                  <input type="number" id="set-memory-overalloc" class="input" value="0" min="-1" max="100">
                  <small class="text-secondary">-1 to disable limit, 0 for no over-allocation</small>
                </div>
                <div class="form-group">
                  <label for="set-disk-overalloc">Disk Over-allocation (%)</label>
                  <input type="number" id="set-disk-overalloc" class="input" value="0" min="-1" max="100">
                  <small class="text-secondary">-1 to disable limit, 0 for no over-allocation</small>
                </div>
              </div>

              <div class="form-actions">
                <button type="submit" class="btn btn-primary">
                  ${icon('save', 18)} Save Changes
                </button>
              </div>
            </form>
          </div>

          <!-- Configuration Tab -->
          <div class="tab-panel" data-tab="configuration">
            <section class="panel-section card">
              <h3>Configuration File</h3>
              <p class="text-secondary">Copy this configuration to your daemon's <code>config.json</code> file.</p>
              <div class="config-block">
                <div class="config-header">
                  <span>config.json</span>
                  <button class="btn btn-ghost btn-sm" id="copy-config">
                    ${icon('copy', 14)} Copy
                  </button>
                </div>
                <pre id="config-content" class="config-code">Loading...</pre>
              </div>
            </section>

            <section class="panel-section card">
              <h3>Auto-Deploy Command</h3>
              <p class="text-secondary">Run this command on the node server to automatically configure the daemon.</p>
              <div class="config-block">
                <div class="config-header">
                  <span>Deploy Script</span>
                  <button class="btn btn-ghost btn-sm" id="copy-deploy">
                    ${icon('copy', 14)} Copy
                  </button>
                </div>
                <pre id="deploy-content" class="config-code">Loading...</pre>
              </div>
            </section>

            <section class="panel-section card">
              <h3>Daemon Token</h3>
              <p class="text-secondary">This token is used to authenticate the daemon with the panel. Keep it secret!</p>
              <div class="token-display">
                <code id="daemon-token" class="token-hidden">••••••••••••••••••••••••••••••••</code>
                <button class="btn btn-ghost btn-sm" id="toggle-token">
                  ${icon('eye', 14)} Show
                </button>
                <button class="btn btn-ghost btn-sm" id="copy-token">
                  ${icon('copy', 14)} Copy
                </button>
                <button class="btn btn-warning btn-sm" id="regenerate-token">
                  ${icon('refresh', 14)} Regenerate
                </button>
              </div>
            </section>
          </div>

          <!-- Allocations Tab -->
          <div class="tab-panel" data-tab="allocations">
            <section class="panel-section card">
              <div class="section-header">
                <h3>Allocations</h3>
                <button class="btn btn-primary btn-sm" id="btn-add-alloc">
                  ${icon('plus', 14)} Add Allocations
                </button>
              </div>
              <div class="table-container">
                <table class="table">
                  <thead>
                    <tr>
                      <th>IP Address</th>
                      <th>Port</th>
                      <th>Assigned To</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody id="allocations-tbody">
                    <tr><td colspan="4" class="text-center">Loading...</td></tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <!-- Servers Tab -->
          <div class="tab-panel" data-tab="servers">
            <section class="panel-section card">
              <div class="section-header">
                <h3>Servers on this Node</h3>
              </div>
              <div class="table-container">
                <table class="table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Name</th>
                      <th>Owner</th>
                      <th>Memory</th>
                      <th>Disk</th>
                      <th>Address</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody id="servers-tbody">
                    <tr><td colspan="7" class="text-center">Loading...</td></tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>

    <style>
      .page-header-back { margin-bottom: 1rem; }
      .node-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
      .node-title { display: flex; align-items: center; gap: 1rem; }
      .node-title h1 { margin: 0; }
      .node-actions { display: flex; gap: 0.5rem; }
      
      .tabs-container { border-bottom: 1px solid var(--border); margin-bottom: 1.5rem; }
      .tabs { display: flex; gap: 0; }
      .tab { padding: 0.75rem 1.25rem; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-secondary); cursor: pointer; font-weight: 500; transition: all 0.2s; }
      .tab:hover { color: var(--text-primary); }
      .tab.active { color: var(--accent); border-bottom-color: var(--accent); }
      
      .tab-panels { min-height: 400px; }
      .tab-panel { display: none; }
      .tab-panel.active { display: block; }
      
      .panel-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; }
      .panel-grid .full-width { grid-column: 1 / -1; }
      @media (max-width: 768px) { .panel-grid { grid-template-columns: 1fr; } }
      
      .panel-section { padding: 1.5rem; }
      .panel-section h3 { margin: 0 0 1rem 0; font-size: 1rem; }
      
      .info-grid, .details-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
      .info-item, .detail-item { display: flex; flex-direction: column; gap: 0.25rem; }
      .info-label, .detail-label { font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; }
      .info-value, .detail-value { font-size: 0.9rem; }
      
      .resource-bars { display: flex; flex-direction: column; gap: 1rem; }
      .resource-item { }
      .resource-header { display: flex; justify-content: space-between; font-size: 0.875rem; margin-bottom: 0.5rem; }
      .progress-bar { height: 8px; background: var(--bg-tertiary); border-radius: 4px; overflow: hidden; }
      .progress-fill { height: 100%; background: var(--accent); transition: width 0.3s; }
      .progress-fill.warning { background: var(--warning); }
      .progress-fill.danger { background: var(--danger); }
      
      .settings-form { padding: 1.5rem; }
      .settings-form h3 { margin: 1.5rem 0 1rem 0; font-size: 1rem; }
      .settings-form h3:first-child { margin-top: 0; }
      
      .config-block { background: var(--bg-tertiary); border-radius: 8px; overflow: hidden; margin-top: 1rem; }
      .config-header { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 1rem; background: var(--bg-secondary); border-bottom: 1px solid var(--border); }
      .config-code { margin: 0; padding: 1rem; font-size: 0.8rem; overflow-x: auto; white-space: pre-wrap; word-break: break-all; }
      
      .token-display { display: flex; align-items: center; gap: 0.5rem; margin-top: 1rem; padding: 1rem; background: var(--bg-tertiary); border-radius: 8px; }
      .token-display code { flex: 1; font-size: 0.875rem; overflow: hidden; text-overflow: ellipsis; }
      .token-hidden { filter: blur(4px); user-select: none; }
      
      .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
      .section-header h3 { margin: 0; }
    </style>
  `;
}

export async function mount(params) {
  const nodeId = params.id;
  let node = null;
  let config = null;
  let allocations = [];
  let servers = [];
  let tokenVisible = false;

  // Tab switching
  document.querySelectorAll('#node-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#node-tabs .tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.querySelector(`.tab-panel[data-tab="${tab.dataset.tab}"]`)?.classList.add('active');
      
      if (tab.dataset.tab === 'allocations') loadAllocations();
      if (tab.dataset.tab === 'servers') loadServers();
      if (tab.dataset.tab === 'configuration') loadConfig();
    });
  });

  async function loadNode() {
    try {
      const [nodeRes, statusRes] = await Promise.all([
        api.get(`/nodes/${nodeId}`),
        api.get(`/nodes/${nodeId}/status`).catch(() => ({ data: {} }))
      ]);
      node = nodeRes.data;
      const status = statusRes.data;

      document.getElementById('node-name').textContent = node.name;
      
      const statusBadge = document.getElementById('node-status');
      if (node.maintenance_mode) {
        statusBadge.textContent = 'Maintenance';
        statusBadge.className = 'badge badge-warning';
      } else if (status.connected) {
        statusBadge.textContent = 'Connected';
        statusBadge.className = 'badge badge-success';
      } else {
        statusBadge.textContent = 'Disconnected';
        statusBadge.className = 'badge badge-danger';
      }

      // System info
      document.getElementById('info-connection').innerHTML = status.connected 
        ? '<span class="text-success">● Connected</span>' 
        : '<span class="text-danger">● Disconnected</span>';
      document.getElementById('info-last-seen').textContent = node.last_seen_at ? formatDate(node.last_seen_at) : 'Never';
      
      if (status.stats) {
        document.getElementById('info-cpu').textContent = `${status.stats.cpu?.toFixed(1) || 0}%`;
        document.getElementById('info-memory').textContent = formatBytes(status.stats.memory || 0);
        document.getElementById('info-disk').textContent = formatBytes(status.stats.disk || 0);
        document.getElementById('info-version').textContent = status.stats.version || 'Unknown';
      }

      // Resource bars
      const memUsed = node.memory_used || 0;
      const diskUsed = node.disk_used || 0;
      const memPct = node.memory > 0 ? (memUsed / node.memory * 100) : 0;
      const diskPct = node.disk > 0 ? (diskUsed / node.disk * 100) : 0;
      const allocPct = node.allocation_count > 0 ? ((node.allocated_count || 0) / node.allocation_count * 100) : 0;

      document.getElementById('mem-usage').textContent = `${memUsed} / ${node.memory} MB`;
      document.getElementById('mem-bar').style.width = `${Math.min(memPct, 100)}%`;
      document.getElementById('mem-bar').className = `progress-fill ${memPct > 90 ? 'danger' : memPct > 70 ? 'warning' : ''}`;

      document.getElementById('disk-usage').textContent = `${diskUsed} / ${node.disk} MB`;
      document.getElementById('disk-bar').style.width = `${Math.min(diskPct, 100)}%`;
      document.getElementById('disk-bar').className = `progress-fill ${diskPct > 90 ? 'danger' : diskPct > 70 ? 'warning' : ''}`;

      document.getElementById('alloc-usage').textContent = `${node.allocated_count || 0} / ${node.allocation_count || 0}`;
      document.getElementById('alloc-bar').style.width = `${Math.min(allocPct, 100)}%`;

      // Node details
      document.getElementById('detail-fqdn').textContent = node.fqdn;
      document.getElementById('detail-port').textContent = node.daemon_port;
      document.getElementById('detail-ssl').textContent = node.scheme === 'https' ? 'Yes' : 'No';
      document.getElementById('detail-servers').textContent = node.server_count || 0;
      document.getElementById('detail-created').textContent = formatDate(node.created_at);
      document.getElementById('detail-uuid').textContent = node.uuid;

      // Settings form
      document.getElementById('set-name').value = node.name;
      document.getElementById('set-fqdn').value = node.fqdn;
      document.getElementById('set-description').value = node.description || '';
      document.getElementById('set-scheme').value = node.scheme;
      document.getElementById('set-daemon-port').value = node.daemon_port;
      document.getElementById('set-memory').value = node.memory;
      document.getElementById('set-disk').value = node.disk;
      document.getElementById('set-memory-overalloc').value = node.memory_overallocate || 0;
      document.getElementById('set-disk-overalloc').value = node.disk_overallocate || 0;

      // Maintenance button
      document.getElementById('btn-maintenance').textContent = node.maintenance_mode ? 'Disable Maintenance' : 'Maintenance Mode';

    } catch (err) {
      toast.error('Failed to load node');
      navigate('/admin/nodes');
    }
  }

  async function loadConfig() {
    try {
      const res = await api.get(`/nodes/${nodeId}/config`);
      config = res.data;
      
      document.getElementById('config-content').textContent = JSON.stringify(config, null, 2);
      document.getElementById('daemon-token').textContent = tokenVisible ? config.token : '••••••••••••••••••••••••••••••••';
      document.getElementById('daemon-token').className = tokenVisible ? '' : 'token-hidden';
      
      const deployCmd = `curl -sSL "${config.panel_url}/api/nodes/${nodeId}/deploy" | bash`;
      document.getElementById('deploy-content').textContent = deployCmd;
    } catch (err) {
      document.getElementById('config-content').textContent = 'Failed to load configuration';
    }
  }

  async function loadAllocations() {
    try {
      const res = await api.get(`/nodes/${nodeId}/allocations`);
      allocations = res.data || [];
      renderAllocations();
    } catch (err) {
      document.getElementById('allocations-tbody').innerHTML = '<tr><td colspan="4" class="text-center text-danger">Failed to load</td></tr>';
    }
  }

  function renderAllocations() {
    const tbody = document.getElementById('allocations-tbody');
    if (allocations.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center text-secondary">No allocations</td></tr>';
      return;
    }
    tbody.innerHTML = allocations.map(a => `
      <tr>
        <td><code>${a.ip}</code></td>
        <td><code>${a.port}</code></td>
        <td>${a.server_id ? `<a href="/server/${a.server_uuid}/console">${a.server_name}</a>` : '<span class="text-secondary">Available</span>'}</td>
        <td>
          ${!a.server_id ? `<button class="btn btn-ghost btn-sm btn-danger delete-alloc" data-id="${a.id}">${icon('trash', 14)}</button>` : ''}
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.delete-alloc').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this allocation?')) return;
        try {
          await api.delete(`/allocations/${btn.dataset.id}`);
          toast.success('Allocation deleted');
          loadAllocations();
        } catch (err) {
          toast.error(err.message);
        }
      });
    });
  }

  async function loadServers() {
    try {
      const res = await api.get(`/admin/servers?node_id=${nodeId}`);
      servers = res.data || [];
      renderServers();
    } catch (err) {
      document.getElementById('servers-tbody').innerHTML = '<tr><td colspan="7" class="text-center text-danger">Failed to load</td></tr>';
    }
  }

  function renderServers() {
    const tbody = document.getElementById('servers-tbody');
    if (servers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-secondary">No servers on this node</td></tr>';
      return;
    }
    tbody.innerHTML = servers.map(s => `
      <tr>
        <td><span class="badge badge-${s.status === 'online' ? 'success' : 'secondary'}">${s.status}</span></td>
        <td><a href="/server/${s.uuid}/console">${s.name}</a></td>
        <td>${s.owner_name || 'Unknown'}</td>
        <td>${s.memory} MB</td>
        <td>${formatBytes(s.disk * 1024 * 1024)}</td>
        <td><code>${s.ip || '0.0.0.0'}:${s.port || '—'}</code></td>
        <td>
          <a href="/server/${s.uuid}/console" class="btn btn-ghost btn-sm">${icon('terminal', 14)}</a>
          <a href="/server/${s.uuid}/settings" class="btn btn-ghost btn-sm">${icon('settings', 14)}</a>
        </td>
      </tr>
    `).join('');
  }

  // Event listeners
  document.getElementById('btn-refresh').addEventListener('click', loadNode);

  document.getElementById('btn-maintenance').addEventListener('click', async () => {
    try {
      await api.put(`/nodes/${nodeId}`, { maintenance_mode: !node.maintenance_mode });
      toast.success(node.maintenance_mode ? 'Maintenance mode disabled' : 'Maintenance mode enabled');
      loadNode();
    } catch (err) {
      toast.error(err.message);
    }
  });

  document.getElementById('btn-delete').addEventListener('click', async () => {
    if (node.server_count > 0) {
      toast.error('Cannot delete node with active servers');
      return;
    }
    const confirmed = await confirmModal('Delete Node', `Are you sure you want to delete "${node.name}"? This cannot be undone.`);
    if (!confirmed) return;
    try {
      await api.delete(`/nodes/${nodeId}`);
      toast.success('Node deleted');
      navigate('/admin/nodes');
    } catch (err) {
      toast.error(err.message);
    }
  });

  document.getElementById('settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api.put(`/nodes/${nodeId}`, {
        name: document.getElementById('set-name').value,
        fqdn: document.getElementById('set-fqdn').value,
        description: document.getElementById('set-description').value,
        scheme: document.getElementById('set-scheme').value,
        daemon_port: parseInt(document.getElementById('set-daemon-port').value),
        memory: parseInt(document.getElementById('set-memory').value),
        disk: parseInt(document.getElementById('set-disk').value),
        memory_overallocate: parseInt(document.getElementById('set-memory-overalloc').value),
        disk_overallocate: parseInt(document.getElementById('set-disk-overalloc').value)
      });
      toast.success('Settings saved');
      loadNode();
    } catch (err) {
      toast.error(err.message);
    }
  });

  document.getElementById('copy-config')?.addEventListener('click', () => {
    navigator.clipboard.writeText(document.getElementById('config-content').textContent);
    toast.success('Configuration copied');
  });

  document.getElementById('copy-deploy')?.addEventListener('click', () => {
    navigator.clipboard.writeText(document.getElementById('deploy-content').textContent);
    toast.success('Deploy command copied');
  });

  document.getElementById('toggle-token')?.addEventListener('click', () => {
    tokenVisible = !tokenVisible;
    document.getElementById('daemon-token').textContent = tokenVisible ? config?.token : '••••••••••••••••••••••••••••••••';
    document.getElementById('daemon-token').className = tokenVisible ? '' : 'token-hidden';
    document.getElementById('toggle-token').innerHTML = `${icon(tokenVisible ? 'eye-off' : 'eye', 14)} ${tokenVisible ? 'Hide' : 'Show'}`;
  });

  document.getElementById('copy-token')?.addEventListener('click', () => {
    if (config?.token) {
      navigator.clipboard.writeText(config.token);
      toast.success('Token copied');
    }
  });

  document.getElementById('regenerate-token')?.addEventListener('click', async () => {
    const confirmed = await confirmModal('Regenerate Token', 'This will invalidate the current daemon token. The daemon will need to be reconfigured.');
    if (!confirmed) return;
    try {
      await api.post(`/nodes/${nodeId}/regenerate-token`);
      toast.success('Token regenerated');
      loadConfig();
    } catch (err) {
      toast.error(err.message);
    }
  });

  document.getElementById('btn-add-alloc')?.addEventListener('click', () => {
    navigate(`/admin/allocations?node=${nodeId}`);
  });

  await loadNode();
  loadConfig();
}
