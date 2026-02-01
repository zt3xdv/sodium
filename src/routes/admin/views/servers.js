import { escapeHtml } from '../../../utils/security.js';
import * as toast from '../../../utils/toast.js';
import { api } from '../../../utils/api.js';
import { state } from '../state.js';
import { renderPagination, setupPaginationListeners, renderBreadcrumb, setupBreadcrumbListeners, renderSearchBox, setupSearchListeners } from '../utils/ui.js';

const navigateTo = (...args) => window.adminNavigate(...args);

export async function renderServersList(container, username, loadView) {
  try {
    const search = state.searchQuery.servers ? `&search=${encodeURIComponent(state.searchQuery.servers)}` : '';
    const res = await api(`/api/admin/servers?page=${state.currentPage.servers}&per_page=${state.itemsPerPage.servers}${search}`);
    const data = await res.json();
    
    container.innerHTML = `
      <div class="admin-header">
        ${renderBreadcrumb([{ label: 'Servers' }])}
        ${renderSearchBox('servers', 'Search by name or ID...')}
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
            <p>No servers yet</p>
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
    
    setupBreadcrumbListeners(navigateTo);
    setupPaginationListeners('servers', loadView);
    setupSearchListeners('servers', loadView);
    
    document.querySelectorAll('.clickable-row[data-id], .list-card[data-id]').forEach(el => {
      el.onclick = () => navigateTo('servers', el.dataset.id);
    });
    
    document.getElementById('create-server-btn').onclick = () => createNewServer();
    
  } catch (e) {
    container.innerHTML = `<div class="error">Failed to load servers</div>`;
  }
}

export async function renderServerDetail(container, username, serverId) {
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
        <button class="detail-tab ${state.currentView.subTab === 'details' ? 'active' : ''}" data-subtab="details">Details</button>
        <button class="detail-tab ${state.currentView.subTab === 'build' ? 'active' : ''}" data-subtab="build">Build Configuration</button>
        <button class="detail-tab ${state.currentView.subTab === 'startup' ? 'active' : ''}" data-subtab="startup">Startup</button>
        <button class="detail-tab ${state.currentView.subTab === 'manage' ? 'active' : ''}" data-subtab="manage">Manage</button>
      </div>
      
      <div class="detail-content" id="server-detail-content"></div>
    `;
    
    setupBreadcrumbListeners(navigateTo);
    
    document.querySelectorAll('.detail-tab').forEach(tab => {
      tab.onclick = () => {
        state.currentView.subTab = tab.dataset.subtab;
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
  
  switch (state.currentView.subTab) {
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
                <span class="info-label">Node</span>
                <span class="info-value">${server.node_name || server.node_id || 'Unknown'}</span>
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
            <h3>Owner</h3>
            <div class="owner-section">
              <div class="current-owner">
                <span class="info-label">Current Owner</span>
                <span class="info-value" id="current-owner-display">${server.owner_username || server.user_id || 'Unknown'}</span>
              </div>
              <div class="owner-search">
                <label>Transfer to User</label>
                <div class="search-input-wrapper">
                  <input type="text" id="owner-search-input" placeholder="Search by username..." autocomplete="off" />
                  <div class="search-results" id="owner-search-results"></div>
                </div>
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
      
      setupOwnerSearch(server);
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
        <div class="detail-grid">
          <div class="detail-card">
            <h3>Current Configuration</h3>
            <div class="info-grid">
              <div class="info-item full-width">
                <span class="info-label">Startup Command</span>
                <code class="info-value code" id="current-startup-display">${escapeHtml(server.startup || 'Not configured')}</code>
              </div>
              <div class="info-item">
                <span class="info-label">Docker Image</span>
                <span class="info-value code" id="current-docker-display">${escapeHtml(server.docker_image || 'Not set')}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Egg ID</span>
                <span class="info-value code">${server.egg_id || 'Unknown'}</span>
              </div>
            </div>
          </div>
          
          <div class="detail-card">
            <h3>Change Egg</h3>
            <p class="card-description">Changing the egg will update the startup command and Docker image.</p>
            <div class="egg-section">
              <div class="current-egg">
                <span class="info-label">Current Egg</span>
                <span class="info-value" id="current-egg-display">Loading...</span>
              </div>
              <div class="egg-search">
                <label>Select New Egg</label>
                <div class="search-input-wrapper">
                  <input type="text" id="egg-search-input" placeholder="Search eggs..." autocomplete="off" />
                  <div class="search-results" id="egg-search-results"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      
      loadCurrentEgg(server);
      setupEggSearch(server);
      break;
      
    case 'manage':
      const isDraft = server.status === 'draft' || server.status === 'install_failed';
      content.innerHTML = `
        <div class="detail-card detail-card-wide">
          <h3>Server Management</h3>
          <div class="manage-actions">
            ${isDraft ? `
              <div class="manage-action highlight">
                <div class="manage-action-info">
                  <h4>Install Server</h4>
                  <p>${server.status === 'install_failed' 
                    ? `Previous installation failed: ${escapeHtml(server.install_error || 'Unknown error')}. Fix the configuration and try again.` 
                    : 'This server is configured but not yet installed. Click to install it on the node.'}</p>
                </div>
                <button class="btn btn-success" id="install-btn">
                  <span class="material-icons-outlined">play_arrow</span>
                  Install Now
                </button>
              </div>
            ` : `
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
            `}
            
            ${!isDraft ? `
              <div class="manage-action">
                <div class="manage-action-info">
                  <h4>Reinstall Server</h4>
                  <p>This will reinstall the server with the selected egg. All files will be deleted.</p>
                </div>
                <button class="btn btn-warning" id="reinstall-btn">Reinstall</button>
              </div>
            ` : ''}
            
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
      
      if (isDraft) {
        document.getElementById('install-btn').onclick = async () => {
          const btn = document.getElementById('install-btn');
          btn.disabled = true;
          btn.innerHTML = '<span class="material-icons-outlined rotating">sync</span> Installing...';
          
          try {
            const res = await api(`/api/admin/servers/${server.id}/install`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({})
            });
            
            if (res.ok) {
              toast.success('Server installation started');
              navigateTo('servers', server.id, 'manage');
            } else {
              const data = await res.json();
              toast.error(data.error || 'Installation failed');
              btn.disabled = false;
              btn.innerHTML = '<span class="material-icons-outlined">play_arrow</span> Install Now';
            }
          } catch (e) {
            toast.error('Failed to install server');
            btn.disabled = false;
            btn.innerHTML = '<span class="material-icons-outlined">play_arrow</span> Install Now';
          }
        };
      }
      
      const reinstallBtn = document.getElementById('reinstall-btn');
      if (reinstallBtn) {
        reinstallBtn.onclick = async () => {
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
      }
      
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

let ownerSearchTimeout = null;

function setupOwnerSearch(server) {
  const input = document.getElementById('owner-search-input');
  const resultsContainer = document.getElementById('owner-search-results');
  
  if (!input || !resultsContainer) return;
  
  input.oninput = () => {
    clearTimeout(ownerSearchTimeout);
    const query = input.value.trim();
    
    if (query.length < 2) {
      resultsContainer.innerHTML = '';
      resultsContainer.style.display = 'none';
      return;
    }
    
    ownerSearchTimeout = setTimeout(async () => {
      try {
        const res = await api(`/api/admin/users?search=${encodeURIComponent(query)}&per_page=10`);
        const data = await res.json();
        
        if (data.users?.length > 0) {
          resultsContainer.innerHTML = data.users.map(u => `
            <div class="search-result-item" data-user-id="${u.id}" data-username="${escapeHtml(u.username)}">
              <div class="user-avatar small">${(u.username || 'U')[0].toUpperCase()}</div>
              <div class="search-result-info">
                <span class="search-result-name">${escapeHtml(u.displayName || u.username)}</span>
                <span class="search-result-username">@${escapeHtml(u.username)}</span>
              </div>
            </div>
          `).join('');
          resultsContainer.style.display = 'block';
          
          resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
            item.onclick = async () => {
              const userId = item.dataset.userId;
              const username = item.dataset.username;
              
              if (!confirm(`Transfer server to @${username}?`)) return;
              
              try {
                await api(`/api/admin/servers/${server.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ updates: { user_id: userId } })
                });
                
                toast.success(`Server transferred to @${username}`);
                document.getElementById('current-owner-display').textContent = `@${username}`;
                input.value = '';
                resultsContainer.style.display = 'none';
              } catch (e) {
                toast.error('Failed to transfer server');
              }
            };
          });
        } else {
          resultsContainer.innerHTML = '<div class="search-no-results">No users found</div>';
          resultsContainer.style.display = 'block';
        }
      } catch (e) {
        resultsContainer.innerHTML = '<div class="search-no-results">Search failed</div>';
        resultsContainer.style.display = 'block';
      }
    }, 300);
  };
  
  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !resultsContainer.contains(e.target)) {
      resultsContainer.style.display = 'none';
    }
  });
}

