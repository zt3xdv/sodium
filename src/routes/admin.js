import { escapeHtml } from '../utils/security.js';
import * as toast from '../utils/toast.js';
import { api, apiJson, getUser } from '../utils/api.js';

let currentView = { type: 'list', tab: 'nodes', id: null, subTab: null };
let currentPage = { nodes: 1, servers: 1, users: 1 };
let itemsPerPage = { nodes: 10, servers: 10, users: 10 };

function renderPagination(meta, tab) {
  if (!meta || meta.total === 0) return '';
  
  let pageNumbers = '';
  const maxVisible = 5;
  let startPage = Math.max(1, meta.current_page - Math.floor(maxVisible / 2));
  let endPage = Math.min(meta.total_pages, startPage + maxVisible - 1);
  
  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }
  
  if (startPage > 1) {
    pageNumbers += `<button class="page-num" data-page="1">1</button>`;
    if (startPage > 2) pageNumbers += `<span class="page-ellipsis">...</span>`;
  }
  
  for (let i = startPage; i <= endPage; i++) {
    pageNumbers += `<button class="page-num ${i === meta.current_page ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }
  
  if (endPage < meta.total_pages) {
    if (endPage < meta.total_pages - 1) pageNumbers += `<span class="page-ellipsis">...</span>`;
    pageNumbers += `<button class="page-num" data-page="${meta.total_pages}">${meta.total_pages}</button>`;
  }
  
  return `
    <div class="pagination">
      <div class="pagination-left">
        <select class="per-page-select" data-tab="${tab}">
          <option value="10" ${meta.per_page === 10 ? 'selected' : ''}>10</option>
          <option value="25" ${meta.per_page === 25 ? 'selected' : ''}>25</option>
          <option value="50" ${meta.per_page === 50 ? 'selected' : ''}>50</option>
        </select>
        <span class="per-page-label">per page</span>
      </div>
      
      <div class="pagination-center">
        <button class="page-btn" data-page="${meta.current_page - 1}" ${meta.current_page <= 1 ? 'disabled' : ''}>
          <span class="material-icons-outlined">chevron_left</span>
        </button>
        <div class="page-numbers">${pageNumbers}</div>
        <button class="page-btn" data-page="${meta.current_page + 1}" ${meta.current_page >= meta.total_pages ? 'disabled' : ''}>
          <span class="material-icons-outlined">chevron_right</span>
        </button>
      </div>
      
      <div class="pagination-right">
        <span class="goto-label">Go to</span>
        <input type="number" class="goto-input" min="1" max="${meta.total_pages}" value="${meta.current_page}" data-tab="${tab}" />
        <span class="page-total">of ${meta.total_pages} (${meta.total} items)</span>
      </div>
    </div>
  `;
}

function setupPaginationListeners(tab) {
  document.querySelectorAll('.pagination .page-btn').forEach(btn => {
    btn.onclick = () => {
      const page = parseInt(btn.dataset.page);
      if (page >= 1) {
        currentPage[tab] = page;
        loadView();
      }
    };
  });
  
  document.querySelectorAll('.pagination .page-num').forEach(btn => {
    btn.onclick = () => {
      currentPage[tab] = parseInt(btn.dataset.page);
      loadView();
    };
  });
  
  const perPageSelect = document.querySelector('.per-page-select');
  if (perPageSelect) {
    perPageSelect.onchange = (e) => {
      itemsPerPage[tab] = parseInt(e.target.value);
      currentPage[tab] = 1;
      loadView();
    };
  }
  
  const gotoInput = document.querySelector('.goto-input');
  if (gotoInput) {
    gotoInput.onkeypress = (e) => {
      if (e.key === 'Enter') {
        let page = parseInt(gotoInput.value);
        const max = parseInt(gotoInput.max);
        if (page < 1) page = 1;
        if (page > max) page = max;
        currentPage[tab] = page;
        loadView();
      }
    };
  }
}

function renderBreadcrumb(items) {
  return `
    <nav class="admin-breadcrumb">
      ${items.map((item, idx) => `
        ${idx > 0 ? '<span class="material-icons-outlined">chevron_right</span>' : ''}
        ${item.onClick ? `<a href="#" class="breadcrumb-item" data-action="${item.onClick}">${escapeHtml(item.label)}</a>` : `<span class="breadcrumb-item current">${escapeHtml(item.label)}</span>`}
      `).join('')}
    </nav>
  `;
}

function setupBreadcrumbListeners() {
  document.querySelectorAll('.breadcrumb-item[data-action]').forEach(el => {
    el.onclick = (e) => {
      e.preventDefault();
      const action = el.dataset.action;
      if (action === 'list-nodes') navigateTo('nodes');
      else if (action === 'list-servers') navigateTo('servers');
      else if (action === 'list-users') navigateTo('users');
      else if (action === 'list-nests') navigateTo('nests');
      else if (action === 'list-locations') navigateTo('locations');
    };
  });
}

function navigateTo(tab, id = null, subTab = null) {
  currentView = { type: id ? 'detail' : 'list', tab, id, subTab: subTab || getDefaultSubTab(tab) };
  loadView();
}

function getDefaultSubTab(tab) {
  switch (tab) {
    case 'nodes': return 'about';
    case 'servers': return 'details';
    case 'users': return 'overview';
    case 'eggs': return 'about';
    default: return null;
  }
}

window.adminNavigate = navigateTo;

export async function renderAdmin() {
  const app = document.getElementById('app');
  const user = getUser();
  
  app.innerHTML = '<div class="loading-spinner"></div>';
  
  try {
    if (!user?.isAdmin) {
      app.innerHTML = `
        <div class="error-page">
          <h1>403</h1>
          <p>Access Denied</p>
          <a href="/dashboard" class="btn btn-primary">Go to Dashboard</a>
        </div>
      `;
      return;
    }
  } catch (e) {
    app.innerHTML = '<div class="error">Failed to verify permissions</div>';
    return;
  }
  
  app.innerHTML = `
    <div class="admin-page">
      <div class="admin-layout">
        <aside class="admin-sidebar">
          <div class="admin-sidebar-header">
            <span class="material-icons-outlined">admin_panel_settings</span>
            <span>Admin</span>
          </div>
          <nav class="admin-nav">
            <a href="#" class="admin-nav-item active" data-tab="nodes">
              <span class="material-icons-outlined">dns</span>
              <span>Nodes</span>
            </a>
            <a href="#" class="admin-nav-item" data-tab="servers">
              <span class="material-icons-outlined">storage</span>
              <span>Servers</span>
            </a>
            <a href="#" class="admin-nav-item" data-tab="users">
              <span class="material-icons-outlined">people</span>
              <span>Users</span>
            </a>
            <a href="#" class="admin-nav-item" data-tab="nests">
              <span class="material-icons-outlined">egg</span>
              <span>Nests</span>
            </a>
            <a href="#" class="admin-nav-item" data-tab="locations">
              <span class="material-icons-outlined">location_on</span>
              <span>Locations</span>
            </a>
            <a href="#" class="admin-nav-item" data-tab="settings">
              <span class="material-icons-outlined">settings</span>
              <span>Settings</span>
            </a>
          </nav>
        </aside>
        
        <main class="admin-main">
          <div class="admin-content" id="admin-content">
            <div class="loading-spinner"></div>
          </div>
        </main>
      </div>
    </div>
  `;
  
  document.querySelectorAll('.admin-nav-item').forEach(item => {
    item.onclick = (e) => {
      e.preventDefault();
      document.querySelectorAll('.admin-nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      navigateTo(item.dataset.tab);
    };
  });
  
  loadView();
}

async function loadView() {
  const container = document.getElementById('admin-content');
  const username = localStorage.getItem('username');
  
  container.innerHTML = '<div class="loading-spinner"></div>';
  
  document.querySelectorAll('.admin-nav-item').forEach(i => {
    i.classList.toggle('active', i.dataset.tab === currentView.tab);
  });
  
  if (currentView.type === 'detail' && currentView.id) {
    switch (currentView.tab) {
      case 'nodes':
        await renderNodeDetail(container, username, currentView.id);
        break;
      case 'servers':
        await renderServerDetail(container, username, currentView.id);
        break;
      case 'users':
        await renderUserDetail(container, username, currentView.id);
        break;
      case 'eggs':
        await renderEggDetail(container, username, currentView.id);
        break;
    }
  } else {
    switch (currentView.tab) {
      case 'nodes':
        await renderNodesList(container, username);
        break;
      case 'servers':
        await renderServersList(container, username);
        break;
      case 'users':
        await renderUsersList(container, username);
        break;
      case 'nests':
        await renderNestsList(container, username);
        break;
      case 'locations':
        await renderLocationsList(container, username);
        break;
      case 'settings':
        await renderSettingsPage(container, username);
        break;
    }
  }
}

// ============== NODES ==============

async function renderNodesList(container, username) {
  try {
    const res = await api(`/api/admin/nodes?page=${currentPage.nodes}&per_page=${itemsPerPage.nodes}`);
    const data = await res.json();
    
    container.innerHTML = `
      <div class="admin-header">
        ${renderBreadcrumb([{ label: 'Nodes' }])}
        <div class="admin-header-actions">
          <button class="btn btn-primary" id="create-node-btn">
            <span class="material-icons-outlined">add</span>
            Create Node
          </button>
        </div>
      </div>
      
      <div class="admin-list">
        ${data.nodes.length === 0 ? `
          <div class="empty-state">
            <span class="material-icons-outlined">dns</span>
            <h3>No Nodes</h3>
            <p>Create your first node to get started</p>
          </div>
        ` : `
          <div class="list-grid nodes-grid">
            ${data.nodes.map(node => `
              <div class="list-card" data-id="${node.id}">
                <div class="list-card-header">
                  <div class="list-card-icon">
                    <span class="material-icons-outlined">dns</span>
                  </div>
                  <div class="list-card-title">
                    <h3>${escapeHtml(node.name)}</h3>
                    <span class="list-card-subtitle">${escapeHtml(node.fqdn)}</span>
                  </div>
                  <span class="status-indicator ${node.maintenance_mode ? 'status-warning' : 'status-success'}"></span>
                </div>
                <div class="list-card-stats">
                  <div class="stat">
                    <span class="stat-label">Memory</span>
                    <span class="stat-value">${formatBytes(node.memory * 1024 * 1024)}</span>
                  </div>
                  <div class="stat">
                    <span class="stat-label">Disk</span>
                    <span class="stat-value">${formatBytes(node.disk * 1024 * 1024)}</span>
                  </div>
                  <div class="stat">
                    <span class="stat-label">Ports</span>
                    <span class="stat-value">${node.allocation_start || 25565}-${node.allocation_end || 25665}</span>
                  </div>
                </div>
                <div class="list-card-footer">
                  <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation(); adminNavigate('nodes', '${node.id}')">
                    <span class="material-icons-outlined">settings</span>
                    Manage
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
        ${renderPagination(data.meta, 'nodes')}
      </div>
    `;
    
    setupBreadcrumbListeners();
    setupPaginationListeners('nodes');
    
    document.querySelectorAll('.list-card[data-id]').forEach(card => {
      card.onclick = () => navigateTo('nodes', card.dataset.id);
    });
    
    document.getElementById('create-node-btn').onclick = () => showCreateNodeModal(username);
    
  } catch (e) {
    container.innerHTML = `<div class="error">Failed to load nodes</div>`;
  }
}

async function renderNodeDetail(container, username, nodeId) {
  try {
    const res = await api(`/api/admin/nodes`);
    const data = await res.json();
    const node = data.nodes.find(n => n.id === nodeId);
    
    if (!node) {
      container.innerHTML = `<div class="error">Node not found</div>`;
      return;
    }
    
    const locRes = await api('/api/admin/locations');
    const locData = await locRes.json();
    
    container.innerHTML = `
      <div class="admin-header">
        ${renderBreadcrumb([
          { label: 'Nodes', onClick: 'list-nodes' },
          { label: node.name }
        ])}
        <div class="admin-header-actions">
          <button class="btn btn-danger" id="delete-node-btn">
            <span class="material-icons-outlined">delete</span>
            Delete
          </button>
        </div>
      </div>
      
      <div class="detail-tabs">
        <button class="detail-tab ${currentView.subTab === 'about' ? 'active' : ''}" data-subtab="about">About</button>
        <button class="detail-tab ${currentView.subTab === 'settings' ? 'active' : ''}" data-subtab="settings">Settings</button>
        <button class="detail-tab ${currentView.subTab === 'configuration' ? 'active' : ''}" data-subtab="configuration">Configuration</button>
        <button class="detail-tab ${currentView.subTab === 'allocations' ? 'active' : ''}" data-subtab="allocations">Allocations</button>
      </div>
      
      <div class="detail-content" id="node-detail-content"></div>
    `;
    
    setupBreadcrumbListeners();
    
    document.querySelectorAll('.detail-tab').forEach(tab => {
      tab.onclick = () => {
        currentView.subTab = tab.dataset.subtab;
        document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        renderNodeSubTab(node, locData.locations, username);
      };
    });
    
    document.getElementById('delete-node-btn').onclick = async () => {
      if (!confirm('Are you sure you want to delete this node? This cannot be undone.')) return;
      try {
        await api(`/api/admin/nodes/${nodeId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        navigateTo('nodes');
      } catch (e) {
        toast.error('Failed to delete node');
      }
    };
    
    renderNodeSubTab(node, locData.locations, username);
    
  } catch (e) {
    container.innerHTML = `<div class="error">Failed to load node</div>`;
  }
}

