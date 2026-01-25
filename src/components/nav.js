import { icon } from './icon.js';
import { navigate } from '../router.js';

export function nav({ user = null, isAdmin = false, currentPath = '/' }) {
  const isAdminPage = currentPath.startsWith('/admin');

  const userMenu = user ? `
    <div class="nav-user" data-dropdown="user-menu">
      <button class="nav-user-btn" type="button">
        <span class="nav-user-avatar">${user.username?.charAt(0).toUpperCase() || 'U'}</span>
        <span class="nav-user-name">${user.username || 'User'}</span>
        ${icon('chevron-down', 16)}
      </button>
      <div class="dropdown-menu" id="user-menu">
        <a href="/account/profile" class="dropdown-item" data-link>
          ${icon('user', 16)}
          <span>Profile</span>
        </a>
        <div class="dropdown-divider"></div>
        <button type="button" class="dropdown-item dropdown-item-danger" data-action="logout">
          ${icon('log-out', 16)}
          <span>Logout</span>
        </button>
      </div>
    </div>
  ` : `
    <a href="/login" class="btn btn--primary" data-link>Login</a>
  `;

  const userLinks = `
    <a href="/dashboard" class="nav-link ${currentPath === '/' || currentPath === '/dashboard' ? 'active' : ''}" data-link>
      ${icon('home', 18)}
      <span>Dashboard</span>
    </a>
    <a href="/servers" class="nav-link ${currentPath.startsWith('/server') && !isAdminPage ? 'active' : ''}" data-link>
      ${icon('server', 18)}
      <span>Servers</span>
    </a>
    ${isAdmin ? `
      <a href="/admin" class="nav-link" data-link>
        ${icon('shield', 18)}
        <span>Admin</span>
      </a>
    ` : ''}
  `;

  const adminLinks = `
    <a href="/admin" class="nav-link ${currentPath === '/admin' ? 'active' : ''}" data-link>
      ${icon('layout-dashboard', 18)}
      <span>Overview</span>
    </a>
    <a href="/admin/servers" class="nav-link ${currentPath.startsWith('/admin/servers') ? 'active' : ''}" data-link>
      ${icon('server', 18)}
      <span>Servers</span>
    </a>
    <a href="/admin/users" class="nav-link ${currentPath.startsWith('/admin/users') ? 'active' : ''}" data-link>
      ${icon('users', 18)}
      <span>Users</span>
    </a>
    <a href="/admin/nodes" class="nav-link ${currentPath.startsWith('/admin/nodes') ? 'active' : ''}" data-link>
      ${icon('hard-drive', 18)}
      <span>Nodes</span>
    </a>
    <a href="/admin/allocations" class="nav-link ${currentPath === '/admin/allocations' ? 'active' : ''}" data-link>
      ${icon('globe', 18)}
      <span>Allocations</span>
    </a>
    <a href="/admin/eggs" class="nav-link ${currentPath === '/admin/eggs' ? 'active' : ''}" data-link>
      ${icon('package', 18)}
      <span>Eggs</span>
    </a>
    <a href="/admin/nests" class="nav-link ${currentPath === '/admin/nests' ? 'active' : ''}" data-link>
      ${icon('folder', 18)}
      <span>Nests</span>
    </a>
    <a href="/admin/settings" class="nav-link ${currentPath === '/admin/settings' ? 'active' : ''}" data-link>
      ${icon('settings', 18)}
      <span>Settings</span>
    </a>
    <div class="nav-divider"></div>
    <a href="/dashboard" class="nav-link nav-link--exit" data-link>
      ${icon('arrow-left', 18)}
      <span>Exit Admin</span>
    </a>
  `;

  return `
    <nav class="navbar" id="main-navbar">
      <div class="nav-container">
        <a href="${isAdminPage ? '/admin' : '/'}" class="nav-logo" data-link>
          <span class="nav-logo-icon">${isAdminPage ? '⚙️' : '🪶'}</span>
          <span class="nav-logo-text">${isAdminPage ? 'Admin' : 'Sodium'}</span>
        </a>
        
        <div class="nav-links" id="nav-links">
          ${isAdminPage ? adminLinks : userLinks}
        </div>
        
        <div class="nav-actions">
          ${userMenu}
        </div>
        
        <button type="button" class="nav-mobile-toggle" id="nav-mobile-toggle" aria-label="Toggle menu">
          ${icon('menu', 24)}
        </button>
      </div>
    </nav>
    <div class="nav-overlay" id="nav-overlay"></div>
  `;
}

export function renderNav() {
  const token = localStorage.getItem('sodium_token');
  const userData = localStorage.getItem('sodium_user');
  const user = userData ? JSON.parse(userData) : null;
  const isAdmin = user?.role === 'admin';
  const currentPath = window.location.pathname || '/';

  return nav({ user, isAdmin, currentPath });
}

let navInitialized = false;

export function initNav() {
  if (navInitialized) return;
  navInitialized = true;

  document.addEventListener('click', (e) => {
    const mobileToggle = e.target.closest('#nav-mobile-toggle');
    if (mobileToggle) {
      e.preventDefault();
      e.stopPropagation();
      const navLinks = document.getElementById('nav-links');
      const overlay = document.getElementById('nav-overlay');
      navLinks?.classList.toggle('open');
      overlay?.classList.toggle('open');
      document.body.classList.toggle('nav-open');
      return;
    }

    const overlay = e.target.closest('#nav-overlay');
    if (overlay) {
      closeNav();
      return;
    }

    const navLink = e.target.closest('.nav-links [data-link]');
    if (navLink) {
      e.preventDefault();
      closeNav();
      const href = navLink.getAttribute('href');
      if (href) navigate(href);
      return;
    }

    const logout = e.target.closest('[data-action="logout"]');
    if (logout) {
      e.preventDefault();
      localStorage.removeItem('sodium_token');
      localStorage.removeItem('sodium_user');
      window.location.href = '/login';
      return;
    }

    const dropdownTrigger = e.target.closest('[data-dropdown]');
    if (dropdownTrigger) {
      e.stopPropagation();
      const menu = dropdownTrigger.querySelector('.dropdown-menu');
      const isOpen = menu?.classList.contains('open');
      
      document.querySelectorAll('.dropdown-menu.open').forEach(m => m.classList.remove('open'));
      
      if (!isOpen && menu) {
        menu.classList.add('open');
      }
      return;
    }

    document.querySelectorAll('.dropdown-menu.open').forEach(m => m.classList.remove('open'));
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeNav();
      document.querySelectorAll('.dropdown-menu.open').forEach(m => m.classList.remove('open'));
    }
  });
}

function closeNav() {
  document.getElementById('nav-links')?.classList.remove('open');
  document.getElementById('nav-overlay')?.classList.remove('open');
  document.body.classList.remove('nav-open');
}
