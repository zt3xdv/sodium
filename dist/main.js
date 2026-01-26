var undefined$1 = undefined;

function renderAuth() {
  const app = document.getElementById('app');
  app.className = 'auth-page';
  
  app.innerHTML = `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-header">
          <div class="logo">
            <span class="material-icons-outlined">bolt</span>
            <span class="logo-text">Sodium</span>
          </div>
          <p class="auth-subtitle">Welcome back</p>
        </div>
        
        <div class="auth-tabs">
          <button class="tab-btn active" data-tab="login">Sign In</button>
          <button class="tab-btn" data-tab="register">Sign Up</button>
        </div>
        
        <form id="login-form" class="auth-form active">
          <div class="form-group">
            <label for="login-username">Username</label>
            <div class="input-wrapper">
              <span class="material-icons-outlined">person</span>
              <input type="text" id="login-username" name="username" placeholder="Enter your username" required>
            </div>
          </div>
          
          <div class="form-group">
            <label for="login-password">Password</label>
            <div class="input-wrapper">
              <span class="material-icons-outlined">lock</span>
              <input type="password" id="login-password" name="password" placeholder="Enter your password" required>
            </div>
          </div>
          
          <div class="error-message" id="login-error"></div>
          
          <button type="submit" class="btn btn-primary btn-full">
            <span>Sign In</span>
            <span class="material-icons-outlined">arrow_forward</span>
          </button>
        </form>
        
        <form id="register-form" class="auth-form">
          <div class="form-group">
            <label for="register-username">Username</label>
            <div class="input-wrapper">
              <span class="material-icons-outlined">person</span>
              <input type="text" id="register-username" name="username" placeholder="Choose a username" required minlength="3" maxlength="20">
            </div>
            <small class="form-hint">3-20 characters</small>
          </div>
          
          <div class="form-group">
            <label for="register-password">Password</label>
            <div class="input-wrapper">
              <span class="material-icons-outlined">lock</span>
              <input type="password" id="register-password" name="password" placeholder="Create a password" required minlength="6">
            </div>
            <small class="form-hint">Minimum 6 characters</small>
          </div>
          
          <div class="form-group">
            <label for="register-confirm">Confirm Password</label>
            <div class="input-wrapper">
              <span class="material-icons-outlined">lock</span>
              <input type="password" id="register-confirm" name="confirm" placeholder="Confirm your password" required>
            </div>
          </div>
          
          <div class="error-message" id="register-error"></div>
          
          <button type="submit" class="btn btn-primary btn-full">
            <span>Create Account</span>
            <span class="material-icons-outlined">arrow_forward</span>
          </button>
        </form>
      </div>
    </div>
  `;
  
  const tabs = app.querySelectorAll('.tab-btn');
  const loginForm = app.querySelector('#login-form');
  const registerForm = app.querySelector('#register-form');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      if (tab.dataset.tab === 'login') {
        loginForm.classList.add('active');
        registerForm.classList.remove('active');
      } else {
        registerForm.classList.add('active');
        loginForm.classList.remove('active');
      }
    });
  });
  
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = loginForm.querySelector('#login-username').value;
    const password = loginForm.querySelector('#login-password').value;
    const errorEl = loginForm.querySelector('#login-error');
    const btn = loginForm.querySelector('button[type="submit"]');
    
    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons-outlined spinning">sync</span>';
    
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      const data = await res.json();
      
      if (data.error) {
        errorEl.textContent = data.error;
        errorEl.style.display = 'block';
        btn.disabled = false;
        btn.innerHTML = '<span>Sign In</span><span class="material-icons-outlined">arrow_forward</span>';
        return;
      }
      
      localStorage.setItem('loggedIn', 'true');
      localStorage.setItem('username', data.user.username);
      localStorage.setItem('password', password);
      
      navigate('/dashboard');
    } catch (err) {
      errorEl.textContent = 'Connection error. Please try again.';
      errorEl.style.display = 'block';
      btn.disabled = false;
      btn.innerHTML = '<span>Sign In</span><span class="material-icons-outlined">arrow_forward</span>';
    }
  });
  
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = registerForm.querySelector('#register-username').value;
    const password = registerForm.querySelector('#register-password').value;
    const confirm = registerForm.querySelector('#register-confirm').value;
    const errorEl = registerForm.querySelector('#register-error');
    const btn = registerForm.querySelector('button[type="submit"]');
    
    if (password !== confirm) {
      errorEl.textContent = 'Passwords do not match';
      errorEl.style.display = 'block';
      return;
    }
    
    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons-outlined spinning">sync</span>';
    
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      const data = await res.json();
      
      if (data.error) {
        errorEl.textContent = data.error;
        errorEl.style.display = 'block';
        btn.disabled = false;
        btn.innerHTML = '<span>Create Account</span><span class="material-icons-outlined">arrow_forward</span>';
        return;
      }
      
      localStorage.setItem('loggedIn', 'true');
      localStorage.setItem('username', data.user.username);
      localStorage.setItem('password', password);
      
      navigate('/dashboard');
    } catch (err) {
      errorEl.textContent = 'Connection error. Please try again.';
      errorEl.style.display = 'block';
      btn.disabled = false;
      btn.innerHTML = '<span>Create Account</span><span class="material-icons-outlined">arrow_forward</span>';
    }
  });
}

function renderDashboard() {
  const app = document.getElementById('app');
  app.className = 'dashboard-page';
  
  const displayName = localStorage.getItem('displayName') || localStorage.getItem('username');
  const username = localStorage.getItem('username');
  
  const hour = new Date().getHours();
  let greeting = 'Good evening';
  if (hour < 12) greeting = 'Good morning';
  else if (hour < 18) greeting = 'Good afternoon';
  
  app.innerHTML = `
    <div class="dashboard-container">
      <header class="dashboard-header">
        <div class="greeting">
          <h1>${greeting}, <span class="highlight">${displayName}</span></h1>
          <p>Welcome to your dashboard</p>
        </div>
      </header>
      
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">
            <span class="material-icons-outlined">person</span>
          </div>
          <div class="stat-content">
            <span class="stat-value">@${username}</span>
            <span class="stat-label">Your Username</span>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon">
            <span class="material-icons-outlined">calendar_today</span>
          </div>
          <div class="stat-content">
            <span class="stat-value">${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            <span class="stat-label">Today's Date</span>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon">
            <span class="material-icons-outlined">schedule</span>
          </div>
          <div class="stat-content">
            <span class="stat-value" id="current-time">${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
            <span class="stat-label">Current Time</span>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon">
            <span class="material-icons-outlined">verified</span>
          </div>
          <div class="stat-content">
            <span class="stat-value">Active</span>
            <span class="stat-label">Account Status</span>
          </div>
        </div>
      </div>
      
      <div class="quick-actions">
        <h2>Quick Actions</h2>
        <div class="actions-grid">
          <a href="/profile" class="action-card">
            <span class="material-icons-outlined">edit</span>
            <span>Edit Profile</span>
          </a>
          <a href="/settings" class="action-card">
            <span class="material-icons-outlined">settings</span>
            <span>Settings</span>
          </a>
        </div>
      </div>
      
      <div class="activity-section">
        <h2>Recent Activity</h2>
        <div class="activity-list">
          <div class="activity-item">
            <span class="material-icons-outlined">login</span>
            <div class="activity-content">
              <span class="activity-title">Signed in successfully</span>
              <span class="activity-time">Just now</span>
            </div>
          </div>
          <div class="activity-item">
            <span class="material-icons-outlined">check_circle</span>
            <div class="activity-content">
              <span class="activity-title">Account created</span>
              <span class="activity-time">Recently</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  const timeEl = app.querySelector('#current-time');
  const interval = setInterval(() => {
    if (!document.getElementById('current-time')) {
      clearInterval(interval);
      return;
    }
    timeEl.textContent = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }, 1000);
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/`/g, '&#96;');
}

function escapeUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return '';
  try {
    const parsed = new URL(url.trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    return parsed.href;
  } catch {
    return '';
  }
}

function sanitizeText(text, maxLength = 1000) {
  if (typeof text !== 'string') return '';
  return escapeHtml(text.slice(0, maxLength).trim());
}

function isValidUrl(url) {
  if (!url || typeof url !== 'string') return true;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function createSafeElement(tag, attributes = {}, textContent = '') {
  const el = document.createElement(tag);
  
  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'href' || key === 'src') {
      const safeUrl = escapeUrl(value);
      if (safeUrl) el.setAttribute(key, safeUrl);
    } else if (key === 'class') {
      el.className = value;
    } else if (key.startsWith('data-')) {
      el.setAttribute(key, escapeHtml(value));
    } else {
      el.setAttribute(key, escapeHtml(value));
    }
  }
  
  if (textContent) {
    el.textContent = textContent;
  }
  
  return el;
}

function safeInnerHTML(element, html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  
  const scripts = template.content.querySelectorAll('script');
  scripts.forEach(script => script.remove());
  
  const elements = template.content.querySelectorAll('*');
  elements.forEach(el => {
    const attrs = Array.from(el.attributes);
    attrs.forEach(attr => {
      if (attr.name.startsWith('on') || 
          attr.value.includes('javascript:') ||
          attr.value.includes('data:text/html')) {
        el.removeAttribute(attr.name);
      }
    });
  });
  
  element.innerHTML = '';
  element.appendChild(template.content);
}

