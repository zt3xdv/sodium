# Role & Permission System

> Granular, customizable role-based access control replacing the current hardcoded `user | moderator | admin` system.

---

## Current State

### What exists today

**Roles** (`src/server/utils/auth.js`):
- Three hardcoded roles: `user`, `moderator`, `admin`
- `isAdmin` boolean flag on user objects
- `requireAdmin` and `requireModerator` middleware
- Role determined by `getUserRole()` which checks `isAdmin` flag first, then `role` field

**Subuser permissions** (`src/utils/permissions.js`):
- 32 granular permissions grouped into 9 categories (Control, Subusers, Files, Backups, Allocations, Startup, Settings, Activity, Schedules)
- Only apply to subusers on individual servers, NOT to panel-wide access
- `hasPermission()` checks against a flat array of permission strings
- Wildcard `*` grants all permissions

**Admin routes** (`src/server/routes/admin.js`):
- All admin routes use `requireAdmin` middleware (line 19) - all or nothing
- Moderator role exists but has no distinct middleware usage beyond `requireModerator`
- No granular admin permissions (any admin can do everything)

### Problems
1. Admins have full access to everything - no way to give "manage users only" access
2. Moderator role has no defined permissions - it's just a label
3. No custom roles - can't create "Support Staff", "Developer", "Billing Manager"
4. Panel-wide permissions and server-level permissions are completely separate systems
5. No permission inheritance or role hierarchy
6. `isAdmin` boolean and `role` field are redundant and can conflict

---

## Plan

### New Permission Architecture

```
Panel Permissions (role-based)          Server Permissions (per-server)
├── admin.nodes.*                       ├── control.*
├── admin.servers.*                     ├── file.*
├── admin.users.*                       ├── backup.*
├── admin.nests.*                       ├── user.*
├── admin.locations.*                   ├── allocation.*
├── admin.announcements.*               ├── startup.*
├── admin.audit.*                       ├── settings.*
├── admin.settings.*                    ├── activity.*
├── admin.webhooks.*                    └── schedule.*
├── admin.plugins.*                     
├── panel.view_admin                    
├── panel.create_servers                
└── panel.manage_own_account            
```

### Role Definition

Roles become a named collection of panel permissions stored in the database, not hardcoded:

```json
{
  "id": "role_abc123",
  "name": "Support Staff",
  "description": "Can view and manage users, view servers, but cannot modify nodes or settings",
  "color": "#3b82f6",
  "isSystem": false,
  "priority": 50,
  "permissions": [
    "admin.users.read",
    "admin.users.update",
    "admin.servers.read",
    "admin.audit.read",
    "panel.view_admin"
  ],
  "createdAt": "2025-01-01T00:00:00Z"
}
```

### Default System Roles

These are created on install and cannot be deleted (but can be modified):

| Role | Priority | Key Permissions |
|---|---|---|
| **Super Admin** | 100 | `*` (all permissions, cannot be removed from this role) |
| **Admin** | 90 | All `admin.*` and `panel.*` permissions |
| **Moderator** | 50 | `admin.users.read`, `admin.servers.read`, `admin.audit.read`, `panel.view_admin` |
| **User** | 10 | `panel.create_servers`, `panel.manage_own_account` |

Priority determines hierarchy - a role can only manage roles with lower priority.

### Full Panel Permission List

