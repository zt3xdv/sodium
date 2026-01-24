import { api } from '../../utils/api.js';
import { setToken, setUser } from '../../utils/auth.js';
import { toast } from '../../components/toast.js';
import { navigate } from '../../router.js';

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateForm(email, password) {
  const errors = [];

  if (!email.trim()) {
    errors.push('Email is required');
  } else if (!validateEmail(email)) {
    errors.push('Please enter a valid email');
  }

  if (!password) {
    errors.push('Password is required');
  } else if (password.length < 6) {
    errors.push('Password must be at least 6 characters');
  }

  return errors;
}

export default function LoginPage() {
  return `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-header">
          <div class="auth-logo">🪶 Sodium</div>
          <h1 class="auth-title">Welcome back</h1>
          <p class="auth-subtitle">Sign in to your account</p>
        </div>

        <form id="login-form" class="auth-form">
          <div class="form-group">
            <label for="email" class="form-label">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              class="form-input"
              placeholder="you@example.com"
              autocomplete="email"
              required
            />
          </div>

          <div class="form-group">
            <label for="password" class="form-label">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              class="form-input"
              placeholder="••••••••"
              autocomplete="current-password"
              required
            />
          </div>

          <button type="submit" id="login-btn" class="btn btn-primary btn-block">
            Sign In
          </button>
        </form>

        <div class="auth-footer">
          <p>Don't have an account? <a href="#/register" class="auth-link">Create one</a></p>
        </div>
      </div>
    </div>
  `;
}

export function mount() {
  const form = document.getElementById('login-form');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const submitBtn = document.getElementById('login-btn');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    const errors = validateForm(email, password);
    if (errors.length > 0) {
      errors.forEach(err => toast.error(err));
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';

    try {
      const response = await api.post('/auth/login', { email, password });

      setToken(response.token);
      setUser(response.user);

      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message || 'Failed to sign in');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
  });

  emailInput.focus();
}
