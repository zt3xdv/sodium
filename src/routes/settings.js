import { getTheme, setTheme, getAvailableThemes } from '../utils/theme.js';
import { clearAuth, api } from '../utils/api.js';

export function renderSettings() {
  const app = document.getElementById('app');
  app.className = 'settings-page';
  
  const username = localStorage.getItem('username');
  
  app.innerHTML = `
    <div class="settings-container">
      <div class="settings-header">
        <h1>Settings</h1>
        <p>Manage your account preferences</p>
      </div>
      
      <div class="settings-content">
        <div class="settings-section">
          <div class="section-header">
            <span class="material-icons-outlined">palette</span>
            <h3>Appearance</h3>
          </div>
          
          <div class="theme-grid" id="theme-grid">
            ${getAvailableThemes().map(t => `
              <button class="theme-card ${getTheme() === t.id ? 'active' : ''}" data-theme="${t.id}">
                <div class="theme-preview" data-preview="${t.id}">
                  <div class="preview-sidebar"></div>
                  <div class="preview-content">
                    <div class="preview-header"></div>
                    <div class="preview-cards">
                      <div class="preview-card"></div>
                      <div class="preview-card"></div>
                    </div>
                  </div>
                </div>
                <span class="theme-name">${t.name}</span>
              </button>
            `).join('')}
          </div>
        </div>
        
        <div class="settings-section">
          <div class="section-header">
            <span class="material-icons-outlined">notifications</span>
            <h3>Notifications</h3>
          </div>
          
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-title">Push Notifications</span>
              <span class="setting-description">Receive notifications about activity</span>
            </div>
            <div class="setting-control">
              <label class="toggle">
                <input type="checkbox" id="notifications-toggle" checked>
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>
        
        <div class="settings-section">
          <div class="section-header">
            <span class="material-icons-outlined">lock</span>
            <h3>Privacy</h3>
          </div>
          
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-title">Profile Visibility</span>
              <span class="setting-description">Control who can see your profile</span>
            </div>
            <div class="setting-control">
              <select id="privacy-select" class="select-input">
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </div>
          </div>
        </div>
        
        <div class="settings-section">
          <div class="section-header">
            <span class="material-icons-outlined">security</span>
            <h3>Security</h3>
          </div>
          
          <div class="setting-item clickable" id="change-password-btn">
            <div class="setting-info">
              <span class="setting-title">Change Password</span>
              <span class="setting-description">Update your account password</span>
            </div>
            <span class="material-icons-outlined">chevron_right</span>
          </div>
        </div>
        
        <div class="settings-section danger-section">
          <div class="section-header">
            <span class="material-icons-outlined">warning</span>
            <h3>Danger Zone</h3>
          </div>
          
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-title">Sign Out</span>
              <span class="setting-description">Sign out of your account on this device</span>
            </div>
            <button class="btn btn-danger" id="logout-btn">
              <span class="material-icons-outlined">logout</span>
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <div class="modal" id="password-modal">
      <div class="modal-backdrop"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3>Change Password</h3>
          <button class="modal-close" id="close-modal">
            <span class="material-icons-outlined">close</span>
          </button>
        </div>
        <form id="password-form">
          <div class="form-group">
            <label for="current-password">Current Password</label>
            <div class="input-wrapper">
              <span class="material-icons-outlined">lock</span>
              <input type="password" id="current-password" required>
            </div>
          </div>
          <div class="form-group">
            <label for="new-password">New Password</label>
            <div class="input-wrapper">
              <span class="material-icons-outlined">lock</span>
              <input type="password" id="new-password" required minlength="6">
            </div>
          </div>
          <div class="form-group">
            <label for="confirm-password">Confirm New Password</label>
            <div class="input-wrapper">
              <span class="material-icons-outlined">lock</span>
              <input type="password" id="confirm-password" required>
            </div>
          </div>
          <div class="message" id="password-message"></div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" id="cancel-modal">Cancel</button>
            <button type="submit" class="btn btn-primary">Update Password</button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  loadSettings();
  
  const logoutBtn = app.querySelector('#logout-btn');
  logoutBtn.addEventListener('click', () => {
    clearAuth();
    window.router.navigateTo('/auth');
  });
  
  const themeGrid = app.querySelector('#theme-grid');
  themeGrid.addEventListener('click', (e) => {
    const card = e.target.closest('.theme-card');
    if (!card) return;
    const theme = card.dataset.theme;
    setTheme(theme);
    themeGrid.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    saveSettings({ theme });
  });
  
  const notificationsToggle = app.querySelector('#notifications-toggle');
  notificationsToggle.addEventListener('change', () => {
    saveSettings({ notifications: notificationsToggle.checked });
  });
  
  const privacySelect = app.querySelector('#privacy-select');
  privacySelect.addEventListener('change', () => {
    saveSettings({ privacy: privacySelect.value });
  });
  
  const modal = app.querySelector('#password-modal');
  const changePasswordBtn = app.querySelector('#change-password-btn');
  const closeModal = app.querySelector('#close-modal');
  const cancelModal = app.querySelector('#cancel-modal');
  const backdrop = modal.querySelector('.modal-backdrop');
  
  changePasswordBtn.addEventListener('click', () => {
    modal.classList.add('active');
  });
  
  const closeModalFn = () => {
    modal.classList.remove('active');
    modal.querySelector('form').reset();
    modal.querySelector('#password-message').textContent = '';
  };
  
  closeModal.addEventListener('click', closeModalFn);
  cancelModal.addEventListener('click', closeModalFn);
  backdrop.addEventListener('click', closeModalFn);
  
  const passwordForm = app.querySelector('#password-form');
  passwordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const currentPassword = passwordForm.querySelector('#current-password').value;
    const newPassword = passwordForm.querySelector('#new-password').value;
    const confirmPassword = passwordForm.querySelector('#confirm-password').value;
    const messageEl = passwordForm.querySelector('#password-message');
    const btn = passwordForm.querySelector('button[type="submit"]');
    
    if (newPassword !== confirmPassword) {
      messageEl.textContent = 'Passwords do not match';
      messageEl.className = 'message error';
      return;
    }
    
    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons-outlined spinning">sync</span>';
    
    try {
      const res = await api('/api/user/password', {
        method: 'PUT',
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });
      
      const data = await res.json();
      
      if (data.error) {
        messageEl.textContent = data.error;
        messageEl.className = 'message error';
      } else {
        messageEl.textContent = 'Password updated successfully!';
        messageEl.className = 'message success';
        
        setTimeout(() => {
          closeModalFn();
        }, 1500);
      }
    } catch (err) {
      messageEl.textContent = 'Connection error. Please try again.';
      messageEl.className = 'message error';
    }
    
    btn.disabled = false;
    btn.innerHTML = 'Update Password';
  });
}

async function loadSettings() {
  try {
    const res = await fetch(`/api/user/profile?username=${encodeURIComponent(localStorage.getItem('username'))}`);
    const data = await res.json();
    
    if (data.user?.settings) {
      const { theme, notifications, privacy } = data.user.settings;
      
      const notificationsToggle = document.getElementById('notifications-toggle');
      const privacySelect = document.getElementById('privacy-select');
      
      if (theme) {
        setTheme(theme);
        const themeGrid = document.getElementById('theme-grid');
        if (themeGrid) {
          themeGrid.querySelectorAll('.theme-card').forEach(c => {
            c.classList.toggle('active', c.dataset.theme === theme);
          });
        }
      }
      if (notificationsToggle) notificationsToggle.checked = notifications !== false;
      if (privacySelect && privacy) privacySelect.value = privacy;
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

async function saveSettings(settings) {
  try {
    await api('/api/user/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings })
    });
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
}
