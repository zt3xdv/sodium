import { escapeHtml, escapeUrl } from '../utils/security.js';

export function renderUser(targetUsername) {
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
          <p>User not found</p>
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
        <p>Connection error. Please try again.</p>
        <a href="/dashboard" class="btn btn-primary">Back to Dashboard</a>
      </div>
    `;
  }
}
