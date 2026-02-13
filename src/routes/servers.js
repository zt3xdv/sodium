import { escapeHtml } from '../utils/security.js';
import * as toast from '../utils/toast.js';
import { api, getToken, getUser } from '../utils/api.js';

let pollInterval = null;
let statusSockets = new Map();

export async function renderServers() {
  const app = document.getElementById('app');
  const user = getUser();
  
  let canCreate = true;
  try {
    const limitsRes = await api(`/api/user/limits?username=${encodeURIComponent(user.username)}`);
    const limitsData = await limitsRes.json();
    canCreate = limitsData.canCreateServers !== false;
  } catch {}
  
  app.innerHTML = `
    <div class="servers-page">
      <div class="page-header">
        <div class="page-header-text">
          <h1>My Servers</h1>
          <p class="page-subtitle">Manage and monitor your game servers</p>
        </div>
        ${canCreate ? `
          <a href="/servers/create" class="btn btn-primary" id="create-server-btn">
            <span class="material-icons-outlined">add</span>
            Create Server
          </a>
        ` : ''}
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
          <div class="empty-state-icon">
            <span class="material-icons-outlined">dns</span>
          </div>
          <h3>No servers yet</h3>
          <p>Create your first server to get started</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = data.servers.map(server => `
      <div class="server-card" data-id="${server.id}">
        <div class="server-card-header">
          <div class="server-card-title">
            <div class="server-icon">
              <span class="material-icons-outlined">dns</span>
            </div>
            <div class="server-name-wrap">
              <h3>${escapeHtml(server.name)}</h3>
              <span class="server-address">${server.node_address || `${server.allocation?.ip}:${server.allocation?.port}`}</span>
            </div>
          </div>
          <span class="status-badge status-loading" data-status-id="${server.id}">loading...</span>
        </div>
        <div class="server-card-body">
          <div class="server-resources">
            <div class="resource-chip">
              <span class="material-icons-outlined">memory</span>
              <span>${server.limits?.memory || 0} MB</span>
            </div>
            <div class="resource-chip">
              <span class="material-icons-outlined">storage</span>
              <span>${server.limits?.disk || 0} MB</span>
            </div>
            <div class="resource-chip">
              <span class="material-icons-outlined">speed</span>
              <span>${server.limits?.cpu || 0}%</span>
            </div>
          </div>
        </div>
        <div class="server-card-footer">
          <div class="power-actions">
            <button class="power-btn start" onclick="serverPower('${server.id}', 'start')" title="Start">
              <span class="material-icons-outlined">play_arrow</span>
            </button>
            <button class="power-btn restart" onclick="serverPower('${server.id}', 'restart')" title="Restart">
              <span class="material-icons-outlined">refresh</span>
            </button>
            <button class="power-btn stop" onclick="serverPower('${server.id}', 'stop')" title="Stop">
              <span class="material-icons-outlined">stop</span>
            </button>
          </div>
          <a href="/server/${server.id}" class="btn btn-primary btn-sm">
            <span class="material-icons-outlined">terminal</span>
            Console
          </a>
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
  el.className = `status-badge status-${status}`;
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
