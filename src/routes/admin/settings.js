import { renderNav } from '../../components/nav.js';
import { renderAdminSidebar } from '../../components/sidebar.js';
import { icon } from '../../components/icon.js';
import { api } from '../../utils/api.js';
import { toast } from '../../components/toast.js';
import { confirmModal } from '../../components/modal.js';

export default function() {
  return `
    ${renderNav()}
    <div class="admin-layout">
      ${renderAdminSidebar('settings')}
      <main class="admin-content">
        <div class="settings-container">
          <div class="admin-header">
            <h1>Settings</h1>
            <p class="text-secondary">Configure panel settings</p>
          </div>

          <form id="settings-form">
            <section class="settings-section">
              <h2>${icon('globe', 18)} General</h2>
              <div class="form-group">
                <label for="panel_name">Panel Name</label>
                <input type="text" id="panel_name" class="input" value="Sodium" placeholder="Sodium">
              </div>
              <div class="form-group">
                <label for="panel_url">Panel URL</label>
                <input type="url" id="panel_url" class="input" placeholder="https://panel.example.com">
              </div>
              <div class="form-group">
                <label for="language">Default Language</label>
                <select id="language" class="input">
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="de">Deutsch</option>
                  <option value="fr">Français</option>
                </select>
              </div>
            </section>

            <section class="settings-section">
              <h2>${icon('mail', 18)} Mail Settings</h2>
              <div class="form-row">
                <div class="form-group">
                  <label for="smtp_host">SMTP Host</label>
                  <input type="text" id="smtp_host" class="input" placeholder="smtp.example.com">
                </div>
                <div class="form-group">
                  <label for="smtp_port">SMTP Port</label>
                  <input type="number" id="smtp_port" class="input" value="587" placeholder="587">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="smtp_user">Username</label>
                  <input type="text" id="smtp_user" class="input" placeholder="user@example.com">
                </div>
                <div class="form-group">
                  <label for="smtp_pass">Password</label>
                  <input type="password" id="smtp_pass" class="input" placeholder="••••••••">
                </div>
              </div>
              <div class="form-group">
                <label for="mail_from">From Address</label>
                <input type="email" id="mail_from" class="input" placeholder="noreply@example.com">
              </div>
              <button type="button" class="btn btn-ghost" id="test-mail">
                ${icon('send', 16)} Send Test Email
              </button>
            </section>

            <section class="settings-section">
              <h2>${icon('box', 18)} Docker</h2>
              <div class="form-group">
                <label for="docker_socket">Docker Socket Path</label>
                <input type="text" id="docker_socket" class="input" value="/var/run/docker.sock" placeholder="/var/run/docker.sock">
              </div>
              <div class="form-group">
                <label for="docker_network">Default Network</label>
                <input type="text" id="docker_network" class="input" value="sodium_network" placeholder="sodium_network">
              </div>
            </section>

            <section class="settings-section">
              <h2>${icon('shield', 18)} Security</h2>
              <div class="form-group">
                <label class="checkbox-label">
                  <input type="checkbox" id="require_2fa">
                  <span>Require 2FA for administrators</span>
                </label>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="session_timeout">Session Timeout (minutes)</label>
                  <input type="number" id="session_timeout" class="input" value="60" min="5">
                </div>
                <div class="form-group">
                  <label for="max_login_attempts">Max Login Attempts</label>
                  <input type="number" id="max_login_attempts" class="input" value="5" min="1">
                </div>
              </div>
              <div class="form-group">
                <label for="lockout_duration">Lockout Duration (minutes)</label>
                <input type="number" id="lockout_duration" class="input" value="15" min="1">
              </div>
            </section>

            <div class="form-actions">
              <button type="submit" class="btn btn-primary">
                ${icon('save', 18)} Save Settings
              </button>
            </div>
          </form>

          <section class="settings-section danger-zone">
            <h2>${icon('alert-triangle', 18)} Danger Zone</h2>
            <div class="danger-actions">
              <div class="danger-item">
                <div>
                  <h4>Clear Activity Logs</h4>
                  <p class="text-secondary">Delete all activity logs from the database</p>
                </div>
                <button class="btn btn-danger btn-sm" id="clear-logs">Clear Logs</button>
              </div>
              <div class="danger-item">
                <div>
                  <h4>Rebuild Node Configurations</h4>
                  <p class="text-secondary">Force all nodes to regenerate their configurations</p>
                </div>
                <button class="btn btn-danger btn-sm" id="rebuild-nodes">Rebuild</button>
              </div>
              <div class="danger-item">
                <div>
                  <h4>Reset Panel Settings</h4>
                  <p class="text-secondary">Reset all settings to default values</p>
                </div>
                <button class="btn btn-danger btn-sm" id="reset-settings">Reset</button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  `;
}

