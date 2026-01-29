import { loadActivityLogs, saveActivityLogs, loadAuditLogs, saveAuditLogs } from '../db.js';
import { generateUUID } from './helpers.js';

export function logActivity(userId, action, details = {}, ip = null) {
  const data = loadActivityLogs();
  const log = {
    id: generateUUID(),
    userId,
    action,
    details,
    ip,
    createdAt: new Date().toISOString()
  };
  data.activityLogs.unshift(log);
  if (data.activityLogs.length > 10000) {
    data.activityLogs = data.activityLogs.slice(0, 10000);
  }
  saveActivityLogs(data);
  return log;
}

export function logAudit(adminId, action, targetType, targetId, details = {}, ip = null) {
  const data = loadAuditLogs();
  const log = {
    id: generateUUID(),
    adminId,
    action,
    targetType,
    targetId,
    details,
    ip,
    createdAt: new Date().toISOString()
  };
  data.auditLogs.unshift(log);
  if (data.auditLogs.length > 10000) {
    data.auditLogs = data.auditLogs.slice(0, 10000);
  }
  saveAuditLogs(data);
  return log;
}

export function getUserActivity(userId, limit = 50) {
  const data = loadActivityLogs();
  return data.activityLogs
    .filter(log => log.userId === userId)
    .slice(0, limit);
}

export function getAuditLogs(limit = 100, page = 1) {
  const data = loadAuditLogs();
  const start = (page - 1) * limit;
  return {
    logs: data.auditLogs.slice(start, start + limit),
    total: data.auditLogs.length,
    totalPages: Math.ceil(data.auditLogs.length / limit)
  };
}

export const ACTIVITY_TYPES = {
  LOGIN: 'auth:login',
  LOGOUT: 'auth:logout',
  PASSWORD_CHANGE: 'auth:password_change',
  PROFILE_UPDATE: 'user:profile_update',
  API_KEY_CREATE: 'api_key:create',
  API_KEY_DELETE: 'api_key:delete',
  SERVER_CREATE: 'server:create',
  SERVER_DELETE: 'server:delete',
  SERVER_START: 'server:start',
  SERVER_STOP: 'server:stop',
  SERVER_RESTART: 'server:restart',
  SERVER_CONSOLE: 'server:console_command',
  FILE_EDIT: 'file:edit',
  FILE_DELETE: 'file:delete',
  FILE_UPLOAD: 'file:upload',
  SUBUSER_ADD: 'subuser:add',
  SUBUSER_REMOVE: 'subuser:remove'
};

export const AUDIT_TYPES = {
  USER_CREATE: 'user:create',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  SERVER_CREATE: 'server:create',
  SERVER_UPDATE: 'server:update',
  SERVER_DELETE: 'server:delete',
  SERVER_SUSPEND: 'server:suspend',
  SERVER_UNSUSPEND: 'server:unsuspend',
  NODE_CREATE: 'node:create',
  NODE_UPDATE: 'node:update',
  NODE_DELETE: 'node:delete',
  EGG_CREATE: 'egg:create',
  EGG_UPDATE: 'egg:update',
  EGG_DELETE: 'egg:delete',
  SETTINGS_UPDATE: 'settings:update',
  ANNOUNCEMENT_CREATE: 'announcement:create',
  ANNOUNCEMENT_UPDATE: 'announcement:update',
  ANNOUNCEMENT_DELETE: 'announcement:delete'
};
