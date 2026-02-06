import { escapeHtml } from '../../../utils/security.js';
import * as toast from '../../../utils/toast.js';
import * as modal from '../../../utils/modal.js';
import { api } from '../../../utils/api.js';
import { state } from '../state.js';
import { formatBytes, renderPagination, setupPaginationListeners, renderBreadcrumb, setupBreadcrumbListeners, jsonToYaml, renderSearchBox, setupSearchListeners } from '../utils/ui.js';

const navigateTo = (...args) => window.adminNavigate(...args);

export async function renderNodesList(container, username, loadView) {
  try {
    const search = state.searchQuery.nodes ? `&search=${encodeURIComponent(state.searchQuery.nodes)}` : '';
    const res = await api(`/api/admin/nodes?page=${state.currentPage.nodes}&per_page=${state.itemsPerPage.nodes}${search}`);
    const data = await res.json();
    
    container.innerHTML = `
      <div class="admin-header">
        ${renderBreadcrumb([{ label: 'Nodes' }])}
        ${renderSearchBox('nodes', 'Search by name, IP, or ID...')}
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
    
    setupBreadcrumbListeners(navigateTo);
    setupPaginationListeners('nodes', loadView);
    setupSearchListeners('nodes', loadView);
    
    document.querySelectorAll('.list-card[data-id]').forEach(card => {
      card.onclick = () => navigateTo('nodes', card.dataset.id);
    });
    
    document.getElementById('create-node-btn').onclick = () => createNewNode();
    
  } catch (e) {
    container.innerHTML = `<div class="error">Failed to load nodes</div>`;
  }
}

export async function renderNodeDetail(container, username, nodeId) {
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
        <button class="detail-tab ${state.currentView.subTab === 'about' ? 'active' : ''}" data-subtab="about">About</button>
        <button class="detail-tab ${state.currentView.subTab === 'settings' ? 'active' : ''}" data-subtab="settings">Settings</button>
        <button class="detail-tab ${state.currentView.subTab === 'configuration' ? 'active' : ''}" data-subtab="configuration">Configuration</button>
        <button class="detail-tab ${state.currentView.subTab === 'allocations' ? 'active' : ''}" data-subtab="allocations">Allocations</button>
      </div>
      
      <div class="detail-content" id="node-detail-content"></div>
    `;
    
    setupBreadcrumbListeners(navigateTo);
    
    document.querySelectorAll('.detail-tab').forEach(tab => {
      tab.onclick = () => {
        state.currentView.subTab = tab.dataset.subtab;
        document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        renderNodeSubTab(node, locData.locations, username);
      };
    });
    
    document.getElementById('delete-node-btn').onclick = async () => {
      const confirmed = await modal.confirm({ title: 'Delete Node', message: 'Are you sure you want to delete this node? This cannot be undone.', danger: true });
      if (!confirmed) return;
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
  
  switch (state.currentView.subTab) {
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
              <h4>Resource Overallocation</h4>
              <p class="form-hint">Allow the node to allocate more resources than physically available. Use with caution.</p>
              <div class="form-grid">
                <div class="form-group">
                  <label>Memory Overallocation (%)</label>
                  <input type="number" name="memory_overallocation" value="${node.memory_overallocation || 0}" min="0" max="100" />
                  <small class="form-hint">0% = No overallocation, 100% = Double the available memory</small>
                </div>
                <div class="form-group">
                  <label>Disk Overallocation (%)</label>
                  <input type="number" name="disk_overallocation" value="${node.disk_overallocation || 0}" min="0" max="100" />
                  <small class="form-hint">0% = No overallocation, 100% = Double the available disk</small>
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

async function createNewNode() {
  try {
    const locRes = await api('/api/admin/locations');
    const locData = await locRes.json();
    
    const node = {
      name: 'Untitled Node',
      fqdn: 'node.example.com',
      scheme: 'https',
      memory: 8192,
      disk: 51200,
      daemon_port: 8080,
      daemon_sftp_port: 2022,
      allocation_start: 25565,
      allocation_end: 25665,
      location_id: locData.locations[0]?.id || null
    };
    
    const res = await api('/api/admin/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ node })
    });
    
    const data = await res.json();
    if (data.node?.id) {
      navigateTo('nodes', data.node.id, 'about');
      toast.info('Configure your new node');
    } else {
      toast.error('Failed to create node');
    }
  } catch (e) {
    toast.error('Failed to create node');
  }
}