function renderProfile() {
  const app = document.getElementById('app');
  app.className = 'profile-page';
  
  const username = localStorage.getItem('username');
  const displayName = localStorage.getItem('displayName') || username;
  
  app.innerHTML = `
    <div class="profile-container">
      <div class="profile-header">
        <h1>Profile</h1>
        <p>Manage your public profile information</p>
      </div>
      
      <div class="profile-content">
        <div class="profile-card">
          <div class="avatar-section">
            <div class="avatar" id="avatar-preview">
              <span class="material-icons-outlined">person</span>
            </div>
            <div class="avatar-info">
              <h3 id="profile-display-name">${escapeHtml(displayName)}</h3>
              <span class="username">@${escapeHtml(username)}</span>
            </div>
          </div>
        </div>
        
        <form id="profile-form" class="profile-form">
          <div class="form-section">
            <h3>Basic Information</h3>
            
            <div class="form-group">
              <label for="avatar-url">Profile Picture URL</label>
              <div class="input-wrapper">
                <span class="material-icons-outlined">image</span>
                <input type="url" id="avatar-url" name="avatar" placeholder="https://example.com/avatar.png">
              </div>
              <small class="form-hint">Use a direct image URL (https only)</small>
            </div>
            
            <div class="form-group">
              <label for="display-name">Display Name</label>
              <div class="input-wrapper">
                <span class="material-icons-outlined">badge</span>
                <input type="text" id="display-name" name="displayName" value="${escapeHtml(displayName)}" maxlength="50" placeholder="Your display name">
              </div>
              <small class="form-hint">This is how others will see you</small>
            </div>
            
            <div class="form-group">
              <label for="bio">Bio</label>
              <div class="textarea-wrapper">
                <textarea id="bio" name="bio" maxlength="500" placeholder="Tell us about yourself..." rows="4"></textarea>
              </div>
              <small class="form-hint"><span id="bio-count">0</span>/500 characters</small>
            </div>
          </div>
          
          <div class="form-section">
            <h3>Social Links</h3>
            <p class="section-description">These will be visible on your public profile</p>
            
            <div class="form-group">
              <label for="link-website">Website</label>
              <div class="input-wrapper">
                <span class="material-icons-outlined">language</span>
                <input type="url" id="link-website" name="website" placeholder="https://yourwebsite.com">
              </div>
            </div>
            
            <div class="form-group">
              <label for="link-twitter">Twitter / X</label>
              <div class="input-wrapper">
                <span class="material-icons-outlined">alternate_email</span>
                <input type="url" id="link-twitter" name="twitter" placeholder="https://twitter.com/username">
              </div>
            </div>
            
            <div class="form-group">
              <label for="link-github">GitHub</label>
              <div class="input-wrapper">
                <span class="material-icons-outlined">code</span>
                <input type="url" id="link-github" name="github" placeholder="https://github.com/username">
              </div>
            </div>
            
            <div class="form-group">
              <label for="link-discord">Discord</label>
              <div class="input-wrapper">
                <span class="material-icons-outlined">chat</span>
                <input type="url" id="link-discord" name="discord" placeholder="https://discord.gg/invite">
              </div>
            </div>
            
            <div class="form-group">
              <label for="link-instagram">Instagram</label>
              <div class="input-wrapper">
                <span class="material-icons-outlined">photo_camera</span>
                <input type="url" id="link-instagram" name="instagram" placeholder="https://instagram.com/username">
              </div>
            </div>
          </div>
          
          <div class="form-actions">
            <div class="message" id="profile-message"></div>
            <button type="submit" class="btn btn-primary">
              <span class="material-icons-outlined">save</span>
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  loadProfile();
  
  const avatarInput = app.querySelector('#avatar-url');
  const avatarPreview = app.querySelector('#avatar-preview');
  
  avatarInput.addEventListener('input', () => {
    updateAvatarPreview(avatarInput.value, avatarPreview);
  });
  
  const bioInput = app.querySelector('#bio');
  const bioCount = app.querySelector('#bio-count');
  
  bioInput.addEventListener('input', () => {
    bioCount.textContent = bioInput.value.length;
  });
  
  const form = app.querySelector('#profile-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const displayName = form.querySelector('#display-name').value.trim();
    const bio = form.querySelector('#bio').value.trim();
    const avatar = form.querySelector('#avatar-url').value.trim();
    
    const links = {
      website: form.querySelector('#link-website').value.trim(),
      twitter: form.querySelector('#link-twitter').value.trim(),
      github: form.querySelector('#link-github').value.trim(),
      discord: form.querySelector('#link-discord').value.trim(),
      instagram: form.querySelector('#link-instagram').value.trim()
    };
    
    const messageEl = form.querySelector('#profile-message');
    const btn = form.querySelector('button[type="submit"]');
    
    if (!validateUrls([avatar, ...Object.values(links)])) {
      messageEl.textContent = 'Invalid URL detected. Only https:// URLs are allowed.';
      messageEl.className = 'message error';
      return;
    }
    
    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons-outlined spinning">sync</span>';
    
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: localStorage.getItem('username'),
          password: localStorage.getItem('password'),
          displayName,
          bio,
          avatar,
          links
        })
      });
      
      const data = await res.json();
      
      if (data.error) {
        messageEl.textContent = escapeHtml(data.error);
        messageEl.className = 'message error';
      } else {
        messageEl.textContent = 'Profile updated successfully!';
        messageEl.className = 'message success';
        localStorage.setItem('displayName', displayName);
        
        const profileDisplayName = document.getElementById('profile-display-name');
        if (profileDisplayName) profileDisplayName.textContent = escapeHtml(displayName);
        
        const navDisplayName = document.querySelector('.user-display-name');
        if (navDisplayName) navDisplayName.textContent = escapeHtml(displayName);
      }
    } catch (err) {
      messageEl.textContent = 'Connection error. Please try again.';
      messageEl.className = 'message error';
    }
    
    btn.disabled = false;
    btn.innerHTML = '<span class="material-icons-outlined">save</span><span>Save Changes</span>';
    
    setTimeout(() => {
      messageEl.textContent = '';
      messageEl.className = 'message';
    }, 3000);
  });
}

function validateUrls(urls) {
  for (const url of urls) {
    if (!url) continue;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') return false;
    } catch {
      return false;
    }
  }
  return true;
}

function updateAvatarPreview(url, container) {
  if (!url || !validateUrls([url])) {
    container.innerHTML = '<span class="material-icons-outlined">person</span>';
    return;
  }
  
  const img = new Image();
  img.onload = () => {
    container.innerHTML = '';
    container.appendChild(img);
  };
  img.onerror = () => {
    container.innerHTML = '<span class="material-icons-outlined">person</span>';
  };
  img.src = url;
  img.alt = 'Avatar';
}

async function loadProfile() {
  try {
    const username = localStorage.getItem('username');
    const res = await fetch(`/api/user/profile?username=${encodeURIComponent(username)}&viewer=${encodeURIComponent(username)}`);
    const data = await res.json();
    
    if (data.user) {
      const bioInput = document.getElementById('bio');
      const bioCount = document.getElementById('bio-count');
      const displayNameInput = document.getElementById('display-name');
      const avatarInput = document.getElementById('avatar-url');
      const avatarPreview = document.getElementById('avatar-preview');
      
      if (bioInput && data.user.bio) {
        bioInput.value = data.user.bio;
        bioCount.textContent = data.user.bio.length;
      }
      
      if (displayNameInput && data.user.displayName) {
        displayNameInput.value = data.user.displayName;
      }
      
      if (avatarInput && data.user.avatar) {
        avatarInput.value = data.user.avatar;
        updateAvatarPreview(data.user.avatar, avatarPreview);
      }
      
      if (data.user.links) {
        const links = data.user.links;
        if (links.website) document.getElementById('link-website').value = links.website;
        if (links.twitter) document.getElementById('link-twitter').value = links.twitter;
        if (links.github) document.getElementById('link-github').value = links.github;
        if (links.discord) document.getElementById('link-discord').value = links.discord;
        if (links.instagram) document.getElementById('link-instagram').value = links.instagram;
      }
    }
  } catch (err) {
    console.error('Failed to load profile:', err);
  }
}

function renderSettings() {
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
          
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-title">Theme</span>
              <span class="setting-description">Choose your preferred color scheme</span>
            </div>
            <div class="setting-control">
              <select id="theme-select" class="select-input">
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="system">System</option>
              </select>
            </div>
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
    localStorage.removeItem('loggedIn');
    localStorage.removeItem('username');
    localStorage.removeItem('password');
    localStorage.removeItem('displayName');
    localStorage.removeItem('userId');
    navigate('/auth');
  });
  
  const themeSelect = app.querySelector('#theme-select');
  themeSelect.addEventListener('change', () => {
    saveSettings({ theme: themeSelect.value });
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
      const res = await fetch('/api/user/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: localStorage.getItem('username'),
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
        localStorage.setItem('password', newPassword);
        
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
      
      const themeSelect = document.getElementById('theme-select');
      const notificationsToggle = document.getElementById('notifications-toggle');
      const privacySelect = document.getElementById('privacy-select');
      
      if (themeSelect && theme) themeSelect.value = theme;
      if (notificationsToggle) notificationsToggle.checked = notifications !== false;
      if (privacySelect && privacy) privacySelect.value = privacy;
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

async function saveSettings(settings) {
  try {
    await fetch('/api/user/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: localStorage.getItem('username'),
        password: localStorage.getItem('password'),
        settings
      })
    });
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
}

function renderNotFound() {
  const app = document.getElementById('app');
  app.className = 'notfound-page';
  
  app.innerHTML = `
    <div class="notfound-container">
      <div class="notfound-content">
        <span class="notfound-code">404</span>
        <h1>Page Not Found</h1>
        <p>The page you're looking for doesn't exist or has been moved.</p>
        <a href="/dashboard" class="btn btn-primary">
          <span class="material-icons-outlined">home</span>
          <span>Back to Dashboard</span>
        </a>
      </div>
    </div>
  `;
}

function renderUser(targetUsername) {
  const app = document.getElementById('app');
  app.className = 'user-page';
  
  app.innerHTML = `
    <div class="user-container">
      <div class="loading-state">
        <span class="material-icons-outlined spinning">sync</span>
        <span>Loading profile...</span>
      </div>
    </div>
  `;
  
  loadUserProfile(targetUsername);
}

async function loadUserProfile(targetUsername) {
  const container = document.querySelector('.user-container');
  const viewer = localStorage.getItem('username') || '';
  
  try {
    const res = await fetch(`/api/user/profile?username=${encodeURIComponent(targetUsername)}&viewer=${encodeURIComponent(viewer)}`);
    const data = await res.json();
    
    if (data.error) {
      container.innerHTML = `
        <div class="error-state">
          <span class="material-icons-outlined">error</span>
          <h2>User Not Found</h2>
          <p>The user you're looking for doesn't exist.</p>
          <a href="/dashboard" class="btn btn-primary">Back to Dashboard</a>
        </div>
      `;
      return;
    }
    
    const user = data.user;
    const isPrivate = user.isPrivate;
    
    const linkIcons = {
      website: 'language',
      twitter: 'alternate_email',
      github: 'code',
      discord: 'chat',
      instagram: 'photo_camera'
    };
    
    const linkLabels = {
      website: 'Website',
      twitter: 'Twitter',
      github: 'GitHub',
      discord: 'Discord',
      instagram: 'Instagram'
    };
    
    let linksHtml = '';
    if (!isPrivate && user.links) {
      const activeLinks = Object.entries(user.links).filter(([_, url]) => url);
      if (activeLinks.length > 0) {
        linksHtml = `
          <div class="user-links">
            <h3>Links</h3>
            <div class="links-list">
              ${activeLinks.map(([key, url]) => {
                const safeUrl = escapeUrl(url);
                if (!safeUrl) return '';
                return `
                  <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="link-item">
                    <span class="material-icons-outlined">${linkIcons[key] || 'link'}</span>
                    <span>${escapeHtml(linkLabels[key] || key)}</span>
                    <span class="material-icons-outlined external">open_in_new</span>
                  </a>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }
    }
    
    const avatarHtml = user.avatar ? 
      `<img src="${escapeUrl(user.avatar)}" alt="Avatar" onerror="this.parentElement.innerHTML='<span class=\\'material-icons-outlined\\'>person</span>'">` :
      `<span class="material-icons-outlined">person</span>`;
    
    container.innerHTML = `
      <div class="user-profile-card">
        <div class="user-header">
          <div class="user-avatar">
            ${avatarHtml}
          </div>
          <div class="user-info">
            <h1>${escapeHtml(user.displayName || user.username)}</h1>
            <span class="user-username">@${escapeHtml(user.username)}</span>
            ${isPrivate ? '<span class="private-badge"><span class="material-icons-outlined">lock</span> Private Profile</span>' : ''}
          </div>
        </div>
        
        ${!isPrivate && user.bio ? `
          <div class="user-bio">
            <h3>About</h3>
            <p>${escapeHtml(user.bio)}</p>
          </div>
        ` : ''}
        
        ${isPrivate ? `
          <div class="private-notice">
            <span class="material-icons-outlined">visibility_off</span>
            <p>This profile is private</p>
          </div>
        ` : ''}
        
        ${linksHtml}
        
        ${!isPrivate && user.createdAt ? `
          <div class="user-meta">
            <span class="material-icons-outlined">calendar_today</span>
            <span>Joined ${new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
          </div>
        ` : ''}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `
      <div class="error-state">
        <span class="material-icons-outlined">wifi_off</span>
        <h2>Connection Error</h2>
        <p>Unable to load profile. Please try again.</p>
        <a href="/dashboard" class="btn btn-primary">Back to Dashboard</a>
      </div>
    `;
  }
}

let pollInterval$2 = null;

function renderServers() {
  const app = document.getElementById('app');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
  app.innerHTML = `
    <div class="servers-page">
      <div class="page-header">
        <h1>My Servers</h1>
      </div>
      
      <div class="resource-limits card">
        <h3>Resource Usage</h3>
        <div class="limits-grid" id="limits-display">
          <div class="limit-item">
            <span class="label">Loading...</span>
          </div>
        </div>
      </div>
      
      <div class="servers-grid" id="servers-list">
        <div class="loading-spinner"></div>
      </div>
    </div>
  `;
  
  loadServers();
  loadLimits();
  
  pollInterval$2 = setInterval(loadServers, 10000);
}

async function loadLimits() {
  const username = localStorage.getItem('username');
  try {
    const res = await fetch(`/api/user/limits?username=${encodeURIComponent(username)}`);
    const data = await res.json();
    
    const container = document.getElementById('limits-display');
    if (!container) return;
    
    container.innerHTML = `
      <div class="limit-item">
        <span class="label">Servers</span>
        <div class="progress-bar">
          <div class="progress" style="width: ${(data.used.servers / data.limits.servers) * 100}%"></div>
        </div>
        <span class="value">${data.used.servers} / ${data.limits.servers}</span>
      </div>
      <div class="limit-item">
        <span class="label">Memory</span>
        <div class="progress-bar">
          <div class="progress" style="width: ${(data.used.memory / data.limits.memory) * 100}%"></div>
        </div>
        <span class="value">${data.used.memory} / ${data.limits.memory} MB</span>
      </div>
      <div class="limit-item">
        <span class="label">Disk</span>
        <div class="progress-bar">
          <div class="progress" style="width: ${(data.used.disk / data.limits.disk) * 100}%"></div>
        </div>
        <span class="value">${data.used.disk} / ${data.limits.disk} MB</span>
      </div>
      <div class="limit-item">
        <span class="label">CPU</span>
        <div class="progress-bar">
          <div class="progress" style="width: ${(data.used.cpu / data.limits.cpu) * 100}%"></div>
        </div>
        <span class="value">${data.used.cpu} / ${data.limits.cpu}%</span>
      </div>
    `;
  } catch (e) {
    console.error('Failed to load limits:', e);
  }
}

async function loadServers() {
  const username = localStorage.getItem('username');
  const container = document.getElementById('servers-list');
  if (!container) return;
  
  try {
    const res = await fetch(`/api/servers?username=${encodeURIComponent(username)}`);
    const data = await res.json();
    
    if (data.servers.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="material-icons-outlined icon">dns</span>
          <h3>No Servers</h3>
          <p>You don't have any servers yet. Contact an administrator to get started.</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = data.servers.map(server => `
      <div class="server-card card" data-id="${server.id}">
        <div class="server-header">
          <h3>${escapeHtml(server.name)}</h3>
          <span class="status status-${server.status || 'offline'}">${server.status || 'offline'}</span>
        </div>
        <div class="server-info">
          <div class="info-row">
            <span class="label">Memory</span>
            <span class="value">${server.limits?.memory || 0} MB</span>
          </div>
          <div class="info-row">
            <span class="label">Disk</span>
            <span class="value">${server.limits?.disk || 0} MB</span>
          </div>
          <div class="info-row">
            <span class="label">CPU</span>
            <span class="value">${server.limits?.cpu || 0}%</span>
          </div>
          <div class="info-row">
            <span class="label">Address</span>
            <span class="value">${server.allocation?.ip}:${server.allocation?.port}</span>
          </div>
        </div>
        <div class="server-actions">
          <button class="btn btn-success btn-sm" onclick="serverPower('${server.id}', 'start')">Start</button>
          <button class="btn btn-warning btn-sm" onclick="serverPower('${server.id}', 'restart')">Restart</button>
          <button class="btn btn-danger btn-sm" onclick="serverPower('${server.id}', 'stop')">Stop</button>
          <a href="/server/${server.id}" class="btn btn-primary btn-sm">Console</a>
        </div>
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = `<div class="error">Failed to load servers</div>`;
  }
}

window.serverPower = async function(serverId, action) {
  const username = localStorage.getItem('username');
  try {
    await fetch(`/api/servers/${serverId}/power`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, action })
    });
    loadServers();
  } catch (e) {
    alert('Failed to execute power action');
  }
};

