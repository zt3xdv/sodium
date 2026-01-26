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
            <span class="label">Avg Memory</span>
          </div>
        </div>
        <div class="summary-card">
          <span class="material-icons-outlined card-icon">schedule</span>
          <div class="card-content">
            <span class="number" id="uptime">-</span>
            <span class="label">Uptime</span>
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
    
    // Calculate average memory usage
    const memoryUsages = data.nodes
      .filter(n => n.status === 'online' && n.memory.total > 0)
      .map(n => (n.memory.used / (n.memory.total * 1024 * 1024)) * 100);
    const avgMemory = memoryUsages.length > 0 
      ? memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length 
      : 0;
    
    // Update summary
    document.getElementById('nodes-online').textContent = `${online}/${total}`;
    document.getElementById('servers-total').textContent = servers;
    document.getElementById('memory-usage').textContent = `${avgMemory.toFixed(0)}%`;
    document.getElementById('uptime').textContent = '99.9%';
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
          <span class="material-icons-outlined icon">cloud_off</span>
          <h3>No Nodes Available</h3>
          <p>No nodes have been configured yet. Contact an administrator.</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = data.nodes.map(node => {
      const memPercent = node.memory.total > 0 ? (node.memory.used / (node.memory.total * 1024 * 1024)) * 100 : 0;
      const diskPercent = node.disk.total > 0 ? (node.disk.used / (node.disk.total * 1024 * 1024)) * 100 : 0;
      const memClass = memPercent > 80 ? 'high' : memPercent > 60 ? 'medium' : '';
      const diskClass = diskPercent > 80 ? 'high' : diskPercent > 60 ? 'medium' : '';
      
      return `
        <div class="node-status-card card ${node.status}">
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
                <span class="value ${memClass}">${memPercent.toFixed(1)}%</span>
              </div>
              <div class="progress-bar">
                <div class="progress ${memClass}" style="width: ${Math.min(memPercent, 100)}%"></div>
              </div>
            </div>
            <div class="stat">
              <div class="stat-header">
                <span class="label">Disk</span>
                <span class="value ${diskClass}">${diskPercent.toFixed(1)}%</span>
              </div>
              <div class="progress-bar">
                <div class="progress ${diskClass}" style="width: ${Math.min(diskPercent, 100)}%"></div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    container.innerHTML = `
      <div class="error-state">
        <span class="material-icons-outlined icon">error_outline</span>
        <h3>Connection Error</h3>
        <p>Unable to fetch status. Retrying...</p>
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
