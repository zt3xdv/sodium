import { escapeHtml } from '../utils/security.js';

let pollInterval = null;

export function renderServers() {
  const app = document.getElementById('app');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
  app.innerHTML = `
    <div class="servers-page">
      <div class="page-header">
        <h1>My Servers</h1>
        <button class="btn btn-primary" id="create-server-btn">
          <span class="material-icons-outlined">add</span>
          Create Server
        </button>
      </div>
      
      <div class="servers-grid" id="servers-list">
        <div class="loading-spinner"></div>
      </div>
      
      <div class="section-divider"></div>
      
      <div class="settings-section resource-limits">
        <div class="section-header">
          <span class="material-icons-outlined">analytics</span>
          <h3>Resource Usage</h3>
        </div>
        <div class="limits-grid" id="limits-display">
          <div class="limit-item">
            <span class="label">Loading...</span>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('create-server-btn').onclick = showCreateServerModal;
  
  loadServers();
  loadLimits();
  
  pollInterval = setInterval(loadServers, 10000);
}

async function loadLimits() {
  const username = localStorage.getItem('username');
  try {
    const res = await fetch(`/api/user/limits?username=${encodeURIComponent(username)}`);
    const data = await res.json();
    
    const container = document.getElementById('limits-display');
    if (!container) return;
    
    container.innerHTML = `
      <div class="limit-item">
        <span class="label">Servers</span>
        <div class="progress-bar">
          <div class="progress" style="width: ${(data.used.servers / data.limits.servers) * 100}%"></div>
        </div>
        <span class="value">${data.used.servers} / ${data.limits.servers}</span>
      </div>
      <div class="limit-item">
        <span class="label">Memory</span>
        <div class="progress-bar">
          <div class="progress" style="width: ${(data.used.memory / data.limits.memory) * 100}%"></div>
        </div>
        <span class="value">${data.used.memory} / ${data.limits.memory} MB</span>
      </div>
      <div class="limit-item">
        <span class="label">Disk</span>
        <div class="progress-bar">
          <div class="progress" style="width: ${(data.used.disk / data.limits.disk) * 100}%"></div>
        </div>
        <span class="value">${data.used.disk} / ${data.limits.disk} MB</span>
      </div>
      <div class="limit-item">
        <span class="label">CPU</span>
        <div class="progress-bar">
          <div class="progress" style="width: ${(data.used.cpu / data.limits.cpu) * 100}%"></div>
        </div>
        <span class="value">${data.used.cpu} / ${data.limits.cpu}%</span>
      </div>
    `;
  } catch (e) {
    console.error('Failed to load limits:', e);
  }
}

async function loadServers() {
  const username = localStorage.getItem('username');
  const container = document.getElementById('servers-list');
  if (!container) return;
  
  try {
    const res = await fetch(`/api/servers?username=${encodeURIComponent(username)}`);
    const data = await res.json();
    
    if (data.servers.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="material-icons-outlined icon">dns</span>
          <h3>No Servers</h3>
          <p>You don't have any servers yet. Contact an administrator to get started.</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = data.servers.map(server => `
      <div class="settings-section server-card" data-id="${server.id}">
        <div class="section-header">
          <span class="material-icons-outlined">dns</span>
          <h3>${escapeHtml(server.name)}</h3>
          <span class="status status-${server.status || 'offline'}">${server.status || 'offline'}</span>
        </div>
        <div class="server-card-content">
          <div class="server-actions">
            <button class="btn btn-success btn-sm btn-icon" onclick="serverPower('${server.id}', 'start')" title="Start">
              <span class="material-icons-outlined">play_arrow</span>
            </button>
            <button class="btn btn-warning btn-sm btn-icon" onclick="serverPower('${server.id}', 'restart')" title="Restart">
              <span class="material-icons-outlined">refresh</span>
            </button>
            <button class="btn btn-danger btn-sm btn-icon" onclick="serverPower('${server.id}', 'stop')" title="Stop">
              <span class="material-icons-outlined">stop</span>
            </button>
            <a href="/server/${server.id}" class="btn btn-primary btn-sm btn-icon" title="Console">
              <span class="material-icons-outlined">terminal</span>
            </a>
          </div>
          <div class="server-info">
            <div class="info-row">
              <span class="label">Memory</span>
              <span class="value">${server.limits?.memory || 0} MB</span>
            </div>
            <div class="info-row">
              <span class="label">Disk</span>
              <span class="value">${server.limits?.disk || 0} MB</span>
            </div>
            <div class="info-row">
              <span class="label">CPU</span>
              <span class="value">${server.limits?.cpu || 0}%</span>
            </div>
            <div class="info-row">
              <span class="label">Address</span>
              <span class="value">${server.node_address || `${server.allocation?.ip}:${server.allocation?.port}`}</span>
            </div>
          </div>
        </div>
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = `<div class="error">Failed to load servers</div>`;
  }
}

