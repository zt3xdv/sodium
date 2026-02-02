import { getUser } from '../utils/api.js';

export function renderSidebar() {
  const sidebar = document.createElement('aside');
  sidebar.id = 'sidebar';
  sidebar.className = 'sidebar';
  
  const currentPath = window.location.pathname;
  const user = getUser();
  
  const sections = [
    {
      label: null,
      items: [
        { path: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
        { path: '/servers', icon: 'dns', label: 'Servers' }
      ]
    },
    {
      label: 'Monitoring',
      items: [
        { path: '/status', icon: 'monitor_heart', label: 'Status' },
        { path: '/activity', icon: 'timeline', label: 'Activity' }
      ]
    },
    {
      label: 'Account',
      items: [
        { path: '/profile', icon: 'person', label: 'Profile' },
        { path: '/settings', icon: 'settings', label: 'Settings' }
      ]
    }
  ];
  
  const adminSection = {
    label: 'Administration',
    items: [
      { path: '/admin/nodes', icon: 'dns', label: 'Nodes' },
      { path: '/admin/servers', icon: 'storage', label: 'Servers' },
      { path: '/admin/users', icon: 'people', label: 'Users' },
      { path: '/admin/nests', icon: 'egg', label: 'Nests' },
      { path: '/admin/locations', icon: 'location_on', label: 'Locations' },
      { path: '/admin/announcements', icon: 'campaign', label: 'Announcements' },
      { path: '/admin/webhooks', icon: 'webhook', label: 'Webhooks' },
      { path: '/admin/audit', icon: 'history', label: 'Audit Log' },
      { path: '/admin/settings', icon: 'tune', label: 'Panel Settings' }
    ]
  };
  
  if (user?.isAdmin) {
    sections.push(adminSection);
  }
  
  const renderSection = (section) => {
    const header = section.label 
      ? `<div class="nav-section-label">${section.label}</div>` 
      : '';
    
    const items = section.items.map(item => `
      <li class="nav-item">
        <a href="${item.path}" class="nav-link ${currentPath === item.path || currentPath.startsWith(item.path + '/') ? 'active' : ''}">
          <span class="material-icons-outlined">${item.icon}</span>
          <span class="nav-text">${item.label}</span>
        </a>
      </li>
    `).join('');
    
    return `
      <div class="nav-section">
        ${header}
        <ul class="nav-list">${items}</ul>
      </div>
    `;
  };
  
  sidebar.innerHTML = `
    <div class="sidebar-header">
      <a href="/dashboard" class="sidebar-brand">
        <span class="material-icons-outlined">bolt</span>
        <span class="brand-text">Sodium</span>
      </a>
    </div>
    
    <nav class="sidebar-nav">
      ${sections.map(renderSection).join('')}
    </nav>
    
    <div class="sidebar-footer">
      <div class="footer-content">
        <span class="version">v1.0.0</span>
      </div>
    </div>
  `;
  
  setTimeout(() => {
    const closeOnMobile = () => {
      if (window.innerWidth <= 768) {
        sidebar.classList.remove('open');
      }
    };
    
    sidebar.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', closeOnMobile);
    });
  }, 0);
  
  return sidebar;
}
