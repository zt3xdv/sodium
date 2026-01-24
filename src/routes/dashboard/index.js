import { nav, initNav } from '../../components/nav.js';
import { icon } from '../../components/icon.js';
import { api } from '../../utils/api.js';
import { getUser, isAdmin } from '../../utils/auth.js';
import { toast } from '../../components/toast.js';
import { navigate } from '../../router.js';
import { formatBytes } from '../../utils/format.js';

const STATUS_CONFIG = {
  online: { color: 'var(--success)', label: 'Online' },
  starting: { color: 'var(--warning)', label: 'Starting' },
  stopping: { color: 'var(--warning)', label: 'Stopping' },
  offline: { color: 'var(--danger)', label: 'Offline' },
  installing: { color: 'var(--info)', label: 'Installing' }
};

function getStatusIndicator(status) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.offline;
  return `<span class="status-indicator" style="background-color: ${config.color};" title="${config.label}"></span>`;
}

function renderServerCard(server) {
  const status = server.status || 'offline';
  const isOnline = status === 'online';
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.offline;
  
  return `
    <div class="server-card" data-server-id="${server.uuid}">
      <div class="server-card-header">
        <div class="server-status">
          ${getStatusIndicator(status)}
          <span class="status-text">${config.label}</span>
        </div>
      </div>
      
      <div class="server-card-body">
        <h3 class="server-name">${server.name}</h3>
        <p class="server-address">${server.ip || '0.0.0.0'}:${server.port || '00000'}</p>
        
        <div class="server-meta">
          <span class="server-type">${server.egg_name || 'Unknown'}</span>
          <span class="server-divider">•</span>
          <span class="server-ram">${formatBytes(server.memory * 1024 * 1024)}</span>
        </div>
        
        <div class="server-node">
          ${icon('hard-drive', 14)}
          <span>${server.node_name || 'Node'}</span>
        </div>
      </div>
      
      <div class="server-card-footer">
        <div class="server-actions">
          <a href="/server/${server.uuid}/console" class="server-action-btn" title="Console">
            ${icon('terminal', 16)}
          </a>
          <a href="/server/${server.uuid}/files" class="server-action-btn" title="Files">
            ${icon('folder', 16)}
          </a>
          <a href="/server/${server.uuid}/settings" class="server-action-btn" title="Settings">
            ${icon('settings', 16)}
          </a>
        </div>
        
        <button 
          class="btn btn-sm ${isOnline ? 'btn-danger' : 'btn-success'}" 
          data-action="${isOnline ? 'stop' : 'start'}"
          data-server-id="${server.uuid}"
        >
          ${icon(isOnline ? 'stop' : 'play', 14)}
          <span>${isOnline ? 'Stop' : 'Start'}</span>
        </button>
      </div>
    </div>
  `;
}

function renderStats(stats) {
  return `
    <div class="dashboard-stats">
      <div class="stat-card">
        <div class="stat-icon">
          ${icon('server', 24)}
        </div>
        <div class="stat-content">
          <span class="stat-value">${stats.total}</span>
          <span class="stat-label">Total Servers</span>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon stat-icon-success">
          ${icon('activity', 24)}
        </div>
        <div class="stat-content">
          <span class="stat-value">${stats.online}</span>
          <span class="stat-label">Online</span>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon stat-icon-info">
          ${icon('cpu', 24)}
        </div>
        <div class="stat-content">
          <span class="stat-value">${stats.cpuUsed}%</span>
          <span class="stat-label">CPU Used</span>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon stat-icon-warning">
          ${icon('hard-drive', 24)}
        </div>
        <div class="stat-content">
          <span class="stat-value">${formatBytes(stats.memoryUsed)}</span>
          <span class="stat-label">RAM Used</span>
        </div>
      </div>
    </div>
  `;
}

function renderSkeleton() {
  const skeletons = Array(3).fill(0).map(() => `
    <div class="server-card server-card-skeleton">
      <div class="server-card-header">
        <div class="skeleton skeleton-circle"></div>
      </div>
      <div class="server-card-body">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-text"></div>
        <div class="skeleton skeleton-text-sm"></div>
      </div>
      <div class="server-card-footer">
        <div class="skeleton skeleton-actions"></div>
        <div class="skeleton skeleton-btn"></div>
      </div>
    </div>
  `).join('');

  return `<div class="server-grid">${skeletons}</div>`;
}

