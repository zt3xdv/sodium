export const PERMISSIONS = {
  'control.console': 'Send commands',
  'control.start': 'Start server',
  'control.stop': 'Stop server',
  'control.restart': 'Restart server',
  'user.create': 'Add subusers',
  'user.read': 'View subusers',
  'user.update': 'Edit subusers',
  'user.delete': 'Remove subusers',
  'file.read': 'View files',
  'file.create': 'Create files',
  'file.update': 'Edit files',
  'file.delete': 'Delete files',
  'file.archive': 'Archive files',
  'file.sftp': 'SFTP access',
  'backup.create': 'Create backups',
  'backup.read': 'View backups',
  'backup.delete': 'Delete backups',
  'backup.restore': 'Restore backups',
  'allocation.read': 'View allocations',
  'allocation.create': 'Add allocations',
  'allocation.update': 'Edit allocations',
  'allocation.delete': 'Remove allocations',
  'startup.read': 'View startup',
  'startup.update': 'Edit startup',
  'settings.rename': 'Rename server',
  'settings.reinstall': 'Reinstall server',
  'activity.read': 'View activity',
  'schedule.read': 'View schedules',
  'schedule.create': 'Create schedules',
  'schedule.update': 'Edit schedules',
  'schedule.delete': 'Delete schedules'
};

export const PERMISSION_GROUPS = {
  'Control': ['control.console', 'control.start', 'control.stop', 'control.restart'],
  'Subusers': ['user.create', 'user.read', 'user.update', 'user.delete'],
  'Files': ['file.read', 'file.create', 'file.update', 'file.delete', 'file.archive', 'file.sftp'],
  'Backups': ['backup.create', 'backup.read', 'backup.delete', 'backup.restore'],
  'Allocations': ['allocation.read', 'allocation.create', 'allocation.update', 'allocation.delete'],
  'Startup': ['startup.read', 'startup.update'],
  'Settings': ['settings.rename', 'settings.reinstall'],
  'Activity': ['activity.read'],
  'Schedules': ['schedule.read', 'schedule.create', 'schedule.update', 'schedule.delete']
};

export function hasPermission(permissions, permission) {
  if (!permissions) return false;
  if (permissions.includes('*')) return true;
  return permissions.includes(permission);
}

export function hasAnyPermission(permissions, perms) {
  return perms.some(p => hasPermission(permissions, p));
}
