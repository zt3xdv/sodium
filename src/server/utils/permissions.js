export const PERMISSIONS = {
  'control.console': 'Send commands to console',
  'control.start': 'Start the server',
  'control.stop': 'Stop the server',
  'control.restart': 'Restart the server',
  
  'user.create': 'Create subusers',
  'user.read': 'View subusers',
  'user.update': 'Update subusers',
  'user.delete': 'Delete subusers',
  
  'file.read': 'Read files',
  'file.create': 'Create files',
  'file.update': 'Update files',
  'file.delete': 'Delete files',
  'file.archive': 'Archive files',
  'file.sftp': 'SFTP access',
  
  'backup.create': 'Create backups',
  'backup.read': 'View backups',
  'backup.delete': 'Delete backups',
  'backup.restore': 'Restore backups',
  
  'allocation.read': 'View allocations',
  'allocation.create': 'Create allocations',
  'allocation.update': 'Update allocations',
  'allocation.delete': 'Delete allocations',
  
  'startup.read': 'View startup config',
  'startup.update': 'Update startup config',
  
  'settings.rename': 'Rename server',
  'settings.reinstall': 'Reinstall server',
  
  'activity.read': 'View activity logs'
};

export const PERMISSION_GROUPS = {
  'Control': ['control.console', 'control.start', 'control.stop', 'control.restart'],
  'Subusers': ['user.create', 'user.read', 'user.update', 'user.delete'],
  'Files': ['file.read', 'file.create', 'file.update', 'file.delete', 'file.archive', 'file.sftp'],
  'Backups': ['backup.create', 'backup.read', 'backup.delete', 'backup.restore'],
  'Allocations': ['allocation.read', 'allocation.create', 'allocation.update', 'allocation.delete'],
  'Startup': ['startup.read', 'startup.update'],
  'Settings': ['settings.rename', 'settings.reinstall'],
  'Activity': ['activity.read']
};

export function hasPermission(subuser, permission) {
  if (!subuser || !subuser.permissions) return false;
  if (subuser.permissions.includes('*')) return true;
  return subuser.permissions.includes(permission);
}

export function hasAnyPermission(subuser, permissions) {
  return permissions.some(p => hasPermission(subuser, p));
}
