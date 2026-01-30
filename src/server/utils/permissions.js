export { PERMISSIONS, PERMISSION_GROUPS } from '../../utils/permissions.js';

export function hasPermission(subuser, permission) {
  if (!subuser || !subuser.permissions) return false;
  if (subuser.permissions.includes('*')) return true;
  return subuser.permissions.includes(permission);
}

export function hasAnyPermission(subuser, permissions) {
  return permissions.some(p => hasPermission(subuser, p));
}
