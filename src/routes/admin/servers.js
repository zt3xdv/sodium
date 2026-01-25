import { renderNav } from '../../components/nav.js';
import { renderAdminSidebar } from '../../components/sidebar.js';
import { icon } from '../../components/icon.js';
import { api } from '../../utils/api.js';
import { toast } from '../../components/toast.js';
import { formatBytes, formatDate } from '../../utils/format.js';
import { openModal, closeModal, confirmModal } from '../../components/modal.js';
import { navigate } from '../../router.js';

export default function() {
  return `
    ${renderNav()}
    <div class="admin-layout">
      ${renderAdminSidebar('servers')}
      <main class="admin-content">
        <div class="admin-header">
          <div>
            <h1>Servers</h1>
            <p class="text-secondary">Manage all game servers</p>
          </div>
          <button class="btn btn-primary" id="btn-new-server">
            ${icon('plus', 18)} New Server
          </button>
        </div>

        <div class="filters-bar">
          <div class="search-box">
            ${icon('search', 18)}
            <input type="text" id="search-input" placeholder="Search servers...">
          </div>
          <select id="node-filter" class="input">
            <option value="">All Nodes</option>
          </select>
          <select id="user-filter" class="input">
            <option value="">All Users</option>
          </select>
        </div>

        <div class="table-container">
          <table class="table" id="servers-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Name</th>
                <th>Owner</th>
                <th>Node</th>
                <th>Resources</th>
                <th>Address</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="servers-list">
              <tr><td colspan="7" class="loading">Loading...</td></tr>
            </tbody>
          </table>
        </div>
      </main>
    </div>
  `;
}

