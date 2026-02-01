import { escapeHtml } from '../utils/security.js';
import { api } from '../utils/api.js';

const activityLabels = {
  'auth:login': { label: 'Logged in', icon: 'login' },
  'auth:logout': { label: 'Logged out', icon: 'logout' },
  'auth:password_change': { label: 'Changed password', icon: 'lock' },
  'user:profile_update': { label: 'Updated profile', icon: 'person' },
  'api_key:create': { label: 'Created API key', icon: 'key' },
  'api_key:delete': { label: 'Deleted API key', icon: 'key_off' },
  'server:create': { label: 'Created server', icon: 'add_circle' },
  'server:delete': { label: 'Deleted server', icon: 'delete' },
  'server:start': { label: 'Started server', icon: 'play_arrow' },
  'server:stop': { label: 'Stopped server', icon: 'stop' },
  'server:restart': { label: 'Restarted server', icon: 'restart_alt' },
  'server:console_command': { label: 'Sent console command', icon: 'terminal' },
  'file:edit': { label: 'Edited file', icon: 'edit' },
  'file:delete': { label: 'Deleted file', icon: 'delete' },
  'file:upload': { label: 'Uploaded file', icon: 'upload' },
  'subuser:add': { label: 'Added subuser', icon: 'person_add' },
  'subuser:remove': { label: 'Removed subuser', icon: 'person_remove' }
};

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

function getActivityInfo(action) {
  return activityLabels[action] || { label: action, icon: 'info' };
}

export async function renderActivityLog() {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading-spinner"></div>';
  
  try {
    const res = await api('/api/activity/me?per_page=50');
    const data = await res.json();
    
    app.innerHTML = `
      <div class="activity-page">
        <div class="page-header">
          <h1>Activity Log</h1>
          <p class="page-description">Your recent account activity</p>
        </div>
        
        <div class="activity-list">
          ${data.logs.length === 0 ? `
            <div class="empty-state">
              <span class="material-icons-outlined">history</span>
              <p>No activity yet</p>
            </div>
          ` : data.logs.map(log => {
            const info = getActivityInfo(log.action);
            return `
              <div class="activity-item">
                <div class="activity-icon">
                  <span class="material-icons-outlined">${info.icon}</span>
                </div>
                <div class="activity-content">
                  <div class="activity-label">${escapeHtml(info.label)}</div>
                  ${log.details?.serverName ? `<div class="activity-detail">Server: ${escapeHtml(log.details.serverName)}</div>` : ''}
                  ${log.details?.method ? `<div class="activity-detail">Method: ${escapeHtml(log.details.method)}</div>` : ''}
                  ${log.ip ? `<div class="activity-detail ip">IP: ${escapeHtml(log.ip)}</div>` : ''}
                </div>
                <div class="activity-time">${formatDate(log.createdAt)}</div>
              </div>
            `;
          }).join('')}
        </div>
        
        ${data.meta.total_pages > 1 ? `
          <div class="activity-pagination">
            <span>Showing ${data.logs.length} of ${data.meta.total} activities</span>
          </div>
        ` : ''}
      </div>
    `;
  } catch (e) {
    app.innerHTML = `
      <div class="error-page">
        <h1>Error</h1>
        <p>Failed to load activity log</p>
      </div>
    `;
  }
}
