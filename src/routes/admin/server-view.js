import { renderNav } from '../../components/nav.js';
import { renderAdminSidebar } from '../../components/sidebar.js';
import { icon } from '../../components/icon.js';
import { api } from '../../utils/api.js';
import { toast } from '../../components/toast.js';
import { navigate } from '../../router.js';
import { formatBytes, formatDate } from '../../utils/format.js';
import { openModal, closeModal, confirmModal } from '../../components/modal.js';

export default function(params) {
  const serverId = params.id;
  
  return `
    ${renderNav()}
    <div class="admin-layout">
      ${renderAdminSidebar('servers')}
      <main class="admin-content">
        <div class="page-header-back">
          <a href="/admin/servers" class="btn btn-ghost btn-sm">
            ${icon('arrow-left', 16)} Back to Servers
          </a>
        </div>

        <div class="server-header" id="server-header">
          <div class="server-title">
            <h1 id="server-name">Loading...</h1>
            <span class="badge" id="server-status">—</span>
          </div>
          <div class="server-actions">
            <a class="btn btn-ghost" id="btn-console" href="#">
              ${icon('terminal', 18)} Console
            </a>
            <button class="btn btn-ghost" id="btn-suspend">
              ${icon('pause', 18)} Suspend
            </button>
            <button class="btn btn-danger" id="btn-delete">
              ${icon('trash', 18)} Delete
            </button>
          </div>
        </div>

        <div class="tabs-container">
          <div class="tabs" id="server-tabs">
            <button class="tab active" data-tab="details">Details</button>
            <button class="tab" data-tab="build">Build Configuration</button>
            <button class="tab" data-tab="startup">Startup</button>
            <button class="tab" data-tab="databases">Databases</button>
            <button class="tab" data-tab="mounts">Mounts</button>
          </div>
        </div>

        <div class="tab-panels">
          <!-- Details Tab -->
          <div class="tab-panel active" data-tab="details">
            <div class="panel-grid">
              <section class="panel-section card">
                <h3>Server Information</h3>
                <form id="details-form">
                  <div class="form-group">
                    <label for="set-name">Server Name</label>
                    <input type="text" id="set-name" class="input" required>
                  </div>
                  <div class="form-group">
                    <label for="set-owner">Owner</label>
                    <select id="set-owner" class="input"></select>
                  </div>
                  <div class="form-group">
                    <label for="set-description">Description</label>
                    <textarea id="set-description" class="input" rows="3"></textarea>
                  </div>
                  <div class="form-group">
                    <label for="set-external-id">External ID</label>
                    <input type="text" id="set-external-id" class="input" placeholder="Optional external identifier">
                  </div>
                  <button type="submit" class="btn btn-primary">${icon('save', 18)} Save</button>
                </form>
              </section>

              <section class="panel-section card">
                <h3>Server Details</h3>
                <div class="details-grid">
                  <div class="detail-item">
                    <span class="detail-label">UUID</span>
                    <code class="detail-value" id="detail-uuid">—</code>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Internal ID</span>
                    <span class="detail-value" id="detail-id">—</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Node</span>
                    <span class="detail-value" id="detail-node">—</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Primary Allocation</span>
                    <code class="detail-value" id="detail-allocation">—</code>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Egg</span>
                    <span class="detail-value" id="detail-egg">—</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Created</span>
                    <span class="detail-value" id="detail-created">—</span>
                  </div>
                </div>
              </section>

              <section class="panel-section card full-width">
                <h3>Resource Limits</h3>
                <div class="resource-summary">
                  <div class="resource-item">
                    <span class="resource-icon">${icon('cpu', 24)}</span>
                    <div class="resource-info">
                      <span class="resource-value" id="res-cpu">0%</span>
                      <span class="resource-label">CPU Limit</span>
                    </div>
                  </div>
                  <div class="resource-item">
                    <span class="resource-icon">${icon('hard-drive', 24)}</span>
                    <div class="resource-info">
                      <span class="resource-value" id="res-memory">0 MB</span>
                      <span class="resource-label">Memory</span>
                    </div>
                  </div>
                  <div class="resource-item">
                    <span class="resource-icon">${icon('database', 24)}</span>
                    <div class="resource-info">
                      <span class="resource-value" id="res-disk">0 MB</span>
                      <span class="resource-label">Disk</span>
                    </div>
                  </div>
                  <div class="resource-item">
                    <span class="resource-icon">${icon('archive', 24)}</span>
                    <div class="resource-info">
                      <span class="resource-value" id="res-backups">0</span>
                      <span class="resource-label">Backups</span>
                    </div>
                  </div>
                  <div class="resource-item">
                    <span class="resource-icon">${icon('layers', 24)}</span>
                    <div class="resource-info">
                      <span class="resource-value" id="res-databases">0</span>
                      <span class="resource-label">Databases</span>
                    </div>
                  </div>
                  <div class="resource-item">
                    <span class="resource-icon">${icon('globe', 24)}</span>
                    <div class="resource-info">
                      <span class="resource-value" id="res-allocations">0</span>
                      <span class="resource-label">Allocations</span>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <!-- Build Configuration Tab -->
          <div class="tab-panel" data-tab="build">
            <form id="build-form" class="panel-section card">
              <h3>Resource Management</h3>
              <div class="form-row">
                <div class="form-group">
                  <label for="build-cpu">CPU Limit (%)</label>
                  <input type="number" id="build-cpu" class="input" min="0" max="400">
                  <small class="text-secondary">0 = unlimited</small>
                </div>
                <div class="form-group">
                  <label for="build-memory">Memory (MB)</label>
                  <input type="number" id="build-memory" class="input" min="128">
                </div>
                <div class="form-group">
                  <label for="build-disk">Disk Space (MB)</label>
                  <input type="number" id="build-disk" class="input" min="256">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="build-swap">Swap (MB)</label>
                  <input type="number" id="build-swap" class="input" value="0">
                  <small class="text-secondary">-1 = unlimited, 0 = disabled</small>
                </div>
                <div class="form-group">
                  <label for="build-io">Block IO Weight</label>
                  <input type="number" id="build-io" class="input" min="10" max="1000" value="500">
                </div>
              </div>

              <h3>Feature Limits</h3>
              <div class="form-row">
                <div class="form-group">
                  <label for="build-databases">Databases</label>
                  <input type="number" id="build-databases" class="input" min="0">
                  <small class="text-secondary">0 = unlimited</small>
                </div>
                <div class="form-group">
                  <label for="build-backups">Backups</label>
                  <input type="number" id="build-backups" class="input" min="0">
                </div>
                <div class="form-group">
                  <label for="build-allocations">Allocations</label>
                  <input type="number" id="build-allocations" class="input" min="1">
                </div>
              </div>

              <h3>Allocation Management</h3>
              <div class="form-group">
                <label for="build-primary-alloc">Primary Allocation</label>
                <select id="build-primary-alloc" class="input"></select>
              </div>
              <div class="form-group">
                <label>Additional Allocations</label>
                <div id="additional-allocs" class="alloc-list"></div>
                <button type="button" class="btn btn-ghost btn-sm" id="btn-add-alloc">
                  ${icon('plus', 14)} Add Allocation
                </button>
              </div>

              <div class="form-actions">
                <button type="submit" class="btn btn-primary">${icon('save', 18)} Update Build Configuration</button>
              </div>
            </form>
          </div>

          <!-- Startup Tab -->
          <div class="tab-panel" data-tab="startup">
            <form id="startup-form" class="panel-section card">
              <h3>Startup Command</h3>
              <div class="form-group">
                <label for="startup-command">Startup Command</label>
                <input type="text" id="startup-command" class="input font-mono">
                <small class="text-secondary">Use {{VARIABLE}} for egg variables</small>
              </div>

              <h3>Docker Configuration</h3>
              <div class="form-row">
                <div class="form-group">
                  <label for="startup-image">Docker Image</label>
                  <select id="startup-image" class="input"></select>
                </div>
              </div>

              <h3>Server Variables</h3>
              <div id="variables-container">
                <p class="text-secondary">Loading...</p>
              </div>

              <div class="form-actions">
                <button type="submit" class="btn btn-primary">${icon('save', 18)} Save Startup Configuration</button>
              </div>
            </form>

            <section class="panel-section card">
              <h3>Reinstall Server</h3>
              <p class="text-secondary">This will reinstall the server with the current egg and startup configuration.</p>
              <button class="btn btn-warning" id="btn-reinstall">
                ${icon('refresh', 18)} Reinstall Server
              </button>
            </section>
          </div>

          <!-- Databases Tab -->
          <div class="tab-panel" data-tab="databases">
            <section class="panel-section card">
              <div class="section-header">
                <h3>Databases</h3>
                <button class="btn btn-primary btn-sm" id="btn-new-db">
                  ${icon('plus', 14)} New Database
                </button>
              </div>
              <div class="table-container">
                <table class="table">
                  <thead>
                    <tr>
                      <th>Database</th>
                      <th>Username</th>
                      <th>Host</th>
                      <th>Max Connections</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody id="databases-tbody">
                    <tr><td colspan="5" class="text-center">Loading...</td></tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <!-- Mounts Tab -->
          <div class="tab-panel" data-tab="mounts">
            <section class="panel-section card">
              <div class="section-header">
                <h3>Mounts</h3>
              </div>
              <p class="text-secondary">Mount configuration allows attaching directories from the host system to the server container.</p>
              <div id="mounts-container">
                <div class="empty-state">
                  <p class="text-secondary">No mounts configured</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>

    <style>
      .page-header-back { margin-bottom: 1rem; }
      .server-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem; }
      .server-title { display: flex; align-items: center; gap: 1rem; }
      .server-title h1 { margin: 0; }
      .server-actions { display: flex; gap: 0.5rem; }
      
      .tabs-container { border-bottom: 1px solid var(--border); margin-bottom: 1.5rem; }
      .tabs { display: flex; gap: 0; overflow-x: auto; }
      .tab { padding: 0.75rem 1.25rem; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-secondary); cursor: pointer; font-weight: 500; transition: all 0.2s; white-space: nowrap; }
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
      
      .details-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
      .detail-item { display: flex; flex-direction: column; gap: 0.25rem; }
      .detail-label { font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; }
      .detail-value { font-size: 0.9rem; }
      
      .resource-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1.5rem; }
      .resource-item { display: flex; align-items: center; gap: 1rem; }
      .resource-icon { color: var(--text-secondary); }
      .resource-info { display: flex; flex-direction: column; }
      .resource-value { font-size: 1.25rem; font-weight: 600; }
      .resource-label { font-size: 0.75rem; color: var(--text-secondary); }
      
      .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
      .section-header h3 { margin: 0; }
      
      .alloc-list { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem; }
      .alloc-tag { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0.5rem; background: var(--bg-tertiary); border-radius: 4px; font-size: 0.875rem; }
      .alloc-tag button { background: none; border: none; cursor: pointer; color: var(--text-secondary); padding: 0; }
    </style>
  `;
}

