import { api } from '../../utils/api.js';
import { setToken, setUser } from '../../utils/auth.js';
import { toast } from '../../components/toast.js';
import { navigate } from '../../router.js';

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateForm(username, email, password, confirmPassword) {
  const errors = [];

  if (!username.trim()) {
    errors.push('Username is required');
  } else if (username.length < 3) {
    errors.push('Username must be at least 3 characters');
  } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    errors.push('Username can only contain letters, numbers, and underscores');
  }

  if (!email.trim()) {
    errors.push('Email is required');
  } else if (!validateEmail(email)) {
    errors.push('Please enter a valid email');
  }

  if (!password) {
    errors.push('Password is required');
  } else if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  if (!confirmPassword) {
    errors.push('Please confirm your password');
  } else if (password !== confirmPassword) {
    errors.push('Passwords do not match');
  }

  return errors;
}

export default function RegisterPage() {
  return `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-header">
          <div class="auth-logo">🪶 Sodium</div>
          <h1 class="auth-title">Create account</h1>
          <p class="auth-subtitle">Get started with Sodium</p>
        </div>

        <form id="register-form" class="auth-form">
          <div class="form-group">
            <label for="username" class="form-label">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              class="form-input"
              placeholder="johndoe"
              autocomplete="username"
              required
            />
          </div>

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
              autocomplete="new-password"
              required
            />
          </div>

          <div class="form-group">
            <label for="confirm-password" class="form-label">Confirm Password</label>
            <input
              type="password"
              id="confirm-password"
              name="confirm-password"
              class="form-input"
              placeholder="••••••••"
              autocomplete="new-password"
              required
            />
          </div>

          <button type="submit" id="register-btn" class="btn btn-primary btn-block">
            Create Account
          </button>
        </form>

        <div class="auth-footer">
          <p>Already have an account? <a href="#/login" class="auth-link">Sign in</a></p>
        </div>
      </div>
    </div>
  `;
}

export function mount() {
  const form = document.getElementById('register-form');
  const usernameInput = document.getElementById('username');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirm-password');
  const submitBtn = document.getElementById('register-btn');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = usernameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    const errors = validateForm(username, email, password, confirmPassword);
    if (errors.length > 0) {
      errors.forEach(err => toast.error(err));
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account...';

    try {
      const response = await api.post('/auth/register', {
        username,
        email,
        password
      });

      setToken(response.token);
      setUser(response.user);

      toast.success('Account created successfully!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message || 'Failed to create account');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Account';
    }
  });

  usernameInput.focus();
}