function cleanupServers() {
  if (pollInterval$2) {
    clearInterval(pollInterval$2);
    pollInterval$2 = null;
  }
}

let pollInterval$1 = null;
let consoleSocket = null;

function renderServerConsole(serverId) {
  const app = document.getElementById('app');
  
  app.innerHTML = `
    <div class="server-console-page">
      <div class="page-header">
        <a href="/servers" class="btn btn-ghost"><span class="material-icons-outlined">arrow_back</span> Back</a>
        <h1 id="server-name">Loading...</h1>
      </div>
      
      <div class="console-layout">
        <div class="console-main">
          <div class="card console-card">
            <div class="console-header">
              <h3>Console</h3>
              <div class="power-buttons">
                <button class="btn btn-success btn-sm" id="btn-start">Start</button>
                <button class="btn btn-warning btn-sm" id="btn-restart">Restart</button>
                <button class="btn btn-danger btn-sm" id="btn-stop">Stop</button>
                <button class="btn btn-danger btn-sm" id="btn-kill">Kill</button>
              </div>
            </div>
            <div class="console-output" id="console-output">
              <div class="console-placeholder">Connecting to server...</div>
            </div>
            <div class="console-input">
              <input type="text" id="command-input" placeholder="Type a command..." />
              <button class="btn btn-primary" id="send-command">Send</button>
            </div>
          </div>
        </div>
        
        <div class="console-sidebar">
          <div class="card">
            <h3>Resources</h3>
            <div id="resources-display">
              <div class="resource-item">
                <span class="label">Status</span>
                <span class="value" id="res-status">--</span>
              </div>
              <div class="resource-item">
                <span class="label">CPU</span>
                <span class="value" id="res-cpu">--</span>
              </div>
              <div class="resource-item">
                <span class="label">Memory</span>
                <span class="value" id="res-memory">--</span>
              </div>
              <div class="resource-item">
                <span class="label">Disk</span>
                <span class="value" id="res-disk">--</span>
              </div>
              <div class="resource-item">
                <span class="label">Network ↑</span>
                <span class="value" id="res-net-tx">--</span>
              </div>
              <div class="resource-item">
                <span class="label">Network ↓</span>
                <span class="value" id="res-net-rx">--</span>
              </div>
            </div>
          </div>
          
          <div class="card">
            <h3>Server Info</h3>
            <div id="server-info">
              <div class="info-item">
                <span class="label">Address</span>
                <span class="value" id="info-address">--</span>
              </div>
              <div class="info-item">
                <span class="label">Node</span>
                <span class="value" id="info-node">--</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  loadServerDetails(serverId);
  connectWebSocket(serverId);
  
  document.getElementById('btn-start').onclick = () => powerAction(serverId, 'start');
  document.getElementById('btn-restart').onclick = () => powerAction(serverId, 'restart');
  document.getElementById('btn-stop').onclick = () => powerAction(serverId, 'stop');
  document.getElementById('btn-kill').onclick = () => powerAction(serverId, 'kill');
  
  document.getElementById('send-command').onclick = () => sendCommand(serverId);
  document.getElementById('command-input').onkeypress = (e) => {
    if (e.key === 'Enter') sendCommand(serverId);
  };
}

async function loadServerDetails(serverId) {
  const username = localStorage.getItem('username');
  
  try {
    const res = await fetch(`/api/servers/${serverId}?username=${encodeURIComponent(username)}`);
    const data = await res.json();
    
    if (data.error) {
      document.getElementById('server-name').textContent = 'Error';
      return;
    }
    
    const server = data.server;
    
    document.getElementById('server-name').textContent = server.name;
    document.getElementById('info-address').textContent = `${server.allocation?.ip}:${server.allocation?.port}`;
    document.getElementById('info-node').textContent = server.node_id?.substring(0, 8) || '--';
  } catch (e) {
    console.error('Failed to load server:', e);
  }
}

async function connectWebSocket(serverId) {
  const username = localStorage.getItem('username');
  
  try {
    const res = await fetch(`/api/servers/${serverId}/websocket?username=${encodeURIComponent(username)}`);
    const data = await res.json();
    
    if (data.error) {
      appendConsole(`[ERROR] ${data.error}`);
      return;
    }
    
    const { token, socket } = data.data;
    
    appendConsole('[SYSTEM] Connecting to console...');
    
    consoleSocket = new WebSocket(socket);
    
    consoleSocket.onopen = () => {
      appendConsole('[SYSTEM] WebSocket connected, authenticating...');
      consoleSocket.send(JSON.stringify({
        event: 'auth',
        args: [token]
      }));
    };
    
    consoleSocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleSocketMessage(message);
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };
    
    consoleSocket.onclose = () => {
      appendConsole('[SYSTEM] Connection closed');
      setTimeout(() => connectWebSocket(serverId), 5000);
    };
    
    consoleSocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      appendConsole('[ERROR] WebSocket connection failed');
    };
    
  } catch (e) {
    console.error('Failed to connect WebSocket:', e);
    appendConsole('[ERROR] Failed to connect to console');
  }
}

function handleSocketMessage(message) {
  const { event, args } = message;
  
  switch (event) {
    case 'auth success':
      appendConsole('[SYSTEM] Authenticated successfully');
      consoleSocket.send(JSON.stringify({ event: 'send logs', args: [null] }));
      consoleSocket.send(JSON.stringify({ event: 'send stats', args: [null] }));
      break;
      
    case 'token expiring':
    case 'token expired':
      appendConsole('[SYSTEM] Token expired, reconnecting...');
      break;
      
    case 'console output':
      if (args && args[0]) {
        const lines = args[0].split('\n');
        lines.forEach(line => {
          if (line.trim()) appendConsole(line);
        });
      }
      break;
      
    case 'status':
      if (args && args[0]) {
        const status = args[0];
        const statusEl = document.getElementById('res-status');
        if (statusEl) {
          statusEl.textContent = status;
          statusEl.className = `value status-${status}`;
        }
      }
      break;
      
    case 'stats':
      if (args && args[0]) {
        updateResources(args[0]);
      }
      break;
      
    case 'install output':
      if (args && args[0]) {
        appendConsole(`[INSTALL] ${args[0]}`);
      }
      break;
      
    case 'install started':
      appendConsole('[SYSTEM] Installation started...');
      break;
      
    case 'install completed':
      appendConsole('[SYSTEM] Installation completed');
      break;
      
    case 'daemon error':
      if (args && args[0]) {
        appendConsole(`[DAEMON ERROR] ${args[0]}`);
      }
      break;
      
    default:
      console.log('Unhandled WebSocket event:', event, args);
  }
}

function updateResources(stats) {
  const cpuEl = document.getElementById('res-cpu');
  const memEl = document.getElementById('res-memory');
  const diskEl = document.getElementById('res-disk');
  const netTxEl = document.getElementById('res-net-tx');
  const netRxEl = document.getElementById('res-net-rx');
  
  if (cpuEl) cpuEl.textContent = `${(stats.cpu_absolute || 0).toFixed(1)}%`;
  if (memEl) memEl.textContent = formatBytes(stats.memory_bytes || 0);
  if (diskEl) diskEl.textContent = formatBytes(stats.disk_bytes || 0);
  if (netTxEl) netTxEl.textContent = formatBytes(stats.network?.tx_bytes || 0);
  if (netRxEl) netRxEl.textContent = formatBytes(stats.network?.rx_bytes || 0);
}

async function powerAction(serverId, action) {
  const username = localStorage.getItem('username');
  
  try {
    const res = await fetch(`/api/servers/${serverId}/power`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, action })
    });
    
    if (res.ok) {
      appendConsole(`[SYSTEM] Power action: ${action}`);
      loadServerDetails(serverId);
    } else {
      const data = await res.json();
      appendConsole(`[ERROR] ${data.error}`);
    }
  } catch (e) {
    appendConsole(`[ERROR] Failed to execute power action`);
  }
}

async function sendCommand(serverId) {
  const input = document.getElementById('command-input');
  const command = input.value.trim();
  if (!command) return;
  
  appendConsole(`> ${command}`);
  input.value = '';
  
  if (consoleSocket && consoleSocket.readyState === WebSocket.OPEN) {
    consoleSocket.send(JSON.stringify({
      event: 'send command',
      args: [command]
    }));
  } else {
    const username = localStorage.getItem('username');
    try {
      const res = await fetch(`/api/servers/${serverId}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, command })
      });
      
      if (!res.ok) {
        const data = await res.json();
        appendConsole(`[ERROR] ${data.error}`);
      }
    } catch (e) {
      appendConsole(`[ERROR] Failed to send command`);
    }
  }
}

