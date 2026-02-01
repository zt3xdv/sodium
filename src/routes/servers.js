import { escapeHtml } from '../utils/security.js';
import * as toast from '../utils/toast.js';
import { api, getToken } from '../utils/api.js';

let pollInterval = null;
let statusSockets = new Map();

export function renderServers() {
  const app = document.getElementById('app');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
  app.innerHTML = `
    <div class="servers-page">
      <div class="page-header">
        <h1>My Servers</h1>
        <a href="/servers/create" class="btn btn-primary">
          <span class="material-icons-outlined">add</span>
          Create Server
        </a>
      </div>
      
      <div class="servers-grid" id="servers-list">
        <div class="loading-spinner"></div>
      </div>
      

    </div>
  `;
  
  loadServers();
  
  pollInterval = setInterval(loadServers, 10000);
}

async function loadServers() {
  const container = document.getElementById('servers-list');
  if (!container) return;
  
  try {
    const res = await api('/api/servers');
    const data = await res.json();
    
    if (data.servers.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="material-icons-outlined">dns</span>
          <p>No servers yet</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = data.servers.map(server => `
      <div class="server-card" data-id="${server.id}">
        <div class="section-header">
          <span class="material-icons-outlined">dns</span>
          <h3>${escapeHtml(server.name)}</h3>
          <span class="status status-loading" data-status-id="${server.id}">loading...</span>
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
    
    connectStatusSockets(data.servers);
  } catch (e) {
    container.innerHTML = `<div class="error">Failed to load servers</div>`;
  }
}

function connectStatusSockets(servers) {
  const token = getToken();
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  
  servers.forEach(server => {
    if (statusSockets.has(server.id)) return;
    
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/console?server=${server.id}&token=${encodeURIComponent(token)}`;
    const socket = new WebSocket(wsUrl);
    
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.event === 'auth success') {
          socket.send(JSON.stringify({ event: 'send stats', args: [null] }));
        } else if (message.event === 'status' && message.args?.[0]) {
          updateServerStatus(server.id, message.args[0]);
        }
      } catch (e) {}
    };
    
    socket.onclose = () => statusSockets.delete(server.id);
    statusSockets.set(server.id, socket);
  });
}

function updateServerStatus(serverId, status) {
  const el = document.querySelector(`[data-status-id="${serverId}"]`);
  if (!el) return;
  el.className = `status status-${status}`;
  el.textContent = status;
}

window.serverPower = async function(serverId, action) {
  try {
    await api(`/api/servers/${serverId}/power`, {
      method: 'POST',
      body: JSON.stringify({ action })
    });
    loadServers();
  } catch (e) {
    toast.error('Failed to execute power action');
  }
};

export function cleanupServers() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  statusSockets.forEach(socket => socket.close());
  statusSockets.clear();
}
