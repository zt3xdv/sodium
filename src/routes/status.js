import { escapeHtml } from '../utils/security.js';

let pollInterval = null;

export function renderStatus() {
  const app = document.getElementById('app');
  
  app.innerHTML = `
    <div class="status-page">
      <div class="status-header">
        <span class="material-icons-outlined header-icon">monitor_heart</span>
        <h1>System Status</h1>
        <p>Real-time status of all nodes</p>
      </div>
      
      <div class="status-summary" id="status-summary">
        <div class="summary-card">
          <span class="number" id="nodes-online">-</span>
          <span class="label">Nodes Online</span>
        </div>
        <div class="summary-card">
          <span class="number" id="nodes-total">-</span>
          <span class="label">Total Nodes</span>
        </div>
        <div class="summary-card">
          <span class="number" id="servers-total">-</span>
          <span class="label">Total Servers</span>
        </div>
      </div>
      
      <div class="nodes-status-grid" id="nodes-list">
        <div class="loading-spinner"></div>
      </div>
      
      <div class="status-footer">
        <p>Last updated: <span id="last-update">--</span></p>
      </div>
    </div>
  `;
  
  loadStatus();
  pollInterval = setInterval(loadStatus, 30000);
}

async function loadStatus() {
  const container = document.getElementById('nodes-list');
  
  try {
    const res = await fetch('/api/status/nodes');
    const data = await res.json();
    
    const online = data.nodes.filter(n => n.status === 'online').length;
    const total = data.nodes.length;
    const servers = data.nodes.reduce((sum, n) => sum + n.servers, 0);
    
    document.getElementById('nodes-online').textContent = online;
    document.getElementById('nodes-total').textContent = total;
    document.getElementById('servers-total').textContent = servers;
    document.getElementById('last-update').textContent = new Date().toLocaleTimeString();
    
    if (data.nodes.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="material-icons-outlined icon">power_off</span>
          <h3>No Nodes</h3>
          <p>No nodes have been configured yet.</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = data.nodes.map(node => {
      const memPercent = node.memory.total > 0 ? (node.memory.used / (node.memory.total * 1024 * 1024)) * 100 : 0;
      const diskPercent = node.disk.total > 0 ? (node.disk.used / (node.disk.total * 1024 * 1024)) * 100 : 0;
      
      return `
        <div class="node-status-card card ${node.status}">
          <div class="node-header">
            <h3>${escapeHtml(node.name)}</h3>
            <span class="status-badge status-${node.status}">${node.status}</span>
          </div>
          <div class="node-stats">
            <div class="stat">
              <span class="label">Servers</span>
              <span class="value">${node.servers}</span>
            </div>
            <div class="stat">
              <span class="label">Memory</span>
              <div class="progress-bar">
                <div class="progress" style="width: ${Math.min(memPercent, 100)}%"></div>
              </div>
              <span class="value">${memPercent.toFixed(1)}%</span>
            </div>
            <div class="stat">
              <span class="label">Disk</span>
              <div class="progress-bar">
                <div class="progress" style="width: ${Math.min(diskPercent, 100)}%"></div>
              </div>
              <span class="value">${diskPercent.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    container.innerHTML = `<div class="error">Failed to load status</div>`;
  }
}

export function cleanupStatus() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}
