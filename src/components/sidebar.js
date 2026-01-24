import { icon } from './icon.js';

const adminSections = [
  { id: 'overview', label: 'Overview', icon: 'home', path: '/admin' },
  { id: 'servers', label: 'Servers', icon: 'server', path: '/admin/servers' },
  { id: 'users', label: 'Users', icon: 'users', path: '/admin/users' },
  { id: 'nodes', label: 'Nodes', icon: 'hard-drive', path: '/admin/nodes' },
  { id: 'allocations', label: 'Allocations', icon: 'globe', path: '/admin/allocations' },
  { id: 'eggs', label: 'Eggs', icon: 'package', path: '/admin/eggs' },
  { id: 'nests', label: 'Nests', icon: 'folder', path: '/admin/nests' },
  { divider: true },
  { id: 'settings', label: 'Settings', icon: 'settings', path: '/admin/settings' },
];

const serverSections = [
  { id: 'console', label: 'Console', icon: 'terminal', path: 'console' },
  { id: 'files', label: 'Files', icon: 'folder', path: 'files' },
  { id: 'databases', label: 'Databases', icon: 'database', path: 'databases' },
  { id: 'schedules', label: 'Schedules', icon: 'clock', path: 'schedules' },
  { id: 'users', label: 'Users', icon: 'users', path: 'users' },
  { id: 'backups', label: 'Backups', icon: 'archive', path: 'backups' },
  { id: 'network', label: 'Network', icon: 'globe', path: 'network' },
  { id: 'startup', label: 'Startup', icon: 'play', path: 'startup' },
  { divider: true },
  { id: 'settings', label: 'Settings', icon: 'settings', path: 'settings' },
];

export function sidebar({ type = 'admin', currentPath = '', serverId = null, collapsed = false }) {
  const sections = type === 'admin' ? adminSections : serverSections;
  const baseUrl = type === 'server' && serverId ? `/server/${serverId}` : '';

  const items = sections.map(section => {
    if (section.divider) {
      return '<div class="sidebar-divider"></div>';
    }

    const href = type === 'admin' ? section.path : `${baseUrl}/${section.path}`;
    const isActive = type === 'admin' 
      ? currentPath === section.path || (section.id === 'overview' && currentPath === '/admin')
      : currentPath.endsWith(section.path);

    return `
      <a href="${href}" class="sidebar-item ${isActive ? 'active' : ''}">
        ${icon(section.icon, 18)}
        <span class="sidebar-label">${section.label}</span>
      </a>
    `;
  }).join('');

  return `
    <aside class="sidebar ${collapsed ? 'collapsed' : ''}" data-sidebar>
      <div class="sidebar-header">
        <button class="sidebar-toggle" data-action="toggle-sidebar">
          ${icon('chevron-right', 20)}
        </button>
      </div>
      <div class="sidebar-content">
        ${items}
      </div>
    </aside>
  `;
}

export function renderAdminSidebar(active = 'overview') {
  const items = adminSections.map(section => {
    if (section.divider) {
      return '<div class="sidebar-divider"></div>';
    }
    const isActive = section.id === active || (active === 'dashboard' && section.id === 'overview');
    return `
      <a href="#${section.path}" class="sidebar-link ${isActive ? 'active' : ''}">
        ${icon(section.icon, 18)}
        <span>${section.label}</span>
      </a>
    `;
  }).join('');

  return `
    <aside class="admin-sidebar">
      <div class="sidebar-header">
        <h2>${icon('shield', 20)} Admin</h2>
      </div>
      <nav class="sidebar-nav">
        ${items}
      </nav>
    </aside>
  `;
}

export function renderServerSidebar(serverId, active = 'console') {
  const items = serverSections.map(section => {
    if (section.divider) {
      return '<div class="sidebar-divider"></div>';
    }
    const isActive = section.id === active;
    return `
      <a href="#/server/${serverId}/${section.path}" class="sidebar-link ${isActive ? 'active' : ''}">
        ${icon(section.icon, 18)}
        <span>${section.label}</span>
      </a>
    `;
  }).join('');

  return `
    <aside class="admin-sidebar">
      <div class="sidebar-header">
        <h2>${icon('server', 20)} Server</h2>
      </div>
      <nav class="sidebar-nav">
        ${items}
      </nav>
    </aside>
  `;
}

export function initSidebar() {
  document.addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-action="toggle-sidebar"]');
    if (toggle) {
      const sidebar = document.querySelector('[data-sidebar]');
      sidebar?.classList.toggle('collapsed');
      localStorage.setItem('sidebar-collapsed', sidebar?.classList.contains('collapsed'));
    }
  });

  const isCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';
  if (isCollapsed) {
    document.querySelector('[data-sidebar]')?.classList.add('collapsed');
  }
}