function renderNodeSubTab(node, locations, username) {
  const content = document.getElementById('node-detail-content');
  
  switch (currentView.subTab) {
    case 'about':
      content.innerHTML = `
        <div class="detail-grid">
          <div class="detail-card">
            <h3>Node Information</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Name</span>
                <span class="info-value">${escapeHtml(node.name)}</span>
              </div>
              <div class="info-item">
                <span class="info-label">FQDN</span>
                <span class="info-value">${escapeHtml(node.fqdn)}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Scheme</span>
                <span class="info-value">${node.scheme || 'https'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Daemon Port</span>
                <span class="info-value">${node.daemon_port || 8080}</span>
              </div>
              <div class="info-item">
                <span class="info-label">SFTP Port</span>
                <span class="info-value">${node.daemon_sftp_port || 2022}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Location</span>
                <span class="info-value">${locations.find(l => l.id === node.location_id)?.long || 'Unknown'}</span>
              </div>
            </div>
          </div>
          
          <div class="detail-card">
            <h3>Resources</h3>
            <div class="resource-bars">
              <div class="resource-bar">
                <div class="resource-header">
                  <span>Memory</span>
                  <span>${formatBytes(node.memory * 1024 * 1024)}</span>
                </div>
                <div class="progress-bar">
                  <div class="progress-fill" style="width: 0%"></div>
                </div>
              </div>
              <div class="resource-bar">
                <div class="resource-header">
                  <span>Disk</span>
                  <span>${formatBytes(node.disk * 1024 * 1024)}</span>
                </div>
                <div class="progress-bar">
                  <div class="progress-fill" style="width: 0%"></div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="detail-card">
            <h3>Status</h3>
            <div class="status-grid">
              <div class="status-item ${node.maintenance_mode ? 'warning' : 'success'}">
                <span class="material-icons-outlined">${node.maintenance_mode ? 'construction' : 'check_circle'}</span>
                <span>${node.maintenance_mode ? 'Maintenance Mode' : 'Operational'}</span>
              </div>
              <div class="status-item ${node.behind_proxy ? 'info' : ''}">
                <span class="material-icons-outlined">${node.behind_proxy ? 'vpn_lock' : 'public'}</span>
                <span>${node.behind_proxy ? 'Behind Proxy' : 'Direct Connection'}</span>
              </div>
            </div>
          </div>
        </div>
      `;
      break;
      
    case 'settings':
      content.innerHTML = `
        <div class="detail-card detail-card-wide">
          <h3>Node Settings</h3>
          <form id="node-settings-form" class="settings-form">
            <div class="form-section">
              <h4>General</h4>
              <div class="form-grid">
                <div class="form-group">
                  <label>Name</label>
                  <input type="text" name="name" value="${escapeHtml(node.name)}" required />
                </div>
                <div class="form-group">
                  <label>Description</label>
                  <input type="text" name="description" value="${escapeHtml(node.description || '')}" />
                </div>
              </div>
            </div>
            
            <div class="form-section">
              <h4>Connection</h4>
              <div class="form-grid">
                <div class="form-group">
                  <label>FQDN</label>
                  <input type="text" name="fqdn" value="${escapeHtml(node.fqdn)}" required />
                </div>
                <div class="form-group">
                  <label>Scheme</label>
                  <select name="scheme">
                    <option value="https" ${node.scheme === 'https' ? 'selected' : ''}>HTTPS</option>
                    <option value="http" ${node.scheme === 'http' ? 'selected' : ''}>HTTP</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Daemon Port</label>
                  <input type="number" name="daemon_port" value="${node.daemon_port || 8080}" required />
                </div>
                <div class="form-group">
                  <label>SFTP Port</label>
                  <input type="number" name="daemon_sftp_port" value="${node.daemon_sftp_port || 2022}" required />
                </div>
              </div>
            </div>
            
            <div class="form-section">
              <h4>Resources</h4>
              <div class="form-grid">
                <div class="form-group">
                  <label>Memory (MB)</label>
                  <input type="number" name="memory" value="${node.memory}" required />
                </div>
                <div class="form-group">
                  <label>Disk (MB)</label>
                  <input type="number" name="disk" value="${node.disk}" required />
                </div>
                <div class="form-group">
                  <label>Upload Size (MB)</label>
                  <input type="number" name="upload_size" value="${node.upload_size || 100}" />
                </div>
                <div class="form-group">
                  <label>Location</label>
                  <select name="location_id">
                    ${locations.map(l => `<option value="${l.id}" ${l.id === node.location_id ? 'selected' : ''}>${escapeHtml(l.long)}</option>`).join('')}
                  </select>
                </div>
              </div>
            </div>
            
            <div class="form-section">
              <h4>Options</h4>
              <div class="form-toggles">
                <label class="toggle-item">
                  <input type="checkbox" name="behind_proxy" ${node.behind_proxy ? 'checked' : ''} />
                  <span class="toggle-content">
                    <span class="toggle-title">Behind Proxy</span>
                    <span class="toggle-desc">Enable if this node is behind a reverse proxy</span>
                  </span>
                </label>
                <label class="toggle-item">
                  <input type="checkbox" name="maintenance_mode" ${node.maintenance_mode ? 'checked' : ''} />
                  <span class="toggle-content">
                    <span class="toggle-title">Maintenance Mode</span>
                    <span class="toggle-desc">Prevent new servers from being created on this node</span>
                  </span>
                </label>
              </div>
            </div>
            
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">Save Changes</button>
            </div>
          </form>
        </div>
      `;
      
      document.getElementById('node-settings-form').onsubmit = async (e) => {
        e.preventDefault();
        const form = new FormData(e.target);
        const nodeData = Object.fromEntries(form);
        nodeData.behind_proxy = form.get('behind_proxy') === 'on';
        nodeData.maintenance_mode = form.get('maintenance_mode') === 'on';
        
        try {
          await api(`/api/admin/nodes/${node.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ node: nodeData })
          });
          toast.success('Node updated successfully');
          navigateTo('nodes', node.id, 'settings');
        } catch (e) {
          toast.error('Failed to update node');
        }
      };
      break;
      
    case 'configuration':
      content.innerHTML = `
        <div class="detail-card detail-card-wide">
          <h3>Configuration Files</h3>
          <p class="card-description">Use these configuration files to set up Wings on your node.</p>
          
          <div class="config-actions">
            <button class="btn btn-ghost" id="show-config-btn">
              <span class="material-icons-outlined">description</span>
              View Configuration
            </button>
            <button class="btn btn-ghost" id="show-deploy-btn">
              <span class="material-icons-outlined">terminal</span>
              Deploy Command
            </button>
          </div>
          
          <div id="config-output" class="config-section" style="display:none;"></div>
        </div>
      `;
      
      document.getElementById('show-config-btn').onclick = async () => {
        const output = document.getElementById('config-output');
        try {
          const res = await api(`/api/admin/nodes/${node.id}/config`);
          const data = await res.json();
          if (data.error) {
            output.innerHTML = `<div class="error">${escapeHtml(data.error)}</div>`;
          } else {
            const yaml = jsonToYaml(data.config);
            output.innerHTML = `
              <div class="config-header">
                <span>config.yml</span>
                <button class="btn btn-sm btn-ghost" onclick="navigator.clipboard.writeText(this.closest('.config-section').querySelector('pre').textContent); this.textContent='Copied!'">Copy</button>
              </div>
              <pre class="config-code">${escapeHtml(yaml)}</pre>
            `;
          }
          output.style.display = 'block';
        } catch (e) {
          toast.error('Failed to load configuration');
        }
      };
      
      document.getElementById('show-deploy-btn').onclick = async () => {
        const output = document.getElementById('config-output');
        try {
          const res = await api(`/api/admin/nodes/${node.id}/deploy`);
          const data = await res.json();
          if (data.error) {
            output.innerHTML = `<div class="error">${escapeHtml(data.error)}</div>`;
          } else {
            output.innerHTML = `
              <div class="config-header">
                <span>Deploy Command</span>
                <button class="btn btn-sm btn-ghost" onclick="navigator.clipboard.writeText(this.closest('.config-section').querySelector('pre').textContent); this.textContent='Copied!'">Copy</button>
              </div>
              <pre class="config-code" style="white-space:pre-wrap;word-break:break-all;">${escapeHtml(data.command)}</pre>
            `;
          }
          output.style.display = 'block';
        } catch (e) {
          toast.error('Failed to load deploy command');
        }
      };
      break;
      
    case 'allocations':
      content.innerHTML = `
        <div class="detail-card detail-card-wide">
          <h3>Port Allocations</h3>
          <p class="card-description">Manage the port range available for servers on this node.</p>
          
          <form id="allocations-form" class="settings-form">
            <div class="form-grid">
              <div class="form-group">
                <label>Port Range Start</label>
                <input type="number" name="allocation_start" value="${node.allocation_start || 25565}" required />
              </div>
              <div class="form-group">
                <label>Port Range End</label>
                <input type="number" name="allocation_end" value="${node.allocation_end || 25665}" required />
              </div>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">Update Allocations</button>
            </div>
          </form>
        </div>
      `;
      
      document.getElementById('allocations-form').onsubmit = async (e) => {
        e.preventDefault();
        const form = new FormData(e.target);
        const nodeData = {
          allocation_start: parseInt(form.get('allocation_start')),
          allocation_end: parseInt(form.get('allocation_end'))
        };
        
        try {
          await api(`/api/admin/nodes/${node.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ node: nodeData })
          });
          toast.success('Allocations updated');
        } catch (e) {
          toast.error('Failed to update allocations');
        }
      };
      break;
  }
}

