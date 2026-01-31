import { setToken, setUser } from '../utils/api.js';

export function renderAuth() {
  const app = document.getElementById('app');
  app.className = 'auth-page';
  
  app.innerHTML = `
    <!-- injection:auth:container:before -->
    <div id="inject-auth-container-before" class="injection-slot"></div>
    
    <div class="auth-container" id="auth-container">
      <div class="auth-card" id="auth-card">
        <!-- injection:auth:header:before -->
        <div id="inject-auth-header-before" class="injection-slot"></div>
        
        <div class="auth-header" id="auth-header">
          <div class="logo">
            <span class="material-icons-outlined">bolt</span>
            <span class="logo-text">Sodium</span>
          </div>
          <p class="auth-subtitle">Welcome back</p>
        </div>
        
        <!-- injection:auth:header:after -->
        <div id="inject-auth-header-after" class="injection-slot"></div>
        
        <!-- injection:auth:tabs:before -->
        <div id="inject-auth-tabs-before" class="injection-slot"></div>
        
        <div class="auth-tabs" id="auth-tabs">
          <button class="tab-btn active" data-tab="login">Sign In</button>
          <button class="tab-btn" data-tab="register">Sign Up</button>
        </div>
        
        <!-- injection:auth:tabs:after -->
        <div id="inject-auth-tabs-after" class="injection-slot"></div>
        
        <!-- injection:auth:login:before -->
        <div id="inject-auth-login-before" class="injection-slot"></div>
        
        <form id="login-form" class="auth-form active">
          <!-- injection:auth:login:fields:before -->
          <div id="inject-auth-login-fields-before" class="injection-slot"></div>
          
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
          
          <!-- injection:auth:login:fields:after -->
          <div id="inject-auth-login-fields-after" class="injection-slot"></div>
          
          <div class="error-message" id="login-error"></div>
          
          <!-- injection:auth:login:button:before -->
          <div id="inject-auth-login-button-before" class="injection-slot"></div>
          
          <button type="submit" class="btn btn-primary btn-full" id="login-submit-btn">
            <span>Sign In</span>
            <span class="material-icons-outlined">arrow_forward</span>
          </button>
          
          <!-- injection:auth:login:button:after -->
          <div id="inject-auth-login-button-after" class="injection-slot"></div>
          
          <!-- injection:auth:login:providers (OAuth buttons) -->
          <div id="inject-auth-login-providers" class="injection-slot auth-providers">
            ${renderSlot('auth:login:providers')}
          </div>
        </form>
        
        <!-- injection:auth:login:after -->
        <div id="inject-auth-login-after" class="injection-slot"></div>
        
        <!-- injection:auth:register:before -->
        <div id="inject-auth-register-before" class="injection-slot"></div>
        
        <form id="register-form" class="auth-form">
          <!-- injection:auth:register:fields:before -->
          <div id="inject-auth-register-fields-before" class="injection-slot"></div>
          
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
          
          <!-- injection:auth:register:fields:after -->
          <div id="inject-auth-register-fields-after" class="injection-slot"></div>
          
          <div class="error-message" id="register-error"></div>
          
          <!-- injection:auth:register:button:before -->
          <div id="inject-auth-register-button-before" class="injection-slot"></div>
          
          <button type="submit" class="btn btn-primary btn-full" id="register-submit-btn">
            <span>Create Account</span>
            <span class="material-icons-outlined">arrow_forward</span>
          </button>
          
          <!-- injection:auth:register:button:after -->
          <div id="inject-auth-register-button-after" class="injection-slot"></div>
          
          <!-- injection:auth:register:providers -->
          <div id="inject-auth-register-providers" class="injection-slot auth-providers">
            ${renderSlot('auth:register:providers')}
          </div>
        </form>
        
        <!-- injection:auth:register:after -->
        <div id="inject-auth-register-after" class="injection-slot"></div>
      </div>
    </div>
    
    <!-- injection:auth:container:after -->
    <div id="inject-auth-container-after" class="injection-slot"></div>
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
      
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('loggedIn', 'true');
      localStorage.setItem('username', data.user.username);
      
      window.router.navigateTo('/dashboard');
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
      
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('loggedIn', 'true');
      localStorage.setItem('username', data.user.username);
      
      window.router.navigateTo('/dashboard');
    } catch (err) {
      errorEl.textContent = 'Connection error. Please try again.';
      errorEl.style.display = 'block';
      btn.disabled = false;
      btn.innerHTML = '<span>Create Account</span><span class="material-icons-outlined">arrow_forward</span>';
    }
  });
}
