import { clearAuth } from '../utils/api.js';
import { escapeHtml } from '../utils/security.js';

export function renderNav() {
  const nav = document.createElement('nav');
  nav.id = 'navbar';
  nav.className = 'navbar';
  
  const displayName = escapeHtml(localStorage.getItem('displayName') || localStorage.getItem('username') || 'User');
  const isLoggedIn = !!localStorage.getItem('loggedIn');
  
  nav.innerHTML = `
    <div class="nav-content">
      <div class="nav-left">
        <button class="nav-toggle" id="sidebar-toggle">
          <span class="material-icons-outlined">menu</span>
        </button>
        <a href="/dashboard" class="nav-brand">
          <span class="material-icons-outlined">bolt</span>
          <span class="brand-text">Sodium</span>
        </a>
      </div>
      
      <div class="nav-right">
        ${isLoggedIn ? `
          <div class="user-menu" id="user-menu">
            <button class="user-menu-btn" id="user-menu-btn">
              <div class="user-avatar">
                <span class="material-icons-outlined">person</span>
              </div>
              <span class="user-display-name">${displayName}</span>
              <span class="material-icons-outlined dropdown-icon">expand_more</span>
            </button>
            <div class="user-dropdown" id="user-dropdown">
              <a href="/profile" class="dropdown-item">
                <span class="material-icons-outlined">person</span>
                <span>Profile</span>
              </a>
              <a href="/settings" class="dropdown-item">
                <span class="material-icons-outlined">settings</span>
                <span>Settings</span>
              </a>
              <hr class="dropdown-divider">
              <button class="dropdown-item logout" id="nav-logout">
                <span class="material-icons-outlined">logout</span>
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
  
  setTimeout(() => {
    const toggle = nav.querySelector('#sidebar-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar) {
          const isOpen = sidebar.classList.toggle('open');
          if (overlay) {
            overlay.classList.toggle('active', isOpen);
          }
        }
      });
    }
    
    const userMenuBtn = nav.querySelector('#user-menu-btn');
    const userDropdown = nav.querySelector('#user-dropdown');
    
    if (userMenuBtn && userDropdown) {
      userMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        userDropdown.classList.toggle('active');
      });
      
      document.addEventListener('click', () => {
        userDropdown.classList.remove('active');
      });
    }
    
    const logoutBtn = nav.querySelector('#nav-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        clearAuth();
        window.router.navigateTo('/auth');
      });
    }
  }, 0);
  
  return nav;
}
