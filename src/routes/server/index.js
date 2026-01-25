import { renderNav } from '../../components/nav.js';
import { icon } from '../../components/icon.js';
import { api } from '../../utils/api.js';
import { toast } from '../../components/toast.js';
import { navigate } from '../../router.js';

export default function() {
  return `
    ${renderNav()}
    <main class="main-content">
      <div class="container">
        <div class="page-header">
          <div>
            <h1>Servers</h1>
            <p class="text-secondary">Manage your game servers</p>
          </div>
          <button class="btn btn-primary" id="create-server-btn">
            ${icon('plus', 18)} New Server
          </button>
        </div>

        <div class="filters-bar">
          <div class="search-box">
            ${icon('search', 18)}
            <input type="text" id="search-input" placeholder="Search servers...">
          </div>
          <div class="filter-group">
            <select id="status-filter" class="input">
              <option value="">All Status</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
              <option value="starting">Starting</option>
              <option value="stopping">Stopping</option>
            </select>
            <select id="node-filter" class="input">
              <option value="">All Nodes</option>
            </select>
          </div>
        </div>

        <div id="servers-grid" class="servers-grid">
          <div class="skeleton-grid">
            ${Array(6).fill('<div class="card skeleton-card"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-text"></div></div>').join('')}
          </div>
        </div>
      </div>
    </main>
  `;
}

export async function mount() {
  const grid = document.getElementById('servers-grid');
  const searchInput = document.getElementById('search-input');
  const statusFilter = document.getElementById('status-filter');
  const nodeFilter = document.getElementById('node-filter');
  
  let servers = [];
  let nodes = [];

  async function loadData() {
    try {
      const [serversRes, nodesRes] = await Promise.all([
        api.get('/servers'),
        api.get('/nodes').catch(() => ({ data: [] }))
      ]);
      servers = serversRes.data || [];
      nodes = nodesRes.data || [];
      
      nodeFilter.innerHTML = '<option value="">All Nodes</option>' +
        nodes.map(n => `<option value="${n.id}">${n.name}</option>`).join('');
      
      renderServers();
    } catch (err) {
      toast.error('Failed to load servers');
      grid.innerHTML = '<div class="empty-state"><p>Failed to load servers</p></div>';
    }
  }

  function renderServers() {
    const search = searchInput.value.toLowerCase();
    const status = statusFilter.value;
    const nodeId = nodeFilter.value;

    const filtered = servers.filter(s => {
      if (search && !s.name.toLowerCase().includes(search)) return false;
      if (status && s.status !== status) return false;
      if (nodeId && s.node_id != nodeId) return false;
      return true;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          ${icon('server', 48)}
          <h3>No servers found</h3>
          <p class="text-secondary">Try adjusting your filters</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(server => {
      const statusLabels = {
        online: 'Online',
        offline: 'Offline',
        starting: 'Starting',
        stopping: 'Stopping',
        restarting: 'Restarting',
        installing: 'Installing'
      };
      const statusLabel = statusLabels[server.status] || server.status;
      
      return `
        <div class="server-card card" data-id="${server.uuid}">
          <div class="server-card-header">
            <span class="status-indicator status-${server.status}"></span>
            <h3 class="server-name">${server.name}</h3>
            <span class="badge badge-${server.status === 'online' ? 'success' : 'default'}">${statusLabel}</span>
          </div>
          <div class="server-card-info">
            <p class="server-address">${server.ip || '0.0.0.0'}:${server.port || '—'}</p>
            <div class="server-meta">
              <span class="text-secondary">${icon('cpu', 14)} ${server.cpu}%</span>
              <span class="text-secondary">${icon('memory', 14)} ${server.memory}MB</span>
              ${server.node_name ? `<span class="text-secondary">${icon('server', 14)} ${server.node_name}</span>` : ''}
            </div>
            <p class="text-secondary server-egg">${server.egg_name || 'Unknown'}</p>
          </div>
          <div class="server-card-actions">
            <a href="/server/${server.uuid}/console" class="btn btn-ghost btn-sm">${icon('terminal', 16)} Console</a>
            <a href="/server/${server.uuid}/files" class="btn btn-ghost btn-sm">${icon('folder', 16)} Files</a>
            <div class="power-actions">
              ${server.status === 'online' ? `
                <button class="btn btn-secondary btn-sm power-btn" data-uuid="${server.uuid}" data-action="restart" title="Restart">
                  ${icon('refresh-cw', 16)}
                </button>
                <button class="btn btn-danger btn-sm power-btn" data-uuid="${server.uuid}" data-action="stop" title="Stop">
                  ${icon('stop', 16)}
                </button>
              ` : `
                <button class="btn btn-primary btn-sm power-btn" data-uuid="${server.uuid}" data-action="start" title="Start" 
                        ${server.status === 'starting' || server.status === 'installing' ? 'disabled' : ''}>
                  ${icon('play', 16)}
                </button>
              `}
            </div>
          </div>
        </div>
      `;
    }).join('');

    document.querySelectorAll('.power-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const uuid = btn.dataset.uuid;
        const action = btn.dataset.action;
        btn.disabled = true;
        try {
          await api.post(`/servers/${uuid}/power`, { action });
          toast.success(`Server ${action} command sent`);
          setTimeout(loadData, 2000);
        } catch (err) {
          if (err.status === 503) {
            toast.error('Daemon not connected');
          } else {
            toast.error(err.message || `Failed to ${action} server`);
          }
        }
        btn.disabled = false;
      });
    });

    document.querySelectorAll('.server-card').forEach(card => {
      card.addEventListener('click', () => {
        navigate(`/server/${card.dataset.id}/console`);
      });
    });
  }

  searchInput.addEventListener('input', renderServers);
  statusFilter.addEventListener('change', renderServers);
  nodeFilter.addEventListener('change', renderServers);

  document.getElementById('create-server-btn')?.addEventListener('click', () => {
    navigate('/admin/servers/new');
  });

  await loadData();
}