async function showCreateNodeModal(username) {
  const locRes = await api('/api/admin/locations');
  const locData = await locRes.json();
  
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.innerHTML = `
    <div class="modal-backdrop" onclick="this.parentElement.remove()"></div>
    <div class="modal-content modal-large">
      <div class="modal-header">
        <h2>Create Node</h2>
        <button class="modal-close" onclick="this.closest('.modal').remove()">
          <span class="material-icons-outlined">close</span>
        </button>
      </div>
      <form id="create-node-form" class="modal-form">
        <div class="form-grid">
          <div class="form-group">
            <label>Name</label>
            <input type="text" name="name" required />
          </div>
          <div class="form-group">
            <label>Location</label>
            <select name="location_id">
              ${locData.locations.map(l => `<option value="${l.id}">${escapeHtml(l.long)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>FQDN</label>
            <input type="text" name="fqdn" placeholder="node.example.com" required />
          </div>
          <div class="form-group">
            <label>Scheme</label>
            <select name="scheme">
              <option value="https">HTTPS</option>
              <option value="http">HTTP</option>
            </select>
          </div>
          <div class="form-group">
            <label>Memory (MB)</label>
            <input type="number" name="memory" value="8192" required />
          </div>
          <div class="form-group">
            <label>Disk (MB)</label>
            <input type="number" name="disk" value="51200" required />
          </div>
          <div class="form-group">
            <label>Daemon Port</label>
            <input type="number" name="daemon_port" value="8080" required />
          </div>
          <div class="form-group">
            <label>SFTP Port</label>
            <input type="number" name="daemon_sftp_port" value="2022" required />
          </div>
          <div class="form-group">
            <label>Port Range Start</label>
            <input type="number" name="allocation_start" value="25565" required />
          </div>
          <div class="form-group">
            <label>Port Range End</label>
            <input type="number" name="allocation_end" value="25665" required />
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" onclick="this.closest('.modal').remove()">Cancel</button>
          <button type="submit" class="btn btn-primary">Create Node</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  
  document.getElementById('create-node-form').onsubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const node = Object.fromEntries(form);
    
    try {
      await api('/api/admin/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ node })
      });
      modal.remove();
      loadView();
    } catch (e) {
      toast.error('Failed to create node');
    }
  };
}

// ============== SERVERS ==============