function appendConsole(text) {
  const output = document.getElementById('console-output');
  const placeholder = output.querySelector('.console-placeholder');
  if (placeholder) placeholder.remove();
  
  const line = document.createElement('div');
  line.className = 'console-line';
  line.textContent = text;
  output.appendChild(line);
  output.scrollTop = output.scrollHeight;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function cleanupServerConsole() {
  if (pollInterval$1) {
    clearInterval(pollInterval$1);
    pollInterval$1 = null;
  }
  if (consoleSocket) {
    consoleSocket.close();
    consoleSocket = null;
  }
}

let pollInterval = null;

function renderStatus() {
  const app = document.getElementById('app');
  
  app.innerHTML = `
    <div class="status-page">
      <div class="status-header">
        <span class="material-icons-outlined header-icon">monitor_heart</span>
        <h1>System Status</h1>
        <p>Real-time status of all nodes</p>
      </div>
      
      <div class="status-summary" id="status-summary">
        <div class="summary-card">
          <span class="number" id="nodes-online">-</span>
          <span class="label">Nodes Online</span>
        </div>
        <div class="summary-card">
          <span class="number" id="nodes-total">-</span>
          <span class="label">Total Nodes</span>
        </div>
        <div class="summary-card">
          <span class="number" id="servers-total">-</span>
          <span class="label">Total Servers</span>
        </div>
      </div>
      
      <div class="nodes-status-grid" id="nodes-list">
        <div class="loading-spinner"></div>
      </div>
      
      <div class="status-footer">
        <p>Last updated: <span id="last-update">--</span></p>
      </div>
    </div>
  `;
  
  loadStatus();
  pollInterval = setInterval(loadStatus, 30000);
}

async function loadStatus() {
  const container = document.getElementById('nodes-list');
  
  try {
    const res = await fetch('/api/status/nodes');
    const data = await res.json();
    
    const online = data.nodes.filter(n => n.status === 'online').length;
    const total = data.nodes.length;
    const servers = data.nodes.reduce((sum, n) => sum + n.servers, 0);
    
    document.getElementById('nodes-online').textContent = online;
    document.getElementById('nodes-total').textContent = total;
    document.getElementById('servers-total').textContent = servers;
    document.getElementById('last-update').textContent = new Date().toLocaleTimeString();
    
    if (data.nodes.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="material-icons-outlined icon">power_off</span>
          <h3>No Nodes</h3>
          <p>No nodes have been configured yet.</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = data.nodes.map(node => {
      const memPercent = node.memory.total > 0 ? (node.memory.used / (node.memory.total * 1024 * 1024)) * 100 : 0;
      const diskPercent = node.disk.total > 0 ? (node.disk.used / (node.disk.total * 1024 * 1024)) * 100 : 0;
      
      return `
        <div class="node-status-card card ${node.status}">
          <div class="node-header">
            <h3>${escapeHtml(node.name)}</h3>
            <span class="status-badge status-${node.status}">${node.status}</span>
          </div>
          <div class="node-stats">
            <div class="stat">
              <span class="label">Servers</span>
              <span class="value">${node.servers}</span>
            </div>
            <div class="stat">
              <span class="label">Memory</span>
              <div class="progress-bar">
                <div class="progress" style="width: ${Math.min(memPercent, 100)}%"></div>
              </div>
              <span class="value">${memPercent.toFixed(1)}%</span>
            </div>
            <div class="stat">
              <span class="label">Disk</span>
              <div class="progress-bar">
                <div class="progress" style="width: ${Math.min(diskPercent, 100)}%"></div>
              </div>
              <span class="value">${diskPercent.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    container.innerHTML = `<div class="error">Failed to load status</div>`;
  }
}

function cleanupStatus() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

let currentTab = 'nodes';

async function renderAdmin() {
  const app = document.getElementById('app');
  const username = localStorage.getItem('username');
  const password = localStorage.getItem('password');
  
  app.innerHTML = '<div class="loading-spinner"></div>';
  
  try {
    const res = await fetch(`/api/auth/me?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`);
    const data = await res.json();
    
    if (!data.user?.isAdmin) {
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
      <div class="page-header">
        <h1>Admin Panel</h1>
      </div>
      
      <div class="admin-tabs">
        <button class="tab-btn active" data-tab="nodes">Nodes</button>
        <button class="tab-btn" data-tab="servers">Servers</button>
        <button class="tab-btn" data-tab="users">Users</button>
        <button class="tab-btn" data-tab="nests">Nests & Eggs</button>
        <button class="tab-btn" data-tab="locations">Locations</button>
      </div>
      
      <div class="admin-content" id="admin-content">
        <div class="loading-spinner"></div>
      </div>
    </div>
  `;
  
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.dataset.tab;
      loadTab(currentTab);
    };
  });
  
  loadTab('nodes');
}

async function loadTab(tab) {
  const container = document.getElementById('admin-content');
  const username = localStorage.getItem('username');
  
  container.innerHTML = '<div class="loading-spinner"></div>';
  
  switch (tab) {
    case 'nodes':
      await loadNodes(container, username);
      break;
    case 'servers':
      await loadServersTab(container, username);
      break;
    case 'users':
      await loadUsers(container, username);
      break;
    case 'nests':
      await loadNests(container, username);
      break;
    case 'locations':
      await loadLocations(container, username);
      break;
  }
}

async function loadNodes(container, username) {
  try {
    const res = await fetch(`/api/admin/nodes?username=${encodeURIComponent(username)}`);
    const data = await res.json();
    
    container.innerHTML = `
      <div class="admin-section">
        <div class="section-header">
          <h2>Nodes</h2>
          <button class="btn btn-primary" id="add-node-btn"><span class="material-icons-outlined">add</span> Add Node</button>
        </div>
        
        <div id="node-form" class="card form-card" style="display:none;">
          <h3>Create Node</h3>
          <form id="create-node-form">
            <div class="form-group">
              <label>Name</label>
              <input type="text" name="name" required />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>FQDN</label>
                <input type="text" name="fqdn" placeholder="node.example.com" required />
              </div>
              <div class="form-group">
                <label>Scheme</label>
                <select name="scheme">
                  <option value="https">HTTPS</option>
                  <option value="http">HTTP</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Memory (MB)</label>
                <input type="number" name="memory" value="8192" required />
              </div>
              <div class="form-group">
                <label>Disk (MB)</label>
                <input type="number" name="disk" value="51200" required />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Daemon Port</label>
                <input type="number" name="daemon_port" value="8080" required />
              </div>
              <div class="form-group">
                <label>SFTP Port</label>
                <input type="number" name="daemon_sftp_port" value="2022" required />
              </div>
            </div>
            <div class="form-group">
              <label>Location</label>
              <select name="location_id" id="node-location"></select>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">Create</button>
              <button type="button" class="btn btn-ghost" id="cancel-node">Cancel</button>
            </div>
          </form>
        </div>
        
        <div class="admin-table">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>FQDN</th>
                <th>Memory</th>
                <th>Disk</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${data.nodes.length === 0 ? '<tr><td colspan="5" class="empty">No nodes</td></tr>' : ''}
              ${data.nodes.map(node => `
                <tr>
                  <td>${escapeHtml(node.name)}</td>
                  <td>${escapeHtml(node.fqdn)}</td>
                  <td>${node.memory} MB</td>
                  <td>${node.disk} MB</td>
                  <td>
                    <button class="btn btn-sm btn-ghost" onclick="editNode('${node.id}')">Edit</button>
                    <button class="btn btn-sm btn-ghost" onclick="showNodeConfig('${node.id}')">Config</button>
                    <button class="btn btn-sm btn-ghost" onclick="showDeployCommand('${node.id}')">Deploy</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteNode('${node.id}')">Delete</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    
    const locRes = await fetch('/api/admin/locations');
    const locData = await locRes.json();
    document.getElementById('node-location').innerHTML = locData.locations.map(l => 
      `<option value="${l.id}">${escapeHtml(l.long)} (${escapeHtml(l.short)})</option>`
    ).join('');
    
    document.getElementById('add-node-btn').onclick = () => {
      document.getElementById('node-form').style.display = 'block';
    };
    
    document.getElementById('cancel-node').onclick = () => {
      document.getElementById('node-form').style.display = 'none';
    };
    
    document.getElementById('create-node-form').onsubmit = async (e) => {
      e.preventDefault();
      const form = new FormData(e.target);
      const node = Object.fromEntries(form);
      
      await fetch('/api/admin/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, node })
      });
      
      loadTab('nodes');
    };
  } catch (e) {
    container.innerHTML = `<div class="error">Failed to load nodes</div>`;
  }
}

window.editNode = async function(nodeId) {
  const username = localStorage.getItem('username');
  try {
    const res = await fetch(`/api/admin/nodes?username=${encodeURIComponent(username)}`);
    const data = await res.json();
    const node = data.nodes.find(n => n.id === nodeId);
    if (!node) return alert('Node not found');
    
    const locRes = await fetch('/api/admin/locations');
    const locData = await locRes.json();
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-backdrop" onclick="this.parentElement.remove()"></div>
      <div class="modal-content modal-large">
        <h2>Edit Node</h2>
        <form id="edit-node-form">
          <div class="form-group">
            <label>Name</label>
            <input type="text" name="name" value="${escapeHtml(node.name)}" required />
          </div>
          <div class="form-group">
            <label>Description</label>
            <input type="text" name="description" value="${escapeHtml(node.description || '')}" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>FQDN</label>
              <input type="text" name="fqdn" value="${escapeHtml(node.fqdn)}" required />
            </div>
            <div class="form-group">
              <label>Scheme</label>
              <select name="scheme">
                <option value="https" ${node.scheme === 'https' ? 'selected' : ''}>HTTPS</option>
                <option value="http" ${node.scheme === 'http' ? 'selected' : ''}>HTTP</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Memory (MB)</label>
              <input type="number" name="memory" value="${node.memory}" required />
            </div>
            <div class="form-group">
              <label>Disk (MB)</label>
              <input type="number" name="disk" value="${node.disk}" required />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Daemon Port</label>
              <input type="number" name="daemon_port" value="${node.daemon_port}" required />
            </div>
            <div class="form-group">
              <label>SFTP Port</label>
              <input type="number" name="daemon_sftp_port" value="${node.daemon_sftp_port}" required />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Upload Size (MB)</label>
              <input type="number" name="upload_size" value="${node.upload_size || 100}" />
            </div>
            <div class="form-group">
              <label>Location</label>
              <select name="location_id">
                ${locData.locations.map(l => `<option value="${l.id}" ${l.id === node.location_id ? 'selected' : ''}>${escapeHtml(l.long)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label><input type="checkbox" name="behind_proxy" ${node.behind_proxy ? 'checked' : ''} /> Behind Proxy</label>
            </div>
            <div class="form-group">
              <label><input type="checkbox" name="maintenance_mode" ${node.maintenance_mode ? 'checked' : ''} /> Maintenance Mode</label>
            </div>
          </div>
          <div class="modal-actions">
            <button type="submit" class="btn btn-primary">Save</button>
            <button type="button" class="btn btn-ghost" onclick="this.closest('.modal').remove()">Cancel</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('edit-node-form').onsubmit = async (e) => {
      e.preventDefault();
      const form = new FormData(e.target);
      const nodeData = Object.fromEntries(form);
      nodeData.behind_proxy = form.get('behind_proxy') === 'on';
      nodeData.maintenance_mode = form.get('maintenance_mode') === 'on';
      
      await fetch(`/api/admin/nodes/${nodeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, node: nodeData })
      });
      
      modal.remove();
      loadTab('nodes');
    };
  } catch (e) {
    alert('Failed to load node: ' + e.message);
  }
};

