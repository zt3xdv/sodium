import { isAuthenticated, isAdmin } from '../utils/auth.js';
import { navigate } from '../router.js';

export const middlewares = {
  auth: (context) => {
    if (!isAuthenticated()) {
      navigate('/login');
      return false;
    }
    return true;
  },

  admin: (context) => {
    if (!isAuthenticated()) {
      navigate('/login');
      return false;
    }
    if (!isAdmin()) {
      navigate('/dashboard');
      return false;
    }
    return true;
  },

  guest: (context) => {
    if (isAuthenticated()) {
      navigate('/dashboard');
      return false;
    }
    return true;
  }
};

export const routes = [
  {
    path: '/',
    component: () => import('./dashboard/index.js'),
    middleware: [middlewares.auth]
  },
  {
    path: '/login',
    component: () => import('./auth/login.js'),
    middleware: [middlewares.guest]
  },
  {
    path: '/register',
    component: () => import('./auth/register.js'),
    middleware: [middlewares.guest]
  },
  {
    path: '/dashboard',
    component: () => import('./dashboard/index.js'),
    middleware: [middlewares.auth]
  },
  {
    path: '/servers',
    component: () => import('./server/index.js'),
    middleware: [middlewares.auth]
  },
  {
    path: '/server/:id',
    component: () => import('./server/console.js'),
    middleware: [middlewares.auth]
  },
  {
    path: '/server/:id/console',
    component: () => import('./server/console.js'),
    middleware: [middlewares.auth]
  },
  {
    path: '/server/:id/files',
    component: () => import('./server/files.js'),
    middleware: [middlewares.auth]
  },
  {
    path: '/server/:id/databases',
    component: () => import('./server/databases.js'),
    middleware: [middlewares.auth]
  },
  {
    path: '/server/:id/schedules',
    component: () => import('./server/schedules.js'),
    middleware: [middlewares.auth]
  },
  {
    path: '/server/:id/users',
    component: () => import('./server/users.js'),
    middleware: [middlewares.auth]
  },
  {
    path: '/server/:id/backups',
    component: () => import('./server/backups.js'),
    middleware: [middlewares.auth]
  },
  {
    path: '/server/:id/network',
    component: () => import('./server/network.js'),
    middleware: [middlewares.auth]
  },
  {
    path: '/server/:id/startup',
    component: () => import('./server/startup.js'),
    middleware: [middlewares.auth]
  },
  {
    path: '/server/:id/settings',
    component: () => import('./server/settings.js'),
    middleware: [middlewares.auth]
  },
  {
    path: '/account/profile',
    component: () => import('./account/profile.js'),
    middleware: [middlewares.auth]
  },
  {
    path: '/admin',
    component: () => import('./admin/index.js'),
    middleware: [middlewares.admin]
  },
  {
    path: '/admin/servers',
    component: () => import('./admin/servers.js'),
    middleware: [middlewares.admin]
  },
  {
    path: '/admin/users',
    component: () => import('./admin/users.js'),
    middleware: [middlewares.admin]
  },

  {
    path: '/admin/eggs',
    component: () => import('./admin/eggs.js'),
    middleware: [middlewares.admin]
  },
  {
    path: '/admin/nests',
    component: () => import('./admin/nests.js'),
    middleware: [middlewares.admin]
  },
  {
    path: '/admin/settings',
    component: () => import('./admin/settings.js'),
    middleware: [middlewares.admin]
  }
];

export function registerRoutes(router) {
  routes.forEach(route => {
    router.route(route.path, {
      handler: async (context) => {
        if (route.middleware) {
          for (const mw of route.middleware) {
            const result = mw(context);
            if (result === false) return '';
          }
        }

        const module = await route.component();
        const component = module.default || module;

        if (typeof component === 'function') {
          const html = component(context);
          
          setTimeout(() => {
            if (module.mount) {
              module.mount(context);
            }
          }, 0);

          return html;
        }

        return '';
      },
      lazy: false
    });
  });
}
