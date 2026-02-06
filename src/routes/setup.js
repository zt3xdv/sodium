import * as toast from '../utils/toast.js';

export async function renderSetup() {
  const app = document.getElementById('app');
  app.className = 'setup-page';
  
  // Theme handling
  const savedTheme = localStorage.getItem('sodium-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  
  let currentStep = 1;
  const totalSteps = 5;
  
  const config = {
    panel: { name: 'Sodium', url: window.location.origin, port: 3000 },
    database: { type: 'file', host: 'localhost', port: 3306, name: 'sodium', user: 'sodium', password: '' },
    redis: { enabled: false, host: 'localhost', port: 6379, password: '' },
    registration: { enabled: true },
    defaults: { servers: 2, memory: 2048, disk: 10240, cpu: 200, allocations: 5, backups: 3 },
    admin: { username: '', email: '', password: '', confirmPassword: '' }
  };
  
  function render() {
    app.innerHTML = `
      <div class="setup-container">
        <div class="setup-card">
          <div class="setup-header">
            <div class="setup-header-top">
              <div class="setup-logo">
                <span class="material-icons-outlined">bolt</span>
                <span>Sodium Setup</span>
              </div>
              <button class="theme-toggle" id="theme-toggle" title="Toggle theme">
                <span class="material-icons-outlined">${document.documentElement.getAttribute('data-theme') === 'dark' ? 'light_mode' : 'dark_mode'}</span>
              </button>
            </div>
            <div class="setup-progress">
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${(currentStep / totalSteps) * 100}%"></div>
              </div>
              <span class="progress-text">Step ${currentStep} of ${totalSteps}</span>
            </div>
          </div>
          
          <div class="setup-content" id="setup-content">
            ${renderStep()}
          </div>
          
          <div class="setup-footer">
            ${currentStep > 1 ? `<button class="btn btn-secondary" id="prev-btn">Back</button>` : '<div></div>'}
            ${currentStep < totalSteps 
              ? `<button class="btn btn-primary" id="next-btn">Next</button>`
              : `<button class="btn btn-primary" id="finish-btn">Complete Setup</button>`
            }
          </div>
        </div>
      </div>
    `;
    
    attachListeners();
  }
  
  function renderStep() {
    switch (currentStep) {
      case 1: return renderPanelStep();
      case 2: return renderDatabaseStep();
      case 3: return renderRedisStep();
      case 4: return renderDefaultsStep();
      case 5: return renderAdminStep();
      default: return '';
    }
  }
  
  function renderPanelStep() {
    return `
      <h2>Panel Configuration</h2>
      <p class="text-muted">Configure your Sodium panel settings</p>
      
      <div class="form-group">
        <label class="form-label">Panel Name</label>
        <input type="text" class="form-control" id="panel-name" value="${config.panel.name}" placeholder="Sodium">
        <small class="text-muted">The name displayed in the browser title and header</small>
      </div>
      
      <div class="form-group">
        <label class="form-label">Panel URL</label>
        <input type="text" class="form-control" id="panel-url" value="${config.panel.url}" placeholder="https://panel.example.com">
        <small class="text-muted">The public URL of your panel (used for links and webhooks)</small>
      </div>
      
      <div class="form-group">
        <label class="form-label">Port</label>
        <input type="number" class="form-control" id="panel-port" value="${config.panel.port}" placeholder="3000">
        <small class="text-muted">The port the panel will listen on</small>
      </div>
    `;
  }
  
  function renderDatabaseStep() {
    return `
      <h2>Database Configuration</h2>
      <p class="text-muted">Choose how to store your data</p>
      
      <div class="form-group">
        <label class="form-label">Database Type</label>
        <select class="form-control" id="db-type">
          <option value="file" ${config.database.type === 'file' ? 'selected' : ''}>File (built-in, no setup required)</option>
          <option value="sqlite" ${config.database.type === 'sqlite' ? 'selected' : ''}>SQLite</option>
          <option value="mysql" ${config.database.type === 'mysql' ? 'selected' : ''}>MySQL / MariaDB</option>
          <option value="postgresql" ${config.database.type === 'postgresql' ? 'selected' : ''}>PostgreSQL</option>
        </select>
      </div>
      
      <div id="db-external-config" class="${config.database.type === 'file' || config.database.type === 'sqlite' ? 'hidden' : ''}">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Host</label>
            <input type="text" class="form-control" id="db-host" value="${config.database.host}">
          </div>
          <div class="form-group">
            <label class="form-label">Port</label>
            <input type="number" class="form-control" id="db-port" value="${config.database.port}">
          </div>
        </div>
        
        <div class="form-group">
          <label class="form-label">Database Name</label>
          <input type="text" class="form-control" id="db-name" value="${config.database.name}">
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Username</label>
            <input type="text" class="form-control" id="db-user" value="${config.database.user}">
          </div>
          <div class="form-group">
            <label class="form-label">Password</label>
            <input type="password" class="form-control" id="db-password" value="${config.database.password}">
          </div>
        </div>
        
        <button class="btn btn-secondary" id="test-db-btn">
          <span class="material-icons-outlined">sync</span>
          Test Connection
        </button>
        <span id="db-test-result" class="test-result"></span>
      </div>
    `;
  }
  
  function renderRedisStep() {
    return `
      <h2>Redis Configuration</h2>
      <p class="text-muted">Optional: Enable Redis for better performance at scale</p>
      
      <div class="form-group">
        <label class="toggle-container">
          <input type="checkbox" id="redis-enabled" ${config.redis.enabled ? 'checked' : ''}>
          <span class="toggle-label">Enable Redis</span>
        </label>
        <small class="text-muted">Recommended for large installations with many concurrent users</small>
      </div>
      
      <div id="redis-config" class="${config.redis.enabled ? '' : 'hidden'}">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Host</label>
            <input type="text" class="form-control" id="redis-host" value="${config.redis.host}">
          </div>
          <div class="form-group">
            <label class="form-label">Port</label>
            <input type="number" class="form-control" id="redis-port" value="${config.redis.port}">
          </div>
        </div>
        
        <div class="form-group">
          <label class="form-label">Password (optional)</label>
          <input type="password" class="form-control" id="redis-password" value="${config.redis.password}">
        </div>
        
        <button class="btn btn-secondary" id="test-redis-btn">
          <span class="material-icons-outlined">sync</span>
          Test Connection
        </button>
        <span id="redis-test-result" class="test-result"></span>
      </div>
    `;
  }
  
  function renderDefaultsStep() {
    return `
      <h2>Default Limits</h2>
      <p class="text-muted">Set default resource limits for new users</p>
      
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Max Servers</label>
          <input type="number" class="form-control" id="default-servers" value="${config.defaults.servers}">
        </div>
        <div class="form-group">
          <label class="form-label">Max Allocations</label>
          <input type="number" class="form-control" id="default-allocations" value="${config.defaults.allocations}">
        </div>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Memory (MB)</label>
          <input type="number" class="form-control" id="default-memory" value="${config.defaults.memory}">
        </div>
        <div class="form-group">
          <label class="form-label">Disk (MB)</label>
          <input type="number" class="form-control" id="default-disk" value="${config.defaults.disk}">
        </div>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">CPU (%)</label>
          <input type="number" class="form-control" id="default-cpu" value="${config.defaults.cpu}">
          <small class="text-muted">100% = 1 CPU core</small>
        </div>
        <div class="form-group">
          <label class="form-label">Max Backups</label>
          <input type="number" class="form-control" id="default-backups" value="${config.defaults.backups}">
          <small class="text-muted">Maximum backups per user</small>
        </div>
      </div>
      
      <div class="form-group">
        <label class="toggle-container">
          <input type="checkbox" id="registration-enabled" ${config.registration.enabled ? 'checked' : ''}>
          <span class="toggle-label">Allow Registration</span>
        </label>
        <small class="text-muted">Allow new users to create accounts</small>
      </div>
    `;
  }
  
  function renderAdminStep() {
    return `
      <h2>Admin Account</h2>
      <p class="text-muted">Create the first administrator account</p>
      
      <div class="form-group">
        <label class="form-label">Username</label>
        <input type="text" class="form-control" id="admin-username" value="${config.admin.username}" placeholder="admin">
      </div>
      
      <div class="form-group">
        <label class="form-label">Email</label>
        <input type="email" class="form-control" id="admin-email" value="${config.admin.email}" placeholder="admin@example.com">
      </div>
      
      <div class="form-group">
        <label class="form-label">Password</label>
        <input type="password" class="form-control" id="admin-password" value="${config.admin.password}" placeholder="Minimum 8 characters">
      </div>
      
      <div class="form-group">
        <label class="form-label">Confirm Password</label>
        <input type="password" class="form-control" id="admin-confirm-password" value="${config.admin.confirmPassword}">
      </div>
    `;
  }
  
  function saveCurrentStep() {
    switch (currentStep) {
      case 1:
        config.panel.name = document.getElementById('panel-name')?.value || 'Sodium';
        config.panel.url = document.getElementById('panel-url')?.value || window.location.origin;
        config.panel.port = parseInt(document.getElementById('panel-port')?.value) || 3000;
        break;
      case 2:
        config.database.type = document.getElementById('db-type')?.value || 'file';
        config.database.host = document.getElementById('db-host')?.value || 'localhost';
        config.database.port = parseInt(document.getElementById('db-port')?.value) || 3306;
        config.database.name = document.getElementById('db-name')?.value || 'sodium';
        config.database.user = document.getElementById('db-user')?.value || 'sodium';
        config.database.password = document.getElementById('db-password')?.value || '';
        break;
      case 3:
        config.redis.enabled = document.getElementById('redis-enabled')?.checked || false;
        config.redis.host = document.getElementById('redis-host')?.value || 'localhost';
        config.redis.port = parseInt(document.getElementById('redis-port')?.value) || 6379;
        config.redis.password = document.getElementById('redis-password')?.value || '';
        break;
      case 4:
        config.defaults.servers = parseInt(document.getElementById('default-servers')?.value) || 2;
        config.defaults.allocations = parseInt(document.getElementById('default-allocations')?.value) || 5;
        config.defaults.memory = parseInt(document.getElementById('default-memory')?.value) || 2048;
        config.defaults.disk = parseInt(document.getElementById('default-disk')?.value) || 10240;
        config.defaults.cpu = parseInt(document.getElementById('default-cpu')?.value) || 200;
        config.defaults.backups = parseInt(document.getElementById('default-backups')?.value) || 3;
        config.registration.enabled = document.getElementById('registration-enabled')?.checked || false;
        break;
      case 5:
        config.admin.username = document.getElementById('admin-username')?.value || '';
        config.admin.email = document.getElementById('admin-email')?.value || '';
        config.admin.password = document.getElementById('admin-password')?.value || '';
        config.admin.confirmPassword = document.getElementById('admin-confirm-password')?.value || '';
        break;
    }
  }
  
  function validateCurrentStep() {
    switch (currentStep) {
      case 1:
        if (!config.panel.name) return 'Panel name is required';
        if (!config.panel.url) return 'Panel URL is required';
        break;
      case 5:
        if (!config.admin.username) return 'Username is required';
        if (!config.admin.email) return 'Email is required';
        if (!config.admin.password) return 'Password is required';
        if (config.admin.password.length < 8) return 'Password must be at least 8 characters';
        if (config.admin.password !== config.admin.confirmPassword) return 'Passwords do not match';
        break;
    }
    return null;
  }
  
  function attachListeners() {
    // Theme toggle
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('sodium-theme', next);
      render();
    });
    
    document.getElementById('prev-btn')?.addEventListener('click', () => {
      saveCurrentStep();
      currentStep--;
      render();
    });
    
    document.getElementById('next-btn')?.addEventListener('click', () => {
      saveCurrentStep();
      const error = validateCurrentStep();
      if (error) {
        toast.error(error);
        return;
      }
      currentStep++;
      render();
    });
    
    document.getElementById('finish-btn')?.addEventListener('click', async () => {
      saveCurrentStep();
      const error = validateCurrentStep();
      if (error) {
        toast.error(error);
        return;
      }
      
      const btn = document.getElementById('finish-btn');
      btn.disabled = true;
      btn.innerHTML = '<span class="loading-spinner-small"></span> Setting up...';
      
      try {
        const res = await fetch('/api/setup/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config)
        });
        
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error || 'Setup failed');
        }
        
        app.innerHTML = `
          <div class="setup-container">
            <div class="setup-card setup-complete">
              <div class="success-icon">
                <span class="material-icons-outlined">check_circle</span>
              </div>
              <h2>Setup Complete!</h2>
              <p>Sodium has been configured successfully.</p>
              <p class="text-muted">Please restart the server for changes to take effect.</p>
              <a href="/auth" class="btn btn-primary">Go to Login</a>
            </div>
          </div>
        `;
      } catch (err) {
        toast.error(err.message);
        btn.disabled = false;
        btn.textContent = 'Complete Setup';
      }
    });
    
    // Database type change
    document.getElementById('db-type')?.addEventListener('change', (e) => {
      const external = document.getElementById('db-external-config');
      if (e.target.value === 'file' || e.target.value === 'sqlite') {
        external?.classList.add('hidden');
      } else {
        external?.classList.remove('hidden');
      }
    });
    
    // Redis toggle
    document.getElementById('redis-enabled')?.addEventListener('change', (e) => {
      const redisConfig = document.getElementById('redis-config');
      if (e.target.checked) {
        redisConfig?.classList.remove('hidden');
      } else {
        redisConfig?.classList.add('hidden');
      }
    });
    
    // Test database connection
    document.getElementById('test-db-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('test-db-btn');
      const result = document.getElementById('db-test-result');
      
      btn.disabled = true;
      result.textContent = 'Testing...';
      result.className = 'test-result';
      
      try {
        const res = await fetch('/api/setup/test-database', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: document.getElementById('db-type').value,
            host: document.getElementById('db-host').value,
            port: document.getElementById('db-port').value,
            name: document.getElementById('db-name').value,
            user: document.getElementById('db-user').value,
            password: document.getElementById('db-password').value
          })
        });
        
        const data = await res.json();
        result.textContent = res.ok ? '✓ ' + data.message : '✗ ' + data.error;
        result.className = 'test-result ' + (res.ok ? 'success' : 'error');
      } catch (err) {
        result.textContent = '✗ Connection failed';
        result.className = 'test-result error';
      }
      
      btn.disabled = false;
    });
    
    // Test Redis connection
    document.getElementById('test-redis-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('test-redis-btn');
      const result = document.getElementById('redis-test-result');
      
      btn.disabled = true;
      result.textContent = 'Testing...';
      result.className = 'test-result';
      
      try {
        const res = await fetch('/api/setup/test-redis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            host: document.getElementById('redis-host').value,
            port: document.getElementById('redis-port').value,
            password: document.getElementById('redis-password').value
          })
        });
        
        const data = await res.json();
        result.textContent = res.ok ? '✓ ' + data.message : '✗ ' + data.error;
        result.className = 'test-result ' + (res.ok ? 'success' : 'error');
      } catch (err) {
        result.textContent = '✗ Connection failed';
        result.className = 'test-result error';
      }
      
      btn.disabled = false;
    });
  }
  
  render();
}
