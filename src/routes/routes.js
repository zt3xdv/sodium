import { renderAuth, renderAuthCallback, renderVerifyEmail, renderResetPassword } from './auth.js';
import { renderDashboard, cleanupDashboard } from './dashboard.js';
import { renderProfile } from './profile.js';
import { renderSettings } from './settings.js';
import { renderNotFound } from './notfound.js';
import { renderUser } from './user.js';
import { renderServers, cleanupServers } from './servers.js';
import { renderCreateServer, cleanupCreateServer } from './create-server.js';
import { renderServerPage, cleanupServerPage } from './server/index.js';
import { renderStatus, cleanupStatus } from './status.js';
import { renderAdmin, cleanupAdmin } from './admin/index.js';
import { renderActivityLog } from './activity-log.js';
import { renderSetup } from './setup.js';

export const routes = {
  '/': {
    redirect: '/auth'
  },
  '/setup': {
    render: renderSetup,
    options: {
      title: 'Setup',
      sidebar: false
    }
  },
  '/auth': {
    render: renderAuth,
    options: {
      title: 'Sign In',
      sidebar: false
    }
  },
  '/auth/callback': {
    render: renderAuthCallback,
    options: {
      title: 'Signing In',
      sidebar: false
    }
  },
  '/auth/verify-email': {
    render: renderVerifyEmail,
    options: {
      title: 'Verify Email',
      sidebar: false
    }
  },
  '/auth/reset-password': {
    render: renderResetPassword,
    options: {
      title: 'Reset Password',
      sidebar: false
    }
  },
  '/dashboard': {
    render: renderDashboard,
    cleanup: cleanupDashboard,
    options: {
      title: 'Dashboard',
      auth: true,
      sidebar: true
    }
  },
  '/servers': {
    render: renderServers,
    cleanup: cleanupServers,
    options: {
      title: 'Servers',
      auth: true,
      sidebar: true
    }
  },
  '/servers/create': {
    render: renderCreateServer,
    cleanup: cleanupCreateServer,
    options: {
      title: 'Create Server',
      auth: true,
      sidebar: true
    }
  },
  '/status': {
    render: renderStatus,
    cleanup: cleanupStatus,
    options: {
      title: 'Status',
      sidebar: false
    }
  },
  '/admin': {
    redirect: '/admin/nodes'
  },
  '/admin/nodes': {
    render: (params) => renderAdmin('nodes', params),
    cleanup: cleanupAdmin,
    options: { title: 'Nodes', auth: true, sidebar: true }
  },
  '/admin/servers': {
    render: (params) => renderAdmin('servers', params),
    cleanup: cleanupAdmin,
    options: { title: 'Admin Servers', auth: true, sidebar: true }
  },
  '/admin/users': {
    render: (params) => renderAdmin('users', params),
    cleanup: cleanupAdmin,
    options: { title: 'Users', auth: true, sidebar: true }
  },
  '/admin/nests': {
    render: (params) => renderAdmin('nests', params),
    cleanup: cleanupAdmin,
    options: { title: 'Nests', auth: true, sidebar: true }
  },
  '/admin/locations': {
    render: (params) => renderAdmin('locations', params),
    cleanup: cleanupAdmin,
    options: { title: 'Locations', auth: true, sidebar: true }
  },
  '/admin/announcements': {
    render: (params) => renderAdmin('announcements', params),
    cleanup: cleanupAdmin,
    options: { title: 'Announcements', auth: true, sidebar: true }
  },
  '/admin/audit': {
    render: (params) => renderAdmin('audit', params),
    cleanup: cleanupAdmin,
    options: { title: 'Audit Log', auth: true, sidebar: true }
  },
  '/admin/settings': {
    render: (params) => renderAdmin('settings', params),
    cleanup: cleanupAdmin,
    options: { title: 'Panel Settings', auth: true, sidebar: true }
  },
  '/admin/webhooks': {
    render: (params) => renderAdmin('webhooks', params),
    cleanup: cleanupAdmin,
    options: { title: 'Webhooks', auth: true, sidebar: true }
  },
  '/profile': {
    render: renderProfile,
    options: {
      title: 'Profile',
      auth: true,
      sidebar: true
    }
  },
  '/settings': {
    render: renderSettings,
    options: {
      title: 'Settings',
      auth: true,
      sidebar: true
    }
  },
  '/activity': {
    render: renderActivityLog,
    options: {
      title: 'Activity Log',
      auth: true,
      sidebar: true
    }
  },
  '/404': {
    render: renderNotFound,
    options: {
      title: 'Not Found',
      sidebar: false
    }
  }
};

export function getUserRoute(username) {
  return {
    render: () => renderUser(username),
    options: {
      title: `${username}'s Profile`,
      sidebar: true
    }
  };
}

export function getServerRoute(serverId) {
  return {
    render: () => renderServerPage(serverId),
    cleanup: cleanupServerPage,
    options: {
      title: 'Server',
      auth: true,
      sidebar: true
    }
  };
}
