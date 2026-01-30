import { escapeHtml } from '../../../utils/security.js';
import { api } from '../../../utils/api.js';
import { state } from '../state.js';
import { renderBreadcrumb, setupBreadcrumbListeners } from '../utils/ui.js';

const navigateTo = (...args) => window.adminNavigate(...args);

function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  
  return date.toLocaleDateString();
}

function getAuditIcon(action) {
  const icons = {
    'user:create': 'person_add',
    'user:update': 'edit',
    'user:delete': 'person_remove',
    'server:create': 'add_circle',
    'server:update': 'edit',
    'server:delete': 'delete',
    'server:suspend': 'block',
    'server:unsuspend': 'check_circle',
    'node:create': 'dns',
    'node:update': 'edit',
    'node:delete': 'delete',
    'egg:create': 'egg',
    'egg:update': 'edit',
    'egg:delete': 'delete',
    'settings:update': 'settings',
    'announcement:create': 'campaign',
    'announcement:update': 'edit',
    'announcement:delete': 'delete'
  };
  return icons[action] || 'info';
}

function formatAuditAction(action) {
  const labels = {
    'user:create': 'created user',
    'user:update': 'updated user',
    'user:delete': 'deleted user',
    'server:create': 'created server',
    'server:update': 'updated server',
    'server:delete': 'deleted server',
    'server:suspend': 'suspended server',
    'server:unsuspend': 'unsuspended server',
    'node:create': 'created node',
    'node:update': 'updated node',
    'node:delete': 'deleted node',
    'egg:create': 'created egg',
    'egg:update': 'updated egg',
    'egg:delete': 'deleted egg',
    'settings:update': 'updated settings',
    'announcement:create': 'created announcement',
    'announcement:update': 'updated announcement',
    'announcement:delete': 'deleted announcement'
  };
  return labels[action] || action;
}

export async function renderAuditLogPage(container, username) {
  try {
    const res = await api('/api/admin/audit-logs?per_page=50');
    const data = await res.json();
    
    container.innerHTML = `
      <div class="admin-header">
        ${renderBreadcrumb([{ label: 'Audit Log' }])}
      </div>
      
      <div class="admin-list">
        ${data.logs.length === 0 ? `
          <div class="empty-state">
            <span class="material-icons-outlined">history</span>
            <h3>No Audit Logs</h3>
            <p>Admin actions will be logged here</p>
          </div>
        ` : `
          <div class="audit-log-list">
            ${data.logs.map(log => `
              <div class="audit-log-item">
                <div class="audit-log-icon">
                  <span class="material-icons-outlined">${getAuditIcon(log.action)}</span>
                </div>
                <div class="audit-log-content">
                  <div class="audit-log-action">
                    <strong>${escapeHtml(log.adminUsername)}</strong>
                    <span>${formatAuditAction(log.action)}</span>
                    <span class="audit-target">${escapeHtml(log.targetType)}${log.details?.title ? `: ${escapeHtml(log.details.title)}` : ''}</span>
                  </div>
                  <div class="audit-log-meta">
                    ${log.ip ? `<span class="ip">${escapeHtml(log.ip)}</span>` : ''}
                    <span class="time">${formatTimeAgo(log.createdAt)}</span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
          
          ${data.meta.total_pages > 1 ? `
            <div class="pagination-info">
              Showing ${data.logs.length} of ${data.meta.total} entries
            </div>
          ` : ''}
        `}
      </div>
    `;
    
    setupBreadcrumbListeners(navigateTo);
    
  } catch (e) {
    container.innerHTML = '<div class="error">Failed to load audit log</div>';
  }
}

function getActivityIcon(action) {
  const icons = {
    'auth:login': 'login',
    'auth:logout': 'logout',
    'auth:password_change': 'lock',
    'user:profile_update': 'person',
    'api_key:create': 'key',
    'api_key:delete': 'key_off',
    'server:create': 'add_circle',
    'server:delete': 'delete',
    'server:start': 'play_arrow',
    'server:stop': 'stop',
    'server:restart': 'restart_alt',
    'server:console_command': 'terminal',
    'file:edit': 'edit',
    'file:delete': 'delete',
    'file:upload': 'upload',
    'subuser:add': 'person_add',
    'subuser:remove': 'person_remove'
  };
  return icons[action] || 'info';
}

function formatActivityAction(action) {
  const labels = {
    'auth:login': 'logged in',
    'auth:logout': 'logged out',
    'auth:password_change': 'changed password',
    'user:profile_update': 'updated profile',
    'api_key:create': 'created API key',
    'api_key:delete': 'deleted API key',
    'server:create': 'created server',
    'server:delete': 'deleted server',
    'server:start': 'started server',
    'server:stop': 'stopped server',
    'server:restart': 'restarted server',
    'server:console_command': 'sent console command',
    'file:edit': 'edited file',
    'file:delete': 'deleted file',
    'file:upload': 'uploaded file',
    'subuser:add': 'added subuser',
    'subuser:remove': 'removed subuser'
  };
  return labels[action] || action;
}

export async function renderActivityLogPage(container, username) {
  try {
    const res = await api('/api/activity?per_page=50');
    const data = await res.json();
    
    container.innerHTML = `
      <div class="admin-header">
        ${renderBreadcrumb([{ label: 'Activity Log' }])}
      </div>
      
      <div class="admin-list">
        ${data.logs.length === 0 ? `
          <div class="empty-state">
            <span class="material-icons-outlined">timeline</span>
            <h3>No Activity</h3>
            <p>User activity will be logged here</p>
          </div>
        ` : `
          <div class="activity-log-list">
            ${data.logs.map(log => `
              <div class="activity-log-item">
                <div class="activity-log-icon">
                  <span class="material-icons-outlined">${getActivityIcon(log.action)}</span>
                </div>
                <div class="activity-log-content">
                  <div class="activity-log-action">
                    <strong>${escapeHtml(log.username || 'Unknown')}</strong>
                    <span>${formatActivityAction(log.action)}</span>
                  </div>
                  <div class="activity-log-meta">
                    ${log.ip ? `<span class="ip">${escapeHtml(log.ip)}</span>` : ''}
                    <span class="time">${formatTimeAgo(log.createdAt)}</span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
          
          ${data.meta.total_pages > 1 ? `
            <div class="pagination-info">
              Showing ${data.logs.length} of ${data.meta.total} entries
            </div>
          ` : ''}
        `}
      </div>
    `;
    
    setupBreadcrumbListeners(navigateTo);
    
  } catch (e) {
    container.innerHTML = '<div class="error">Failed to load activity log</div>';
  }
}