```js
export const PANEL_PERMISSIONS = {
  // Node management
  'admin.nodes.read': 'View nodes',
  'admin.nodes.create': 'Create nodes',
  'admin.nodes.update': 'Edit nodes',
  'admin.nodes.delete': 'Delete nodes',

  // Server management (admin-level, all servers)
  'admin.servers.read': 'View all servers',
  'admin.servers.create': 'Create servers for any user',
  'admin.servers.update': 'Edit any server',
  'admin.servers.delete': 'Delete any server',
  'admin.servers.suspend': 'Suspend/unsuspend servers',

  // User management
  'admin.users.read': 'View users',
  'admin.users.create': 'Create users',
  'admin.users.update': 'Edit users',
  'admin.users.delete': 'Delete users',
  'admin.users.roles': 'Assign roles to users',

  // Nests & Eggs
  'admin.nests.read': 'View nests & eggs',
  'admin.nests.create': 'Create nests & eggs',
  'admin.nests.update': 'Edit nests & eggs',
  'admin.nests.delete': 'Delete nests & eggs',

  // Locations
  'admin.locations.read': 'View locations',
  'admin.locations.create': 'Create locations',
  'admin.locations.update': 'Edit locations',
  'admin.locations.delete': 'Delete locations',

  // Announcements
  'admin.announcements.read': 'View announcements',
  'admin.announcements.create': 'Create announcements',
  'admin.announcements.update': 'Edit announcements',
  'admin.announcements.delete': 'Delete announcements',

  // Audit logs
  'admin.audit.read': 'View audit logs',

  // Panel settings
  'admin.settings.read': 'View panel settings',
  'admin.settings.update': 'Modify panel settings',

  // Webhooks
  'admin.webhooks.read': 'View webhooks',
  'admin.webhooks.create': 'Create webhooks',
  'admin.webhooks.update': 'Edit webhooks',
  'admin.webhooks.delete': 'Delete webhooks',

  // Plugins (for future plugin system)
  'admin.plugins.read': 'View plugins',
  'admin.plugins.manage': 'Install/activate/deactivate plugins',

  // Panel-level
  'panel.view_admin': 'Access admin area',
  'panel.create_servers': 'Create own servers',
  'panel.manage_own_account': 'Edit own profile and settings'
};

export const PANEL_PERMISSION_GROUPS = {
  'Nodes': ['admin.nodes.read', 'admin.nodes.create', 'admin.nodes.update', 'admin.nodes.delete'],
  'Servers': ['admin.servers.read', 'admin.servers.create', 'admin.servers.update', 'admin.servers.delete', 'admin.servers.suspend'],
  'Users': ['admin.users.read', 'admin.users.create', 'admin.users.update', 'admin.users.delete', 'admin.users.roles'],
  'Nests & Eggs': ['admin.nests.read', 'admin.nests.create', 'admin.nests.update', 'admin.nests.delete'],
  'Locations': ['admin.locations.read', 'admin.locations.create', 'admin.locations.update', 'admin.locations.delete'],
  'Announcements': ['admin.announcements.read', 'admin.announcements.create', 'admin.announcements.update', 'admin.announcements.delete'],
  'Audit': ['admin.audit.read'],
  'Settings': ['admin.settings.read', 'admin.settings.update'],
  'Webhooks': ['admin.webhooks.read', 'admin.webhooks.create', 'admin.webhooks.update', 'admin.webhooks.delete'],
  'Plugins': ['admin.plugins.read', 'admin.plugins.manage'],
  'Panel': ['panel.view_admin', 'panel.create_servers', 'panel.manage_own_account']
};
```

---

## Implementation

### Database Changes

Add `roles` collection to `src/server/db.js`:

```js
const COLLECTIONS = {
  // ... existing
  roles: 13
};
```

Modify user objects - replace `isAdmin` + `role` with `roleId`:

```json
{
  "id": "user_abc",
  "username": "john",
  "roleId": "role_admin",
  "permissions": []
}
```

Users get permissions from their role, plus optional per-user permission overrides in `permissions` array.

### Auth Middleware Changes

**Replace** `requireAdmin` and `requireModerator` with `requirePermission()`:

```js
// src/server/utils/auth.js

export function getUserPermissions(user) {
  const role = getRoleById(user.roleId);
  const rolePerms = role?.permissions || [];
  const userPerms = user.permissions || [];

  // Merge: role permissions + user-specific overrides
  const all = new Set([...rolePerms, ...userPerms]);
  return [...all];
}

export function hasPermission(user, permission) {
  const perms = getUserPermissions(user);
  if (perms.includes('*')) return true;

  // Check exact match
  if (perms.includes(permission)) return true;

  // Check wildcard: admin.nodes.* matches admin.nodes.read
  const parts = permission.split('.');
  for (let i = parts.length - 1; i > 0; i--) {
    const wildcard = parts.slice(0, i).join('.') + '.*';
    if (perms.includes(wildcard)) return true;
  }

  return false;
}

export function requirePermission(...permissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const hasAny = permissions.some(p => hasPermission(req.user, p));
    if (!hasAny) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: permissions
      });
    }

    next();
  };
}

// Backward compatibility
export function requireAdmin(req, res, next) {
  return requirePermission('*')(req, res, next);
}
```