function renderEmptyState(canCreate) {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">
        ${icon('server', 64)}
      </div>
      <h2 class="empty-state-title">No servers yet</h2>
      <p class="empty-state-text">You don't have any servers. ${canCreate ? 'Create your first server to get started.' : 'Contact an administrator to get access.'}</p>
      ${canCreate ? `
        <a href="/server/create" class="btn btn-primary">
          ${icon('plus', 18)}
          <span>Create Server</span>
        </a>
      ` : ''}
    </div>
  `;
}

export default function DashboardPage() {
  const user = getUser();
  const admin = isAdmin();

  return `
    ${nav({ user, isAdmin: admin, currentPath: '/dashboard' })}
    
    <main class="dashboard-page">
      <div class="container">
        <div class="dashboard-header">
          <h1 class="page-title">Your Servers</h1>
          ${admin ? `
            <a href="/server/create" class="btn btn-primary" id="create-server-btn">
              ${icon('plus', 18)}
              <span>Create Server</span>
            </a>
          ` : ''}
        </div>
        
        <div id="stats-container"></div>
        
        <div id="servers-container">
          ${renderSkeleton()}
        </div>
      </div>
    </main>
    
    <style>
      .dashboard-page {
        min-height: calc(100vh - 60px);
        padding: 2rem 0;
      }
      
      .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 1rem;
      }
      
      .dashboard-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
      }
      
      .page-title {
        font-size: var(--text-2xl);
        font-weight: 600;
        color: var(--text-primary);
        margin: 0;
      }
      
      /* Stats */
      .dashboard-stats {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 1rem;
        margin-bottom: 2rem;
      }
      
      @media (max-width: 768px) {
        .dashboard-stats {
          grid-template-columns: repeat(2, 1fr);
        }
      }
      
      @media (max-width: 480px) {
        .dashboard-stats {
          grid-template-columns: 1fr;
        }
      }
      
      .stat-card {
        background: var(--bg-secondary);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 1rem;
        display: flex;
        align-items: center;
        gap: 1rem;
        transition: border-color 0.2s;
      }
      
      .stat-card:hover {
        border-color: var(--border-hover);
      }
      
      .stat-icon {
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--accent-muted);
        border-radius: 8px;
        color: var(--accent);
      }
      
      .stat-icon-success {
        background: rgba(34, 197, 94, 0.15);
        color: var(--success);
      }
      
      .stat-icon-info {
        background: rgba(59, 130, 246, 0.15);
        color: var(--info);
      }
      
      .stat-icon-warning {
        background: rgba(245, 158, 11, 0.15);
        color: var(--warning);
      }
      
      .stat-content {
        display: flex;
        flex-direction: column;
      }
      
      .stat-value {
        font-size: var(--text-xl);
        font-weight: 600;
        color: var(--text-primary);
      }
      
      .stat-label {
        font-size: var(--text-sm);
        color: var(--text-secondary);
      }
      
      /* Server Grid */
      .server-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1rem;
      }
      
      @media (max-width: 1024px) {
        .server-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }
      
      @media (max-width: 640px) {
        .server-grid {
          grid-template-columns: 1fr;
        }
      }
      
      /* Server Card */
      .server-card {
        background: var(--bg-secondary);
        border: 1px solid var(--border);
        border-radius: 8px;
        overflow: hidden;
        transition: border-color 0.2s, transform 0.2s;
      }
      
      .server-card:hover {
        border-color: var(--border-hover);
        transform: translateY(-2px);
      }
      
      .server-card-header {
        padding: 0.75rem 1rem;
        border-bottom: 1px solid var(--border);
      }
      
      .server-status {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      
      .status-indicator {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        animation: pulse 2s infinite;
      }
      
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      
      .status-text {
        font-size: var(--text-xs);
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      
      .server-card-body {
        padding: 1rem;
      }
      
      .server-name {
        font-size: var(--text-lg);
        font-weight: 600;
        color: var(--text-primary);
        margin: 0 0 0.25rem 0;
      }
      
      .server-address {
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        color: var(--text-secondary);
        margin: 0 0 0.75rem 0;
      }
      
      .server-meta {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: var(--text-sm);
        color: var(--text-secondary);
        margin-bottom: 0.5rem;
      }
      
      .server-divider {
        color: var(--text-tertiary);
      }
      
      .server-node {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        font-size: var(--text-xs);
        color: var(--text-tertiary);
      }
      
      .server-card-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem 1rem;
        border-top: 1px solid var(--border);
        background: var(--bg-tertiary);
      }
      
      .server-actions {
        display: flex;
        gap: 0.5rem;
      }
      
      .server-action-btn {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        color: var(--text-secondary);
        transition: background 0.2s, color 0.2s;
      }
      
      .server-action-btn:hover {
        background: var(--bg-elevated);
        color: var(--text-primary);
      }
      
      /* Buttons */
      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        font-size: var(--text-sm);
        font-weight: 500;
        border-radius: 6px;
        border: none;
        cursor: pointer;
        transition: background 0.2s, transform 0.1s;
      }
      
      .btn:active {
        transform: scale(0.98);
      }
      
      .btn-sm {
        padding: 0.375rem 0.75rem;
        font-size: var(--text-xs);
      }
      
      .btn-primary {
        background: var(--accent);
        color: white;
      }
      
      .btn-primary:hover {
        background: var(--accent-hover);
      }
      
      .btn-success {
        background: var(--success);
        color: white;
      }
      
      .btn-success:hover {
        background: #16a34a;
      }
      
      .btn-danger {
        background: var(--danger);
        color: white;
      }
      
      .btn-danger:hover {
        background: #dc2626;
      }
      
      .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      
      /* Empty State */
      .empty-state {
        text-align: center;
        padding: 4rem 2rem;
      }
      
      .empty-state-icon {
        color: var(--text-tertiary);
        margin-bottom: 1.5rem;
      }
      
      .empty-state-title {
        font-size: var(--text-xl);
        font-weight: 600;
        color: var(--text-primary);
        margin: 0 0 0.5rem 0;
      }
      
      .empty-state-text {
        font-size: var(--text-base);
        color: var(--text-secondary);
        margin: 0 0 1.5rem 0;
        max-width: 400px;
        margin-left: auto;
        margin-right: auto;
      }
      
      /* Skeleton Loading */
      .server-card-skeleton {
        pointer-events: none;
      }
      
      .skeleton {
        background: linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-elevated) 50%, var(--bg-tertiary) 75%);
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
        border-radius: 4px;
      }
      
      @keyframes shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
      
      .skeleton-circle {
        width: 10px;
        height: 10px;
        border-radius: 50%;
      }
      
      .skeleton-title {
        height: 24px;
        width: 70%;
        margin-bottom: 8px;
      }
      
      .skeleton-text {
        height: 16px;
        width: 50%;
        margin-bottom: 12px;
      }
      
      .skeleton-text-sm {
        height: 14px;
        width: 40%;
      }
      
      .skeleton-actions {
        height: 32px;
        width: 100px;
      }
      
      .skeleton-btn {
        height: 32px;
        width: 70px;
      }
    </style>
  `;
}

export async function mount() {
  initNav();
  
  const statsContainer = document.getElementById('stats-container');
  const serversContainer = document.getElementById('servers-container');
  const admin = isAdmin();
  
  if (!serversContainer) return;
  
  try {
    const servers = await api.get('/servers');
    
    const stats = {
      total: servers.length,
      online: servers.filter(s => s.status === 'online').length,
      cpuUsed: 0,
      memoryUsed: 0
    };
    
    servers.forEach(server => {
      if (server.status === 'online') {
        stats.cpuUsed += server.cpu_usage || 0;
        stats.memoryUsed += server.memory_usage || 0;
      }
    });
    
    if (stats.total > 0) {
      stats.cpuUsed = Math.round(stats.cpuUsed / stats.total);
    }
    
    if (statsContainer) {
      statsContainer.innerHTML = renderStats(stats);
    }
    
    if (servers.length === 0) {
      serversContainer.innerHTML = renderEmptyState(admin);
    } else {
      serversContainer.innerHTML = `
        <div class="server-grid">
          ${servers.map(server => renderServerCard(server)).join('')}
        </div>
      `;
    }
    
    initServerActions();
    
  } catch (err) {
    console.error('Failed to load servers:', err);
    toast.error('Failed to load servers');
    serversContainer.innerHTML = renderEmptyState(admin);
  }
}

function initServerActions() {
  document.querySelectorAll('[data-action="start"], [data-action="stop"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const action = btn.dataset.action;
      const serverId = btn.dataset.serverId;
      
      btn.disabled = true;
      const originalContent = btn.innerHTML;
      btn.innerHTML = `${icon('refresh', 14)} <span>${action === 'start' ? 'Starting...' : 'Stopping...'}</span>`;
      
      try {
        await api.post(`/servers/${serverId}/power`, { action });
        toast.success(`Server ${action === 'start' ? 'started' : 'stopped'} successfully`);
        
        const card = btn.closest('.server-card');
        if (card) {
          const indicator = card.querySelector('.status-indicator');
          const statusText = card.querySelector('.status-text');
          const newStatus = action === 'start' ? 'starting' : 'stopping';
          const config = STATUS_CONFIG[newStatus];
          
          if (indicator) indicator.style.backgroundColor = config.color;
          if (statusText) statusText.textContent = config.label;
        }
        
        setTimeout(() => {
          mount();
        }, 3000);
        
      } catch (err) {
        toast.error(err.message || `Failed to ${action} server`);
        btn.disabled = false;
        btn.innerHTML = originalContent;
      }
    });
  });
  
  document.querySelectorAll('.server-action-btn').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(link.getAttribute('href'));
    });
  });
}
