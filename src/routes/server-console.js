import { escapeHtml } from '../utils/security.js';

let pollInterval = null;

export function renderServerConsole(serverId) {
  const app = document.getElementById('app');
  
  app.innerHTML = `
    <div class="server-console-page">
      <div class="page-header">
        <a href="/servers" class="btn btn-ghost"><span class="material-icons-outlined">arrow_back</span> Back</a>
        <h1 id="server-name">Loading...</h1>
      </div>
      
      <div class="console-layout">
        <div class="console-main">
          <div class="card console-card">
            <div class="console-header">
              <h3>Console</h3>
              <div class="power-buttons">
                <button class="btn btn-success btn-sm" id="btn-start">Start</button>
                <button class="btn btn-warning btn-sm" id="btn-restart">Restart</button>
                <button class="btn btn-danger btn-sm" id="btn-stop">Stop</button>
                <button class="btn btn-danger btn-sm" id="btn-kill">Kill</button>
              </div>
            </div>
            <div class="console-output" id="console-output">
              <div class="console-placeholder">Connecting to server...</div>
            </div>
            <div class="console-input">
              <input type="text" id="command-input" placeholder="Type a command..." />
              <button class="btn btn-primary" id="send-command">Send</button>
            </div>
          </div>
        </div>
        
        <div class="console-sidebar">
          <div class="card">
            <h3>Resources</h3>
            <div id="resources-display">
              <div class="resource-item">
                <span class="label">Status</span>
                <span class="value" id="res-status">--</span>
              </div>
              <div class="resource-item">
                <span class="label">CPU</span>
                <span class="value" id="res-cpu">--</span>
              </div>
              <div class="resource-item">
                <span class="label">Memory</span>
                <span class="value" id="res-memory">--</span>
              </div>
              <div class="resource-item">
                <span class="label">Disk</span>
                <span class="value" id="res-disk">--</span>
              </div>
              <div class="resource-item">
                <span class="label">Network ↑</span>
                <span class="value" id="res-net-tx">--</span>
              </div>
              <div class="resource-item">
                <span class="label">Network ↓</span>
                <span class="value" id="res-net-rx">--</span>
              </div>
            </div>
          </div>
          
          <div class="card">
            <h3>Server Info</h3>
            <div id="server-info">
              <div class="info-item">
                <span class="label">Address</span>
                <span class="value" id="info-address">--</span>
              </div>
              <div class="info-item">
                <span class="label">Node</span>
                <span class="value" id="info-node">--</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  loadServerDetails(serverId);
  
  document.getElementById('btn-start').onclick = () => powerAction(serverId, 'start');
  document.getElementById('btn-restart').onclick = () => powerAction(serverId, 'restart');
  document.getElementById('btn-stop').onclick = () => powerAction(serverId, 'stop');
  document.getElementById('btn-kill').onclick = () => powerAction(serverId, 'kill');
  
  document.getElementById('send-command').onclick = () => sendCommand(serverId);
  document.getElementById('command-input').onkeypress = (e) => {
    if (e.key === 'Enter') sendCommand(serverId);
  };
  
  pollInterval = setInterval(() => loadServerDetails(serverId), 5000);
}

async function loadServerDetails(serverId) {
  const username = localStorage.getItem('username');
  
  try {
    const res = await fetch(`/api/servers/${serverId}?username=${encodeURIComponent(username)}`);
    const data = await res.json();
    
    if (data.error) {
      document.getElementById('server-name').textContent = 'Error';
      return;
    }
    
    const server = data.server;
    const resources = data.resources;
    
    document.getElementById('server-name').textContent = server.name;
    document.getElementById('info-address').textContent = `${server.allocation?.ip}:${server.allocation?.port}`;
    document.getElementById('info-node').textContent = server.node_id?.substring(0, 8) || '--';
    
    if (resources) {
      document.getElementById('res-status').textContent = resources.state || 'offline';
      document.getElementById('res-status').className = `value status-${resources.state || 'offline'}`;
      document.getElementById('res-cpu').textContent = `${(resources.resources?.cpu_absolute || 0).toFixed(1)}%`;
      document.getElementById('res-memory').textContent = formatBytes(resources.resources?.memory_bytes || 0);
      document.getElementById('res-disk').textContent = formatBytes(resources.resources?.disk_bytes || 0);
      document.getElementById('res-net-tx').textContent = formatBytes(resources.resources?.network_tx_bytes || 0);
      document.getElementById('res-net-rx').textContent = formatBytes(resources.resources?.network_rx_bytes || 0);
    }
  } catch (e) {
    console.error('Failed to load server:', e);
  }
}

async function powerAction(serverId, action) {
  const username = localStorage.getItem('username');
  
  try {
    const res = await fetch(`/api/servers/${serverId}/power`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, action })
    });
    
    if (res.ok) {
      appendConsole(`[SYSTEM] Power action: ${action}`);
      loadServerDetails(serverId);
    } else {
      const data = await res.json();
      appendConsole(`[ERROR] ${data.error}`);
    }
  } catch (e) {
    appendConsole(`[ERROR] Failed to execute power action`);
  }
}

async function sendCommand(serverId) {
  const input = document.getElementById('command-input');
  const command = input.value.trim();
  if (!command) return;
  
  const username = localStorage.getItem('username');
  
  try {
    const res = await fetch(`/api/servers/${serverId}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, command })
    });
    
    appendConsole(`> ${command}`);
    input.value = '';
    
    if (!res.ok) {
      const data = await res.json();
      appendConsole(`[ERROR] ${data.error}`);
    }
  } catch (e) {
    appendConsole(`[ERROR] Failed to send command`);
  }
}

function appendConsole(text) {
  const output = document.getElementById('console-output');
  const placeholder = output.querySelector('.console-placeholder');
  if (placeholder) placeholder.remove();
  
  const line = document.createElement('div');
  line.className = 'console-line';
  line.textContent = text;
  output.appendChild(line);
  output.scrollTop = output.scrollHeight;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function cleanupServerConsole() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}