window.showDeployCommand = async function(nodeId) {
  const username = localStorage.getItem('username');
  try {
    const res = await fetch(`/api/admin/nodes/${nodeId}/deploy?username=${encodeURIComponent(username)}`);
    const data = await res.json();
    
    if (data.error) {
      alert(data.error);
      return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-backdrop" onclick="this.parentElement.remove()"></div>
      <div class="modal-content">
        <h2>Deploy Command</h2>
        <p>Run this command on your node to configure Wings:</p>
        <pre class="config-output" style="white-space:pre-wrap;word-break:break-all;">${escapeHtml(data.command)}</pre>
        <div class="modal-actions">
          <button class="btn btn-ghost" onclick="navigator.clipboard.writeText(this.closest('.modal').querySelector('.config-output').textContent);this.textContent='Copied!'">Copy</button>
          <button class="btn btn-primary" onclick="this.closest('.modal').remove()">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  } catch (e) {
    alert('Failed to load deploy command: ' + e.message);
  }
};

window.showNodeConfig = async function(nodeId) {
  const username = localStorage.getItem('username');
  try {
    const res = await fetch(`/api/admin/nodes/${nodeId}/config?username=${encodeURIComponent(username)}`);
    const data = await res.json();
    
    if (data.error) {
      alert(data.error);
      return;
    }
    
    const yamlConfig = jsonToYaml(data.config);
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-backdrop" onclick="this.parentElement.remove()"></div>
      <div class="modal-content">
        <h2>Wings Configuration</h2>
        <p>Copy this configuration to <code>/etc/pterodactyl/config.yml</code> on your node:</p>
        <pre class="config-output">${escapeHtml(yamlConfig)}</pre>
        <div class="modal-actions">
          <button class="btn btn-ghost" onclick="navigator.clipboard.writeText(this.closest('.modal').querySelector('.config-output').textContent);this.textContent='Copied!'">Copy</button>
          <button class="btn btn-primary" onclick="this.closest('.modal').remove()">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  } catch (e) {
    alert('Failed to load config: ' + e.message);
  }
};

function jsonToYaml(obj, indent = 0) {
  let yaml = '';
  const spaces = '  '.repeat(indent);
  
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      yaml += `${spaces}${key}: null\n`;
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      yaml += `${spaces}${key}:\n${jsonToYaml(value, indent + 1)}`;
    } else if (Array.isArray(value)) {
      yaml += `${spaces}${key}:\n`;
      value.forEach(item => {
        if (typeof item === 'object') {
          yaml += `${spaces}  -\n${jsonToYaml(item, indent + 2)}`;
        } else {
          yaml += `${spaces}  - ${item}\n`;
        }
      });
    } else if (typeof value === 'string') {
      yaml += `${spaces}${key}: "${value}"\n`;
    } else {
      yaml += `${spaces}${key}: ${value}\n`;
    }
  }
  return yaml;
}