export async function mount() {
  const serversList = document.getElementById('servers-list');
  const searchInput = document.getElementById('search-input');
  const nodeFilter = document.getElementById('node-filter');
  const userFilter = document.getElementById('user-filter');
  
  let servers = [];
  let nodes = [];
  let users = [];

  async function loadData() {
    try {
      const [serversRes, nodesRes, usersRes] = await Promise.all([
        api.get('/admin/servers'),
        api.get('/nodes'),
        api.get('/admin/users')
      ]);
      
      servers = serversRes.data || [];
      nodes = nodesRes.data || [];
      users = usersRes.data || [];

      nodeFilter.innerHTML = '<option value="">All Nodes</option>' +
        nodes.map(n => `<option value="${n.id}">${n.name}</option>`).join('');
      
      userFilter.innerHTML = '<option value="">All Users</option>' +
        users.map(u => `<option value="${u.id}">${u.username}</option>`).join('');

      renderServers();
    } catch (err) {
      toast.error('Failed to load data');
      serversList.innerHTML = '<tr><td colspan="7" class="empty">Failed to load servers</td></tr>';
    }
  }

  function renderServers() {
    const search = searchInput.value.toLowerCase();
    const nodeId = nodeFilter.value;
    const userId = userFilter.value;

    const filtered = servers.filter(s => {
      if (search && !s.name.toLowerCase().includes(search)) return false;
      if (nodeId && s.node_id != nodeId) return false;
      if (userId && s.owner_id != userId) return false;
      return true;
    });

    if (filtered.length === 0) {
      serversList.innerHTML = '<tr><td colspan="7" class="empty">No servers found</td></tr>';
      return;
    }

    serversList.innerHTML = filtered.map(server => `
      <tr data-id="${server.uuid}">
        <td>
          <span class="status-indicator status-${server.status}"></span>
          <span class="badge badge-${server.status === 'online' ? 'success' : 'secondary'}">${server.status}</span>
        </td>
        <td>
          <a href="/server/${server.uuid}/console" class="server-link">${server.name}</a>
          <div class="text-secondary text-sm">${server.egg_name || 'Unknown Egg'}</div>
        </td>
        <td>${server.owner_name || 'Unknown'}</td>
        <td>${server.node_name || 'Unknown'}</td>
        <td>
          <span class="text-sm">${server.memory}MB RAM</span><br>
          <span class="text-secondary text-sm">${formatBytes(server.disk * 1024 * 1024)} Disk</span>
        </td>
        <td class="font-mono">${server.ip || '0.0.0.0'}:${server.port || '—'}</td>
        <td class="actions-cell">
          <button class="btn btn-ghost btn-sm console-btn" title="Console">
            ${icon('terminal', 14)}
          </button>
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
    document.querySelectorAll('.console-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const uuid = btn.closest('tr').dataset.id;
        navigate(`/server/${uuid}/console`);
      });
    });

    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const uuid = btn.closest('tr').dataset.id;
        navigate(`/server/${uuid}/settings`);
      });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const row = btn.closest('tr');
        const server = servers.find(s => s.uuid === row.dataset.id);
        await deleteServer(server);
      });
    });
  }

  async function deleteServer(server) {
    const confirmed = await confirmModal('Delete Server', `Are you sure you want to delete "${server.name}"? This will permanently delete all server files.`);
    if (!confirmed) return;

    try {
      await api.delete(`/servers/${server.uuid}`);
      toast.success('Server deleted');
      loadData();
    } catch (err) {
      toast.error('Failed to delete server');
    }
  }

  function showNewServerModal() {
    openModal({
      title: 'Create Server',
      size: 'large',
      content: `
        <form id="server-form">
          <div class="form-row">
            <div class="form-group">
              <label for="name">Server Name</label>
              <input type="text" id="name" class="input" required>
            </div>
            <div class="form-group">
              <label for="owner">Owner</label>
              <select id="owner" class="input" required>
                ${users.map(u => `<option value="${u.id}">${u.username}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="node">Node</label>
              <select id="node" class="input" required>
                ${nodes.map(n => `<option value="${n.id}">${n.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label for="egg">Egg</label>
              <select id="egg" class="input" required>
                <option value="">Select a node first</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="memory">Memory (MB)</label>
              <input type="number" id="memory" class="input" value="1024" min="128" required>
            </div>
            <div class="form-group">
              <label for="disk">Disk (MB)</label>
              <input type="number" id="disk" class="input" value="10240" min="256" required>
            </div>
            <div class="form-group">
              <label for="cpu">CPU (%)</label>
              <input type="number" id="cpu" class="input" value="100" min="0" required>
            </div>
          </div>
          <div class="form-group">
            <label for="allocation">Allocation</label>
            <select id="allocation" class="input" required>
              <option value="">Select a node first</option>
            </select>
          </div>
          
          <div class="form-section">
            <h4>Server Limits <span class="text-muted text-sm">(0 = unlimited)</span></h4>
            <div class="form-row">
              <div class="form-group">
                <label for="limit_databases">Databases</label>
                <input type="number" id="limit_databases" class="input" value="2" min="0">
              </div>
              <div class="form-group">
                <label for="limit_backups">Backups</label>
                <input type="number" id="limit_backups" class="input" value="3" min="0">
              </div>
              <div class="form-group">
                <label for="limit_allocations">Allocations</label>
                <input type="number" id="limit_allocations" class="input" value="1" min="1">
              </div>
            </div>
          </div>
        </form>
      `,
      actions: [
        { label: 'Cancel', class: 'btn-ghost', action: closeModal },
        { label: 'Create', class: 'btn-primary', action: async () => {
          const data = {
            name: document.getElementById('name').value,
            owner_id: parseInt(document.getElementById('owner').value),
            node_id: parseInt(document.getElementById('node').value),
            egg_id: parseInt(document.getElementById('egg').value),
            memory: parseInt(document.getElementById('memory').value),
            disk: parseInt(document.getElementById('disk').value),
            cpu: parseInt(document.getElementById('cpu').value),
            allocation_id: parseInt(document.getElementById('allocation').value),
            limit_databases: parseInt(document.getElementById('limit_databases').value) || 0,
            limit_backups: parseInt(document.getElementById('limit_backups').value) || 0,
            limit_allocations: parseInt(document.getElementById('limit_allocations').value) || 1
          };

          try {
            await api.post('/servers', data);
            toast.success('Server created');
            closeModal();
            loadData();
          } catch (err) {
            toast.error(err.message || 'Failed to create server');
          }
        }}
      ]
    });

    const nodeSelect = document.getElementById('node');
    nodeSelect.addEventListener('change', async () => {
      const nodeId = nodeSelect.value;
      if (!nodeId) return;

      try {
        const [eggsRes, allocsRes] = await Promise.all([
          api.get('/eggs'),
          api.get(`/nodes/${nodeId}/allocations?available=true`)
        ]);

        document.getElementById('egg').innerHTML = 
          (eggsRes.data || []).map(e => `<option value="${e.id}">${e.name}</option>`).join('');
        
        document.getElementById('allocation').innerHTML = 
          (allocsRes.data || []).map(a => `<option value="${a.id}">${a.ip}:${a.port}</option>`).join('');
      } catch (err) {
        toast.error('Failed to load options');
      }
    });

    if (nodes.length > 0) {
      nodeSelect.dispatchEvent(new Event('change'));
    }
  }

  searchInput.addEventListener('input', renderServers);
  nodeFilter.addEventListener('change', renderServers);
  userFilter.addEventListener('change', renderServers);
  
  document.getElementById('btn-new-server').addEventListener('click', showNewServerModal);

  await loadData();
}
