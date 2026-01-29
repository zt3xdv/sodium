export const INJECTION_POINTS = {
  // === GLOBAL ===
  'global:head': { description: 'Inside <head> tag', position: 'append' },
  'global:body:start': { description: 'Start of <body>', position: 'prepend' },
  'global:body:end': { description: 'End of <body>', position: 'append' },
  
  // === NAVIGATION ===
  'nav:before': { description: 'Before navigation bar', position: 'before' },
  'nav:brand:after': { description: 'After brand logo', position: 'after' },
  'nav:items:before': { description: 'Before nav items', position: 'before' },
  'nav:items:after': { description: 'After nav items', position: 'after' },
  'nav:after': { description: 'After navigation bar', position: 'after' },
  
  // === SIDEBAR ===
  'sidebar:header:before': { description: 'Before sidebar header', position: 'before' },
  'sidebar:header:after': { description: 'After sidebar header', position: 'after' },
  'sidebar:nav:before': { description: 'Before sidebar nav list', position: 'before' },
  'sidebar:nav:start': { description: 'Start of nav list (top)', position: 'prepend' },
  'sidebar:nav:end': { description: 'End of nav list (bottom)', position: 'append' },
  'sidebar:nav:after': { description: 'After sidebar nav list', position: 'after' },
  'sidebar:footer:before': { description: 'Before sidebar footer', position: 'before' },
  'sidebar:footer:after': { description: 'After sidebar footer', position: 'after' },
  
  // === AUTH PAGE ===
  'auth:container:before': { description: 'Before auth container', position: 'before' },
  'auth:header:before': { description: 'Before auth header', position: 'before' },
  'auth:header:after': { description: 'After auth header', position: 'after' },
  'auth:tabs:before': { description: 'Before auth tabs', position: 'before' },
  'auth:tabs:after': { description: 'After auth tabs', position: 'after' },
  
  // Login form
  'auth:login:before': { description: 'Before login form', position: 'before' },
  'auth:login:fields:before': { description: 'Before login fields', position: 'prepend' },
  'auth:login:fields:after': { description: 'After login fields', position: 'append' },
  'auth:login:button:before': { description: 'Before login button', position: 'before' },
  'auth:login:button:after': { description: 'After login button', position: 'after' },
  'auth:login:providers': { description: 'OAuth providers (Google, Discord, etc)', position: 'append' },
  'auth:login:after': { description: 'After login form', position: 'after' },
  
  // Register form
  'auth:register:before': { description: 'Before register form', position: 'before' },
  'auth:register:fields:before': { description: 'Before register fields', position: 'prepend' },
  'auth:register:fields:after': { description: 'After register fields', position: 'append' },
  'auth:register:button:before': { description: 'Before register button', position: 'before' },
  'auth:register:button:after': { description: 'After register button', position: 'after' },
  'auth:register:providers': { description: 'OAuth providers for register', position: 'append' },
  'auth:register:after': { description: 'After register form', position: 'after' },
  
  'auth:container:after': { description: 'After auth container', position: 'after' },
  
  // === DASHBOARD ===
  'dashboard:before': { description: 'Before dashboard content', position: 'before' },
  'dashboard:header:before': { description: 'Before dashboard header', position: 'before' },
  'dashboard:header:after': { description: 'After dashboard header', position: 'after' },
  'dashboard:stats:before': { description: 'Before stats cards', position: 'before' },
  'dashboard:stats:after': { description: 'After stats cards', position: 'after' },
  'dashboard:servers:before': { description: 'Before servers list', position: 'before' },
  'dashboard:servers:after': { description: 'After servers list', position: 'after' },
  'dashboard:after': { description: 'After dashboard content', position: 'after' },
  
  // === SERVERS LIST ===
  'servers:before': { description: 'Before servers page', position: 'before' },
  'servers:header:before': { description: 'Before servers header', position: 'before' },
  'servers:header:actions': { description: 'Server header action buttons', position: 'append' },
  'servers:header:after': { description: 'After servers header', position: 'after' },
  'servers:filters:before': { description: 'Before server filters', position: 'before' },
  'servers:filters:after': { description: 'After server filters', position: 'after' },
  'servers:list:before': { description: 'Before servers list', position: 'before' },
  'servers:list:after': { description: 'After servers list', position: 'after' },
  'servers:after': { description: 'After servers page', position: 'after' },
  
  // === SERVER VIEW ===
  'server:before': { description: 'Before server view', position: 'before' },
  'server:header:before': { description: 'Before server header', position: 'before' },
  'server:header:info': { description: 'Server header info area', position: 'append' },
  'server:header:actions': { description: 'Server action buttons', position: 'append' },
  'server:header:after': { description: 'After server header', position: 'after' },
  
  // Server tabs
  'server:tabs:before': { description: 'Before server tabs', position: 'before' },
  'server:tabs:start': { description: 'Start of tabs (left)', position: 'prepend' },
  'server:tabs:end': { description: 'End of tabs (right)', position: 'append' },
  'server:tabs:after': { description: 'After server tabs', position: 'after' },
  
  // Console tab
  'server:console:before': { description: 'Before console', position: 'before' },
  'server:console:terminal:before': { description: 'Before terminal', position: 'before' },
  'server:console:terminal:after': { description: 'After terminal', position: 'after' },
  'server:console:input:before': { description: 'Before command input', position: 'before' },
  'server:console:input:after': { description: 'After command input', position: 'after' },
  'server:console:actions': { description: 'Console action buttons', position: 'append' },
  'server:console:after': { description: 'After console', position: 'after' },
  
  // Files tab
  'server:files:before': { description: 'Before file manager', position: 'before' },
  'server:files:toolbar:before': { description: 'Before file toolbar', position: 'before' },
  'server:files:toolbar:actions': { description: 'File toolbar actions', position: 'append' },
  'server:files:toolbar:after': { description: 'After file toolbar', position: 'after' },
  'server:files:list:before': { description: 'Before file list', position: 'before' },
  'server:files:list:after': { description: 'After file list', position: 'after' },
  'server:files:after': { description: 'After file manager', position: 'after' },
  
  // Startup tab
  'server:startup:before': { description: 'Before startup settings', position: 'before' },
  'server:startup:variables:before': { description: 'Before startup variables', position: 'before' },
  'server:startup:variables:after': { description: 'After startup variables', position: 'after' },
  'server:startup:after': { description: 'After startup settings', position: 'after' },
  
  // Settings tab  
  'server:settings:before': { description: 'Before server settings', position: 'before' },
  'server:settings:after': { description: 'After server settings', position: 'after' },
  
  // Backups tab
  'server:backups:before': { description: 'Before backups', position: 'before' },
  'server:backups:actions': { description: 'Backup action buttons', position: 'append' },
  'server:backups:list:before': { description: 'Before backup list', position: 'before' },
  'server:backups:list:after': { description: 'After backup list', position: 'after' },
  'server:backups:after': { description: 'After backups', position: 'after' },
  
  // Network tab
  'server:network:before': { description: 'Before network settings', position: 'before' },
  'server:network:after': { description: 'After network settings', position: 'after' },
  
  // Schedules tab
  'server:schedules:before': { description: 'Before schedules', position: 'before' },
  'server:schedules:after': { description: 'After schedules', position: 'after' },
  
  // Users/subusers tab
  'server:users:before': { description: 'Before users management', position: 'before' },
  'server:users:after': { description: 'After users management', position: 'after' },
  
  'server:after': { description: 'After server view', position: 'after' },
  
  // === ADMIN ===
  'admin:before': { description: 'Before admin page', position: 'before' },
  'admin:sidebar:before': { description: 'Before admin sidebar', position: 'before' },
  'admin:sidebar:items': { description: 'Admin sidebar items', position: 'append' },
  'admin:sidebar:after': { description: 'After admin sidebar', position: 'after' },
  'admin:content:before': { description: 'Before admin content', position: 'before' },
  'admin:content:after': { description: 'After admin content', position: 'after' },
  
  // Admin sections
  'admin:users:before': { description: 'Before users section', position: 'before' },
  'admin:users:actions': { description: 'User management actions', position: 'append' },
  'admin:users:after': { description: 'After users section', position: 'after' },
  
  'admin:servers:before': { description: 'Before servers section', position: 'before' },
  'admin:servers:actions': { description: 'Server management actions', position: 'append' },
  'admin:servers:after': { description: 'After servers section', position: 'after' },
  
  'admin:nodes:before': { description: 'Before nodes section', position: 'before' },
  'admin:nodes:actions': { description: 'Node management actions', position: 'append' },
  'admin:nodes:after': { description: 'After nodes section', position: 'after' },
  
  'admin:eggs:before': { description: 'Before eggs section', position: 'before' },
  'admin:eggs:after': { description: 'After eggs section', position: 'after' },
  
  'admin:plugins:before': { description: 'Before plugins section', position: 'before' },
  'admin:plugins:after': { description: 'After plugins section', position: 'after' },
  
  'admin:settings:before': { description: 'Before settings section', position: 'before' },
  'admin:settings:after': { description: 'After settings section', position: 'after' },
  
  'admin:after': { description: 'After admin page', position: 'after' },
  
  // === PROFILE ===
  'profile:before': { description: 'Before profile page', position: 'before' },
  'profile:header:before': { description: 'Before profile header', position: 'before' },
  'profile:header:after': { description: 'After profile header', position: 'after' },
  'profile:info:before': { description: 'Before profile info', position: 'before' },
  'profile:info:after': { description: 'After profile info', position: 'after' },
  'profile:security:before': { description: 'Before security section', position: 'before' },
  'profile:security:after': { description: 'After security section', position: 'after' },
  'profile:after': { description: 'After profile page', position: 'after' },
  
  // === SETTINGS ===
  'settings:before': { description: 'Before settings page', position: 'before' },
  'settings:sections:before': { description: 'Before settings sections', position: 'before' },
  'settings:sections:after': { description: 'After settings sections', position: 'after' },
  'settings:after': { description: 'After settings page', position: 'after' },
  
  // === STATUS ===
  'status:before': { description: 'Before status page', position: 'before' },
  'status:nodes:before': { description: 'Before nodes status', position: 'before' },
  'status:nodes:after': { description: 'After nodes status', position: 'after' },
  'status:after': { description: 'After status page', position: 'after' },
  
  // === MODALS ===
  'modal:before': { description: 'Before modal content', position: 'before' },
  'modal:header:after': { description: 'After modal header', position: 'after' },
  'modal:body:before': { description: 'Before modal body', position: 'before' },
  'modal:body:after': { description: 'After modal body', position: 'after' },
  'modal:footer:before': { description: 'Before modal footer', position: 'before' },
  'modal:footer:after': { description: 'After modal footer', position: 'after' },
  'modal:after': { description: 'After modal content', position: 'after' }
};

export function getInjectionPointInfo(pointId) {
  return INJECTION_POINTS[pointId] || null;
}

export function getAllInjectionPoints() {
  return Object.entries(INJECTION_POINTS).map(([id, info]) => ({
    id,
    ...info
  }));
}

export function getInjectionPointsByCategory(category) {
  return Object.entries(INJECTION_POINTS)
    .filter(([id]) => id.startsWith(category + ':'))
    .map(([id, info]) => ({ id, ...info }));
}
