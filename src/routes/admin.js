import { escapeHtml } from '../utils/security.js';

let currentTab = 'nodes';
let currentPage = { nodes: 1, servers: 1, users: 1 };
let itemsPerPage = { nodes: 10, servers: 10, users: 10 };

function renderPagination(meta, tab) {
  if (meta.total === 0) return '';
  
  // Generate page numbers
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
  // Page buttons (prev/next)
  document.querySelectorAll('.pagination .page-btn').forEach(btn => {
    btn.onclick = () => {
      const page = parseInt(btn.dataset.page);
      if (page >= 1) {
        currentPage[tab] = page;
        loadTab(tab);
      }
    };
  });
  
  // Page number buttons
  document.querySelectorAll('.pagination .page-num').forEach(btn => {
    btn.onclick = () => {
      const page = parseInt(btn.dataset.page);
      currentPage[tab] = page;
      loadTab(tab);
    };
  });
  
  // Per page selector
  const perPageSelect = document.querySelector('.per-page-select');
  if (perPageSelect) {
    perPageSelect.onchange = (e) => {
      itemsPerPage[tab] = parseInt(e.target.value);
      currentPage[tab] = 1;
      loadTab(tab);
    };
  }
  
  // Go to page input
  const gotoInput = document.querySelector('.goto-input');
  if (gotoInput) {
    gotoInput.onkeypress = (e) => {
      if (e.key === 'Enter') {
        let page = parseInt(gotoInput.value);
        const max = parseInt(gotoInput.max);
        if (page < 1) page = 1;
        if (page > max) page = max;
        currentPage[tab] = page;
        loadTab(tab);
      }
    };
  }
}

