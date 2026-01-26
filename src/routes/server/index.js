import { renderConsoleTab, initConsoleTab, cleanupConsoleTab, setConsoleCallbacks } from './console.js';
import { renderFilesTab, initFilesTab, cleanupFilesTab } from './files.js';

let currentServerId = null;
let serverLimits = null;
let currentTab = 'console';
let serverData = null;

const tabs = [
  { id: 'console', label: 'Console', icon: 'terminal' },
  { id: 'files', label: 'Files', icon: 'folder' },
  { id: 'startup', label: 'Startup', icon: 'play_circle', disabled: true },
  { id: 'settings', label: 'Settings', icon: 'settings', disabled: true }
];

export function renderServerPage(serverId) {
  currentServerId = serverId;
  const app = document.getElementById('app');
  
  app.innerHTML = `
    <div class="server-page">
      <div class="server-header">
        <div class="server-header-left">
          <a href="/servers" class="btn btn-ghost btn-sm">
            <span class="material-icons-outlined">arrow_back</span>
          </a>
          <div class="server-title">
            <h1 id="server-name">Loading...</h1>
            <span class="server-status" id="server-status">--</span>
          </div>
        </div>
        <div class="server-header-right">
          <div class="server-address" id="server-address">--</div>
          <div class="power-buttons">
            <button class="btn btn-success btn-sm" id="btn-start" title="Start">
              <span class="material-icons-outlined">play_arrow</span>
            </button>
            <button class="btn btn-warning btn-sm" id="btn-restart" title="Restart">
              <span class="material-icons-outlined">refresh</span>
            </button>
            <button class="btn btn-danger btn-sm" id="btn-stop" title="Stop">
              <span class="material-icons-outlined">stop</span>
            </button>
            <button class="btn btn-danger btn-sm" id="btn-kill" title="Kill">
              <span class="material-icons-outlined">power_settings_new</span>
            </button>
          </div>
        </div>
      </div>
      
      <div class="server-tabs">
        ${tabs.map(tab => `
          <button class="server-tab ${tab.id === currentTab ? 'active' : ''} ${tab.disabled ? 'disabled' : ''}" 
                  data-tab="${tab.id}" ${tab.disabled ? 'disabled' : ''}>
            <span class="material-icons-outlined">${tab.icon}</span>
            <span>${tab.label}</span>
          </button>
        `).join('')}
      </div>
      
      <div class="server-content">
        <div class="server-main" id="tab-content"></div>
        <div class="server-sidebar">
          <div class="card resources-card">
            <h4>Resources</h4>
            <div class="resource-bars">
              <div class="resource-bar-item">
                <div class="resource-bar-header">
                  <span>CPU</span>
                  <span id="res-cpu-text">0%</span>
                </div>
                <div class="resource-bar">
                  <div class="resource-bar-fill cpu" id="res-cpu-bar" style="width: 0%"></div>
                </div>
              </div>
              <div class="resource-bar-item">
                <div class="resource-bar-header">
                  <span>Memory</span>
                  <span id="res-mem-text">0 MB</span>
                </div>
                <div class="resource-bar">
                  <div class="resource-bar-fill memory" id="res-mem-bar" style="width: 0%"></div>
                </div>
              </div>
              <div class="resource-bar-item">
                <div class="resource-bar-header">
                  <span>Disk</span>
                  <span id="res-disk-text">0 MB</span>
                </div>
                <div class="resource-bar">
                  <div class="resource-bar-fill disk" id="res-disk-bar" style="width: 0%"></div>
                </div>
              </div>
            </div>
            <div class="resource-stats">
              <div class="resource-stat">
                <span class="material-icons-outlined">arrow_upward</span>
                <span id="res-net-tx">0 B</span>
              </div>
              <div class="resource-stat">
                <span class="material-icons-outlined">arrow_downward</span>
                <span id="res-net-rx">0 B</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  setConsoleCallbacks(updateServerStatus, updateServerResources, getServerId);
  loadServerDetails(serverId);
  switchTab(currentTab);
  
  document.querySelectorAll('.server-tab:not(.disabled)').forEach(tab => {
    tab.onclick = () => switchTab(tab.dataset.tab);
  });
  
  document.getElementById('btn-start').onclick = () => powerAction(serverId, 'start');
  document.getElementById('btn-restart').onclick = () => powerAction(serverId, 'restart');
  document.getElementById('btn-stop').onclick = () => powerAction(serverId, 'stop');
  document.getElementById('btn-kill').onclick = () => powerAction(serverId, 'kill');
}

function switchTab(tabId) {
  cleanupCurrentTab();
  
  currentTab = tabId;
  
  document.querySelectorAll('.server-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabId);
  });
  
  const content = document.getElementById('tab-content');
  const sidebar = document.querySelector('.server-sidebar');
  
  if (sidebar) {
    sidebar.style.display = tabId === 'console' ? 'flex' : 'none';
  }
  
  switch (tabId) {
    case 'console':
      content.innerHTML = renderConsoleTab();
      initConsoleTab(currentServerId);
      break;
    case 'files':
      content.innerHTML = renderFilesTab();
      initFilesTab(currentServerId);
      break;
    default:
      content.innerHTML = `<div class="card"><p>Coming soon...</p></div>`;
  }
}

function cleanupCurrentTab() {
  switch (currentTab) {
    case 'console':
      cleanupConsoleTab();
      break;
    case 'files':
      cleanupFilesTab();
      break;
  }
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
    
    serverData = data.server;
    serverLimits = serverData.limits;
    
    document.getElementById('server-name').textContent = serverData.name;
    document.getElementById('server-address').textContent = 
      `${serverData.allocation?.ip}:${serverData.allocation?.port}`;
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
    
    if (!res.ok) {
      const data = await res.json();
      console.error('Power action failed:', data.error);
    }
  } catch (e) {
    console.error('Failed to execute power action:', e);
  }
}

export function updateServerStatus(status) {
  const statusEl = document.getElementById('server-status');
  if (statusEl) {
    statusEl.textContent = status;
    statusEl.className = `server-status status-${status}`;
  }
}

export function updateServerResources(stats) {
  const limits = serverLimits;
  const cpuPercent = Math.min(100, stats.cpu_absolute || 0);
  const memPercent = limits?.memory ? Math.min(100, ((stats.memory_bytes || 0) / (limits.memory * 1024 * 1024)) * 100) : 0;
  const diskPercent = limits?.disk ? Math.min(100, ((stats.disk_bytes || 0) / (limits.disk * 1024 * 1024)) * 100) : 0;
  
  const cpuBar = document.getElementById('res-cpu-bar');
  const memBar = document.getElementById('res-mem-bar');
  const diskBar = document.getElementById('res-disk-bar');
  
  if (cpuBar) cpuBar.style.width = `${cpuPercent}%`;
  if (memBar) memBar.style.width = `${memPercent}%`;
  if (diskBar) diskBar.style.width = `${diskPercent}%`;
  
  const cpuText = document.getElementById('res-cpu-text');
  const memText = document.getElementById('res-mem-text');
  const diskText = document.getElementById('res-disk-text');
  const netTx = document.getElementById('res-net-tx');
  const netRx = document.getElementById('res-net-rx');
  
  if (cpuText) cpuText.textContent = `${cpuPercent.toFixed(1)}%`;
  if (memText) memText.textContent = formatBytes(stats.memory_bytes || 0);
  if (diskText) diskText.textContent = formatBytes(stats.disk_bytes || 0);
  if (netTx) netTx.textContent = formatBytes(stats.network?.tx_bytes || 0);
  if (netRx) netRx.textContent = formatBytes(stats.network?.rx_bytes || 0);
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function cleanupServerPage() {
  cleanupCurrentTab();
  currentServerId = null;
  serverData = null;
  currentTab = 'console';
}

export function getServerId() {
  return currentServerId;
}