export async function mount() {
  async function loadSettings() {
    try {
      const res = await api.get('/admin/settings');
      const settings = res.data || {};
      
      if (settings.panel_name) document.getElementById('panel_name').value = settings.panel_name;
      if (settings.panel_url) document.getElementById('panel_url').value = settings.panel_url;
      if (settings.language) document.getElementById('language').value = settings.language;
      if (settings.smtp_host) document.getElementById('smtp_host').value = settings.smtp_host;
      if (settings.smtp_port) document.getElementById('smtp_port').value = settings.smtp_port;
      if (settings.smtp_user) document.getElementById('smtp_user').value = settings.smtp_user;
      if (settings.mail_from) document.getElementById('mail_from').value = settings.mail_from;
      if (settings.docker_socket) document.getElementById('docker_socket').value = settings.docker_socket;
      if (settings.docker_network) document.getElementById('docker_network').value = settings.docker_network;
      if (settings.require_2fa) document.getElementById('require_2fa').checked = settings.require_2fa;
      if (settings.session_timeout) document.getElementById('session_timeout').value = settings.session_timeout;
      if (settings.max_login_attempts) document.getElementById('max_login_attempts').value = settings.max_login_attempts;
      if (settings.lockout_duration) document.getElementById('lockout_duration').value = settings.lockout_duration;
    } catch (err) {
      // Settings may not exist yet
    }
  }

  document.getElementById('settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const data = {
      panel_name: document.getElementById('panel_name').value,
      panel_url: document.getElementById('panel_url').value,
      language: document.getElementById('language').value,
      smtp_host: document.getElementById('smtp_host').value,
      smtp_port: parseInt(document.getElementById('smtp_port').value) || 587,
      smtp_user: document.getElementById('smtp_user').value,
      smtp_pass: document.getElementById('smtp_pass').value || undefined,
      mail_from: document.getElementById('mail_from').value,
      docker_socket: document.getElementById('docker_socket').value,
      docker_network: document.getElementById('docker_network').value,
      require_2fa: document.getElementById('require_2fa').checked,
      session_timeout: parseInt(document.getElementById('session_timeout').value) || 60,
      max_login_attempts: parseInt(document.getElementById('max_login_attempts').value) || 5,
      lockout_duration: parseInt(document.getElementById('lockout_duration').value) || 15
    };

    try {
      await api.put('/admin/settings', data);
      toast.success('Settings saved');
    } catch (err) {
      toast.error('Failed to save settings');
    }
  });

  document.getElementById('test-mail')?.addEventListener('click', async () => {
    try {
      await api.post('/admin/settings/test-mail');
      toast.success('Test email sent');
    } catch (err) {
      toast.error('Failed to send test email');
    }
  });

  document.getElementById('clear-logs')?.addEventListener('click', async () => {
    const confirmed = await confirmModal('Clear Logs', 'Are you sure you want to delete all activity logs? This cannot be undone.');
    if (!confirmed) return;

    try {
      await api.post('/admin/settings/clear-logs');
      toast.success('Logs cleared');
    } catch (err) {
      toast.error('Failed to clear logs');
    }
  });

  document.getElementById('rebuild-nodes')?.addEventListener('click', async () => {
    const confirmed = await confirmModal('Rebuild Nodes', 'This will force all nodes to regenerate their configurations. Continue?');
    if (!confirmed) return;

    try {
      await api.post('/admin/settings/rebuild-nodes');
      toast.success('Node configurations rebuilt');
    } catch (err) {
      toast.error('Failed to rebuild nodes');
    }
  });

  document.getElementById('reset-settings')?.addEventListener('click', async () => {
    const confirmed = await confirmModal('Reset Settings', 'This will reset ALL settings to their default values. Are you absolutely sure?');
    if (!confirmed) return;

    try {
      await api.post('/admin/settings/reset');
      toast.success('Settings reset');
      loadSettings();
    } catch (err) {
      toast.error('Failed to reset settings');
    }
  });

  await loadSettings();
}