window.deleteNode = async function(nodeId) {
  if (!confirm('Are you sure? This cannot be undone.')) return;
  const username = localStorage.getItem('username');
  
  try {
    await fetch(`/api/admin/nodes/${nodeId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    loadTab('nodes');
  } catch (e) {
    alert('Failed to delete node');
  }
};

async function loadServersTab(container, username) {
  try {
    const res = await fetch(`/api/admin/servers?username=${encodeURIComponent(username)}`);
    const data = await res.json();
    
    container.innerHTML = `
      <div class="admin-section">
        <div class="section-header">
          <h2>Servers</h2>
          <button class="btn btn-primary" id="add-server-btn"><span class="material-icons-outlined">add</span> Create Server</button>
        </div>
        
        <div id="server-form" class="card form-card" style="display:none;">
          <h3>Create Server</h3>
          <form id="create-server-form">
            <div class="form-group">
              <label>Name</label>
              <input type="text" name="name" required />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Owner (User ID)</label>
                <select name="user_id" id="server-user"></select>
              </div>
              <div class="form-group">
                <label>Node</label>
                <select name="node_id" id="server-node"></select>
              </div>
            </div>
            <div class="form-group">
              <label>Egg</label>
              <select name="egg_id" id="server-egg"></select>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Memory (MB)</label>
                <input type="number" name="memory" value="1024" required />
              </div>
              <div class="form-group">
                <label>Disk (MB)</label>
                <input type="number" name="disk" value="5120" required />
              </div>
              <div class="form-group">
                <label>CPU (%)</label>
                <input type="number" name="cpu" value="100" required />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Allocation IP</label>
                <input type="text" name="allocation_ip" value="0.0.0.0" />
              </div>
              <div class="form-group">
                <label>Allocation Port</label>
                <input type="number" name="allocation_port" value="25565" />
              </div>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">Create</button>
              <button type="button" class="btn btn-ghost" id="cancel-server">Cancel</button>
            </div>
          </form>
        </div>
        
        <div class="admin-table">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Owner</th>
                <th>Resources</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${data.servers.length === 0 ? '<tr><td colspan="5" class="empty">No servers</td></tr>' : ''}
              ${data.servers.map(s => `
                <tr>
                  <td>${escapeHtml(s.name)}</td>
                  <td>${s.user_id?.substring(0, 8) || '--'}</td>
                  <td>${s.limits?.memory || 0}MB / ${s.limits?.disk || 0}MB / ${s.limits?.cpu || 0}%</td>
                  <td><span class="status-badge status-${s.status}">${s.status}</span></td>
                  <td>
                    <button class="btn btn-sm btn-danger" onclick="deleteServer('${s.id}')">Delete</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    
    const usersRes = await fetch(`/api/admin/users?username=${encodeURIComponent(username)}`);
    const usersData = await usersRes.json();
    document.getElementById('server-user').innerHTML = usersData.users.map(u => 
      `<option value="${u.id}">${escapeHtml(u.username)}</option>`
    ).join('');
    
    const nodesRes = await fetch(`/api/admin/nodes?username=${encodeURIComponent(username)}`);
    const nodesData = await nodesRes.json();
    document.getElementById('server-node').innerHTML = nodesData.nodes.map(n => 
      `<option value="${n.id}">${escapeHtml(n.name)}</option>`
    ).join('');
    
    const eggsRes = await fetch('/api/admin/eggs');
    const eggsData = await eggsRes.json();
    document.getElementById('server-egg').innerHTML = eggsData.eggs.map(e => 
      `<option value="${e.id}">${escapeHtml(e.name)}</option>`
    ).join('');
    
    document.getElementById('add-server-btn').onclick = () => {
      document.getElementById('server-form').style.display = 'block';
    };
    
    document.getElementById('cancel-server').onclick = () => {
      document.getElementById('server-form').style.display = 'none';
    };
    
    document.getElementById('create-server-form').onsubmit = async (e) => {
      e.preventDefault();
      const form = new FormData(e.target);
      const server = Object.fromEntries(form);
      
      await fetch('/api/admin/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, server })
      });
      
      loadTab('servers');
    };
  } catch (e) {
    container.innerHTML = `<div class="error">Failed to load servers</div>`;
  }
}

window.deleteServer = async function(serverId) {
  if (!confirm('Are you sure? This will delete the server from the node.')) return;
  const username = localStorage.getItem('username');
  
  try {
    await fetch(`/api/admin/servers/${serverId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    loadTab('servers');
  } catch (e) {
    alert('Failed to delete server');
  }
};

async function loadUsers(container, username) {
  try {
    const res = await fetch(`/api/admin/users?username=${encodeURIComponent(username)}`);
    const data = await res.json();
    
    container.innerHTML = `
      <div class="admin-section">
        <div class="section-header">
          <h2>Users</h2>
        </div>
        
        <div class="admin-table">
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Display Name</th>
                <th>Admin</th>
                <th>Limits</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${data.users.map(u => `
                <tr>
                  <td>${escapeHtml(u.username)}</td>
                  <td>${escapeHtml(u.displayName || u.username)}</td>
                  <td>${u.isAdmin ? '✓' : '✗'}</td>
                  <td>${u.limits ? `${u.limits.servers} servers, ${u.limits.memory}MB` : 'Default'}</td>
                  <td>
                    <button class="btn btn-sm btn-ghost" onclick="toggleAdmin('${u.id}', ${!u.isAdmin})">${u.isAdmin ? 'Remove Admin' : 'Make Admin'}</button>
                    <button class="btn btn-sm btn-ghost" onclick="editUserLimits('${u.id}')">Edit Limits</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (e) {
    container.innerHTML = `<div class="error">Failed to load users</div>`;
  }
}

window.toggleAdmin = async function(userId, makeAdmin) {
  const username = localStorage.getItem('username');
  
  await fetch(`/api/admin/users/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, updates: { isAdmin: makeAdmin } })
  });
  
  loadTab('users');
};

window.editUserLimits = async function(userId) {
  const limits = {
    servers: parseInt(prompt('Max servers:', '2')) || 2,
    memory: parseInt(prompt('Max memory (MB):', '2048')) || 2048,
    disk: parseInt(prompt('Max disk (MB):', '10240')) || 10240,
    cpu: parseInt(prompt('Max CPU (%):', '200')) || 200
  };
  
  const username = localStorage.getItem('username');
  
  await fetch(`/api/admin/users/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, updates: { limits } })
  });
  
  loadTab('users');
};

async function loadNests(container, username) {
  try {
    const res = await fetch('/api/admin/nests');
    const data = await res.json();
    
    container.innerHTML = `
      <div class="admin-section">
        <div class="section-header">
          <h2>Nests & Eggs</h2>
          <div>
            <button class="btn btn-ghost" id="add-nest-btn"><span class="material-icons-outlined">add</span> Add Nest</button>
            <button class="btn btn-primary" id="import-egg-btn"><span class="material-icons-outlined">upload</span> Import Egg</button>
          </div>
        </div>
        
        <div id="import-egg-form" class="card form-card" style="display:none;">
          <h3>Import Pterodactyl Egg</h3>
          <form id="egg-import-form">
            <div class="form-group">
              <label>Egg JSON</label>
              <textarea name="eggJson" rows="10" placeholder="Paste egg JSON here..."></textarea>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">Import</button>
              <button type="button" class="btn btn-ghost" id="cancel-import">Cancel</button>
            </div>
          </form>
        </div>
        
        <div class="nests-grid">
          ${data.nests.map(nest => `
            <div class="nest-card card">
              <h3>${escapeHtml(nest.name)}</h3>
              <p>${escapeHtml(nest.description)}</p>
              <div class="eggs-list">
                <h4>Eggs (${nest.eggs?.length || 0})</h4>
                ${(nest.eggs || []).map(egg => `
                  <div class="egg-item">
                    <span class="egg-name">${escapeHtml(egg.name)}</span>
                    <span class="egg-image">${escapeHtml(egg.docker_image?.split('/').pop() || '')}</span>
                  </div>
                `).join('') || '<div class="empty">No eggs</div>'}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    
    document.getElementById('add-nest-btn').onclick = async () => {
      const name = prompt('Nest name:');
      if (!name) return;
      const description = prompt('Description:') || '';
      
      await fetch('/api/admin/nests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, nest: { name, description } })
      });
      
      loadTab('nests');
    };
    
    document.getElementById('import-egg-btn').onclick = () => {
      document.getElementById('import-egg-form').style.display = 'block';
    };
    
    document.getElementById('cancel-import').onclick = () => {
      document.getElementById('import-egg-form').style.display = 'none';
    };
    
    document.getElementById('egg-import-form').onsubmit = async (e) => {
      e.preventDefault();
      const form = new FormData(e.target);
      
      const res = await fetch('/api/admin/eggs/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, eggJson: form.get('eggJson') })
      });
      
      if (res.ok) {
        loadTab('nests');
      } else {
        alert('Failed to import egg');
      }
    };
  } catch (e) {
    container.innerHTML = `<div class="error">Failed to load nests</div>`;
  }
}

