import { api } from '../utils/api.js';
import { escapeHtml } from '../utils/security.js';

let pollInterval = null;

export function renderDashboard() {
  const app = document.getElementById('app');
  app.className = 'dashboard-page';
  
  const displayName = localStorage.getItem('displayName') || localStorage.getItem('username');
  
  const hour = new Date().getHours();
  let greeting = 'Good evening';
  if (hour < 12) greeting = 'Good morning';
  else if (hour < 18) greeting = 'Good afternoon';
  
  app.innerHTML = `
    <div class="dashboard-container">
      <div id="announcements-container"></div>
      
      <header class="dashboard-header">
        <div class="greeting">
          <h1>${greeting}, <span class="highlight">${escapeHtml(displayName)}</span></h1>
          <p>Welcome to your dashboard</p>
        </div>
      </header>
      
      <div class="dashboard-grid">
        <div class="dashboard-section resources-section">
          <div class="section-header">
            <span class="material-icons-outlined">analytics</span>
            <h2>Resource Usage</h2>
          </div>
          <div class="limits-grid" id="limits-display">
            <div class="loading-spinner"></div>
          </div>
        </div>
        
        <div class="dashboard-section servers-section">
          <div class="section-header">
            <span class="material-icons-outlined">dns</span>
            <h2>Servers</h2>
            <a href="/servers" class="btn btn-ghost btn-sm">View All</a>
          </div>
          <div class="servers-list" id="servers-list">
            <div class="loading-spinner"></div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  loadLimits();
  loadServers();
  loadAnnouncements();
  
  pollInterval = setInterval(() => {
    loadServers();
    loadLimits();
  }, 10000);
}

async function loadLimits() {
  const username = localStorage.getItem('username');
  const container = document.getElementById('limits-display');
  if (!container) return;
  
  try {
    const res = await fetch(`/api/user/limits?username=${encodeURIComponent(username)}`);
    const data = await res.json();
    
    const calcPercent = (used, limit) => limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
    
    container.innerHTML = `
      <div class="limit-item">
        <div class="limit-header">
          <span class="label">Servers</span>
          <span class="value">${data.used.servers} / ${data.limits.servers}</span>
        </div>
        <div class="progress-bar">
          <div class="progress" style="width: ${calcPercent(data.used.servers, data.limits.servers)}%"></div>
        </div>
      </div>
      <div class="limit-item">
        <div class="limit-header">
          <span class="label">Memory</span>
          <span class="value">${data.used.memory} / ${data.limits.memory} MB</span>
        </div>
        <div class="progress-bar">
          <div class="progress" style="width: ${calcPercent(data.used.memory, data.limits.memory)}%"></div>
        </div>
      </div>
      <div class="limit-item">
        <div class="limit-header">
          <span class="label">Disk</span>
          <span class="value">${data.used.disk} / ${data.limits.disk} MB</span>
        </div>
        <div class="progress-bar">
          <div class="progress" style="width: ${calcPercent(data.used.disk, data.limits.disk)}%"></div>
        </div>
      </div>
      <div class="limit-item">
        <div class="limit-header">
          <span class="label">CPU</span>
          <span class="value">${data.used.cpu} / ${data.limits.cpu}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress" style="width: ${calcPercent(data.used.cpu, data.limits.cpu)}%"></div>
        </div>
      </div>
    `;
  } catch (e) {
    console.error('Failed to load limits:', e);
    container.innerHTML = `<div class="error-state">Failed to load resources</div>`;
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
          <span class="material-icons-outlined">dns</span>
          <p>No servers yet</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = data.servers.map(server => `
      <a href="/server/${server.id}" class="server-item">
        <div class="server-info">
          <span class="server-name">${escapeHtml(server.name)}</span>
          <span class="server-address">${server.node_address || `${server.allocation?.ip}:${server.allocation?.port}`}</span>
        </div>
        <div class="server-meta">
          <span class="status status-${server.status || 'offline'}">${server.status || 'offline'}</span>
          <span class="material-icons-outlined">chevron_right</span>
        </div>
      </a>
    `).join('');
  } catch (e) {
    console.error('Failed to load servers:', e);
    container.innerHTML = `<div class="error-state">Failed to load servers</div>`;
  }
}

async function loadAnnouncements() {
  const container = document.getElementById('announcements-container');
  if (!container) return;
  
  try {
    const res = await api('/api/announcements/active');
    const data = await res.json();
    
    if (data.announcements.length === 0) {
      container.innerHTML = '';
      return;
    }
    
    const dismissed = JSON.parse(localStorage.getItem('dismissedAnnouncements') || '[]');
    const activeAnnouncements = data.announcements.filter(a => !dismissed.includes(a.id));
    
    if (activeAnnouncements.length === 0) {
      container.innerHTML = '';
      return;
    }
    
    container.innerHTML = activeAnnouncements.map(a => `
      <div class="announcement-banner type-${a.type}" data-id="${a.id}">
        <div class="announcement-icon">
          <span class="material-icons-outlined">campaign</span>
        </div>
        <div class="announcement-content">
          <div class="announcement-title">${escapeHtml(a.title)}</div>
          <div class="announcement-text">${escapeHtml(a.content)}</div>
        </div>
        <button class="announcement-close" onclick="dismissAnnouncement('${a.id}')">
          <span class="material-icons-outlined">close</span>
        </button>
      </div>
    `).join('');
    
    window.dismissAnnouncement = (id) => {
      const dismissed = JSON.parse(localStorage.getItem('dismissedAnnouncements') || '[]');
      dismissed.push(id);
      localStorage.setItem('dismissedAnnouncements', JSON.stringify(dismissed));
      const banner = document.querySelector(`.announcement-banner[data-id="${id}"]`);
      if (banner) banner.remove();
    };
  } catch (e) {
    console.error('Failed to load announcements:', e);
    container.innerHTML = '';
  }
}

export function cleanupDashboard() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}
