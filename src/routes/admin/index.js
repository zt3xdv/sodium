import { getUser } from '../../utils/api.js';
import { state } from './state.js';

import { renderNodesList, renderNodeDetail } from './views/nodes.js';
import { renderServersList, renderServerDetail } from './views/servers.js';
import { renderUsersList, renderUserDetail } from './views/users.js';
import { renderNestsList, renderEggDetail } from './views/nests.js';
import { renderLocationsList } from './views/locations.js';
import { renderSettingsPage } from './views/settings.js';
import { renderAnnouncementsList } from './views/announcements.js';
import { renderAuditLogPage, renderActivityLogPage } from './views/logs.js';
import { renderWebhooksList } from './views/webhooks.js';

function navigateTo(tab, id = null, subTab = null) {
  state.currentView = { 
    type: id ? 'detail' : 'list', 
    tab, 
    id, 
    subTab: subTab || getDefaultSubTab(tab) 
  };
  loadView();
}

function getDefaultSubTab(tab) {
  switch (tab) {
    case 'nodes': return 'about';
    case 'servers': return 'details';
    case 'users': return 'overview';
    case 'eggs': return 'about';
    default: return null;
  }
}

window.adminNavigate = navigateTo;

export async function renderAdmin(tab = 'nodes', params = {}) {
  const app = document.getElementById('app');
  const user = getUser();
  
  app.innerHTML = '<div class="loading-spinner"></div>';
  
  try {
    if (!user?.isAdmin) {
      app.innerHTML = `
        <div class="error-page">
          <h1>403</h1>
          <p>Access Denied</p>
          <a href="/dashboard" class="btn btn-primary">Go to Dashboard</a>
        </div>
      `;
      return;
    }
  } catch (e) {
    app.innerHTML = '<div class="error">Failed to verify permissions</div>';
    return;
  }
  
  state.currentView = {
    type: params.id ? 'detail' : 'list',
    tab,
    id: params.id || null,
    subTab: params.subTab || getDefaultSubTab(tab)
  };
  
  app.innerHTML = `
    <div class="admin-page">
      <div class="admin-content" id="admin-content">
        <div class="loading-spinner"></div>
      </div>
    </div>
  `;
  
  loadView();
}

export async function loadView() {
  const container = document.getElementById('admin-content');
  const username = localStorage.getItem('username');
  
  container.innerHTML = '<div class="loading-spinner"></div>';
  
  if (state.currentView.type === 'detail' && state.currentView.id) {
    switch (state.currentView.tab) {
      case 'nodes':
        await renderNodeDetail(container, username, state.currentView.id);
        break;
      case 'servers':
        await renderServerDetail(container, username, state.currentView.id);
        break;
      case 'users':
        await renderUserDetail(container, username, state.currentView.id);
        break;
      case 'eggs':
        await renderEggDetail(container, username, state.currentView.id);
        break;
    }
  } else {
    switch (state.currentView.tab) {
      case 'nodes':
        await renderNodesList(container, username, loadView);
        break;
      case 'servers':
        await renderServersList(container, username, loadView);
        break;
      case 'users':
        await renderUsersList(container, username, loadView);
        break;
      case 'nests':
        await renderNestsList(container, username, loadView);
        break;
      case 'locations':
        await renderLocationsList(container, username, loadView);
        break;
      case 'settings':
        await renderSettingsPage(container, username, loadView);
        break;
      case 'announcements':
        await renderAnnouncementsList(container, username, loadView);
        break;
      case 'audit':
        await renderAuditLogPage(container, username);
        break;
      case 'activity':
        await renderActivityLogPage(container, username);
        break;
      case 'webhooks':
        await renderWebhooksList(container, username, loadView);
        break;
    }
  }
}

export function cleanupAdmin() {
}