async function loadLocations(container, username) {
  try {
    const res = await fetch('/api/admin/locations');
    const data = await res.json();
    
    container.innerHTML = `
      <div class="admin-section">
        <div class="section-header">
          <h2>Locations</h2>
          <button class="btn btn-primary" id="add-location-btn"><span class="material-icons-outlined">add</span> Add Location</button>
        </div>
        
        <div class="admin-table">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Short</th>
                <th>Long</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${data.locations.map(l => `
                <tr>
                  <td>${l.id}</td>
                  <td>${escapeHtml(l.short)}</td>
                  <td>${escapeHtml(l.long)}</td>
                  <td>
                    <button class="btn btn-sm btn-danger" onclick="deleteLocation('${l.id}')">Delete</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    
    document.getElementById('add-location-btn').onclick = async () => {
      const short = prompt('Short code (e.g., us, eu):');
      if (!short) return;
      const long = prompt('Full name:') || short;
      
      await fetch('/api/admin/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, location: { short, long } })
      });
      
      loadTab('locations');
    };
  } catch (e) {
    container.innerHTML = `<div class="error">Failed to load locations</div>`;
  }
}

window.deleteLocation = async function(locationId) {
  if (!confirm('Delete this location?')) return;
  const username = localStorage.getItem('username');
  
  await fetch(`/api/admin/locations/${locationId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  });
  
  loadTab('locations');
};

function cleanupAdmin() {}

const routes = {
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
  '/404': {
    render: renderNotFound,
    options: {
      title: 'Not Found',
      sidebar: false
    }
  }
};

function getUserRoute(username) {
  return {
    render: () => renderUser(username),
    options: {
      title: `${username}'s Profile`,
      sidebar: true
    }
  };
}

function getServerRoute(serverId) {
  return {
    render: () => renderServerConsole(serverId),
    cleanup: cleanupServerConsole,
    options: {
      title: 'Console',
      auth: true,
      sidebar: true
    }
  };
}

function renderNav() {
  const nav = document.createElement('nav');
  nav.id = 'navbar';
  nav.className = 'navbar';
  
  const displayName = localStorage.getItem('displayName') || localStorage.getItem('username') || 'User';
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
        if (sidebar) {
          sidebar.classList.toggle('open');
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
        localStorage.removeItem('loggedIn');
        localStorage.removeItem('username');
        localStorage.removeItem('password');
        localStorage.removeItem('displayName');
        localStorage.removeItem('userId');
        navigate('/auth');
      });
    }
  }, 0);
  
  return nav;
}

function renderSidebar() {
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

function navigate(path) {
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

function router() {
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
  
  const isAuthenticated = !!localStorage.getItem('loggedIn');
  
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
    
    const existingSidebar = document.getElementById('sidebar');
    if (existingSidebar && route.options?.sidebar !== false && isAuthenticated) {
      existingSidebar.replaceWith(renderSidebar());
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

window.addEventListener('DOMContentLoaded', () => {
  const loading = document.getElementById('loading');
  
  setTimeout(() => {
    loading.classList.add('hidden');
    loading.addEventListener('transitionend', () => {
      loading.remove();
    });
    router();
  }, 300);
});
