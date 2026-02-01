import { escapeHtml } from '../utils/security.js';

let pollInterval = null;

export function renderStatus() {
  const app = document.getElementById('app');
  
  app.innerHTML = `
    <div class="status-page">
      <div class="status-header">
        <div class="status-indicator" id="global-status">
          <span class="pulse"></span>
        </div>
        <h1>System Status</h1>
        <p class="status-subtitle" id="status-message">Checking system status...</p>
      </div>
      
      <div class="status-summary" id="status-summary">
        <div class="summary-card">
          <span class="material-icons-outlined card-icon">dns</span>
          <div class="card-content">
            <span class="number" id="nodes-online">-</span>
            <span class="label">Nodes Online</span>
          </div>
        </div>
        <div class="summary-card">
          <span class="material-icons-outlined card-icon">storage</span>
          <div class="card-content">
            <span class="number" id="servers-total">-</span>
            <span class="label">Servers</span>
          </div>
        </div>
        <div class="summary-card">
          <span class="material-icons-outlined card-icon">memory</span>
          <div class="card-content">
            <span class="number" id="memory-usage">-</span>
            <span class="label">Mem Alloc</span>
          </div>
        </div>
        <div class="summary-card">
          <span class="material-icons-outlined card-icon">save</span>
          <div class="card-content">
            <span class="number" id="uptime">-</span>
            <span class="label">Disk Alloc</span>
          </div>
        </div>
      </div>
      
      <div class="status-section">
        <div class="section-header">
          <h2>Node Status</h2>
          <span class="refresh-info">
            <span class="material-icons-outlined spinning" id="refresh-icon" style="display:none;">sync</span>
            Updated <span id="last-update">--</span>
          </span>
        </div>
        
        <div class="nodes-status-grid" id="nodes-list">
          <div class="loading-spinner"></div>
        </div>
      </div>
      
      <div class="status-footer">
        <div class="footer-content">
          <span class="material-icons-outlined">info</span>
          <p>Status updates every 30 seconds automatically</p>
        </div>
      </div>
    </div>
  `;
  
  loadStatus();
  pollInterval = setInterval(loadStatus, 30000);
}

async function loadStatus() {
  const container = document.getElementById('nodes-list');
  const refreshIcon = document.getElementById('refresh-icon');
  
  if (refreshIcon) refreshIcon.style.display = 'inline-block';
  
  try {
    const res = await fetch('/api/status/nodes');
    const data = await res.json();
    
    const online = data.nodes.filter(n => n.status === 'online').length;
    const total = data.nodes.length;
    const servers = data.nodes.reduce((sum, n) => sum + n.servers, 0);
    
    // Calculate total allocated resources
    const totalAllocMem = data.nodes.reduce((sum, n) => sum + n.memory.allocated, 0);
    const totalMem = data.nodes.reduce((sum, n) => sum + n.memory.total, 0);
    const totalAllocDisk = data.nodes.reduce((sum, n) => sum + n.disk.allocated, 0);
    const totalDisk = data.nodes.reduce((sum, n) => sum + n.disk.total, 0);
    
    // Update summary
    document.getElementById('nodes-online').textContent = `${online}/${total}`;
    document.getElementById('servers-total').textContent = servers;
    document.getElementById('memory-usage').textContent = totalMem > 0 ? `${((totalAllocMem / totalMem) * 100).toFixed(0)}%` : '0%';
    document.getElementById('uptime').textContent = totalDisk > 0 ? `${((totalAllocDisk / totalDisk) * 100).toFixed(0)}%` : '0%';
    document.getElementById('last-update').textContent = new Date().toLocaleTimeString();
    
    // Update global status
    const globalStatus = document.getElementById('global-status');
    const statusMessage = document.getElementById('status-message');
    
    if (online === total && total > 0) {
      globalStatus.className = 'status-indicator online';
      statusMessage.textContent = 'All systems operational';
    } else if (online > 0) {
      globalStatus.className = 'status-indicator partial';
      statusMessage.textContent = `${total - online} node(s) experiencing issues`;
    } else if (total > 0) {
      globalStatus.className = 'status-indicator offline';
      statusMessage.textContent = 'System outage detected';
    } else {
      globalStatus.className = 'status-indicator';
      statusMessage.textContent = 'No nodes configured';
    }
    
    if (data.nodes.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="material-icons-outlined">cloud_off</span>
          <p>No nodes configured</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = data.nodes.map(node => {
      const memAllocPercent = node.memory.total > 0 ? (node.memory.allocated / node.memory.total) * 100 : 0;
      const diskAllocPercent = node.disk.total > 0 ? (node.disk.allocated / node.disk.total) * 100 : 0;
      const memAllocClass = memAllocPercent > 80 ? 'high' : memAllocPercent > 60 ? 'medium' : '';
      const diskAllocClass = diskAllocPercent > 80 ? 'high' : diskAllocPercent > 60 ? 'medium' : '';
      
      return `
        <div class="node-status-card ${node.status}">
          <div class="node-header">
            <div class="node-info">
              <span class="node-indicator ${node.status}"></span>
              <h3>${escapeHtml(node.name)}</h3>
            </div>
            <span class="status-badge status-${node.status}">${node.status}</span>
          </div>
          
          <div class="node-meta">
            <span class="meta-item">
              <span class="material-icons-outlined">storage</span>
              ${node.servers} servers
            </span>
            <span class="meta-item">
              <span class="material-icons-outlined">location_on</span>
              ${escapeHtml(node.location || 'Unknown')}
            </span>
          </div>
          
          <div class="node-stats">
            <div class="stat">
              <div class="stat-header">
                <span class="label">Memory</span>
                <span class="value ${memAllocClass}">${node.memory.allocated} / ${node.memory.total} MB</span>
              </div>
              <div class="progress-bar">
                <div class="progress ${memAllocClass}" style="width: ${Math.min(memAllocPercent, 100)}%"></div>
              </div>
            </div>
            <div class="stat">
              <div class="stat-header">
                <span class="label">Disk</span>
                <span class="value ${diskAllocClass}">${node.disk.allocated} / ${node.disk.total} MB</span>
              </div>
              <div class="progress-bar">
                <div class="progress ${diskAllocClass}" style="width: ${Math.min(diskAllocPercent, 100)}%"></div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    container.innerHTML = `
      <div class="error-state">
        <span class="material-icons-outlined">error_outline</span>
        <p>Connection error. Retrying...</p>
      </div>
    `;
  } finally {
    if (refreshIcon) {
      setTimeout(() => { refreshIcon.style.display = 'none'; }, 500);
    }
  }
}

export function cleanupStatus() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}