export async function renderAdmin() {
  const app = document.getElementById('app');
  const username = localStorage.getItem('username');
  const password = localStorage.getItem('password');
  
  app.innerHTML = '<div class="loading-spinner"></div>';
  
  try {
    const res = await fetch(`/api/auth/me?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`);
    const data = await res.json();
    
    if (!data.user?.isAdmin) {
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
      <div class="page-header">
        <h1>Admin Panel</h1>
      </div>
      
      <div class="admin-tabs">
        <button class="tab-btn active" data-tab="nodes" title="Nodes"><span class="material-icons-outlined">dns</span><span class="tab-label">Nodes</span></button>
        <button class="tab-btn" data-tab="servers" title="Servers"><span class="material-icons-outlined">storage</span><span class="tab-label">Servers</span></button>
        <button class="tab-btn" data-tab="users" title="Users"><span class="material-icons-outlined">people</span><span class="tab-label">Users</span></button>
        <button class="tab-btn" data-tab="nests" title="Nests & Eggs"><span class="material-icons-outlined">egg</span><span class="tab-label">Nests</span></button>
        <button class="tab-btn" data-tab="locations" title="Locations"><span class="material-icons-outlined">location_on</span><span class="tab-label">Locations</span></button>
        <button class="tab-btn" data-tab="settings" title="Panel Settings"><span class="material-icons-outlined">settings</span><span class="tab-label">Settings</span></button>
      </div>
      
      <div class="admin-content" id="admin-content">
        <div class="loading-spinner"></div>
      </div>
    </div>
  `;
  
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.dataset.tab;
      loadTab(currentTab);
    };
  });
  
  loadTab('nodes');
}

async function loadTab(tab) {
  const container = document.getElementById('admin-content');
  const username = localStorage.getItem('username');
  
  container.innerHTML = '<div class="loading-spinner"></div>';
  
  switch (tab) {
    case 'nodes':
      await loadNodes(container, username);
      break;
    case 'servers':
      await loadServersTab(container, username);
      break;
    case 'users':
      await loadUsers(container, username);
      break;
    case 'nests':
      await loadNests(container, username);
      break;
    case 'locations':
      await loadLocations(container, username);
      break;
    case 'settings':
      await loadPanelSettings(container, username);
      break;
  }
}

async function loadNodes(container, username) {
  try {
    const res = await fetch(`/api/admin/nodes?username=${encodeURIComponent(username)}&page=${currentPage.nodes}&per_page=${itemsPerPage.nodes}`);
    const data = await res.json();
    
    container.innerHTML = `
      <div class="admin-section">
        <div class="section-header">
          <h2>Nodes</h2>
          <button class="btn btn-primary" id="add-node-btn"><span class="material-icons-outlined">add</span> Add Node</button>
        </div>
        
        <div id="node-form" class="card form-card" style="display:none;">
          <h3>Create Node</h3>
          <form id="create-node-form">
            <div class="form-group">
              <label>Name</label>
              <input type="text" name="name" required />
            </div>
            <div class="form-row">
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
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Memory (MB)</label>
                <input type="number" name="memory" value="8192" required />
              </div>
              <div class="form-group">
                <label>Disk (MB)</label>
                <input type="number" name="disk" value="51200" required />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Daemon Port</label>
                <input type="number" name="daemon_port" value="8080" required />
              </div>
              <div class="form-group">
                <label>SFTP Port</label>
                <input type="number" name="daemon_sftp_port" value="2022" required />
              </div>
            </div>
            <div class="form-group">
              <label>Location</label>
              <select name="location_id" id="node-location"></select>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Port Range Start</label>
                <input type="number" name="allocation_start" value="25565" required />
              </div>
              <div class="form-group">
                <label>Port Range End</label>
                <input type="number" name="allocation_end" value="25665" required />
              </div>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">Create</button>
              <button type="button" class="btn btn-ghost" id="cancel-node">Cancel</button>
            </div>
          </form>
        </div>
        
        <div class="admin-table">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>FQDN</th>
                <th>Memory</th>
                <th>Disk</th>
                <th>Ports</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${data.nodes.length === 0 ? '<tr><td colspan="6" class="empty">No nodes</td></tr>' : ''}
              ${data.nodes.map(node => `
                <tr>
                  <td>${escapeHtml(node.name)}</td>
                  <td>${escapeHtml(node.fqdn)}</td>
                  <td>${node.memory} MB</td>
                  <td>${node.disk} MB</td>
                  <td>${node.allocation_start || 25565}-${node.allocation_end || 25665}</td>
                  <td>
                    <button class="btn btn-sm btn-ghost" onclick="editNode('${node.id}')">Edit</button>
                    <button class="btn btn-sm btn-ghost" onclick="showNodeConfig('${node.id}')">Config</button>
                    <button class="btn btn-sm btn-ghost" onclick="showDeployCommand('${node.id}')">Deploy</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteNode('${node.id}')">Delete</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        
        <div class="admin-cards">
          ${data.nodes.length === 0 ? '<div class="empty-state"><p>No nodes</p></div>' : ''}
          ${data.nodes.map(node => `
            <div class="admin-card">
              <div class="card-header">
                <h4>${escapeHtml(node.name)}</h4>
              </div>
              <div class="card-info">
                <div class="info-row">
                  <span class="label">FQDN</span>
                  <span class="value">${escapeHtml(node.fqdn)}</span>
                </div>
                <div class="info-row">
                  <span class="label">Memory</span>
                  <span class="value">${node.memory} MB</span>
                </div>
                <div class="info-row">
                  <span class="label">Disk</span>
                  <span class="value">${node.disk} MB</span>
                </div>
                <div class="info-row">
                  <span class="label">Port</span>
                  <span class="value">${node.daemon_port}</span>
                </div>
                <div class="info-row">
                  <span class="label">Ports</span>
                  <span class="value">${node.allocation_start || 25565}-${node.allocation_end || 25665}</span>
                </div>
              </div>
              <div class="card-actions">
                <button class="btn btn-sm btn-ghost" onclick="editNode('${node.id}')">Edit</button>
                <button class="btn btn-sm btn-ghost" onclick="showNodeConfig('${node.id}')">Config</button>
                <button class="btn btn-sm btn-ghost" onclick="showDeployCommand('${node.id}')">Deploy</button>
                <button class="btn btn-sm btn-danger" onclick="deleteNode('${node.id}')">Delete</button>
              </div>
            </div>
          `).join('')}
        </div>
        
        ${renderPagination(data.meta, 'nodes')}
      </div>
    `;
    
    setupPaginationListeners('nodes');
    
    const locRes = await fetch('/api/admin/locations');
    const locData = await locRes.json();
    document.getElementById('node-location').innerHTML = locData.locations.map(l => 
      `<option value="${l.id}">${escapeHtml(l.long)} (${escapeHtml(l.short)})</option>`
    ).join('');
    
    document.getElementById('add-node-btn').onclick = () => {
      document.getElementById('node-form').style.display = 'block';
    };
    
    document.getElementById('cancel-node').onclick = () => {
      document.getElementById('node-form').style.display = 'none';
    };
    
    document.getElementById('create-node-form').onsubmit = async (e) => {
      e.preventDefault();
      const form = new FormData(e.target);
      const node = Object.fromEntries(form);
      
      await fetch('/api/admin/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, node })
      });
      
      loadTab('nodes');
    };
  } catch (e) {
    container.innerHTML = `<div class="error">Failed to load nodes</div>`;
  }
}

window.editNode = async function(nodeId) {
  const username = localStorage.getItem('username');
  try {
    const res = await fetch(`/api/admin/nodes?username=${encodeURIComponent(username)}`);
    const data = await res.json();
    const node = data.nodes.find(n => n.id === nodeId);
    if (!node) return alert('Node not found');
    
    const locRes = await fetch('/api/admin/locations');
    const locData = await locRes.json();
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-backdrop" onclick="this.parentElement.remove()"></div>
      <div class="modal-content modal-large">
        <h2>Edit Node</h2>
        <form id="edit-node-form">
          <div class="form-group">
            <label>Name</label>
            <input type="text" name="name" value="${escapeHtml(node.name)}" required />
          </div>
          <div class="form-group">
            <label>Description</label>
            <input type="text" name="description" value="${escapeHtml(node.description || '')}" />
          </div>
          <div class="form-row">
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
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Memory (MB)</label>
              <input type="number" name="memory" value="${node.memory}" required />
            </div>
            <div class="form-group">
              <label>Disk (MB)</label>
              <input type="number" name="disk" value="${node.disk}" required />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Daemon Port</label>
              <input type="number" name="daemon_port" value="${node.daemon_port}" required />
            </div>
            <div class="form-group">
              <label>SFTP Port</label>
              <input type="number" name="daemon_sftp_port" value="${node.daemon_sftp_port}" required />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Upload Size (MB)</label>
              <input type="number" name="upload_size" value="${node.upload_size || 100}" />
            </div>
            <div class="form-group">
              <label>Location</label>
              <select name="location_id">
                ${locData.locations.map(l => `<option value="${l.id}" ${l.id === node.location_id ? 'selected' : ''}>${escapeHtml(l.long)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label><input type="checkbox" name="behind_proxy" ${node.behind_proxy ? 'checked' : ''} /> Behind Proxy</label>
            </div>
            <div class="form-group">
              <label><input type="checkbox" name="maintenance_mode" ${node.maintenance_mode ? 'checked' : ''} /> Maintenance Mode</label>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Port Range Start</label>
              <input type="number" name="allocation_start" value="${node.allocation_start || 25565}" required />
            </div>
            <div class="form-group">
              <label>Port Range End</label>
              <input type="number" name="allocation_end" value="${node.allocation_end || 25665}" required />
            </div>
          </div>
          <div class="modal-actions">
            <button type="submit" class="btn btn-primary">Save</button>
            <button type="button" class="btn btn-ghost" onclick="this.closest('.modal').remove()">Cancel</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('edit-node-form').onsubmit = async (e) => {
      e.preventDefault();
      const form = new FormData(e.target);
      const nodeData = Object.fromEntries(form);
      nodeData.behind_proxy = form.get('behind_proxy') === 'on';
      nodeData.maintenance_mode = form.get('maintenance_mode') === 'on';
      
      await fetch(`/api/admin/nodes/${nodeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, node: nodeData })
      });
      
      modal.remove();
      loadTab('nodes');
    };
  } catch (e) {
    alert('Failed to load node: ' + e.message);
  }
};

