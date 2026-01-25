import { router, authGuard, guestGuard, adminGuard } from './router.js';
import { isAuthenticated } from './utils/auth.js';
import { initSidebar } from './components/sidebar.js';
import { initNav } from './components/nav.js';
import './styles/main.scss';

function registerRoutes() {
  router.setOutlet('#app');

  router.use(async (context) => {
    console.log(`Navigating to: ${context.path}`);
    return true;
  });

  router
    .route('/login', () => import('./routes/auth/login.js'), { lazy: true })
    .route('/register', () => import('./routes/auth/register.js'), { lazy: true })

    .route('/', () => import('./routes/dashboard/index.js'), { lazy: true })
    .route('/dashboard', () => import('./routes/dashboard/index.js'), { lazy: true })

    .route('/servers', () => import('./routes/server/index.js'), { lazy: true })
    .route('/server/create', () => import('./routes/server/create.js'), { lazy: true })
    .route('/server/:id', () => import('./routes/server/console.js'), { lazy: true })
    .route('/server/:id/console', () => import('./routes/server/console.js'), { lazy: true })
    .route('/server/:id/files', () => import('./routes/server/files.js'), { lazy: true })
    .route('/server/:id/databases', () => import('./routes/server/databases.js'), { lazy: true })
    .route('/server/:id/schedules', () => import('./routes/server/schedules.js'), { lazy: true })
    .route('/server/:id/users', () => import('./routes/server/users.js'), { lazy: true })
    .route('/server/:id/backups', () => import('./routes/server/backups.js'), { lazy: true })
    .route('/server/:id/network', () => import('./routes/server/network.js'), { lazy: true })
    .route('/server/:id/startup', () => import('./routes/server/startup.js'), { lazy: true })
    .route('/server/:id/settings', () => import('./routes/server/settings.js'), { lazy: true })

    .route('/profile', () => import('./routes/account/profile.js'), { lazy: true })
    .route('/account/api-keys', () => import('./routes/account/api-keys.js'), { lazy: true })

    .route('/admin', () => import('./routes/admin/index.js'), { lazy: true })
    .route('/admin/servers', () => import('./routes/admin/servers.js'), { lazy: true })
    .route('/admin/servers/new', () => import('./routes/admin/servers-new.js'), { lazy: true })
    .route('/admin/servers/:id', () => import('./routes/admin/server-view.js'), { lazy: true })
    .route('/admin/users', () => import('./routes/admin/users.js'), { lazy: true })
    .route('/admin/users/new', () => import('./routes/admin/users-new.js'), { lazy: true })

    .route('/admin/nodes', () => import('./routes/admin/nodes.js'), { lazy: true })
    .route('/admin/nodes/:id', () => import('./routes/admin/node-view.js'), { lazy: true })
    .route('/admin/allocations', () => import('./routes/admin/allocations.js'), { lazy: true })
    .route('/admin/eggs', () => import('./routes/admin/eggs.js'), { lazy: true })
    .route('/admin/nests', () => import('./routes/admin/nests.js'), { lazy: true })
    .route('/admin/settings', () => import('./routes/admin/settings.js'), { lazy: true })

    .notFound(({ path }) => {
      const outlet = document.querySelector('#app');
      if (outlet) {
        outlet.innerHTML = `
          <div class="error-page">
            <h1>404</h1>
            <p>The page "${path}" was not found.</p>
            <a href="/">Go to Dashboard</a>
          </div>
        `;
      }
    });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('Service worker registration failed:', err);
    });
  }
}

function init() {
  registerRoutes();
  initNav();

  router.on('beforeNavigate', ({ path }) => {
    document.body.classList.add('navigating');
  });

  router.on('afterNavigate', ({ path }) => {
    document.body.classList.remove('navigating');
    window.scrollTo(0, 0);
    initSidebar();
  });

  if (!isAuthenticated() && !window.location.pathname.match(/^\/(login|register)/)) {
    router.navigate('/login');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export { router };
