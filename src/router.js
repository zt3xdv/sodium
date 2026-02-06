import { routes, getUserRoute, getServerRoute } from './routes/routes.js';
import { renderNav } from './components/nav.js';
import { renderSidebar } from './components/sidebar.js';

let mounted = false;
let currentCleanup = null;

function clearMain() {
  const existing = document.getElementById('app');
  if (existing) existing.innerHTML = '';
}

function mountShell(withSidebar = false) {
  if (!mounted) {
    document.body.innerHTML = '';
    
    const wrapper = document.createElement('div');
    wrapper.id = 'wrapper';
    wrapper.className = withSidebar ? 'with-sidebar' : '';
    
    if (withSidebar) {
      wrapper.appendChild(renderSidebar());
    }
    
    const contentArea = document.createElement('div');
    contentArea.id = 'content-area';
    
    contentArea.appendChild(renderNav());
    
    const main = document.createElement('main');
    main.id = 'app';
    contentArea.appendChild(main);
    
    wrapper.appendChild(contentArea);
    document.body.appendChild(wrapper);
    
    document.body.addEventListener('click', onBodyClick);
    mounted = true;
  } else {
    const wrapper = document.getElementById('wrapper');
    if (wrapper) {
      wrapper.className = withSidebar ? 'with-sidebar' : '';
      
      const existingSidebar = document.getElementById('sidebar');
      if (withSidebar && !existingSidebar) {
        wrapper.insertBefore(renderSidebar(), wrapper.firstChild);
      } else if (!withSidebar && existingSidebar) {
        existingSidebar.remove();
      }
    }
  }
}

function onBodyClick(e) {
  if (e.defaultPrevented) return;
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  
  let a = e.target;
  while (a && a.nodeName !== 'A') a = a.parentElement;
  if (!a) return;
  
  const href = a.getAttribute('href');
  if (!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
  
  e.preventDefault();
  navigate(href);
}

export function navigate(path) {
  if (!path.startsWith('/')) {
    const base = window.location.pathname.replace(/\/+$/, '');
    path = base + '/' + path;
  }
  window.history.pushState({}, '', path);
  router();
}

window.router = {
  navigateTo: navigate
};

window.addEventListener('popstate', () => {
  router();
});

export function router() {
  const path = window.location.pathname;
  let route = routes[path];
  
  if (!route && path.startsWith('/u/')) {
    const username = path.split('/')[2];
    if (username && /^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      route = getUserRoute(username);
    }
  }
  
  if (!route && path.startsWith('/server/')) {
    const serverId = path.split('/')[2];
    if (serverId) {
      route = getServerRoute(serverId);
    }
  }
  
  if (!route) {
    route = routes['/404'];
  }
  
  const isAuthenticated = !!localStorage.getItem('auth_token');
  
  if (route.redirect) {
    window.history.replaceState({}, '', route.redirect);
    return router();
  }
  
  if (route.options?.auth && !isAuthenticated) {
    window.history.replaceState({}, '', '/auth');
    return router();
  }
  
  if (isAuthenticated && path === '/auth') {
    window.history.replaceState({}, '', '/dashboard');
    return router();
  }
  
  if (isAuthenticated && path === '/') {
    window.history.replaceState({}, '', '/dashboard');
    return router();
  }
  
  if (!isAuthenticated && path === '/') {
    window.history.replaceState({}, '', '/auth');
    return router();
  }
  
  document.title = 'Sodium - ' + (route.options?.title || 'App');
  
  const appEl = document.getElementById('app');
  if (appEl) appEl.classList.add('fade-out');
  
  setTimeout(() => {
    if (currentCleanup) {
      currentCleanup();
      currentCleanup = null;
    }
    
    mountShell(route.options?.sidebar !== false && isAuthenticated);
    clearMain();
    
    // Update active link in sidebar instead of replacing it
    const existingSidebar = document.getElementById('sidebar');
    if (existingSidebar && route.options?.sidebar !== false && isAuthenticated) {
      updateSidebarActiveLink(path);
    }
    
    route.render();
    currentCleanup = route.cleanup || null;
    
    const newAppEl = document.getElementById('app');
    if (newAppEl) {
      newAppEl.classList.remove('fade-out');
      newAppEl.classList.add('fade-in');
    }
  }, 150);
}

function updateSidebarActiveLink(currentPath) {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  
  sidebar.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPath) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}
