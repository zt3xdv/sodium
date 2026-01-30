import { getUser } from '../../utils/api.js';
import { state } from './state.js';

// Views
import { renderNodesList, renderNodeDetail } from './views/nodes.js';
import { renderServersList, renderServerDetail } from './views/servers.js';
import { renderUsersList, renderUserDetail } from './views/users.js';
import { renderNestsList, renderEggDetail } from './views/nests.js';
import { renderLocationsList } from './views/locations.js';
import { renderSettingsPage } from './views/settings.js';
import { renderAnnouncementsList } from './views/announcements.js';
import { renderAuditLogPage, renderActivityLogPage } from './views/logs.js';

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

export async function renderAdmin() {
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
  
  app.innerHTML = `
    <div class="admin-page">
      <div class="admin-layout">
        <aside class="admin-sidebar">
          <div class="admin-sidebar-header">
            <span class="material-icons-outlined">admin_panel_settings</span>
            <span>Admin</span>
          </div>
          <nav class="admin-nav">
            <a href="#" class="admin-nav-item active" data-tab="nodes">
              <span class="material-icons-outlined">dns</span>
              <span>Nodes</span>
            </a>
            <a href="#" class="admin-nav-item" data-tab="servers">
              <span class="material-icons-outlined">storage</span>
              <span>Servers</span>
            </a>
            <a href="#" class="admin-nav-item" data-tab="users">
              <span class="material-icons-outlined">people</span>
              <span>Users</span>
            </a>
            <a href="#" class="admin-nav-item" data-tab="nests">
              <span class="material-icons-outlined">egg</span>
              <span>Nests</span>
            </a>
            <a href="#" class="admin-nav-item" data-tab="locations">
              <span class="material-icons-outlined">location_on</span>
              <span>Locations</span>
            </a>
            <a href="#" class="admin-nav-item" data-tab="announcements">
              <span class="material-icons-outlined">campaign</span>
              <span>Announcements</span>
            </a>
            <a href="#" class="admin-nav-item" data-tab="audit">
              <span class="material-icons-outlined">history</span>
              <span>Audit Log</span>
            </a>
            <a href="#" class="admin-nav-item" data-tab="activity">
              <span class="material-icons-outlined">timeline</span>
              <span>Activity</span>
            </a>
            <a href="#" class="admin-nav-item" data-tab="settings">
              <span class="material-icons-outlined">settings</span>
              <span>Settings</span>
            </a>
          </nav>
        </aside>
        
        <main class="admin-main">
          <div class="admin-content" id="admin-content">
            <div class="loading-spinner"></div>
          </div>
        </main>
      </div>
    </div>
  `;
  
  document.querySelectorAll('.admin-nav-item').forEach(item => {
    item.onclick = (e) => {
      e.preventDefault();
      document.querySelectorAll('.admin-nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      navigateTo(item.dataset.tab);
    };
  });
  
  loadView();
}

export async function loadView() {
  const container = document.getElementById('admin-content');
  const username = localStorage.getItem('username');
  
  container.innerHTML = '<div class="loading-spinner"></div>';
  
  document.querySelectorAll('.admin-nav-item').forEach(i => {
    i.classList.toggle('active', i.dataset.tab === state.currentView.tab);
  });
  
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
    }
  }
}

export function cleanupAdmin() {}
