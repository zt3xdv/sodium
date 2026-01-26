import { escapeHtml, escapeUrl } from '../utils/security.js';

export function renderProfile() {
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