export async function mount(params) {
  const serverId = params.id;
  let server = null;
  let users = [];
  let egg = null;
  let allocations = [];
  let databases = [];
  let dbHosts = [];

  // Tab switching
  document.querySelectorAll('#server-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#server-tabs .tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.querySelector(`.tab-panel[data-tab="${tab.dataset.tab}"]`)?.classList.add('active');
      
      if (tab.dataset.tab === 'databases') loadDatabases();
      if (tab.dataset.tab === 'startup') loadStartup();
      if (tab.dataset.tab === 'build') loadBuildConfig();
    });
  });

  async function loadServer() {
    try {
      const [serverRes, usersRes] = await Promise.all([
        api.get(`/admin/servers/${serverId}`),
        api.get('/admin/users')
      ]);
      server = serverRes.data;
      users = usersRes.data || [];

      document.getElementById('server-name').textContent = server.name;
      document.getElementById('btn-console').href = `/server/${server.uuid}/console`;
      
      const statusEl = document.getElementById('server-status');
      statusEl.textContent = server.status;
      statusEl.className = `badge badge-${server.status === 'online' ? 'success' : server.status === 'suspended' ? 'warning' : 'secondary'}`;

      document.getElementById('btn-suspend').innerHTML = server.suspended
        ? `${icon('play', 18)} Unsuspend`
        : `${icon('pause', 18)} Suspend`;

      // Details form
      document.getElementById('set-name').value = server.name;
      document.getElementById('set-description').value = server.description || '';
      document.getElementById('set-external-id').value = server.external_id || '';
      document.getElementById('set-owner').innerHTML = users.map(u => 
        `<option value="${u.id}" ${u.id === server.owner_id ? 'selected' : ''}>${u.username} (${u.email})</option>`
      ).join('');

      // Details display
      document.getElementById('detail-uuid').textContent = server.uuid;
      document.getElementById('detail-id').textContent = server.id;
      document.getElementById('detail-node').textContent = server.node_name || 'Unknown';
      document.getElementById('detail-allocation').textContent = `${server.ip || '0.0.0.0'}:${server.port || '—'}`;
      document.getElementById('detail-egg').textContent = server.egg_name || 'Unknown';
      document.getElementById('detail-created').textContent = formatDate(server.created_at);

      // Resources
      document.getElementById('res-cpu').textContent = server.cpu ? `${server.cpu}%` : 'Unlimited';
      document.getElementById('res-memory').textContent = `${server.memory} MB`;
      document.getElementById('res-disk').textContent = formatBytes(server.disk * 1024 * 1024);
      document.getElementById('res-backups').textContent = server.limit_backups || 0;
      document.getElementById('res-databases').textContent = server.limit_databases || 0;
      document.getElementById('res-allocations').textContent = server.limit_allocations || 1;

    } catch (err) {
      toast.error('Failed to load server');
      navigate('/admin/servers');
    }
  }

  async function loadBuildConfig() {
    if (!server) return;

    document.getElementById('build-cpu').value = server.cpu || 0;
    document.getElementById('build-memory').value = server.memory;
    document.getElementById('build-disk').value = server.disk;
    document.getElementById('build-swap').value = server.swap || 0;
    document.getElementById('build-io').value = server.io || 500;
    document.getElementById('build-databases').value = server.limit_databases || 0;
    document.getElementById('build-backups').value = server.limit_backups || 0;
    document.getElementById('build-allocations').value = server.limit_allocations || 1;

    try {
      const res = await api.get(`/nodes/${server.node_id}/allocations`);
      allocations = res.data || [];
      
      const primarySelect = document.getElementById('build-primary-alloc');
      primarySelect.innerHTML = allocations
        .filter(a => !a.server_id || a.server_id === server.id)
        .map(a => `<option value="${a.id}" ${a.id === server.allocation_id ? 'selected' : ''}>${a.ip}:${a.port}</option>`)
        .join('');
    } catch (err) {
      console.error('Failed to load allocations', err);
    }
  }

  async function loadStartup() {
    if (!server) return;

    document.getElementById('startup-command').value = server.startup_command || '';

    try {
      const eggRes = await api.get(`/eggs/${server.egg_id}`);
      egg = eggRes.data;

      const imageSelect = document.getElementById('startup-image');
      const images = egg.docker_images || [];
      imageSelect.innerHTML = images.map(img => 
        `<option value="${img}" ${img === server.docker_image ? 'selected' : ''}>${img}</option>`
      ).join('');

      const variables = egg.variables || [];
      const serverVars = server.variables || {};
      const container = document.getElementById('variables-container');
      
      if (variables.length === 0) {
        container.innerHTML = '<p class="text-secondary">No variables defined for this egg</p>';
        return;
      }

      container.innerHTML = variables.map(v => `
        <div class="form-group">
          <label for="var-${v.env_variable}">${v.name}</label>
          <input type="text" id="var-${v.env_variable}" class="input variable-input"
                 data-env="${v.env_variable}"
                 value="${serverVars[v.env_variable] || v.default_value || ''}"
                 placeholder="${v.default_value || ''}">
          ${v.description ? `<small class="text-secondary">${v.description}</small>` : ''}
        </div>
      `).join('');
    } catch (err) {
      console.error('Failed to load startup config', err);
    }
  }

  async function loadDatabases() {
    try {
      const [dbRes, hostsRes] = await Promise.all([
        api.get(`/servers/${server.uuid}/databases`),
        api.get('/database-hosts').catch(() => ({ data: [] }))
      ]);
      databases = dbRes.data || [];
      dbHosts = hostsRes.data || [];
      renderDatabases();
    } catch (err) {
      document.getElementById('databases-tbody').innerHTML = '<tr><td colspan="5" class="text-danger">Failed to load</td></tr>';
    }
  }

  function renderDatabases() {
    const tbody = document.getElementById('databases-tbody');
    if (databases.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-secondary text-center">No databases</td></tr>';
      return;
    }
    tbody.innerHTML = databases.map(db => `
      <tr>
        <td><code>${db.database_name}</code></td>
        <td><code>${db.username}</code></td>
        <td>${db.host}:${db.port}</td>
        <td>${db.max_connections || 0}</td>
        <td>
          <button class="btn btn-ghost btn-sm reset-pass" data-id="${db.uuid}">${icon('key', 14)}</button>
          <button class="btn btn-ghost btn-sm btn-danger delete-db" data-id="${db.uuid}">${icon('trash', 14)}</button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.delete-db').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this database?')) return;
        try {
          await api.delete(`/servers/${server.uuid}/databases/${btn.dataset.id}`);
          toast.success('Database deleted');
          loadDatabases();
        } catch (err) {
          toast.error(err.message);
        }
      });
    });

    tbody.querySelectorAll('.reset-pass').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await api.post(`/servers/${server.uuid}/databases/${btn.dataset.id}/rotate-password`);
          toast.success('Password rotated');
        } catch (err) {
          toast.error(err.message);
        }
      });
    });
  }

  // Event listeners
  document.getElementById('details-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api.put(`/admin/servers/${serverId}`, {
        name: document.getElementById('set-name').value,
        description: document.getElementById('set-description').value,
        external_id: document.getElementById('set-external-id').value,
        owner_id: parseInt(document.getElementById('set-owner').value)
      });
      toast.success('Server updated');
      loadServer();
    } catch (err) {
      toast.error(err.message);
    }
  });

  document.getElementById('build-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api.put(`/admin/servers/${serverId}/build`, {
        cpu: parseInt(document.getElementById('build-cpu').value),
        memory: parseInt(document.getElementById('build-memory').value),
        disk: parseInt(document.getElementById('build-disk').value),
        swap: parseInt(document.getElementById('build-swap').value),
        io: parseInt(document.getElementById('build-io').value),
        limit_databases: parseInt(document.getElementById('build-databases').value),
        limit_backups: parseInt(document.getElementById('build-backups').value),
        limit_allocations: parseInt(document.getElementById('build-allocations').value),
        allocation_id: parseInt(document.getElementById('build-primary-alloc').value)
      });
      toast.success('Build configuration updated');
      loadServer();
    } catch (err) {
      toast.error(err.message);
    }
  });

  document.getElementById('startup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const variables = {};
    document.querySelectorAll('.variable-input').forEach(input => {
      variables[input.dataset.env] = input.value;
    });

    try {
      await api.put(`/admin/servers/${serverId}/startup`, {
        startup_command: document.getElementById('startup-command').value,
        docker_image: document.getElementById('startup-image').value,
        variables
      });
      toast.success('Startup configuration saved');
    } catch (err) {
      toast.error(err.message);
    }
  });

  document.getElementById('btn-suspend').addEventListener('click', async () => {
    try {
      await api.post(`/admin/servers/${serverId}/${server.suspended ? 'unsuspend' : 'suspend'}`);
      toast.success(server.suspended ? 'Server unsuspended' : 'Server suspended');
      loadServer();
    } catch (err) {
      toast.error(err.message);
    }
  });

  document.getElementById('btn-reinstall').addEventListener('click', async () => {
    const confirmed = await confirmModal('Reinstall Server', 'This will delete all server files and reinstall from scratch.');
    if (!confirmed) return;
    try {
      await api.post(`/servers/${server.uuid}/install`);
      toast.success('Reinstall started');
    } catch (err) {
      toast.error(err.message);
    }
  });

  document.getElementById('btn-delete').addEventListener('click', async () => {
    const confirmed = await confirmModal('Delete Server', `Type "${server.name}" to confirm permanent deletion.`, { input: true });
    if (confirmed !== server.name) {
      if (confirmed !== false) toast.error('Name does not match');
      return;
    }
    try {
      await api.delete(`/admin/servers/${serverId}`);
      toast.success('Server deleted');
      navigate('/admin/servers');
    } catch (err) {
      toast.error(err.message);
    }
  });

  document.getElementById('btn-new-db')?.addEventListener('click', () => {
    if (dbHosts.length === 0) {
      toast.error('No database hosts available');
      return;
    }
    openModal({
      title: 'Create Database',
      content: `
        <div class="form-group">
          <label>Database Host</label>
          <select id="modal-db-host" class="input">
            ${dbHosts.map(h => `<option value="${h.id}">${h.name} (${h.host})</option>`).join('')}
          </select>
        </div>
      `,
      actions: [
        { label: 'Cancel', class: 'btn-ghost', action: closeModal },
        { label: 'Create', class: 'btn-primary', action: async () => {
          try {
            await api.post(`/servers/${server.uuid}/databases`, {
              host_id: document.getElementById('modal-db-host').value
            });
            toast.success('Database created');
            closeModal();
            loadDatabases();
          } catch (err) {
            toast.error(err.message);
          }
        }}
      ]
    });
  });

  await loadServer();
}
