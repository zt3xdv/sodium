import { api } from '../../utils/api.js';
import { formatBytes } from '../../utils/format.js';
import { renderConsoleTab, initConsoleTab, cleanupConsoleTab, setConsoleCallbacks } from './console.js';
import { renderFilesTab, initFilesTab, cleanupFilesTab } from './files.js';
import { renderStartupTab, initStartupTab, cleanupStartupTab } from './startup.js';
import { renderNetworkTab, initNetworkTab, cleanupNetworkTab } from './network.js';
import { renderUsersTab, initUsersTab, cleanupUsersTab } from './users.js';
import { renderSchedulesTab, initSchedulesTab, cleanupSchedulesTab } from './schedules.js';
import { renderSettingsTab, initSettingsTab, cleanupSettingsTab } from './settings.js';
import { renderBackupsTab, initBackupsTab, cleanupBackupsTab } from './backups.js';

let currentServerId = null;
let serverLimits = null;
let currentTab = 'console';
let serverData = null;
let installCheckInterval = null;

const SPARK_POINTS = 30;
const sparkHistory = {
  cpu: [],
  mem: [],
  disk: []
};

const tabs = [
  { id: 'console', label: 'Console', icon: 'terminal' },
  { id: 'files', label: 'Files', icon: 'folder' },
  { id: 'backups', label: 'Backups', icon: 'cloud' },
  { id: 'startup', label: 'Startup', icon: 'play_circle' },
  { id: 'schedules', label: 'Schedules', icon: 'schedule' },
  { id: 'network', label: 'Network', icon: 'lan' },
  { id: 'users', label: 'Users', icon: 'group' },
  { id: 'settings', label: 'Settings', icon: 'settings' }
];