async function renderServersList(container, username) {
  try {
    const res = await api(`/api/admin/servers?page=${currentPage.servers}&per_page=${itemsPerPage.servers}`);
    const data = await res.json();
    
    container.innerHTML = `
      <div class="admin-header">
        ${renderBreadcrumb([{ label: 'Servers' }])}
        <div class="admin-header-actions">
          <button class="btn btn-primary" id="create-server-btn">
            <span class="material-icons-outlined">add</span>
            Create Server
          </button>
        </div>
      </div>
      
      <div class="admin-list">
        ${data.servers.length === 0 ? `
          <div class="empty-state">
            <span class="material-icons-outlined">storage</span>
            <h3>No Servers</h3>
            <p>No servers have been created yet</p>
          </div>
        ` : `
          <div class="list-table">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Owner</th>
                  <th>Node</th>
                  <th>Resources</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${data.servers.map(s => `
                  <tr class="clickable-row" data-id="${s.id}">
                    <td>
                      <div class="cell-main">${escapeHtml(s.name)}</div>
                      <div class="cell-sub">${s.id.substring(0, 8)}</div>
                    </td>
                    <td>${s.user_id?.substring(0, 8) || '--'}</td>
                    <td>${s.node_id?.substring(0, 8) || '--'}</td>
                    <td>
                      <div class="resource-pills">
                        <span class="pill">${s.limits?.memory || 0}MB</span>
                        <span class="pill">${s.limits?.disk || 0}MB</span>
                        <span class="pill">${s.limits?.cpu || 0}%</span>
                      </div>
                    </td>
                    <td>
                      <span class="status-badge status-${s.status}">${s.status}</span>
                      ${s.suspended ? '<span class="status-badge status-suspended">Suspended</span>' : ''}
                    </td>
                    <td>
                      <div class="action-buttons" onclick="event.stopPropagation()">
                        ${s.suspended 
                          ? `<button class="btn btn-xs btn-success" onclick="unsuspendServerAdmin('${s.id}')">Unsuspend</button>` 
                          : `<button class="btn btn-xs btn-warning" onclick="suspendServerAdmin('${s.id}')">Suspend</button>`}
                        <button class="btn btn-xs btn-danger" onclick="deleteServerAdmin('${s.id}')">Delete</button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          
          <div class="list-cards">
            ${data.servers.map(s => `
              <div class="list-card" data-id="${s.id}">
                <div class="list-card-header">
                  <div class="list-card-icon">
                    <span class="material-icons-outlined">storage</span>
                  </div>
                  <div class="list-card-title">
                    <h3>${escapeHtml(s.name)}</h3>
                    <span class="list-card-subtitle">${s.id.substring(0, 8)}</span>
                  </div>
                  <span class="status-badge status-${s.status}">${s.status}</span>
                </div>
                <div class="list-card-stats">
                  <div class="stat">
                    <span class="stat-label">Memory</span>
                    <span class="stat-value">${s.limits?.memory || 0}MB</span>
                  </div>
                  <div class="stat">
                    <span class="stat-label">Disk</span>
                    <span class="stat-value">${s.limits?.disk || 0}MB</span>
                  </div>
                  <div class="stat">
                    <span class="stat-label">CPU</span>
                    <span class="stat-value">${s.limits?.cpu || 0}%</span>
                  </div>
                </div>
                <div class="list-card-footer" onclick="event.stopPropagation()">
                  ${s.suspended 
                    ? `<button class="btn btn-sm btn-success" onclick="unsuspendServerAdmin('${s.id}')">Unsuspend</button>` 
                    : `<button class="btn btn-sm btn-warning" onclick="suspendServerAdmin('${s.id}')">Suspend</button>`}
                  <button class="btn btn-sm btn-danger" onclick="deleteServerAdmin('${s.id}')">Delete</button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
        ${renderPagination(data.meta, 'servers')}
      </div>
    `;
    
    setupBreadcrumbListeners();
    setupPaginationListeners('servers');
    
    document.querySelectorAll('.clickable-row[data-id], .list-card[data-id]').forEach(el => {
      el.onclick = () => navigateTo('servers', el.dataset.id);
    });
    
    document.getElementById('create-server-btn').onclick = () => showCreateServerModal(username);
    
  } catch (e) {
    container.innerHTML = `<div class="error">Failed to load servers</div>`;
  }
}

async function renderServerDetail(container, username, serverId) {
  try {
    const res = await api(`/api/admin/servers`);
    const data = await res.json();
    const server = data.servers.find(s => s.id === serverId);
    
    if (!server) {
      container.innerHTML = `<div class="error">Server not found</div>`;
      return;
    }
    
    container.innerHTML = `
      <div class="admin-header">
        ${renderBreadcrumb([
          { label: 'Servers', onClick: 'list-servers' },
          { label: server.name }
        ])}
        <div class="admin-header-actions">
          <a href="/server/${serverId}" class="btn btn-ghost">
            <span class="material-icons-outlined">open_in_new</span>
            View Console
          </a>
          <button class="btn btn-danger" id="delete-server-btn">
            <span class="material-icons-outlined">delete</span>
            Delete
          </button>
        </div>
      </div>
      
      <div class="detail-tabs">
        <button class="detail-tab ${currentView.subTab === 'details' ? 'active' : ''}" data-subtab="details">Details</button>
        <button class="detail-tab ${currentView.subTab === 'build' ? 'active' : ''}" data-subtab="build">Build Configuration</button>
        <button class="detail-tab ${currentView.subTab === 'startup' ? 'active' : ''}" data-subtab="startup">Startup</button>
        <button class="detail-tab ${currentView.subTab === 'manage' ? 'active' : ''}" data-subtab="manage">Manage</button>
      </div>
      
      <div class="detail-content" id="server-detail-content"></div>
    `;
    
    setupBreadcrumbListeners();
    
    document.querySelectorAll('.detail-tab').forEach(tab => {
      tab.onclick = () => {
        currentView.subTab = tab.dataset.subtab;
        document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        renderServerSubTab(server, username);
      };
    });
    
    document.getElementById('delete-server-btn').onclick = async () => {
      if (!confirm('Are you sure you want to delete this server? This cannot be undone.')) return;
      try {
        await api(`/api/admin/servers/${serverId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        navigateTo('servers');
      } catch (e) {
        toast.error('Failed to delete server');
      }
    };
    
    renderServerSubTab(server, username);
    
  } catch (e) {
    container.innerHTML = `<div class="error">Failed to load server</div>`;
  }
}

function renderServerSubTab(server, username) {
  const content = document.getElementById('server-detail-content');
  
  switch (currentView.subTab) {
    case 'details':
      content.innerHTML = `
        <div class="detail-grid">
          <div class="detail-card">
            <h3>Server Information</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Name</span>
                <span class="info-value">${escapeHtml(server.name)}</span>
              </div>
              <div class="info-item">
                <span class="info-label">ID</span>
                <span class="info-value code">${server.id}</span>
              </div>
              <div class="info-item">
                <span class="info-label">UUID</span>
                <span class="info-value code">${server.uuid || server.id}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Owner</span>
                <span class="info-value">${server.user_id || 'Unknown'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Node</span>
                <span class="info-value">${server.node_id || 'Unknown'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Status</span>
                <span class="info-value">
                  <span class="status-badge status-${server.status}">${server.status}</span>
                  ${server.suspended ? '<span class="status-badge status-suspended">Suspended</span>' : ''}
                </span>
              </div>
            </div>
          </div>
          
          <div class="detail-card">
            <h3>Resource Limits</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Memory</span>
                <span class="info-value">${server.limits?.memory || 0} MB</span>
              </div>
              <div class="info-item">
                <span class="info-label">Disk</span>
                <span class="info-value">${server.limits?.disk || 0} MB</span>
              </div>
              <div class="info-item">
                <span class="info-label">CPU</span>
                <span class="info-value">${server.limits?.cpu || 0}%</span>
              </div>
              <div class="info-item">
                <span class="info-label">Swap</span>
                <span class="info-value">${server.limits?.swap || 0} MB</span>
              </div>
              <div class="info-item">
                <span class="info-label">I/O</span>
                <span class="info-value">${server.limits?.io || 500}</span>
              </div>
            </div>
          </div>
        </div>
      `;
      break;
      
    case 'build':
      content.innerHTML = `
        <div class="detail-card detail-card-wide">
          <h3>Build Configuration</h3>
          <form id="server-build-form" class="settings-form">
            <div class="form-grid">
              <div class="form-group">
                <label>Memory (MB)</label>
                <input type="number" name="memory" value="${server.limits?.memory || 1024}" required />
              </div>
              <div class="form-group">
                <label>Disk (MB)</label>
                <input type="number" name="disk" value="${server.limits?.disk || 5120}" required />
              </div>
              <div class="form-group">
                <label>CPU Limit (%)</label>
                <input type="number" name="cpu" value="${server.limits?.cpu || 100}" required />
              </div>
              <div class="form-group">
                <label>Swap (MB)</label>
                <input type="number" name="swap" value="${server.limits?.swap || 0}" />
              </div>
              <div class="form-group">
                <label>Block IO Weight</label>
                <input type="number" name="io" value="${server.limits?.io || 500}" min="10" max="1000" />
              </div>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">Update Build</button>
            </div>
          </form>
        </div>
      `;
      
      document.getElementById('server-build-form').onsubmit = async (e) => {
        e.preventDefault();
        const form = new FormData(e.target);
        const limits = {
          memory: parseInt(form.get('memory')),
          disk: parseInt(form.get('disk')),
          cpu: parseInt(form.get('cpu')),
          swap: parseInt(form.get('swap')),
          io: parseInt(form.get('io'))
        };
        
        try {
          await api(`/api/admin/servers/${server.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates: { limits } })
          });
          toast.success('Build configuration updated');
        } catch (e) {
          toast.error('Failed to update build configuration');
        }
      };
      break;
      
    case 'startup':
      content.innerHTML = `
        <div class="detail-card detail-card-wide">
          <h3>Startup Configuration</h3>
          <div class="info-grid">
            <div class="info-item full-width">
              <span class="info-label">Startup Command</span>
              <code class="info-value code">${escapeHtml(server.startup || 'Not configured')}</code>
            </div>
            <div class="info-item">
              <span class="info-label">Docker Image</span>
              <span class="info-value code">${escapeHtml(server.docker_image || 'Not set')}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Egg</span>
              <span class="info-value">${server.egg_id || 'Unknown'}</span>
            </div>
          </div>
        </div>
      `;
      break;
      
    case 'manage':
      content.innerHTML = `
        <div class="detail-card detail-card-wide">
          <h3>Server Management</h3>
          <div class="manage-actions">
            <div class="manage-action">
              <div class="manage-action-info">
                <h4>Open Server</h4>
                <p>Access the server console, files, and settings as an administrator.</p>
              </div>
              <a href="/server/${server.id}" class="btn btn-primary">
                <span class="material-icons-outlined">open_in_new</span>
                Open Server
              </a>
            </div>
            
            <div class="manage-action">
              <div class="manage-action-info">
                <h4>Reinstall Server</h4>
                <p>This will reinstall the server with the selected egg. All files will be deleted.</p>
              </div>
              <button class="btn btn-warning" id="reinstall-btn">Reinstall</button>
            </div>
            
            <div class="manage-action">
              <div class="manage-action-info">
                <h4>${server.suspended ? 'Unsuspend' : 'Suspend'} Server</h4>
                <p>${server.suspended ? 'Allow the server to be accessed again.' : 'Prevent the server from being accessed or started.'}</p>
              </div>
              <button class="btn ${server.suspended ? 'btn-success' : 'btn-warning'}" id="suspend-btn">
                ${server.suspended ? 'Unsuspend' : 'Suspend'}
              </button>
            </div>
            
            <div class="manage-action danger">
              <div class="manage-action-info">
                <h4>Delete Server</h4>
                <p>Permanently delete this server and all of its files. This action cannot be undone.</p>
              </div>
              <button class="btn btn-danger" id="delete-btn">Delete Server</button>
            </div>
          </div>
        </div>
      `;
      
      document.getElementById('reinstall-btn').onclick = async () => {
        if (!confirm('Are you sure? All server files will be deleted.')) return;
        try {
          await api(`/api/servers/${server.id}/reinstall`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
          });
          toast.success('Server reinstall initiated');
        } catch (e) {
          toast.error('Failed to reinstall server');
        }
      };
      
      document.getElementById('suspend-btn').onclick = async () => {
        const action = server.suspended ? 'unsuspend' : 'suspend';
        try {
          await api(`/api/servers/${server.id}/${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
          });
          toast.success(`Server ${action}ed`);
          navigateTo('servers', server.id, 'manage');
        } catch (e) {
          toast.error(`Failed to ${action} server`);
        }
      };
      
      document.getElementById('delete-btn').onclick = async () => {
        if (!confirm('Are you sure you want to delete this server? This cannot be undone.')) return;
        try {
          await api(`/api/admin/servers/${server.id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
          });
          navigateTo('servers');
        } catch (e) {
          toast.error('Failed to delete server');
        }
      };
      break;
  }
}

async function showCreateServerModal(username) {
  const [usersRes, nodesRes, eggsRes] = await Promise.all([
    api(`/api/admin/users?per_page=100`),
    api(`/api/admin/nodes?per_page=100`),
    api('/api/admin/eggs')
  ]);
  
  const [usersData, nodesData, eggsData] = await Promise.all([
    usersRes.json(),
    nodesRes.json(),
    eggsRes.json()
  ]);
  
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.innerHTML = `
    <div class="modal-backdrop" onclick="this.parentElement.remove()"></div>
    <div class="modal-content modal-large">
      <div class="modal-header">
        <h2>Create Server</h2>
        <button class="modal-close" onclick="this.closest('.modal').remove()">
          <span class="material-icons-outlined">close</span>
        </button>
      </div>
      <form id="create-server-form" class="modal-form">
        <div class="form-grid">
          <div class="form-group full-width">
            <label>Server Name</label>
            <input type="text" name="name" required />
          </div>
          <div class="form-group">
            <label>Owner</label>
            <select name="user_id" required>
              ${usersData.users.map(u => `<option value="${u.id}">${escapeHtml(u.username)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Node</label>
            <select name="node_id" required>
              ${nodesData.nodes.map(n => `<option value="${n.id}">${escapeHtml(n.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group full-width">
            <label>Egg</label>
            <select name="egg_id" required>
              ${eggsData.eggs.map(e => `<option value="${e.id}">${escapeHtml(e.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Memory (MB)</label>
            <input type="number" name="memory" value="1024" required />
          </div>
          <div class="form-group">
            <label>Disk (MB)</label>
            <input type="number" name="disk" value="5120" required />
          </div>
          <div class="form-group">
            <label>CPU Limit (%)</label>
            <input type="number" name="cpu" value="100" required />
          </div>
          <div class="form-group">
            <label>Allocation Port</label>
            <input type="number" name="allocation_port" value="25565" />
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" onclick="this.closest('.modal').remove()">Cancel</button>
          <button type="submit" class="btn btn-primary">Create Server</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  
  document.getElementById('create-server-form').onsubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const server = Object.fromEntries(form);
    
    try {
      await api('/api/admin/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server })
      });
      modal.remove();
      loadView();
    } catch (e) {
      toast.error('Failed to create server');
    }
  };
}

window.suspendServerAdmin = async function(serverId) {
  const username = localStorage.getItem('username');
  try {
    const res = await api(`/api/servers/${serverId}/suspend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (res.ok) {
      loadView();
    } else {
      const data = await res.json();
      toast.error(data.error || 'Failed to suspend');
    }
  } catch (e) {
    toast.error('Failed to suspend');
  }
};

window.unsuspendServerAdmin = async function(serverId) {
  const username = localStorage.getItem('username');
  try {
    const res = await api(`/api/servers/${serverId}/unsuspend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (res.ok) {
      loadView();
    } else {
      const data = await res.json();
      toast.error(data.error || 'Failed to unsuspend');
    }
  } catch (e) {
    toast.error('Failed to unsuspend');
  }
};

window.deleteServerAdmin = async function(serverId) {
  if (!confirm('Are you sure? This will delete the server from the node.')) return;
  const username = localStorage.getItem('username');
  try {
    await api(`/api/admin/servers/${serverId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    loadView();
  } catch (e) {
    toast.error('Failed to delete server');
  }
};

// ============== USERS ==============

async function renderUsersList(container, username) {
  try {
    const res = await api(`/api/admin/users?page=${currentPage.users}&per_page=${itemsPerPage.users}`);
    const data = await res.json();
    
    container.innerHTML = `
      <div class="admin-header">
        ${renderBreadcrumb([{ label: 'Users' }])}
      </div>
      
      <div class="admin-list">
        ${data.users.length === 0 ? `
          <div class="empty-state">
            <span class="material-icons-outlined">people</span>
            <h3>No Users</h3>
            <p>No users have been created yet</p>
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
    
    setupBreadcrumbListeners();
    setupPaginationListeners('users');
    
    document.querySelectorAll('.clickable-row[data-id], .list-card[data-id]').forEach(el => {
      el.onclick = () => navigateTo('users', el.dataset.id);
    });
    
  } catch (e) {
    container.innerHTML = `<div class="error">Failed to load users</div>`;
  }
}

async function renderUserDetail(container, username, userId) {
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
        <button class="detail-tab ${currentView.subTab === 'overview' ? 'active' : ''}" data-subtab="overview">Overview</button>
        <button class="detail-tab ${currentView.subTab === 'servers' ? 'active' : ''}" data-subtab="servers">Servers</button>
        <button class="detail-tab ${currentView.subTab === 'permissions' ? 'active' : ''}" data-subtab="permissions">Permissions</button>
        <button class="detail-tab ${currentView.subTab === 'limits' ? 'active' : ''}" data-subtab="limits">Resource Limits</button>
      </div>
      
      <div class="detail-content" id="user-detail-content"></div>
    `;
    
    setupBreadcrumbListeners();
    
    document.querySelectorAll('.detail-tab').forEach(tab => {
      tab.onclick = async () => {
        currentView.subTab = tab.dataset.subtab;
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
  
  switch (currentView.subTab) {
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

// ============== NESTS ==============

function renderAdminEggIcon(egg) {
  if (!egg.icon) {
    return '<span class="material-icons-outlined">egg_alt</span>';
  }
  
  // Check if it's a Material Icon name (no slashes, no dots)
  if (!egg.icon.includes('/') && !egg.icon.includes('.')) {
    return `<span class="material-icons-outlined">${escapeHtml(egg.icon)}</span>`;
  }
  
  // It's a URL (image)
  if (egg.icon.startsWith('http') || egg.icon.startsWith('/') || egg.icon.includes('.')) {
    return `<img src="${escapeHtml(egg.icon)}" alt="${escapeHtml(egg.name)}" onerror="this.outerHTML='<span class=\\'material-icons-outlined\\'>egg_alt</span>'" />`;
  }
  
  return '<span class="material-icons-outlined">egg_alt</span>';
}

async function renderNestsList(container, username) {
  try {
    const res = await api('/api/admin/nests');
    const data = await res.json();
    const nests = data.nests || [];
    
    container.innerHTML = `
      <div class="admin-header">
        ${renderBreadcrumb([{ label: 'Nests & Eggs' }])}
        <div class="admin-header-actions">
          <button class="btn btn-ghost" id="create-nest-btn">
            <span class="material-icons-outlined">create_new_folder</span>
            Create Nest
          </button>
          ${nests.length > 0 ? `
            <button class="btn btn-ghost" id="create-egg-btn">
              <span class="material-icons-outlined">add</span>
              New Egg
            </button>
            <button class="btn btn-primary" id="import-egg-btn">
              <span class="material-icons-outlined">upload</span>
              Import Egg
            </button>
          ` : ''}
        </div>
      </div>
      
      <div class="admin-list">
        ${nests.length === 0 ? `
          <div class="empty-state">
            <span class="material-icons-outlined">egg</span>
            <h3>No Nests</h3>
            <p>Create a nest to organize your eggs</p>
          </div>
        ` : `
          <div class="nests-list">
            ${nests.map(nest => `
              <div class="nest-card">
                <div class="nest-header">
                  <div class="nest-info">
                    <h3>${escapeHtml(nest.name)}</h3>
                    <p>${escapeHtml(nest.description || 'No description')}</p>
                  </div>
                  <div class="nest-actions">
                    <button class="btn btn-sm btn-ghost" onclick="editNestAdmin('${nest.id}')" title="Edit Nest">
                      <span class="material-icons-outlined">edit</span>
                    </button>
                    <button class="btn btn-sm btn-ghost" onclick="addEggToNestAdmin('${nest.id}')" title="Add Egg">
                      <span class="material-icons-outlined">add</span>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteNestAdmin('${nest.id}')" title="Delete Nest">
                      <span class="material-icons-outlined">delete</span>
                    </button>
                  </div>
                </div>
                <div class="eggs-grid">
                  ${(nest.eggs || []).length === 0 ? `
                    <div class="empty-eggs">No eggs in this nest</div>
                  ` : (nest.eggs || []).map(egg => `
                    <div class="egg-card clickable" data-egg-id="${egg.id}">
                      <div class="egg-icon">
                        ${renderAdminEggIcon(egg)}
                      </div>
                      <div class="egg-info">
                        <h4>${escapeHtml(egg.name)}${egg.admin_only ? '<span class="admin-badge">Admin</span>' : ''}</h4>
                        <span class="egg-author">${escapeHtml(egg.author || 'Unknown')}</span>
                      </div>
                      <div class="egg-meta">
                        <span class="egg-vars-count" title="Variables">${(egg.variables || []).length} vars</span>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
    
    setupBreadcrumbListeners();
    
    document.getElementById('create-nest-btn').onclick = () => showNestModal(username);
    
    const createEggBtn = document.getElementById('create-egg-btn');
    if (createEggBtn) {
      createEggBtn.onclick = () => showQuickEggModal(username, nests);
    }
    
    const importBtn = document.getElementById('import-egg-btn');
    if (importBtn) {
      importBtn.onclick = () => showImportEggModal(username, nests);
    }
    
    // Click on egg card to open detail view
    document.querySelectorAll('.egg-card.clickable').forEach(card => {
      card.onclick = () => navigateTo('eggs', card.dataset.eggId);
    });
    
  } catch (e) {
    container.innerHTML = `<div class="error">Failed to load nests</div>`;
  }
}

function showNestModal(username, nest = null) {
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.innerHTML = `
    <div class="modal-backdrop" onclick="this.parentElement.remove()"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h2>${nest ? 'Edit Nest' : 'Create Nest'}</h2>
        <button class="modal-close" onclick="this.closest('.modal').remove()">
          <span class="material-icons-outlined">close</span>
        </button>
      </div>
      <form id="nest-form" class="modal-form">
        <div class="form-group">
          <label>Name</label>
          <input type="text" name="name" value="${nest ? escapeHtml(nest.name) : ''}" required />
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea name="description" rows="3">${nest ? escapeHtml(nest.description || '') : ''}</textarea>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" onclick="this.closest('.modal').remove()">Cancel</button>
          <button type="submit" class="btn btn-primary">${nest ? 'Save' : 'Create'}</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  
  document.getElementById('nest-form').onsubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const nestData = {
      name: form.get('name'),
      description: form.get('description')
    };
    
    try {
      if (nest) {
        await api(`/api/admin/nests/${nest.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nest: nestData })
        });
      } else {
        await api('/api/admin/nests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nest: nestData })
        });
      }
      modal.remove();
      loadView();
    } catch (e) {
      toast.error('Failed to save nest');
    }
  };
}

function showImportEggModal(username, nests) {
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.innerHTML = `
    <div class="modal-backdrop" onclick="this.parentElement.remove()"></div>
    <div class="modal-content modal-large">
      <div class="modal-header">
        <h2>Import Egg</h2>
        <button class="modal-close" onclick="this.closest('.modal').remove()">
          <span class="material-icons-outlined">close</span>
        </button>
      </div>
      <form id="import-egg-form" class="modal-form">
        <div class="form-group">
          <label>Target Nest</label>
          <select name="nest_id" required>
            ${nests.map(n => `<option value="${n.id}">${escapeHtml(n.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Egg JSON</label>
          <textarea name="eggJson" rows="12" placeholder="Paste Pterodactyl egg JSON here..." required></textarea>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" onclick="this.closest('.modal').remove()">Cancel</button>
          <button type="submit" class="btn btn-primary">Import</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  
  document.getElementById('import-egg-form').onsubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    
    try {
      const res = await api('/api/admin/eggs/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          nest_id: form.get('nest_id'),
          eggJson: form.get('eggJson')
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        modal.remove();
        loadView();
        toast.success('Egg imported successfully');
      } else {
        toast.error(data.error || 'Failed to import egg');
      }
    } catch (e) {
      toast.error('Failed to import egg');
    }
  };
}

window.editNestAdmin = async function(nestId) {
  const res = await api('/api/admin/nests');
  const data = await res.json();
  const nest = data.nests.find(n => n.id === nestId);
  if (nest) {
    showNestModal(localStorage.getItem('username'), nest);
  }
};

window.deleteNestAdmin = async function(nestId) {
  if (!confirm('Delete this nest and all its eggs?')) return;
  const username = localStorage.getItem('username');
  
  try {
    await api(`/api/admin/nests/${nestId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    loadView();
  } catch (e) {
    toast.error('Failed to delete nest');
  }
};

window.addEggToNestAdmin = async function(nestId) {
  const res = await api('/api/admin/nests');
  const data = await res.json();
  showEggModal(localStorage.getItem('username'), data.nests, nestId);
};

window.editEggAdmin = function(eggId) {
  navigateTo('eggs', eggId);
};

window.deleteEggAdmin = async function(eggId) {
  if (!confirm('Delete this egg?')) return;
  const username = localStorage.getItem('username');
  
  try {
    await api(`/api/admin/eggs/${eggId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    loadView();
  } catch (e) {
    toast.error('Failed to delete egg');
  }
};

function showEggModal(username, nests, selectedNestId, egg = null) {
  let dockerImagesText = '';
  if (egg?.docker_images && typeof egg.docker_images === 'object') {
    dockerImagesText = Object.entries(egg.docker_images).map(([k, v]) => `${k}|${v}`).join('\n');
  } else if (egg?.docker_image) {
    dockerImagesText = egg.docker_image;
  }
  
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.innerHTML = `
    <div class="modal-backdrop" onclick="this.parentElement.remove()"></div>
    <div class="modal-content modal-large">
      <div class="modal-header">
        <h2>${egg ? 'Edit Egg' : 'Create Egg'}</h2>
        <button class="modal-close" onclick="this.closest('.modal').remove()">
          <span class="material-icons-outlined">close</span>
        </button>
      </div>
      <form id="egg-form" class="modal-form">
        <div class="form-grid">
          <div class="form-group">
            <label>Name</label>
            <input type="text" name="name" value="${egg ? escapeHtml(egg.name) : ''}" required />
          </div>
          <div class="form-group">
            <label>Nest</label>
            <select name="nest_id" required>
              ${nests.map(n => `<option value="${n.id}" ${n.id === selectedNestId ? 'selected' : ''}>${escapeHtml(n.name)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea name="description" rows="2">${egg ? escapeHtml(egg.description || '') : ''}</textarea>
        </div>
        <div class="form-group">
          <label>Author</label>
          <input type="text" name="author" value="${egg ? escapeHtml(egg.author || '') : 'admin@sodium.local'}" />
        </div>
        <div class="form-group">
          <label>Docker Images</label>
          <p class="form-hint">One per line. Format: Label|image:tag</p>
          <textarea name="docker_images" rows="4" placeholder="Java 17|ghcr.io/pterodactyl/yolks:java_17">${dockerImagesText}</textarea>
        </div>
        <div class="form-group">
          <label>Startup Command</label>
          <textarea name="startup" rows="3" placeholder="java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar {{SERVER_JARFILE}}">${egg ? escapeHtml(egg.startup || '') : ''}</textarea>
        </div>
        <div class="form-group">
          <label>Stop Command</label>
          <input type="text" name="stop" value="${egg?.config?.stop || '^C'}" />
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" onclick="this.closest('.modal').remove()">Cancel</button>
          <button type="submit" class="btn btn-primary">${egg ? 'Save' : 'Create'}</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  
  document.getElementById('egg-form').onsubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    
    const dockerImagesRaw = form.get('docker_images');
    const docker_images = {};
    dockerImagesRaw.split('\n').filter(l => l.trim()).forEach(line => {
      const [label, image] = line.split('|').map(s => s.trim());
      if (label && image) {
        docker_images[label] = image;
      } else if (label) {
        docker_images[label] = label;
      }
    });
    
    const eggData = {
      name: form.get('name'),
      nest_id: form.get('nest_id'),
      description: form.get('description'),
      author: form.get('author'),
      docker_images,
      docker_image: Object.values(docker_images)[0] || '',
      startup: form.get('startup'),
      config: { stop: form.get('stop') || '^C' }
    };
    
    try {
      if (egg) {
        await api(`/api/admin/eggs/${egg.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ egg: eggData })
        });
      } else {
        await api('/api/admin/eggs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ egg: eggData })
        });
      }
      modal.remove();
      loadView();
    } catch (e) {
      toast.error('Failed to save egg');
    }
  };
}

function showQuickEggModal(username, nests) {
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.innerHTML = `
    <div class="modal-backdrop" onclick="this.parentElement.remove()"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h2>Create New Egg</h2>
        <button class="modal-close" onclick="this.closest('.modal').remove()">
          <span class="material-icons-outlined">close</span>
        </button>
      </div>
      <form id="quick-egg-form" class="modal-form">
        <div class="form-group">
          <label>Name</label>
          <input type="text" name="name" placeholder="e.g., Paper 1.20" required />
        </div>
        <div class="form-group">
          <label>Nest</label>
          <select name="nest_id" required>
            ${nests.map(n => `<option value="${n.id}">${escapeHtml(n.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Docker Image</label>
          <input type="text" name="docker_image" placeholder="ghcr.io/pterodactyl/yolks:java_17" required />
        </div>
        <div class="form-group">
          <label>Startup Command</label>
          <textarea name="startup" rows="2" placeholder="java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar server.jar" required></textarea>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" onclick="this.closest('.modal').remove()">Cancel</button>
          <button type="submit" class="btn btn-primary">Create</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  
  document.getElementById('quick-egg-form').onsubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    
    const eggData = {
      name: form.get('name'),
      nest_id: form.get('nest_id'),
      docker_images: { 'default': form.get('docker_image') },
      docker_image: form.get('docker_image'),
      startup: form.get('startup'),
      author: 'admin@sodium.local',
      config: { stop: '^C' },
      variables: []
    };
    
    try {
      const res = await api('/api/admin/eggs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ egg: eggData })
      });
      const data = await res.json();
      modal.remove();
      if (data.egg?.id) {
        navigateTo('eggs', data.egg.id);
      } else {
        loadView();
      }
    } catch (e) {
      toast.error('Failed to create egg');
    }
  };
}

// ============== EGG DETAIL ==============

async function renderEggDetail(container, username, eggId) {
  try {
    const res = await api(`/api/admin/eggs/${eggId}`);
    const data = await res.json();
    const egg = data.egg;
    
    if (!egg) {
      container.innerHTML = `<div class="error">Egg not found</div>`;
      return;
    }
    
    const nestsRes = await api('/api/admin/nests');
    const nestsData = await nestsRes.json();
    const nests = nestsData.nests || [];
    const currentNest = nests.find(n => n.id === egg.nest_id);
    
    container.innerHTML = `
      <div class="admin-header">
        ${renderBreadcrumb([
          { label: 'Nests & Eggs', onClick: 'list-nests' },
          { label: egg.name }
        ])}
        <div class="admin-header-actions">
          <button class="btn btn-ghost" id="export-egg-btn">
            <span class="material-icons-outlined">download</span>
            Export
          </button>
          <button class="btn btn-danger" id="delete-egg-btn">
            <span class="material-icons-outlined">delete</span>
            Delete
          </button>
        </div>
      </div>
      
      <div class="detail-tabs">
        <button class="detail-tab ${currentView.subTab === 'about' ? 'active' : ''}" data-subtab="about">About</button>
        <button class="detail-tab ${currentView.subTab === 'configuration' ? 'active' : ''}" data-subtab="configuration">Configuration</button>
        <button class="detail-tab ${currentView.subTab === 'variables' ? 'active' : ''}" data-subtab="variables">Variables</button>
        <button class="detail-tab ${currentView.subTab === 'install' ? 'active' : ''}" data-subtab="install">Install Script</button>
      </div>
      
      <div class="detail-content" id="egg-detail-content"></div>
    `;
    
    setupBreadcrumbListeners();
    
    document.querySelectorAll('.detail-tab').forEach(tab => {
      tab.onclick = () => {
        currentView.subTab = tab.dataset.subtab;
        document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        renderEggSubTab(egg, nests, username);
      };
    });
    
    document.getElementById('delete-egg-btn').onclick = async () => {
      if (!confirm('Are you sure you want to delete this egg? This cannot be undone.')) return;
      try {
        await api(`/api/admin/eggs/${eggId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        navigateTo('nests');
      } catch (e) {
        toast.error('Failed to delete egg');
      }
    };
    
    document.getElementById('export-egg-btn').onclick = () => {
      const exportData = {
        "_comment": "Exported from Sodium Panel",
        "meta": { "version": "PTDL_v2" },
        "exported_at": new Date().toISOString(),
        "name": egg.name,
        "author": egg.author || "admin@sodium.local",
        "description": egg.description || "",
        "docker_images": egg.docker_images || {},
        "startup": egg.startup,
        "config": egg.config || {},
        "scripts": {
          "installation": {
            "script": egg.install_script || "#!/bin/bash\necho 'No install script'",
            "container": egg.install_container || "alpine:3.18",
            "entrypoint": egg.install_entrypoint || "bash"
          }
        },
        "variables": (egg.variables || []).map(v => ({
          "name": v.name,
          "description": v.description || "",
          "env_variable": v.env_variable,
          "default_value": v.default_value || "",
          "user_viewable": v.user_viewable !== false,
          "user_editable": v.user_editable !== false,
          "rules": v.rules || "nullable|string"
        }))
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `egg-${egg.name.toLowerCase().replace(/\s+/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Egg exported');
    };
    
    renderEggSubTab(egg, nests, username);
    
  } catch (e) {
    container.innerHTML = `<div class="error">Failed to load egg</div>`;
  }
}

function renderEggSubTab(egg, nests, username) {
  const content = document.getElementById('egg-detail-content');
  
  switch (currentView.subTab) {
    case 'about':
      renderEggAboutTab(content, egg, nests, username);
      break;
    case 'configuration':
      renderEggConfigTab(content, egg, username);
      break;
    case 'variables':
      renderEggVariablesTab(content, egg, username);
      break;
    case 'install':
      renderEggInstallTab(content, egg, username);
      break;
    default:
      renderEggAboutTab(content, egg, nests, username);
  }
}

function renderEggAboutTab(content, egg, nests, username) {
  const dockerImagesText = egg.docker_images && typeof egg.docker_images === 'object'
    ? Object.entries(egg.docker_images).map(([k, v]) => `${k}|${v}`).join('\n')
    : egg.docker_image || '';
  
  content.innerHTML = `
    <div class="detail-card detail-card-wide">
      <h3>Egg Information</h3>
      <form id="egg-about-form" class="settings-form">
        <div class="form-grid">
          <div class="form-group">
            <label>Name</label>
            <input type="text" name="name" value="${escapeHtml(egg.name)}" required />
          </div>
          <div class="form-group">
            <label>Nest</label>
            <select name="nest_id" required>
              ${nests.map(n => `<option value="${n.id}" ${n.id === egg.nest_id ? 'selected' : ''}>${escapeHtml(n.name)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea name="description" rows="3">${escapeHtml(egg.description || '')}</textarea>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label>Author</label>
            <input type="text" name="author" value="${escapeHtml(egg.author || '')}" />
          </div>
          <div class="form-group">
            <label>Icon</label>
            <input type="text" name="icon" value="${escapeHtml(egg.icon || '')}" placeholder="egg_alt, terminal, or image URL" />
            <p class="form-hint">Material Icon name, image URL, or leave empty for default</p>
          </div>
        </div>
        <div class="form-group">
          <label>UUID</label>
          <input type="text" value="${egg.id}" readonly class="input-readonly" />
        </div>
        <div class="form-group">
          <label>Docker Images</label>
          <p class="form-hint">One per line. Format: Label|image:tag (e.g., Java 17|ghcr.io/pterodactyl/yolks:java_17)</p>
          <textarea name="docker_images" rows="4">${dockerImagesText}</textarea>
        </div>
        <div class="form-toggles">
          <label class="toggle-item">
            <input type="checkbox" name="admin_only" ${egg.admin_only ? 'checked' : ''} />
            <span class="toggle-content">
              <span class="toggle-title">Admin Only</span>
              <span class="toggle-desc">Only administrators can use this egg to create servers</span>
            </span>
          </label>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Save Changes</button>
        </div>
      </form>
    </div>
  `;
  
  document.getElementById('egg-about-form').onsubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    
    const dockerImagesRaw = form.get('docker_images');
    const docker_images = {};
    dockerImagesRaw.split('\n').filter(l => l.trim()).forEach(line => {
      const parts = line.split('|').map(s => s.trim());
      if (parts.length >= 2) {
        docker_images[parts[0]] = parts[1];
      } else if (parts[0]) {
        docker_images[parts[0]] = parts[0];
      }
    });
    
    try {
      await api(`/api/admin/eggs/${egg.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          egg: {
            name: form.get('name'),
            nest_id: form.get('nest_id'),
            description: form.get('description'),
            author: form.get('author'),
            icon: form.get('icon') || null,
            admin_only: form.get('admin_only') === 'on',
            docker_images,
            docker_image: Object.values(docker_images)[0] || egg.docker_image
          }
        })
      });
      toast.success('Egg updated');
      navigateTo('eggs', egg.id, 'about');
    } catch (e) {
      toast.error('Failed to update egg');
    }
  };
}

function renderEggConfigTab(content, egg, username) {
  const config = egg.config || {};
  const filesConfig = typeof config.files === 'string' ? config.files : JSON.stringify(config.files || {}, null, 2);
  const startupConfig = typeof config.startup === 'string' ? config.startup : JSON.stringify(config.startup || {}, null, 2);
  const logsConfig = typeof config.logs === 'string' ? config.logs : JSON.stringify(config.logs || {}, null, 2);
  
  content.innerHTML = `
    <div class="detail-grid">
      <div class="detail-card detail-card-wide">
        <h3>Startup Configuration</h3>
        <form id="egg-startup-form" class="settings-form">
          <div class="form-group">
            <label>Startup Command</label>
            <p class="form-hint">Use {{VARIABLE}} syntax for environment variables</p>
            <textarea name="startup" rows="3" class="code-textarea">${escapeHtml(egg.startup || '')}</textarea>
          </div>
          <div class="form-group">
            <label>Stop Command</label>
            <p class="form-hint">Command sent to stop the server (e.g., ^C, stop, quit)</p>
            <input type="text" name="stop" value="${escapeHtml(config.stop || '^C')}" />
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Save Startup Config</button>
          </div>
        </form>
      </div>
      
      <div class="detail-card detail-card-wide">
        <h3>Advanced Configuration (JSON)</h3>
        <form id="egg-advanced-form" class="settings-form">
          <div class="form-group">
            <label>Files Configuration</label>
            <p class="form-hint">Configuration file parsing rules</p>
            <textarea name="files" rows="6" class="code-textarea">${escapeHtml(filesConfig)}</textarea>
          </div>
          <div class="form-group">
            <label>Startup Detection</label>
            <p class="form-hint">Pattern to detect when server has started</p>
            <textarea name="startup_config" rows="4" class="code-textarea">${escapeHtml(startupConfig)}</textarea>
          </div>
          <div class="form-group">
            <label>Logs Configuration</label>
            <textarea name="logs" rows="4" class="code-textarea">${escapeHtml(logsConfig)}</textarea>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Save Advanced Config</button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  document.getElementById('egg-startup-form').onsubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    
    try {
      await api(`/api/admin/eggs/${egg.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          egg: {
            startup: form.get('startup'),
            config: { ...egg.config, stop: form.get('stop') }
          }
        })
      });
      toast.success('Startup config updated');
      navigateTo('eggs', egg.id, 'configuration');
    } catch (e) {
      toast.error('Failed to update config');
    }
  };
  
  document.getElementById('egg-advanced-form').onsubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    
    let files, startup_config, logs;
    try {
      files = JSON.parse(form.get('files') || '{}');
      startup_config = JSON.parse(form.get('startup_config') || '{}');
      logs = JSON.parse(form.get('logs') || '{}');
    } catch (err) {
      toast.error('Invalid JSON in configuration');
      return;
    }
    
    try {
      await api(`/api/admin/eggs/${egg.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          egg: {
            config: {
              ...egg.config,
              files: JSON.stringify(files),
              startup: JSON.stringify(startup_config),
              logs: JSON.stringify(logs)
            }
          }
        })
      });
      toast.success('Advanced config updated');
      navigateTo('eggs', egg.id, 'configuration');
    } catch (e) {
      toast.error('Failed to update config');
    }
  };
}

function renderEggVariablesTab(content, egg, username) {
  const variables = egg.variables || [];
  
  content.innerHTML = `
    <div class="detail-card detail-card-wide">
      <div class="card-header-flex">
        <h3>Environment Variables</h3>
        <button class="btn btn-primary btn-sm" id="add-variable-btn">
          <span class="material-icons-outlined">add</span>
          Add Variable
        </button>
      </div>
      <p class="card-description">Variables are passed to the server as environment variables and can be used in the startup command with {{VARIABLE}} syntax.</p>
      
      <div class="variables-list" id="variables-list">
        ${variables.length === 0 ? `
          <div class="empty-state small">
            <span class="material-icons-outlined">code</span>
            <p>No variables defined</p>
          </div>
        ` : variables.map((v, idx) => `
          <div class="variable-card" data-index="${idx}">
            <div class="variable-header">
              <div class="variable-title">
                <span class="variable-name">${escapeHtml(v.name)}</span>
                <code class="variable-env">\${${escapeHtml(v.env_variable)}}</code>
              </div>
              <div class="variable-actions">
                <button class="btn btn-xs btn-ghost edit-var-btn" data-index="${idx}">
                  <span class="material-icons-outlined">edit</span>
                </button>
                <button class="btn btn-xs btn-danger delete-var-btn" data-index="${idx}">
                  <span class="material-icons-outlined">delete</span>
                </button>
              </div>
            </div>
            <div class="variable-details">
              <p class="variable-desc">${escapeHtml(v.description || 'No description')}</p>
              <div class="variable-meta">
                <span><strong>Default:</strong> ${escapeHtml(v.default_value || '(empty)')}</span>
                <span><strong>Rules:</strong> ${escapeHtml(v.rules || 'nullable|string')}</span>
              </div>
              <div class="variable-flags">
                ${v.user_viewable !== false ? '<span class="flag success">Viewable</span>' : '<span class="flag">Hidden</span>'}
                ${v.user_editable !== false ? '<span class="flag success">Editable</span>' : '<span class="flag">Locked</span>'}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  document.getElementById('add-variable-btn').onclick = () => showVariableModal(egg, null, username);
  
  document.querySelectorAll('.edit-var-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.index);
      showVariableModal(egg, idx, username);
    };
  });
  
  document.querySelectorAll('.delete-var-btn').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm('Delete this variable?')) return;
      const idx = parseInt(btn.dataset.index);
      const newVars = [...variables];
      newVars.splice(idx, 1);
      
      try {
        await api(`/api/admin/eggs/${egg.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ egg: { variables: newVars } })
        });
        toast.success('Variable deleted');
        navigateTo('eggs', egg.id, 'variables');
      } catch (e) {
        toast.error('Failed to delete variable');
      }
    };
  });
}

function showVariableModal(egg, editIndex, username) {
  const isEdit = editIndex !== null;
  const variable = isEdit ? egg.variables[editIndex] : {};
  
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.innerHTML = `
    <div class="modal-backdrop" onclick="this.parentElement.remove()"></div>
    <div class="modal-content modal-large">
      <div class="modal-header">
        <h2>${isEdit ? 'Edit Variable' : 'Add Variable'}</h2>
        <button class="modal-close" onclick="this.closest('.modal').remove()">
          <span class="material-icons-outlined">close</span>
        </button>
      </div>
      <form id="variable-form" class="modal-form">
        <div class="form-grid">
          <div class="form-group">
            <label>Name</label>
            <input type="text" name="name" value="${escapeHtml(variable.name || '')}" placeholder="Server Memory" required />
          </div>
          <div class="form-group">
            <label>Environment Variable</label>
            <input type="text" name="env_variable" value="${escapeHtml(variable.env_variable || '')}" placeholder="SERVER_MEMORY" required pattern="[A-Z0-9_]+" title="Uppercase letters, numbers and underscores only" />
          </div>
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea name="description" rows="2" placeholder="Memory allocated to the server in MB">${escapeHtml(variable.description || '')}</textarea>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label>Default Value</label>
            <input type="text" name="default_value" value="${escapeHtml(variable.default_value || '')}" placeholder="1024" />
          </div>
          <div class="form-group">
            <label>Validation Rules</label>
            <input type="text" name="rules" value="${escapeHtml(variable.rules || 'nullable|string')}" placeholder="required|integer|min:128" />
          </div>
        </div>
        <div class="form-toggles">
          <label class="toggle-item">
            <input type="checkbox" name="user_viewable" ${variable.user_viewable !== false ? 'checked' : ''} />
            <span class="toggle-content">
              <span class="toggle-title">User Viewable</span>
              <span class="toggle-desc">Users can see this variable's value</span>
            </span>
          </label>
          <label class="toggle-item">
            <input type="checkbox" name="user_editable" ${variable.user_editable !== false ? 'checked' : ''} />
            <span class="toggle-content">
              <span class="toggle-title">User Editable</span>
              <span class="toggle-desc">Users can modify this variable's value</span>
            </span>
          </label>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" onclick="this.closest('.modal').remove()">Cancel</button>
          <button type="submit" class="btn btn-primary">${isEdit ? 'Save' : 'Add'}</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  
  document.getElementById('variable-form').onsubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    
    const newVar = {
      name: form.get('name'),
      env_variable: form.get('env_variable').toUpperCase(),
      description: form.get('description'),
      default_value: form.get('default_value'),
      rules: form.get('rules') || 'nullable|string',
      user_viewable: form.get('user_viewable') === 'on',
      user_editable: form.get('user_editable') === 'on'
    };
    
    const newVars = [...(egg.variables || [])];
    if (isEdit) {
      newVars[editIndex] = newVar;
    } else {
      newVars.push(newVar);
    }
    
    try {
      await api(`/api/admin/eggs/${egg.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ egg: { variables: newVars } })
      });
      modal.remove();
      toast.success(isEdit ? 'Variable updated' : 'Variable added');
      navigateTo('eggs', egg.id, 'variables');
    } catch (e) {
      toast.error('Failed to save variable');
    }
  };
}

function renderEggInstallTab(content, egg, username) {
  content.innerHTML = `
    <div class="detail-card detail-card-wide">
      <h3>Install Script</h3>
      <p class="card-description">This script runs when a server is first created to set up the environment.</p>
      <form id="egg-install-form" class="settings-form">
        <div class="form-grid">
          <div class="form-group">
            <label>Install Container</label>
            <p class="form-hint">Docker image used to run the install script</p>
            <input type="text" name="install_container" value="${escapeHtml(egg.install_container || 'alpine:3.18')}" />
          </div>
          <div class="form-group">
            <label>Install Entrypoint</label>
            <p class="form-hint">Command used to run the script (e.g., bash, ash, sh)</p>
            <input type="text" name="install_entrypoint" value="${escapeHtml(egg.install_entrypoint || 'bash')}" />
          </div>
        </div>
        <div class="form-group">
          <label>Install Script</label>
          <p class="form-hint">Shell script executed during server installation. Files are stored in /mnt/server</p>
          <textarea name="install_script" rows="20" class="code-textarea">${escapeHtml(egg.install_script || '#!/bin/bash\ncd /mnt/server\necho "No install script configured"')}</textarea>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Save Install Script</button>
        </div>
      </form>
    </div>
  `;
  
  document.getElementById('egg-install-form').onsubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    
    try {
      await api(`/api/admin/eggs/${egg.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          egg: {
            install_container: form.get('install_container'),
            install_entrypoint: form.get('install_entrypoint'),
            install_script: form.get('install_script')
          }
        })
      });
      toast.success('Install script updated');
      navigateTo('eggs', egg.id, 'install');
    } catch (e) {
      toast.error('Failed to update install script');
    }
  };
}

// ============== LOCATIONS ==============

async function renderLocationsList(container, username) {
  try {
    const res = await api('/api/admin/locations');
    const data = await res.json();
    
    container.innerHTML = `
      <div class="admin-header">
        ${renderBreadcrumb([{ label: 'Locations' }])}
        <div class="admin-header-actions">
          <button class="btn btn-primary" id="create-location-btn">
            <span class="material-icons-outlined">add</span>
            Create Location
          </button>
        </div>
      </div>
      
      <div class="admin-list">
        ${data.locations.length === 0 ? `
          <div class="empty-state">
            <span class="material-icons-outlined">location_on</span>
            <h3>No Locations</h3>
            <p>Create a location to organize your nodes</p>
          </div>
        ` : `
          <div class="locations-grid">
            ${data.locations.map(l => `
              <div class="location-card">
                <div class="location-icon">
                  <span class="material-icons-outlined">location_on</span>
                </div>
                <div class="location-info">
                  <h3>${escapeHtml(l.short)}</h3>
                  <p>${escapeHtml(l.long)}</p>
                </div>
                <div class="location-actions">
                  <button class="btn btn-sm btn-danger" onclick="deleteLocationAdmin('${l.id}')">
                    <span class="material-icons-outlined">delete</span>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
    
    setupBreadcrumbListeners();
    
    document.getElementById('create-location-btn').onclick = () => showLocationModal(username);
    
  } catch (e) {
    container.innerHTML = `<div class="error">Failed to load locations</div>`;
  }
}

function showLocationModal(username) {
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.innerHTML = `
    <div class="modal-backdrop" onclick="this.parentElement.remove()"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h2>Create Location</h2>
        <button class="modal-close" onclick="this.closest('.modal').remove()">
          <span class="material-icons-outlined">close</span>
        </button>
      </div>
      <form id="location-form" class="modal-form">
        <div class="form-group">
          <label>Short Code</label>
          <input type="text" name="short" placeholder="e.g., us, eu, asia" required />
        </div>
        <div class="form-group">
          <label>Full Name</label>
          <input type="text" name="long" placeholder="e.g., United States, Europe" required />
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" onclick="this.closest('.modal').remove()">Cancel</button>
          <button type="submit" class="btn btn-primary">Create</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  
  document.getElementById('location-form').onsubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    
    try {
      await api('/api/admin/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          location: {
            short: form.get('short'),
            long: form.get('long')
          }
        })
      });
      modal.remove();
      loadView();
    } catch (e) {
      toast.error('Failed to create location');
    }
  };
}

window.deleteLocationAdmin = async function(locationId) {
  if (!confirm('Delete this location?')) return;
  const username = localStorage.getItem('username');
  
  try {
    await api(`/api/admin/locations/${locationId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    loadView();
  } catch (e) {
    toast.error('Failed to delete location');
  }
};

// ============== SETTINGS ==============

async function renderSettingsPage(container, username) {
  try {
    const res = await api(`/api/admin/settings`);
    const data = await res.json();
    const config = data.config || {};
    
    container.innerHTML = `
      <div class="admin-header">
        ${renderBreadcrumb([{ label: 'Settings' }])}
      </div>
      
      <div class="settings-page">
        <form id="panel-settings-form" class="settings-form">
          <div class="detail-card">
            <h3>General Settings</h3>
            <div class="form-grid">
              <div class="form-group">
                <label>Panel Name</label>
                <input type="text" name="panel_name" value="${escapeHtml(config.panel?.name || 'Sodium Panel')}" />
              </div>
              <div class="form-group">
                <label>Panel URL</label>
                <input type="url" name="panel_url" value="${escapeHtml(config.panel?.url || '')}" placeholder="https://panel.example.com" />
              </div>
            </div>
          </div>
          
          <div class="detail-card">
            <h3>Registration</h3>
            <div class="form-toggles">
              <label class="toggle-item">
                <input type="checkbox" name="registration_enabled" ${config.registration?.enabled ? 'checked' : ''} />
                <span class="toggle-content">
                  <span class="toggle-title">Allow Registrations</span>
                  <span class="toggle-desc">Allow new users to register on the panel</span>
                </span>
              </label>
            </div>
          </div>
          
          <div class="detail-card">
            <h3>Features</h3>
            <div class="form-toggles">
              <label class="toggle-item">
                <input type="checkbox" name="subusers_enabled" ${config.features?.subusers !== false ? 'checked' : ''} />
                <span class="toggle-content">
                  <span class="toggle-title">Subusers</span>
                  <span class="toggle-desc">Allow users to share server access with others</span>
                </span>
              </label>
            </div>
          </div>
          
          <div class="detail-card">
            <h3>Default User Limits</h3>
            <p class="card-description">These limits are applied to new users when they register.</p>
            <div class="form-grid">
              <div class="form-group">
                <label>Max Servers</label>
                <input type="number" name="default_servers" value="${config.defaults?.servers || 2}" min="0" />
              </div>
              <div class="form-group">
                <label>Max Memory (MB)</label>
                <input type="number" name="default_memory" value="${config.defaults?.memory || 2048}" min="0" />
              </div>
              <div class="form-group">
                <label>Max Disk (MB)</label>
                <input type="number" name="default_disk" value="${config.defaults?.disk || 10240}" min="0" />
              </div>
              <div class="form-group">
                <label>Max CPU (%)</label>
                <input type="number" name="default_cpu" value="${config.defaults?.cpu || 200}" min="0" />
              </div>
            </div>
          </div>
          
          <div class="form-actions">
            <button type="submit" class="btn btn-primary btn-large">Save Settings</button>
          </div>
        </form>
      </div>
    `;
    
    setupBreadcrumbListeners();
    
    document.getElementById('panel-settings-form').onsubmit = async (e) => {
      e.preventDefault();
      const form = e.target;
      
      const newConfig = {
        panel: {
          name: form.panel_name.value,
          url: form.panel_url.value
        },
        registration: {
          enabled: form.registration_enabled.checked
        },
        features: {
          subusers: form.subusers_enabled.checked
        },
        defaults: {
          servers: parseInt(form.default_servers.value) || 2,
          memory: parseInt(form.default_memory.value) || 2048,
          disk: parseInt(form.default_disk.value) || 10240,
          cpu: parseInt(form.default_cpu.value) || 200
        }
      };
      
      try {
        const saveRes = await api('/api/admin/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config: newConfig })
        });
        
        if (saveRes.ok) {
          toast.success('Settings saved');
        } else {
          toast.error('Failed to save settings');
        }
      } catch (e) {
        toast.error('Failed to save settings');
      }
    };
    
  } catch (e) {
    container.innerHTML = `<div class="error">Failed to load settings</div>`;
  }
}

// ============== UTILITIES ==============

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function jsonToYaml(obj, indent = 0) {
  let yaml = '';
  const spaces = '  '.repeat(indent);
  
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      yaml += `${spaces}${key}: null\n`;
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      yaml += `${spaces}${key}:\n${jsonToYaml(value, indent + 1)}`;
    } else if (Array.isArray(value)) {
      yaml += `${spaces}${key}:\n`;
      value.forEach(item => {
        if (typeof item === 'object') {
          yaml += `${spaces}  -\n${jsonToYaml(item, indent + 2)}`;
        } else {
          yaml += `${spaces}  - ${item}\n`;
        }
      });
    } else if (typeof value === 'string') {
      yaml += `${spaces}${key}: "${value}"\n`;
    } else {
      yaml += `${spaces}${key}: ${value}\n`;
    }
  }
  return yaml;
}

export function cleanupAdmin() {}