window.serverPower = async function(serverId, action) {
  const username = localStorage.getItem('username');
  try {
    await fetch(`/api/servers/${serverId}/power`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, action })
    });
    loadServers();
  } catch (e) {
    alert('Failed to execute power action');
  }
};

async function showCreateServerModal() {
  const username = localStorage.getItem('username');
  
  try {
    const [nestsRes, limitsRes] = await Promise.all([
      fetch('/api/servers/nests'),
      fetch(`/api/user/limits?username=${encodeURIComponent(username)}`)
    ]);
    
    const nestsData = await nestsRes.json();
    const limitsData = await limitsRes.json();
    
    const allEggs = nestsData.nests.flatMap(n => n.eggs || []);
    if (allEggs.length === 0) {
      alert('No eggs available');
      return;
    }
    
    const remaining = {
      servers: limitsData.limits.servers - limitsData.used.servers,
      memory: limitsData.limits.memory - limitsData.used.memory,
      disk: limitsData.limits.disk - limitsData.used.disk,
      cpu: limitsData.limits.cpu - limitsData.used.cpu
    };
    
    if (remaining.servers <= 0) {
      alert('You have reached your server limit');
      return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'create-server-modal';
    modal.innerHTML = `
      <div class="modal-backdrop" onclick="this.parentElement.remove()"></div>
      <div class="modal-content modal-large">
        <div class="modal-header">
          <h3>Create Server</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">
            <span class="material-icons-outlined">close</span>
          </button>
        </div>
        
        <div class="remaining-resources">
          <span>Available: ${remaining.memory} MB RAM, ${remaining.disk} MB Disk, ${remaining.cpu}% CPU</span>
        </div>
        
        <form id="create-server-form">
          <div class="form-group">
            <label>Server Name</label>
            <input type="text" name="name" required placeholder="My Server" />
          </div>
          
          <div class="form-group">
            <label>Egg</label>
            <select name="egg_id" required>
              ${allEggs.map(e => `<option value="${e.id}">${escapeHtml(e.name)}</option>`).join('')}
            </select>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Memory (MB) - Max: ${remaining.memory}</label>
              <input type="number" name="memory" value="512" min="128" max="${remaining.memory}" required />
            </div>
            <div class="form-group">
              <label>Disk (MB) - Max: ${remaining.disk}</label>
              <input type="number" name="disk" value="1024" min="256" max="${remaining.disk}" required />
            </div>
          </div>
          
          <div class="form-group">
            <label>CPU (%) - Max: ${remaining.cpu}</label>
            <input type="number" name="cpu" value="100" min="25" max="${remaining.cpu}" required />
          </div>
          
          <div id="create-server-error" class="error-message"></div>
          
          <div class="modal-actions">
            <button type="submit" class="btn btn-primary" id="submit-create-server">Create Server</button>
            <button type="button" class="btn btn-ghost" onclick="this.closest('.modal').remove()">Cancel</button>
          </div>
        </form>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('create-server-form').onsubmit = async (e) => {
      e.preventDefault();
      const form = new FormData(e.target);
      const errorEl = document.getElementById('create-server-error');
      const submitBtn = document.getElementById('submit-create-server');
      
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating...';
      errorEl.style.display = 'none';
      
      try {
        const res = await fetch('/api/servers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            name: form.get('name'),
            egg_id: form.get('egg_id'),
            memory: parseInt(form.get('memory')),
            disk: parseInt(form.get('disk')),
            cpu: parseInt(form.get('cpu'))
          })
        });
        
        const data = await res.json();
        
        if (res.ok) {
          modal.remove();
          loadServers();
          loadLimits();
        } else {
          errorEl.textContent = data.error || 'Failed to create server';
          errorEl.style.display = 'block';
          submitBtn.disabled = false;
          submitBtn.textContent = 'Create Server';
        }
      } catch (err) {
        errorEl.textContent = 'Network error';
        errorEl.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Server';
      }
    };
    
  } catch (e) {
    console.error('Failed to load create server data:', e);
    alert('Failed to load data');
  }
}

export function cleanupServers() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}
