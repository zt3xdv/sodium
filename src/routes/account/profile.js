import { api } from '../../utils/api.js';
import { renderNav } from '../../components/nav.js';
import { toast } from '../../components/toast.js';
import { openModal, closeModal } from '../../components/modal.js';
import { formatBytes } from '../../utils/format.js';

export default function render(params) {
  return `
    ${renderNav()}
    <div class="page profile-page">
      <div class="page-header">
        <h1>Profile Settings</h1>
      </div>
      
      <div class="profile-container">
        <div class="profile-section">
          <div class="card">
            <div class="card__header">
              <h3>Profile Information</h3>
            </div>
            <div class="card__body">
              <div id="profile-content" class="loading">Loading...</div>
            </div>
          </div>
        </div>
        
        <div class="profile-section">
          <div class="card">
            <div class="card__header">
              <h3>Resource Limits</h3>
            </div>
            <div class="card__body">
              <div id="limits-content" class="loading">Loading...</div>
            </div>
          </div>
        </div>
        
        <div class="profile-section">
          <div class="card">
            <div class="card__header">
              <h3>Security</h3>
            </div>
            <div class="card__body">
              <div class="security-actions">
                <button class="btn btn--secondary" id="btn-change-password">
                  Change Password
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export async function mount() {
  await loadProfile();
  
  document.getElementById('btn-change-password')?.addEventListener('click', showPasswordModal);
}

async function loadProfile() {
  try {
    const { data } = await api.get('/account/profile');
    renderProfileContent(data);
    renderLimitsContent(data.limits);
  } catch (err) {
    document.getElementById('profile-content').innerHTML = `
      <div class="alert alert--danger">Failed to load profile</div>
    `;
  }
}

function renderProfileContent(user) {
  const container = document.getElementById('profile-content');
  
  container.innerHTML = `
    <form id="profile-form" class="profile-form">
      <div class="profile-header">
        <div class="avatar-container">
          <div class="avatar" id="avatar-preview">
            ${user.avatar 
              ? `<img src="${user.avatar}" alt="Avatar" />`
              : `<span class="avatar-initials">${getInitials(user.display_name || user.username)}</span>`
            }
          </div>
          <button type="button" class="btn btn--sm btn--secondary" id="btn-change-avatar">
            Change Avatar
          </button>
        </div>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label for="display_name">Display Name</label>
          <input type="text" id="display_name" name="display_name" class="input" 
                 value="${user.display_name || ''}" placeholder="${user.username}">
          <div class="form-hint">This will be shown instead of your username</div>
        </div>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label for="username">Username</label>
          <input type="text" id="username" name="username" class="input" 
                 value="${user.username}" required>
        </div>
        
        <div class="form-group">
          <label for="email">Email</label>
          <input type="email" id="email" name="email" class="input" 
                 value="${user.email}" required>
        </div>
      </div>
      
      <div class="form-group">
        <label for="bio">Bio</label>
        <textarea id="bio" name="bio" class="textarea" rows="3" 
                  placeholder="Tell us about yourself...">${user.bio || ''}</textarea>
      </div>
      
      <div class="form-group">
        <label>Account Details</label>
        <div class="profile-meta">
          <p><strong>Role:</strong> <span class="badge badge--${user.role === 'admin' ? 'primary' : 'default'}">${user.role}</span></p>
          <p><strong>Member since:</strong> ${new Date(user.created_at).toLocaleDateString()}</p>
        </div>
      </div>
      
      <div class="form-actions">
        <button type="submit" class="btn btn--primary">Save Changes</button>
      </div>
    </form>
    <input type="file" id="avatar-input" accept="image/*" style="display: none;">
  `;
  
  document.getElementById('profile-form')?.addEventListener('submit', handleProfileSubmit);
  document.getElementById('btn-change-avatar')?.addEventListener('click', () => {
    document.getElementById('avatar-input')?.click();
  });
  document.getElementById('avatar-input')?.addEventListener('change', handleAvatarChange);
}

function renderLimitsContent(limits) {
  const container = document.getElementById('limits-content');
  
  if (!limits) {
    container.innerHTML = '<p class="text-muted">No limits configured</p>';
    return;
  }
  
  const renderLimit = (label, current, limit, unit = '') => {
    const isUnlimited = limit === 0;
    const percentage = isUnlimited ? 0 : Math.min((current / limit) * 100, 100);
    const isNearLimit = !isUnlimited && percentage >= 80;
    const isAtLimit = !isUnlimited && percentage >= 100;
    
    return `
      <div class="limit-item">
        <div class="limit-header">
          <span class="limit-label">${label}</span>
          <span class="limit-value ${isAtLimit ? 'text-danger' : isNearLimit ? 'text-warning' : ''}">
            ${unit === 'bytes' ? formatBytes(current) : current}
            ${isUnlimited ? '/ ∞' : `/ ${unit === 'bytes' ? formatBytes(limit) : limit}`}
          </span>
        </div>
        ${!isUnlimited ? `
          <div class="limit-bar">
            <div class="limit-bar-fill ${isAtLimit ? 'bg-danger' : isNearLimit ? 'bg-warning' : 'bg-primary'}" 
                 style="width: ${percentage}%"></div>
          </div>
        ` : ''}
      </div>
    `;
  };
  
  container.innerHTML = `
    <div class="limits-grid">
      ${renderLimit('Servers', limits.servers.current, limits.servers.limit)}
      ${renderLimit('Memory', limits.memory.current, limits.memory.limit, 'bytes')}
      ${renderLimit('Disk', limits.disk.current, limits.disk.limit, 'bytes')}
      ${renderLimit('CPU', limits.cpu.current, limits.cpu.limit, '%')}
      ${renderLimit('Databases', limits.databases.current, limits.databases.limit)}
      ${renderLimit('Backups', limits.backups.current, limits.backups.limit)}
      ${renderLimit('Allocations', limits.allocations.current, limits.allocations.limit)}
    </div>
    <p class="text-muted text-sm mt-4">
      <strong>Note:</strong> Unlimited (∞) means no limit is set. Contact an administrator to request limit changes.
    </p>
  `;
}

async function handleProfileSubmit(e) {
  e.preventDefault();
  
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Saving...';
  
  try {
    const data = {
      display_name: form.display_name.value || null,
      username: form.username.value,
      email: form.email.value,
      bio: form.bio.value || null
    };
    
    const { data: user } = await api.put('/account/profile', data);
    
    localStorage.setItem('sodium_user', JSON.stringify(user));
    toast.success('Profile updated successfully');
    
    renderLimitsContent(user.limits);
  } catch (err) {
    toast.error(err.message || 'Failed to update profile');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Changes';
  }
}

async function handleAvatarChange(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  if (file.size > 2 * 1024 * 1024) {
    toast.error('Avatar must be less than 2MB');
    return;
  }
  
  try {
    const reader = new FileReader();
    reader.onload = async (event) => {
      const avatar = event.target.result;
      
      try {
        await api.put('/account/profile', { avatar });
        
        const preview = document.getElementById('avatar-preview');
        preview.innerHTML = `<img src="${avatar}" alt="Avatar" />`;
        
        toast.success('Avatar updated');
      } catch (err) {
        toast.error(err.message || 'Failed to update avatar');
      }
    };
    reader.readAsDataURL(file);
  } catch (err) {
    toast.error('Failed to read file');
  }
}

function showPasswordModal() {
  openModal({
    title: 'Change Password',
    size: 'sm',
    content: `
      <form id="password-form">
        <div class="form-group">
          <label for="current_password">Current Password</label>
          <input type="password" id="current_password" name="current_password" class="input" required>
        </div>
        
        <div class="form-group">
          <label for="new_password">New Password</label>
          <input type="password" id="new_password" name="new_password" class="input" 
                 required minlength="8">
          <div class="form-hint">Minimum 8 characters</div>
        </div>
        
        <div class="form-group">
          <label for="confirm_password">Confirm New Password</label>
          <input type="password" id="confirm_password" name="confirm_password" class="input" required>
        </div>
      </form>
    `,
    actions: [
      {
        label: 'Cancel',
        class: 'btn--secondary',
        action: () => closeModal()
      },
      {
        label: 'Update Password',
        class: 'btn--primary',
        action: handlePasswordSubmit
      }
    ]
  });
}

async function handlePasswordSubmit() {
  const form = document.getElementById('password-form');
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }
  
  const current_password = form.current_password.value;
  const new_password = form.new_password.value;
  const confirm_password = form.confirm_password.value;
  
  if (new_password !== confirm_password) {
    toast.error('Passwords do not match');
    return;
  }
  
  const btn = document.querySelector('[data-action-index="1"]');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Updating...';
  }
  
  try {
    await api.put('/account/password', { current_password, new_password });
    toast.success('Password updated successfully');
    closeModal();
  } catch (err) {
    toast.error(err.message || 'Failed to update password');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Update Password';
    }
  }
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}
