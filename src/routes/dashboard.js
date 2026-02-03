import { api, getToken } from '../utils/api.js';
import { escapeHtml } from '../utils/security.js';

let pollInterval = null;
let statusSockets = new Map();

export function renderDashboard() {
  const app = document.getElementById('app');
  app.className = 'dashboard-page';
  
  const displayName = localStorage.getItem('displayName') || localStorage.getItem('username');
  
  const hour = new Date().getHours();
  let greeting, icon, subtitle;
  
  if (hour < 6) {
    greeting = 'Late night';
    icon = 'dark_mode';
    subtitle = "Burning the midnight oil?";
  } else if (hour < 12) {
    greeting = 'Good morning';
    icon = 'wb_twilight';
    subtitle = "Ready to conquer the day";
  } else if (hour < 18) {
    greeting = 'Good afternoon';
    icon = 'wb_sunny';
    subtitle = "Hope your day is going well";
  } else if (hour < 22) {
    greeting = 'Good evening';
    icon = 'nights_stay';
    subtitle = "Winding down for the night?";
  } else {
    greeting = 'Good night';
    icon = 'bedtime';
    subtitle = "Don't stay up too late";
  }
  
  app.innerHTML = `
    <div class="dashboard-container">
      <div id="email-verification-banner"></div>
      <div id="announcements-container"></div>
      
      <header class="dashboard-header">
        <div class="greeting">
          <div class="greeting-icon">
            <span class="material-icons-outlined">${icon}</span>
          </div>
          <div class="greeting-text">
            <h1>${greeting}, <span class="highlight">${escapeHtml(displayName)}</span></h1>
            <p>${subtitle}</p>
          </div>
        </div>
        <div class="quick-stats" id="quick-stats"></div>
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
  loadQuickStats();
  checkEmailVerification();
  
  pollInterval = setInterval(() => {
    loadServers();
    loadLimits();
    loadQuickStats();
  }, 10000);
}

async function checkEmailVerification() {
  const banner = document.getElementById('email-verification-banner');
  if (!banner) return;
  
  try {
    const res = await api('/api/auth/verification-status');
    const data = await res.json();
    
    if (data.emailVerificationRequired && !data.emailVerified) {
      banner.innerHTML = `
        <div class="verification-banner">
          <div class="verification-content">
            <span class="material-icons-outlined">mail</span>
            <div class="verification-text">
              <strong>Email Verification Required</strong>
              <p>Please verify your email address (${data.email || 'not set'}) to unlock all features.</p>
            </div>
          </div>
          <button class="btn btn-sm" id="resend-verification-btn">Resend Email</button>
        </div>
      `;
      
      document.getElementById('resend-verification-btn')?.addEventListener('click', async (e) => {
        const btn = e.target;
        btn.disabled = true;
        btn.textContent = 'Sending...';
        
        try {
          const resendRes = await api('/api/auth/resend-verification', { method: 'POST' });
          const resendData = await resendRes.json();
          if (resendData.success) {
            btn.textContent = 'Email Sent!';
            btn.classList.add('btn-success');
          } else {
            btn.textContent = resendData.error || 'Failed';
            btn.disabled = false;
          }
        } catch (err) {
          btn.textContent = 'Failed';
          btn.disabled = false;
        }
      });
    }
  } catch (e) {
    // Ignore verification check errors
  }
}

async function loadQuickStats() {
  const container = document.getElementById('quick-stats');
  if (!container) return;
  
  try {
    const res = await api('/api/servers');
    const data = await res.json();
    
    const online = data.servers.filter(s => s.status === 'running').length;
    const starting = data.servers.filter(s => s.status === 'starting').length;
    const offline = data.servers.filter(s => s.status === 'offline' || !s.status).length;
    
    container.innerHTML = `
      <div class="stat-chip online">
        <span class="material-icons-outlined">check_circle</span>
        <span>${online} online</span>
      </div>
      ${starting > 0 ? `
      <div class="stat-chip starting">
        <span class="material-icons-outlined">hourglass_top</span>
        <span>${starting} starting</span>
      </div>
      ` : ''}
      <div class="stat-chip offline">
        <span class="material-icons-outlined">cancel</span>
        <span>${offline} offline</span>
      </div>
    `;
  } catch (e) {
    container.innerHTML = '';
  }
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
      <div class="limit-item">
        <div class="limit-header">
          <span class="label">Allocations</span>
          <span class="value">${data.used.allocations || 0} / ${data.limits.allocations || 5}</span>
        </div>
        <div class="progress-bar">
          <div class="progress" style="width: ${calcPercent(data.used.allocations || 0, data.limits.allocations || 5)}%"></div>
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
          <span class="status status-loading" data-status-id="${server.id}">loading...</span>
          <span class="material-icons-outlined">chevron_right</span>
        </div>
      </a>
    `).join('');
    
    connectStatusSockets(data.servers);
  } catch (e) {
    console.error('Failed to load servers:', e);
    container.innerHTML = `<div class="error-state">Failed to load servers</div>`;
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
  statusSockets.forEach(socket => socket.close());
  statusSockets.clear();
}
