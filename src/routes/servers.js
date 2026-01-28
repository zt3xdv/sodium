import { escapeHtml } from '../utils/security.js';
import * as toast from '../utils/toast.js';
import { api } from '../utils/api.js';

let pollInterval = null;

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
  const container = document.getElementById('servers-list');
  if (!container) return;
  
  try {
    const res = await api('/api/servers');
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
}