async function loadCurrentEgg(server) {
  const display = document.getElementById('current-egg-display');
  if (!display || !server.egg_id) {
    if (display) display.textContent = 'No egg assigned';
    return;
  }
  
  try {
    const res = await api(`/api/admin/eggs/${server.egg_id}`);
    const data = await res.json();
    if (data.egg) {
      display.textContent = data.egg.name;
    } else {
      display.textContent = 'Unknown egg';
    }
  } catch (e) {
    display.textContent = 'Failed to load';
  }
}

let eggSearchTimeout = null;

function setupEggSearch(server) {
  const input = document.getElementById('egg-search-input');
  const resultsContainer = document.getElementById('egg-search-results');
  
  if (!input || !resultsContainer) return;
  
  input.oninput = () => {
    clearTimeout(eggSearchTimeout);
    const query = input.value.trim();
    
    if (query.length < 1) {
      resultsContainer.innerHTML = '';
      resultsContainer.style.display = 'none';
      return;
    }
    
    eggSearchTimeout = setTimeout(async () => {
      try {
        const res = await api(`/api/admin/eggs?search=${encodeURIComponent(query)}`);
        const data = await res.json();
        
        if (data.eggs?.length > 0) {
          resultsContainer.innerHTML = data.eggs.map(e => `
            <div class="search-result-item" data-egg-id="${e.id}" data-egg-name="${escapeHtml(e.name)}">
              <div class="egg-icon small">
                <span class="material-icons-outlined">${e.icon || 'egg'}</span>
              </div>
              <div class="search-result-info">
                <span class="search-result-name">${escapeHtml(e.name)}</span>
                <span class="search-result-sub">${escapeHtml(e.docker_image || 'No image')}</span>
              </div>
            </div>
          `).join('');
          resultsContainer.style.display = 'block';
          
          resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
            item.onclick = async () => {
              const eggId = item.dataset.eggId;
              const eggName = item.dataset.eggName;
              
              if (!confirm(`Change egg to "${eggName}"? This will update the startup command and Docker image.`)) return;
              
              try {
                const res = await api(`/api/admin/servers/${server.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ updates: { egg_id: eggId } })
                });
                
                const data = await res.json();
                if (data.success) {
                  toast.success(`Egg changed to "${eggName}"`);
                  document.getElementById('current-egg-display').textContent = eggName;
                  if (data.server) {
                    document.getElementById('current-startup-display').textContent = data.server.startup || 'Not configured';
                    document.getElementById('current-docker-display').textContent = data.server.docker_image || 'Not set';
                  }
                  input.value = '';
                  resultsContainer.style.display = 'none';
                } else {
                  toast.error('Failed to change egg');
                }
              } catch (e) {
                toast.error('Failed to change egg');
              }
            };
          });
        } else {
          resultsContainer.innerHTML = '<div class="search-no-results">No eggs found</div>';
          resultsContainer.style.display = 'block';
        }
      } catch (e) {
        resultsContainer.innerHTML = '<div class="search-no-results">Search failed</div>';
        resultsContainer.style.display = 'block';
      }
    }, 300);
  };
  
  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !resultsContainer.contains(e.target)) {
      resultsContainer.style.display = 'none';
    }
  });
}

export async function createNewServer() {
  try {
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
    
    if (!usersData.users?.length) {
      toast.error('No users available');
      return;
    }
    if (!nodesData.nodes?.length) {
      toast.error('No nodes available');
      return;
    }
    if (!eggsData.eggs?.length) {
      toast.error('No eggs available');
      return;
    }
    
    const server = {
      name: 'Untitled Server',
      user_id: usersData.users[0].id,
      node_id: nodesData.nodes[0].id,
      egg_id: eggsData.eggs[0].id,
      memory: 1024,
      disk: 5120,
      cpu: 100
    };
    
    const res = await api('/api/admin/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ server, skipInstall: true })
    });
    
    const data = await res.json();
    if (data.server?.id) {
      navigateTo('servers', data.server.id, 'details');
      toast.info('Configure your server, then click "Install" when ready');
    } else {
      toast.error(data.error || 'Failed to create server');
    }
  } catch (e) {
    toast.error('Failed to create server');
  }
}

window.suspendServerAdmin = async function(serverId) {
  try {
    const res = await api(`/api/servers/${serverId}/suspend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (res.ok) {
      // Trigger a reload in the main view. We assume adminNavigate will refresh.
      // But adminNavigate changes state. To reload current view we can just call the render function again
      // or re-navigate to same place.
      const currentTab = state.currentView.tab;
      navigateTo(currentTab);
    } else {
      const data = await res.json();
      toast.error(data.error || 'Failed to suspend');
    }
  } catch (e) {
    toast.error('Failed to suspend');
  }
};

window.unsuspendServerAdmin = async function(serverId) {
  try {
    const res = await api(`/api/servers/${serverId}/unsuspend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (res.ok) {
      const currentTab = state.currentView.tab;
      navigateTo(currentTab);
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
  try {
    await api(`/api/admin/servers/${serverId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const currentTab = state.currentView.tab;
    navigateTo(currentTab);
  } catch (e) {
    toast.error('Failed to delete server');
  }
};
