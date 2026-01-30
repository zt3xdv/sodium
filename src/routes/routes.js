import { renderAuth } from './auth.js';
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

export const routes = {
  '/': {
    redirect: '/auth'
  },
  '/auth': {
    render: renderAuth,
    options: {
      title: 'Sign In',
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
    render: renderAdmin,
    cleanup: cleanupAdmin,
    options: {
      title: 'Admin',
      auth: true,
      sidebar: true
    }
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