export function renderServerPage(serverId) {
  currentServerId = serverId;
  const app = document.getElementById('app');
  
  app.innerHTML = `
    <div class="server-page">
      <div class="server-header">
        <div class="server-header-left">
          <div class="server-title">
            <h1 id="server-name">Loading...</h1>
            <span class="server-status" id="server-status">--</span>
          </div>
        </div>
        <div class="server-header-right">
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
          <div class="sidebar-section">
            <div class="section-header">
              <span class="material-icons-outlined">info</span>
              <h3>Server Info</h3>
            </div>
            <div class="sidebar-card">
              <div class="info-row">
                <span class="material-icons-outlined">language</span>
                <div class="info-content">
                  <span class="info-label">Address</span>
                  <span class="info-value" id="server-address">--</span>
                </div>
              </div>
              <div class="info-row">
                <span class="material-icons-outlined">dns</span>
                <div class="info-content">
                  <span class="info-label">Node</span>
                  <span class="info-value" id="server-node">--</span>
                </div>
              </div>
              <div class="info-row">
                <span class="material-icons-outlined">schedule</span>
                <div class="info-content">
                  <span class="info-label">Uptime</span>
                  <span class="info-value" id="server-uptime">--</span>
                </div>
              </div>
            </div>
          </div>
          
          <div class="sidebar-section">
            <div class="section-header">
              <span class="material-icons-outlined">monitoring</span>
              <h3>Resources</h3>
            </div>
            <div class="sidebar-card">
              <div class="resource-spark-item">
                <div class="resource-spark-header">
                  <div class="resource-spark-label">
                    <span class="material-icons-outlined">memory</span>
                    <span>CPU</span>
                  </div>
                  <span class="resource-spark-value" id="res-cpu-text">0%</span>
                </div>
                <div class="resource-spark-chart">
                  <svg id="spark-cpu" viewBox="0 0 100 24" preserveAspectRatio="none">
                    <polyline class="spark-line cpu" points="0,24 100,24" />
                  </svg>
                </div>
              </div>
              <div class="resource-spark-item">
                <div class="resource-spark-header">
                  <div class="resource-spark-label">
                    <span class="material-icons-outlined">storage</span>
                    <span>Memory</span>
                  </div>
                  <span class="resource-spark-value" id="res-mem-text">0 MB</span>
                </div>
                <div class="resource-spark-chart">
                  <svg id="spark-mem" viewBox="0 0 100 24" preserveAspectRatio="none">
                    <polyline class="spark-line memory" points="0,24 100,24" />
                  </svg>
                </div>
              </div>
              <div class="resource-spark-item">
                <div class="resource-spark-header">
                  <div class="resource-spark-label">
                    <span class="material-icons-outlined">save</span>
                    <span>Disk</span>
                  </div>
                  <span class="resource-spark-value" id="res-disk-text">0 MB</span>
                </div>
                <div class="resource-spark-chart">
                  <svg id="spark-disk" viewBox="0 0 100 24" preserveAspectRatio="none">
                    <polyline class="spark-line disk" points="0,24 100,24" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
          
          <div class="sidebar-section">
            <div class="section-header">
              <span class="material-icons-outlined">swap_vert</span>
              <h3>Network</h3>
            </div>
            <div class="sidebar-card network-stats">
              <div class="network-stat">
                <span class="material-icons-outlined tx">arrow_upward</span>
                <div class="stat-content">
                  <span class="stat-label">Outbound</span>
                  <span class="stat-value" id="res-net-tx">0 B</span>
                </div>
              </div>
              <div class="network-stat">
                <span class="material-icons-outlined rx">arrow_downward</span>
                <div class="stat-content">
                  <span class="stat-label">Inbound</span>
                  <span class="stat-value" id="res-net-rx">0 B</span>
                </div>
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
    case 'backups':
      content.innerHTML = renderBackupsTab();
      initBackupsTab(currentServerId);
      break;
    case 'startup':
      content.innerHTML = renderStartupTab();
      initStartupTab(currentServerId);
      break;
    case 'schedules':
      content.innerHTML = renderSchedulesTab(currentServerId);
      initSchedulesTab(currentServerId);
      break;
    case 'network':
      content.innerHTML = renderNetworkTab();
      initNetworkTab(currentServerId);
      break;
    case 'users':
      content.innerHTML = renderUsersTab();
      initUsersTab(currentServerId);
      break;
    case 'settings':
      content.innerHTML = renderSettingsTab();
      initSettingsTab(currentServerId);
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
    case 'backups':
      cleanupBackupsTab();
      break;
    case 'startup':
      cleanupStartupTab();
      break;
    case 'schedules':
      cleanupSchedulesTab();
      break;
    case 'network':
      cleanupNetworkTab();
      break;
    case 'users':
      cleanupUsersTab();
      break;
    case 'settings':
      cleanupSettingsTab();
      break;
  }
}

async function loadServerDetails(serverId) {
  const username = localStorage.getItem('username');
  
  try {
    const res = await api(`/api/servers/${serverId}`);
    const data = await res.json();
    
    if (data.error) {
      document.getElementById('server-name').textContent = 'Error';
      return;
    }
    
    serverData = data.server;
    serverLimits = serverData.limits;
    
    document.getElementById('server-name').textContent = serverData.name;
    
    const address = serverData.node_address || `${serverData.allocation?.ip || '0.0.0.0'}:${serverData.allocation?.port || 25565}`;
    document.getElementById('server-address').textContent = address;
    
    const nodeEl = document.getElementById('server-node');
    if (nodeEl) nodeEl.textContent = serverData.node_name || 'Unknown';
    
    // Check if server is installing
    if (serverData.status === 'installing') {
      showInstallingScreen();
    }
  } catch (e) {
    console.error('Failed to load server:', e);
  }
}

function showInstallingScreen() {
  const content = document.getElementById('tab-content');
  const sidebar = document.querySelector('.server-sidebar');
  const tabsEl = document.querySelector('.server-tabs');
  const powerBtns = document.querySelector('.power-buttons');
  
  if (sidebar) sidebar.style.display = 'none';
  if (tabsEl) tabsEl.style.display = 'none';
  if (powerBtns) powerBtns.style.display = 'none';
  
  content.innerHTML = `
    <div class="installing-screen">
      <div class="installing-content">
        <div class="installing-icon">
          <span class="material-icons-outlined spinning">settings</span>
        </div>
        <h2>Server Installing</h2>
        <p>Your server is being set up. This may take a few minutes...</p>
        <div class="installing-progress">
          <div class="installing-bar"></div>
        </div>
        <p class="installing-hint">You can leave this page and come back later.</p>
      </div>
    </div>
  `;
  
  // Poll for status changes
  if (installCheckInterval) clearInterval(installCheckInterval);
  installCheckInterval = setInterval(checkInstallStatus, 5000);
}

async function checkInstallStatus() {
  const username = localStorage.getItem('username');
  
  try {
    const res = await api(`/api/servers/${currentServerId}`);
    const data = await res.json();
    
    if (data.server && data.server.status !== 'installing') {
      clearInterval(installCheckInterval);
      installCheckInterval = null;
      
      // Reload the page to show full interface
      serverData = data.server;
      const tabsEl = document.querySelector('.server-tabs');
      const sidebar = document.querySelector('.server-sidebar');
      const powerBtns = document.querySelector('.power-buttons');
      
      if (tabsEl) tabsEl.style.display = 'flex';
      if (sidebar) sidebar.style.display = 'flex';
      if (powerBtns) powerBtns.style.display = 'flex';
      
      switchTab('console');
    }
  } catch (e) {
    console.error('Failed to check install status:', e);
  }
}

async function powerAction(serverId, action) {
  const username = localStorage.getItem('username');
  
  try {
    const res = await api(`/api/servers/${serverId}/power`, {
      method: 'POST',
      
      body: JSON.stringify({ action })
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
  const cpuPercent = Math.min(100, stats.cpu_absolute || 0);
  const memPercent = stats.memory_limit_bytes ? Math.min(100, (stats.memory_bytes / stats.memory_limit_bytes) * 100) : 0;
  const diskLimit = serverLimits?.disk ? serverLimits.disk * 1024 * 1024 : 0;
  const diskPercent = diskLimit ? Math.min(100, (stats.disk_bytes / diskLimit) * 100) : 0;
  
  sparkHistory.cpu.push(cpuPercent);
  sparkHistory.mem.push(memPercent);
  sparkHistory.disk.push(diskPercent);
  
  if (sparkHistory.cpu.length > SPARK_POINTS) sparkHistory.cpu.shift();
  if (sparkHistory.mem.length > SPARK_POINTS) sparkHistory.mem.shift();
  if (sparkHistory.disk.length > SPARK_POINTS) sparkHistory.disk.shift();
  
  updateSparkline('spark-cpu', sparkHistory.cpu);
  updateSparkline('spark-mem', sparkHistory.mem);
  updateSparkline('spark-disk', sparkHistory.disk);
  
  const cpuText = document.getElementById('res-cpu-text');
  const memText = document.getElementById('res-mem-text');
  const diskText = document.getElementById('res-disk-text');
  const netTx = document.getElementById('res-net-tx');
  const netRx = document.getElementById('res-net-rx');
  
  const uptimeEl = document.getElementById('server-uptime');
  
  if (cpuText) cpuText.textContent = `${cpuPercent.toFixed(1)}%`;
  if (memText) memText.textContent = formatBytes(stats.memory_bytes || 0);
  if (diskText) diskText.textContent = formatBytes(stats.disk_bytes || 0);
  if (netTx) netTx.textContent = formatBytes(stats.network?.tx_bytes || 0);
  if (netRx) netRx.textContent = formatBytes(stats.network?.rx_bytes || 0);
  if (uptimeEl) uptimeEl.textContent = formatUptime(stats.uptime || 0);
}

function formatUptime(ms) {
  if (!ms || ms <= 0) return '--';
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function updateSparkline(svgId, data) {
  const svg = document.getElementById(svgId);
  if (!svg) return;
  
  const polyline = svg.querySelector('polyline');
  if (!polyline) return;
  
  if (data.length < 2) {
    polyline.setAttribute('points', '0,24 100,24');
    return;
  }
  
  const points = data.map((value, index) => {
    const x = (index / (SPARK_POINTS - 1)) * 100;
    const y = 24 - (value / 100) * 22;
    return `${x},${y}`;
  }).join(' ');
  
  polyline.setAttribute('points', points);
}

export function cleanupServerPage() {
  cleanupCurrentTab();
  if (installCheckInterval) {
    clearInterval(installCheckInterval);
    installCheckInterval = null;
  }
  currentServerId = null;
  serverData = null;
  currentTab = 'console';
  sparkHistory.cpu = [];
  sparkHistory.mem = [];
  sparkHistory.disk = [];
}

export function getServerId() {
  return currentServerId;
}
