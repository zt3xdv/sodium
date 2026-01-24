import { icon } from './icon.js';

export function nav({ user = null, isAdmin = false, currentPath = '/' }) {
  const userMenu = user ? `
    <div class="nav-user" data-dropdown="user-menu">
      <button class="nav-user-btn">
        <span class="nav-user-avatar">${user.username?.charAt(0).toUpperCase() || 'U'}</span>
        <span class="nav-user-name">${user.username || 'User'}</span>
        ${icon('chevron-down', 16)}
      </button>
      <div class="dropdown-menu" id="user-menu">
        <a href="/profile" class="dropdown-item">
          ${icon('user', 16)}
          <span>Profile</span>
        </a>
        <a href="/api-keys" class="dropdown-item">
          ${icon('key', 16)}
          <span>API Keys</span>
        </a>
        <div class="dropdown-divider"></div>
        <a href="/logout" class="dropdown-item dropdown-item-danger" data-action="logout">
          ${icon('log-out', 16)}
          <span>Logout</span>
        </a>
      </div>
    </div>
  ` : `
    <a href="/login" class="btn btn-primary">Login</a>
  `;

  const adminLink = isAdmin ? `
    <a href="/admin" class="nav-link ${currentPath.startsWith('/admin') ? 'active' : ''}">
      ${icon('shield', 18)}
      <span>Admin</span>
    </a>
  ` : '';

  return `
    <nav class="navbar">
      <div class="nav-container">
        <a href="/" class="nav-logo">
          <span class="nav-logo-icon">🪶</span>
          <span class="nav-logo-text">Sodium</span>
        </a>
        
        <div class="nav-links">
          <a href="/dashboard" class="nav-link ${currentPath === '/dashboard' ? 'active' : ''}">
            ${icon('home', 18)}
            <span>Dashboard</span>
          </a>
          <a href="/servers" class="nav-link ${currentPath.startsWith('/server') ? 'active' : ''}">
            ${icon('server', 18)}
            <span>Servers</span>
          </a>
          ${adminLink}
        </div>
        
        <div class="nav-actions">
          ${userMenu}
        </div>
        
        <button class="nav-mobile-toggle" data-action="toggle-mobile-nav">
          ${icon('menu', 24)}
        </button>
      </div>
    </nav>
  `;
}

export function renderNav() {
  const token = localStorage.getItem('sodium_token');
  const userData = localStorage.getItem('sodium_user');
  const user = userData ? JSON.parse(userData) : null;
  const isAdmin = user?.role === 'admin';
  const currentPath = window.location.hash.slice(1) || '/';

  return nav({ user, isAdmin, currentPath });
}

export function initNav() {
  document.addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-action="toggle-mobile-nav"]');
    if (toggle) {
      document.querySelector('.nav-links')?.classList.toggle('open');
    }

    const logout = e.target.closest('[data-action="logout"]');
    if (logout) {
      e.preventDefault();
      localStorage.removeItem('sodium_token');
      localStorage.removeItem('sodium_user');
      window.location.hash = '/login';
    }

    const dropdown = e.target.closest('[data-dropdown]');
    if (dropdown) {
      const menu = dropdown.querySelector('.dropdown-menu');
      menu?.classList.toggle('open');
    } else {
      document.querySelectorAll('.dropdown-menu.open').forEach(m => m.classList.remove('open'));
    }
  });
}
