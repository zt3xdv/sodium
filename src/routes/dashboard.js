export function renderDashboard() {
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