### Admin Route Changes

**Before** (`src/server/routes/admin.js` line 19):
```js
router.use(authenticateUser, requireAdmin);
```

**After** - per-route permissions:
```js
router.use(authenticateUser, requirePermission('panel.view_admin'));

// Nodes
router.get('/nodes', requirePermission('admin.nodes.read'), (req, res) => { ... });
router.post('/nodes', requirePermission('admin.nodes.create'), (req, res) => { ... });
router.put('/nodes/:id', requirePermission('admin.nodes.update'), (req, res) => { ... });
router.delete('/nodes/:id', requirePermission('admin.nodes.delete'), (req, res) => { ... });

// Users
router.get('/users', requirePermission('admin.users.read'), (req, res) => { ... });
router.post('/users', requirePermission('admin.users.create'), async (req, res) => { ... });
router.put('/users/:id', requirePermission('admin.users.update'), (req, res) => { ... });
router.delete('/users/:id', requirePermission('admin.users.delete'), async (req, res) => { ... });

// ... same pattern for all admin routes
```

### Role CRUD API

New routes in `src/server/routes/admin.js` (or separate `roles.js`):

```
GET    /api/admin/roles              - List all roles
POST   /api/admin/roles              - Create role
PUT    /api/admin/roles/:id          - Update role
DELETE /api/admin/roles/:id          - Delete role (if not system role)
GET    /api/admin/roles/:id/users    - List users with this role
GET    /api/admin/permissions        - List all available permissions
```

### Frontend Changes

**Admin sidebar** - Show/hide sections based on user permissions:

```js
// src/components/sidebar.js
function renderAdminSidebar(user) {
  const items = [];

  if (hasPermission(user, 'admin.nodes.read'))
    items.push({ label: 'Nodes', href: '/admin/nodes', icon: 'dns' });
  if (hasPermission(user, 'admin.servers.read'))
    items.push({ label: 'Servers', href: '/admin/servers', icon: 'storage' });
  if (hasPermission(user, 'admin.users.read'))
    items.push({ label: 'Users', href: '/admin/users', icon: 'people' });
  // ...

  return items;
}
```

**Role management UI** (`src/routes/admin/roles.js`):
- Table of roles with name, color badge, user count, permission count
- Create/edit role form with permission checkboxes grouped by category
- Drag to reorder priority
- Assign role to user from user edit page

### JWT Token Changes

Include permissions in the JWT payload for fast checks:

```js
// src/server/routes/auth.js
const token = jwt.sign({
  id: user.id,
  username: user.username,
  roleId: user.roleId,
  permissions: getUserPermissions(user)  // cached in token
}, JWT_SECRET, { expiresIn: '7d' });
```

Frontend reads permissions from token to show/hide UI elements without extra API calls.

---

## Migration

Existing users need to be migrated from the old system:

```js
function migrateUserRoles() {
  const users = loadUsers().users;

  // Create default system roles if they don't exist
  ensureSystemRoles();

  for (const user of users) {
    if (user.roleId) continue; // Already migrated

    if (user.isAdmin || user.role === 'admin') {
      user.roleId = 'role_admin';
    } else if (user.role === 'moderator') {
      user.roleId = 'role_moderator';
    } else {
      user.roleId = 'role_user';
    }

    // Keep isAdmin for backward compat during transition
  }

  saveUsers({ users });
}
```

---

## Implementation Order

1. Define `PANEL_PERMISSIONS` and `PANEL_PERMISSION_GROUPS` in `src/utils/permissions.js`
2. Add `roles` collection to `db.js`, create default system roles
3. Implement `requirePermission()` middleware, replace `requireAdmin` usage
4. Add role CRUD API endpoints
5. Migrate existing users to role-based system
6. Update JWT token to include permissions
7. Update admin sidebar to show/hide based on permissions
8. Build role management admin UI
9. Update user edit form to assign roles
10. Remove `isAdmin` boolean (use permissions only)
