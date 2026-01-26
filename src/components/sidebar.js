export function renderSidebar() {
  const sidebar = document.createElement('aside');
  sidebar.id = 'sidebar';
  sidebar.className = 'sidebar';
  
  const currentPath = window.location.pathname;
  
  const baseItems = [
    { path: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
    { path: '/servers', icon: 'dns', label: 'Servers' },
    { path: '/status', icon: 'monitor_heart', label: 'Status' },
    { path: '/profile', icon: 'person', label: 'Profile' },
    { path: '/settings', icon: 'settings', label: 'Settings' }
  ];
  
  sidebar.innerHTML = `
    <div class="sidebar-header">
      <a href="/dashboard" class="sidebar-brand">
        <span class="material-icons-outlined">bolt</span>
        <span class="brand-text">Sodium</span>
      </a>
    </div>
    
    <nav class="sidebar-nav">
      <ul class="nav-list" id="nav-list">
        ${baseItems.map(item => `
          <li class="nav-item">
            <a href="${item.path}" class="nav-link ${currentPath === item.path ? 'active' : ''}">
              <span class="material-icons-outlined">${item.icon}</span>
              <span class="nav-text">${item.label}</span>
            </a>
          </li>
        `).join('')}
      </ul>
    </nav>
    
    <div class="sidebar-footer">
      <div class="footer-content">
        <span class="version">v1.0.0</span>
      </div>
    </div>
  `;
  
  checkAdminStatus(sidebar, currentPath);
  
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

async function checkAdminStatus(sidebar, currentPath) {
  const username = localStorage.getItem('username');
  const password = localStorage.getItem('password');
  
  if (!username || !password) return;
  
  try {
    const res = await fetch(`/api/auth/me?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`);
    const data = await res.json();
    
    if (data.user?.isAdmin) {
      const navList = sidebar.querySelector('#nav-list');
      const settingsItem = navList.querySelector('a[href="/settings"]')?.closest('.nav-item');
      
      if (settingsItem && !navList.querySelector('a[href="/admin"]')) {
        const adminItem = document.createElement('li');
        adminItem.className = 'nav-item';
        adminItem.innerHTML = `
          <a href="/admin" class="nav-link ${currentPath === '/admin' ? 'active' : ''}">
            <span class="material-icons-outlined">admin_panel_settings</span>
            <span class="nav-text">Admin</span>
          </a>
        `;
        navList.insertBefore(adminItem, settingsItem);
      }
    }
  } catch (e) {
    console.error('Failed to check admin status:', e);
  }
}