window.showDeployCommand = async function(nodeId) {
  const username = localStorage.getItem('username');
  try {
    const res = await fetch(`/api/admin/nodes/${nodeId}/deploy?username=${encodeURIComponent(username)}`);
    const data = await res.json();
    
    if (data.error) {
      alert(data.error);
      return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-backdrop" onclick="this.parentElement.remove()"></div>
      <div class="modal-content">
        <h2>Deploy Command</h2>
        <p>Run this command on your node to configure Wings:</p>
        <pre class="config-output" style="white-space:pre-wrap;word-break:break-all;">${escapeHtml(data.command)}</pre>
        <div class="modal-actions">
          <button class="btn btn-ghost" onclick="navigator.clipboard.writeText(this.closest('.modal').querySelector('.config-output').textContent);this.textContent='Copied!'">Copy</button>
          <button class="btn btn-primary" onclick="this.closest('.modal').remove()">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  } catch (e) {
    alert('Failed to load deploy command: ' + e.message);
  }
};

window.showNodeConfig = async function(nodeId) {
  const username = localStorage.getItem('username');
  try {
    const res = await fetch(`/api/admin/nodes/${nodeId}/config?username=${encodeURIComponent(username)}`);
    const data = await res.json();
    
    if (data.error) {
      alert(data.error);
      return;
    }
    
    const yamlConfig = jsonToYaml(data.config);
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-backdrop" onclick="this.parentElement.remove()"></div>
      <div class="modal-content">
        <h2>Wings Configuration</h2>
        <p>Copy this configuration to <code>/etc/pterodactyl/config.yml</code> on your node:</p>
        <pre class="config-output">${escapeHtml(yamlConfig)}</pre>
        <div class="modal-actions">
          <button class="btn btn-ghost" onclick="navigator.clipboard.writeText(this.closest('.modal').querySelector('.config-output').textContent);this.textContent='Copied!'">Copy</button>
          <button class="btn btn-primary" onclick="this.closest('.modal').remove()">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  } catch (e) {
    alert('Failed to load config: ' + e.message);
  }
};

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

window.deleteNode = async function(nodeId) {
  if (!confirm('Are you sure? This cannot be undone.')) return;
  const username = localStorage.getItem('username');
  
  try {
    await fetch(`/api/admin/nodes/${nodeId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    loadTab('nodes');
  } catch (e) {
    alert('Failed to delete node');
  }
};

async function loadServersTab(container, username) {
  try {
    const res = await fetch(`/api/admin/servers?username=${encodeURIComponent(username)}&page=${currentPage.servers}&per_page=${itemsPerPage.servers}`);
    const data = await res.json();
    
    container.innerHTML = `
      <div class="admin-section">
        <div class="section-header">
          <h2>Servers</h2>
          <button class="btn btn-primary" id="add-server-btn"><span class="material-icons-outlined">add</span> Create Server</button>
        </div>
        
        <div id="server-form" class="card form-card" style="display:none;">
          <h3>Create Server</h3>
          <form id="create-server-form">
            <div class="form-group">
              <label>Name</label>
              <input type="text" name="name" required />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Owner (User ID)</label>
                <select name="user_id" id="server-user"></select>
              </div>
              <div class="form-group">
                <label>Node</label>
                <select name="node_id" id="server-node"></select>
              </div>
            </div>
            <div class="form-group">
              <label>Egg</label>
              <select name="egg_id" id="server-egg"></select>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Memory (MB)</label>
                <input type="number" name="memory" value="1024" required />
              </div>
              <div class="form-group">
                <label>Disk (MB)</label>
                <input type="number" name="disk" value="5120" required />
              </div>
              <div class="form-group">
                <label>CPU (%)</label>
                <input type="number" name="cpu" value="100" required />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Allocation IP</label>
                <input type="text" name="allocation_ip" value="0.0.0.0" />
              </div>
              <div class="form-group">
                <label>Allocation Port</label>
                <input type="number" name="allocation_port" value="25565" />
              </div>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">Create</button>
              <button type="button" class="btn btn-ghost" id="cancel-server">Cancel</button>
            </div>
          </form>
        </div>
        
        <div class="admin-table">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Owner</th>
                <th>Resources</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${data.servers.length === 0 ? '<tr><td colspan="5" class="empty">No servers</td></tr>' : ''}
              ${data.servers.map(s => `
                <tr>
                  <td>${escapeHtml(s.name)}${s.suspended ? ' <span class="status-badge status-suspended">Suspended</span>' : ''}</td>
                  <td>${s.user_id?.substring(0, 8) || '--'}</td>
                  <td>${s.limits?.memory || 0}MB / ${s.limits?.disk || 0}MB / ${s.limits?.cpu || 0}%</td>
                  <td><span class="status-badge status-${s.status}">${s.status}</span></td>
                  <td>
                    ${s.suspended 
                      ? `<button class="btn btn-sm btn-success" onclick="unsuspendServer('${s.id}')">Unsuspend</button>` 
                      : `<button class="btn btn-sm btn-warning" onclick="suspendServer('${s.id}')">Suspend</button>`}
                    <button class="btn btn-sm btn-danger" onclick="deleteServer('${s.id}')">Delete</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        
        ${renderPagination(data.meta, 'servers')}
      </div>
    `;
    
    setupPaginationListeners('servers');
    
    const usersRes = await fetch(`/api/admin/users?username=${encodeURIComponent(username)}&per_page=100`);
    const usersData = await usersRes.json();
    document.getElementById('server-user').innerHTML = usersData.users.map(u => 
      `<option value="${u.id}">${escapeHtml(u.username)}</option>`
    ).join('');
    
    const nodesRes = await fetch(`/api/admin/nodes?username=${encodeURIComponent(username)}&per_page=100`);
    const nodesData = await nodesRes.json();
    document.getElementById('server-node').innerHTML = nodesData.nodes.map(n => 
      `<option value="${n.id}">${escapeHtml(n.name)}</option>`
    ).join('');
    
    const eggsRes = await fetch('/api/admin/eggs');
    const eggsData = await eggsRes.json();
    document.getElementById('server-egg').innerHTML = eggsData.eggs.map(e => 
      `<option value="${e.id}">${escapeHtml(e.name)}</option>`
    ).join('');
    
    document.getElementById('add-server-btn').onclick = () => {
      document.getElementById('server-form').style.display = 'block';
    };
    
    document.getElementById('cancel-server').onclick = () => {
      document.getElementById('server-form').style.display = 'none';
    };
    
    document.getElementById('create-server-form').onsubmit = async (e) => {
      e.preventDefault();
      const form = new FormData(e.target);
      const server = Object.fromEntries(form);
      
      await fetch('/api/admin/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, server })
      });
      
      loadTab('servers');
    };
  } catch (e) {
    container.innerHTML = `<div class="error">Failed to load servers</div>`;
  }
}

window.deleteServer = async function(serverId) {
  if (!confirm('Are you sure? This will delete the server from the node.')) return;
  const username = localStorage.getItem('username');
  
  try {
    await fetch(`/api/admin/servers/${serverId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    loadTab('servers');
  } catch (e) {
    alert('Failed to delete server');
  }
};

window.suspendServer = async function(serverId) {
  const username = localStorage.getItem('username');
  
  try {
    const res = await fetch(`/api/servers/${serverId}/suspend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    if (res.ok) {
      loadTab('servers');
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to suspend server');
    }
  } catch (e) {
    alert('Failed to suspend server');
  }
};

window.unsuspendServer = async function(serverId) {
  const username = localStorage.getItem('username');
  
  try {
    const res = await fetch(`/api/servers/${serverId}/unsuspend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    if (res.ok) {
      loadTab('servers');
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to unsuspend server');
    }
  } catch (e) {
    alert('Failed to unsuspend server');
  }
};

async function loadUsers(container, username) {
  try {
    const res = await fetch(`/api/admin/users?username=${encodeURIComponent(username)}&page=${currentPage.users}&per_page=${itemsPerPage.users}`);
    const data = await res.json();
    
    container.innerHTML = `
      <div class="admin-section">
        <div class="section-header">
          <h2>Users</h2>
        </div>
        
        <div class="admin-table">
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Display Name</th>
                <th>Admin</th>
                <th>Limits</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${data.users.map(u => `
                <tr>
                  <td>${escapeHtml(u.username)}</td>
                  <td>${escapeHtml(u.displayName || u.username)}</td>
                  <td>${u.isAdmin ? '✓' : '✗'}</td>
                  <td>${u.limits ? `${u.limits.servers} servers, ${u.limits.memory}MB` : 'Default'}</td>
                  <td>
                    <button class="btn btn-sm btn-ghost" onclick="toggleAdmin('${u.id}', ${!u.isAdmin})">${u.isAdmin ? 'Remove Admin' : 'Make Admin'}</button>
                    <button class="btn btn-sm btn-ghost" onclick="editUserLimits('${u.id}')">Edit Limits</button>
                    <button class="btn btn-sm btn-ghost" onclick="toggleSubusers('${u.id}', ${u.allowSubusers === false})">${u.allowSubusers === false ? 'Enable Subusers' : 'Disable Subusers'}</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        
        <div class="admin-cards">
          ${data.users.map(u => `
            <div class="admin-card">
              <div class="card-header">
                <h4>${escapeHtml(u.username)}</h4>
                <span class="status ${u.isAdmin ? 'status-online' : ''}">${u.isAdmin ? 'Admin' : 'User'}</span>
              </div>
              <div class="card-info">
                <div class="info-row">
                  <span class="label">Display Name</span>
                  <span class="value">${escapeHtml(u.displayName || u.username)}</span>
                </div>
                <div class="info-row">
                  <span class="label">Limits</span>
                  <span class="value">${u.limits ? `${u.limits.servers} servers` : 'Default'}</span>
                </div>
              </div>
              <div class="card-actions">
                <button class="btn btn-sm btn-ghost" onclick="toggleAdmin('${u.id}', ${!u.isAdmin})">${u.isAdmin ? 'Remove Admin' : 'Make Admin'}</button>
                <button class="btn btn-sm btn-ghost" onclick="editUserLimits('${u.id}')">Limits</button>
              </div>
            </div>
          `).join('')}
        </div>
        
        ${renderPagination(data.meta, 'users')}
      </div>
    `;
    
    setupPaginationListeners('users');
  } catch (e) {
    container.innerHTML = `<div class="error">Failed to load users</div>`;
  }
}

window.toggleAdmin = async function(userId, makeAdmin) {
  const username = localStorage.getItem('username');
  
  await fetch(`/api/admin/users/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, updates: { isAdmin: makeAdmin } })
  });
  
  loadTab('users');
};

window.editUserLimits = async function(userId) {
  const limits = {
    servers: parseInt(prompt('Max servers:', '2')) || 2,
    memory: parseInt(prompt('Max memory (MB):', '2048')) || 2048,
    disk: parseInt(prompt('Max disk (MB):', '10240')) || 10240,
    cpu: parseInt(prompt('Max CPU (%):', '200')) || 200
  };
  
  const username = localStorage.getItem('username');
  
  await fetch(`/api/admin/users/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, updates: { limits } })
  });
  
  loadTab('users');
};

window.toggleSubusers = async function(userId, allow) {
  const username = localStorage.getItem('username');
  
  await fetch(`/api/admin/users/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, updates: { allowSubusers: allow } })
  });
  
  loadTab('users');
};

async function loadNests(container, username) {
  try {
    const res = await fetch('/api/admin/nests');
    const data = await res.json();
    const nests = data.nests || [];
    const hasNests = nests.length > 0;
    
    container.innerHTML = `
      <div class="admin-section">
        <div class="section-header">
          <h2>Nests & Eggs</h2>
          <div>
            <button class="btn btn-ghost" id="add-nest-btn"><span class="material-icons-outlined">create_new_folder</span> Add Nest</button>
            ${hasNests ? `<button class="btn btn-primary" id="import-egg-btn"><span class="material-icons-outlined">upload</span> Import Egg</button>` : ''}
          </div>
        </div>
        
        <div id="nest-form" class="card form-card" style="display:none;">
          <h3 id="nest-form-title">Create Nest</h3>
          <form id="create-nest-form">
            <input type="hidden" name="nest_id" id="nest-id" />
            <div class="form-group">
              <label>Name</label>
              <input type="text" name="name" id="nest-name" required />
            </div>
            <div class="form-group">
              <label>Description</label>
              <textarea name="description" id="nest-description" rows="3"></textarea>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary" id="nest-submit-btn">Create</button>
              <button type="button" class="btn btn-ghost" id="cancel-nest">Cancel</button>
            </div>
          </form>
        </div>
        
        <div id="import-egg-form" class="card form-card" style="display:none;">
          <h3>Import Pterodactyl Egg</h3>
          <form id="egg-import-form">
            <div class="form-group">
              <label>Target Nest</label>
              <select name="nest_id" id="import-nest-select" required>
                ${nests.map(n => `<option value="${n.id}">${escapeHtml(n.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Egg JSON</label>
              <textarea name="eggJson" rows="10" placeholder="Paste Pterodactyl egg JSON here..."></textarea>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">Import</button>
              <button type="button" class="btn btn-ghost" id="cancel-import">Cancel</button>
            </div>
          </form>
        </div>
        
        <div id="egg-form" class="card form-card" style="display:none;">
          <h3 id="egg-form-title">Create Egg</h3>
          <form id="create-egg-form">
            <input type="hidden" name="egg_id" id="egg-id" />
            <div class="form-row">
              <div class="form-group">
                <label>Name</label>
                <input type="text" name="name" id="egg-name" required />
              </div>
              <div class="form-group">
                <label>Nest</label>
                <select name="nest_id" id="egg-nest-select" required>
                  ${nests.map(n => `<option value="${n.id}">${escapeHtml(n.name)}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>Description</label>
              <textarea name="description" id="egg-description" rows="2"></textarea>
            </div>
            <div class="form-group">
              <label>Author</label>
              <input type="text" name="author" id="egg-author" value="admin@sodium.local" />
            </div>
            <div class="form-group">
              <label>Docker Images</label>
              <p class="form-hint">One per line. Format: Label|image:tag (e.g., Java 17|ghcr.io/pterodactyl/yolks:java_17)</p>
              <textarea name="docker_images" id="egg-docker-images" rows="4" placeholder="Java 17|ghcr.io/pterodactyl/yolks:java_17"></textarea>
            </div>
            <div class="form-group">
              <label>Startup Command</label>
              <textarea name="startup" id="egg-startup" rows="3" placeholder="java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar {{SERVER_JARFILE}}"></textarea>
            </div>
            <div class="form-group">
              <label>Stop Command</label>
              <input type="text" name="stop" id="egg-stop" value="^C" />
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary" id="egg-submit-btn">Create</button>
              <button type="button" class="btn btn-ghost" id="cancel-egg">Cancel</button>
            </div>
          </form>
        </div>
        
        ${!hasNests ? `
          <div class="empty-state card">
            <span class="material-icons-outlined icon">folder_off</span>
            <h3>No Nests</h3>
            <p>Create a nest first to organize your eggs</p>
          </div>
        ` : `
          <div class="nests-grid">
            ${nests.map(nest => `
              <div class="nest-card card">
                <div class="nest-header">
                  <h3>${escapeHtml(nest.name)}</h3>
                  <div class="nest-actions">
                    <button class="btn btn-sm btn-ghost" onclick="editNest('${nest.id}')"><span class="material-icons-outlined">edit</span></button>
                    <button class="btn btn-sm btn-ghost" onclick="addEggToNest('${nest.id}')"><span class="material-icons-outlined">add</span></button>
                    <button class="btn btn-sm btn-danger" onclick="deleteNest('${nest.id}')"><span class="material-icons-outlined">delete</span></button>
                  </div>
                </div>
                <p class="nest-description">${escapeHtml(nest.description || '')}</p>
                <div class="eggs-list">
                  <h4>Eggs (${nest.eggs?.length || 0})</h4>
                  ${(nest.eggs || []).length === 0 ? '<div class="empty">No eggs in this nest</div>' : ''}
                  ${(nest.eggs || []).map(egg => `
                    <div class="egg-item">
                      <div class="egg-info">
                        <span class="egg-name">${escapeHtml(egg.name)}</span>
                        <span class="egg-images">${formatDockerImages(egg.docker_images, egg.docker_image)}</span>
                      </div>
                      <div class="egg-actions">
                        <button class="btn btn-xs btn-ghost" onclick="editEgg('${egg.id}')"><span class="material-icons-outlined">edit</span></button>
                        <button class="btn btn-xs btn-danger" onclick="deleteEgg('${egg.id}')"><span class="material-icons-outlined">delete</span></button>
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
    
    // Add Nest
    document.getElementById('add-nest-btn').onclick = () => {
      document.getElementById('nest-form').style.display = 'block';
      document.getElementById('nest-form-title').textContent = 'Create Nest';
      document.getElementById('nest-submit-btn').textContent = 'Create';
      document.getElementById('nest-id').value = '';
      document.getElementById('nest-name').value = '';
      document.getElementById('nest-description').value = '';
    };
    
    document.getElementById('cancel-nest').onclick = () => {
      document.getElementById('nest-form').style.display = 'none';
    };
    
    document.getElementById('create-nest-form').onsubmit = async (e) => {
      e.preventDefault();
      const nestId = document.getElementById('nest-id').value;
      const name = document.getElementById('nest-name').value;
      const description = document.getElementById('nest-description').value;
      
      if (nestId) {
        await fetch(`/api/admin/nests/${nestId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, nest: { name, description } })
        });
      } else {
        await fetch('/api/admin/nests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, nest: { name, description } })
        });
      }
      
      loadTab('nests');
    };
    
    // Import Egg
    const importBtn = document.getElementById('import-egg-btn');
    if (importBtn) {
      importBtn.onclick = () => {
        document.getElementById('import-egg-form').style.display = 'block';
      };
    }
    
    document.getElementById('cancel-import').onclick = () => {
      document.getElementById('import-egg-form').style.display = 'none';
    };
    
    document.getElementById('egg-import-form').onsubmit = async (e) => {
      e.preventDefault();
      const form = new FormData(e.target);
      const nestId = form.get('nest_id');
      const eggJson = form.get('eggJson');
      
      const res = await fetch('/api/admin/eggs/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, nest_id: nestId, eggJson })
      });
      
      const data = await res.json();
      if (res.ok) {
        loadTab('nests');
      } else {
        alert(data.error || 'Failed to import egg');
      }
    };
    
    // Create/Edit Egg form
    document.getElementById('cancel-egg').onclick = () => {
      document.getElementById('egg-form').style.display = 'none';
    };
    
    document.getElementById('create-egg-form').onsubmit = async (e) => {
      e.preventDefault();
      const eggId = document.getElementById('egg-id').value;
      const dockerImagesRaw = document.getElementById('egg-docker-images').value;
      
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
        name: document.getElementById('egg-name').value,
        nest_id: document.getElementById('egg-nest-select').value,
        description: document.getElementById('egg-description').value,
        author: document.getElementById('egg-author').value,
        docker_images,
        docker_image: Object.values(docker_images)[0] || '',
        startup: document.getElementById('egg-startup').value,
        config: {
          stop: document.getElementById('egg-stop').value || '^C'
        }
      };
      
      if (eggId) {
        await fetch(`/api/admin/eggs/${eggId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, egg: eggData })
        });
      } else {
        await fetch('/api/admin/eggs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, egg: eggData })
        });
      }
      
      loadTab('nests');
    };
    
  } catch (e) {
    console.error('Failed to load nests:', e);
    container.innerHTML = `<div class="error">Failed to load nests</div>`;
  }
}

function formatDockerImages(dockerImages, fallbackImage) {
  if (dockerImages && typeof dockerImages === 'object') {
    const keys = Object.keys(dockerImages);
    if (keys.length > 0) {
      return keys.length === 1 ? escapeHtml(keys[0]) : `${keys.length} images`;
    }
  }
  if (fallbackImage) {
    return escapeHtml(fallbackImage.split('/').pop() || fallbackImage);
  }
  return 'No image';
}

window.editNest = async function(nestId) {
  const res = await fetch('/api/admin/nests');
  const data = await res.json();
  const nest = data.nests.find(n => n.id === nestId);
  if (!nest) return;
  
  document.getElementById('nest-form').style.display = 'block';
  document.getElementById('nest-form-title').textContent = 'Edit Nest';
  document.getElementById('nest-submit-btn').textContent = 'Save';
  document.getElementById('nest-id').value = nest.id;
  document.getElementById('nest-name').value = nest.name;
  document.getElementById('nest-description').value = nest.description || '';
};

window.deleteNest = async function(nestId) {
  if (!confirm('Delete this nest and all its eggs?')) return;
  const username = localStorage.getItem('username');
  
  await fetch(`/api/admin/nests/${nestId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  });
  
  loadTab('nests');
};

window.addEggToNest = function(nestId) {
  document.getElementById('egg-form').style.display = 'block';
  document.getElementById('egg-form-title').textContent = 'Create Egg';
  document.getElementById('egg-submit-btn').textContent = 'Create';
  document.getElementById('egg-id').value = '';
  document.getElementById('egg-name').value = '';
  document.getElementById('egg-nest-select').value = nestId;
  document.getElementById('egg-description').value = '';
  document.getElementById('egg-author').value = 'admin@sodium.local';
  document.getElementById('egg-docker-images').value = '';
  document.getElementById('egg-startup').value = '';
  document.getElementById('egg-stop').value = '^C';
};

window.editEgg = async function(eggId) {
  const res = await fetch('/api/admin/nests');
  const data = await res.json();
  let egg = null;
  for (const nest of data.nests) {
    egg = (nest.eggs || []).find(e => e.id === eggId);
    if (egg) break;
  }
  if (!egg) return;
  
  let dockerImagesText = '';
  if (egg.docker_images && typeof egg.docker_images === 'object') {
    dockerImagesText = Object.entries(egg.docker_images).map(([k, v]) => `${k}|${v}`).join('\n');
  } else if (egg.docker_image) {
    dockerImagesText = egg.docker_image;
  }
  
  document.getElementById('egg-form').style.display = 'block';
  document.getElementById('egg-form-title').textContent = 'Edit Egg';
  document.getElementById('egg-submit-btn').textContent = 'Save';
  document.getElementById('egg-id').value = egg.id;
  document.getElementById('egg-name').value = egg.name;
  document.getElementById('egg-nest-select').value = egg.nest_id;
  document.getElementById('egg-description').value = egg.description || '';
  document.getElementById('egg-author').value = egg.author || '';
  document.getElementById('egg-docker-images').value = dockerImagesText;
  document.getElementById('egg-startup').value = egg.startup || '';
  document.getElementById('egg-stop').value = egg.config?.stop || '^C';
};

window.deleteEgg = async function(eggId) {
  if (!confirm('Delete this egg?')) return;
  const username = localStorage.getItem('username');
  
  await fetch(`/api/admin/eggs/${eggId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  });
  
  loadTab('nests');
};

async function loadLocations(container, username) {
  try {
    const res = await fetch('/api/admin/locations');
    const data = await res.json();
    
    container.innerHTML = `
      <div class="admin-section">
        <div class="section-header">
          <h2>Locations</h2>
          <button class="btn btn-primary" id="add-location-btn"><span class="material-icons-outlined">add</span> Add Location</button>
        </div>
        
        <div class="admin-table">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Short</th>
                <th>Long</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${data.locations.map(l => `
                <tr>
                  <td>${l.id}</td>
                  <td>${escapeHtml(l.short)}</td>
                  <td>${escapeHtml(l.long)}</td>
                  <td>
                    <button class="btn btn-sm btn-danger" onclick="deleteLocation('${l.id}')">Delete</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        
        <div class="admin-cards">
          ${data.locations.length === 0 ? '<div class="empty-state"><p>No locations</p></div>' : ''}
          ${data.locations.map(l => `
            <div class="admin-card">
              <div class="card-header">
                <h4>${escapeHtml(l.short)}</h4>
              </div>
              <div class="card-info">
                <div class="info-row">
                  <span class="label">Full Name</span>
                  <span class="value">${escapeHtml(l.long)}</span>
                </div>
                <div class="info-row">
                  <span class="label">ID</span>
                  <span class="value">${l.id}</span>
                </div>
              </div>
              <div class="card-actions">
                <button class="btn btn-sm btn-danger" onclick="deleteLocation('${l.id}')">Delete</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    
    document.getElementById('add-location-btn').onclick = async () => {
      const short = prompt('Short code (e.g., us, eu):');
      if (!short) return;
      const long = prompt('Full name:') || short;
      
      await fetch('/api/admin/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, location: { short, long } })
      });
      
      loadTab('locations');
    };
  } catch (e) {
    container.innerHTML = `<div class="error">Failed to load locations</div>`;
  }
}

window.deleteLocation = async function(locationId) {
  if (!confirm('Delete this location?')) return;
  const username = localStorage.getItem('username');
  
  await fetch(`/api/admin/locations/${locationId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  });
  
  loadTab('locations');
};

async function loadPanelSettings(container, username) {
  try {
    const res = await fetch(`/api/admin/settings?username=${encodeURIComponent(username)}`);
    const data = await res.json();
    const config = data.config || {};
    
    container.innerHTML = `
      <div class="admin-section">
        <div class="section-header">
          <h2>Panel Settings</h2>
        </div>
        
        <div class="card form-card">
          <form id="panel-settings-form">
            <h3>General</h3>
            <div class="form-row">
              <div class="form-group">
                <label>Panel Name</label>
                <input type="text" name="panel_name" value="${escapeHtml(config.panel?.name || 'Sodium Panel')}" />
              </div>
              <div class="form-group">
                <label>Panel URL</label>
                <input type="url" name="panel_url" value="${escapeHtml(config.panel?.url || '')}" placeholder="https://panel.example.com" />
              </div>
            </div>
            
            <h3>Registration</h3>
            <div class="form-group">
              <label class="toggle-label">
                <input type="checkbox" name="registration_enabled" ${config.registration?.enabled ? 'checked' : ''} />
                <span>Allow new user registrations</span>
              </label>
            </div>
            
            <h3>Features</h3>
            <div class="form-group">
              <label class="toggle-label">
                <input type="checkbox" name="subusers_enabled" ${config.features?.subusers !== false ? 'checked' : ''} />
                <span>Allow subusers (users can share server access)</span>
              </label>
            </div>
            
            <h3>Default User Limits</h3>
            <p class="form-hint">These limits are applied to new users when they register.</p>
            <div class="form-row">
              <div class="form-group">
                <label>Max Servers</label>
                <input type="number" name="default_servers" value="${config.defaults?.servers || 2}" min="0" />
              </div>
              <div class="form-group">
                <label>Memory (MB)</label>
                <input type="number" name="default_memory" value="${config.defaults?.memory || 2048}" min="0" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Disk (MB)</label>
                <input type="number" name="default_disk" value="${config.defaults?.disk || 10240}" min="0" />
              </div>
              <div class="form-group">
                <label>CPU (%)</label>
                <input type="number" name="default_cpu" value="${config.defaults?.cpu || 200}" min="0" />
              </div>
            </div>
            
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">Save Settings</button>
            </div>
          </form>
        </div>
      </div>
    `;
    
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
      
      const saveRes = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, config: newConfig })
      });
      
      if (saveRes.ok) {
        const btn = form.querySelector('button[type="submit"]');
        btn.textContent = 'Saved!';
        setTimeout(() => btn.textContent = 'Save Settings', 2000);
      }
    };
  } catch (e) {
    console.error('Failed to load settings:', e);
    container.innerHTML = `<div class="error">Failed to load panel settings</div>`;
  }
}

export function cleanupAdmin() {}
