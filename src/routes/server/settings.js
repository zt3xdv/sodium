import { renderNav } from '../../components/nav.js';
import { renderServerSidebar } from '../../components/sidebar.js';
import { icon } from '../../components/icon.js';
import { api } from '../../utils/api.js';
import { toast } from '../../components/toast.js';
import { confirmModal } from '../../components/modal.js';
import { navigate } from '../../router.js';

export default function(params) {
  const serverId = params.id;
  
  return `
    ${renderNav()}
    <div class="server-layout">
      ${renderServerSidebar(serverId, 'settings')}
      <main class="server-content">
        <div class="settings-container">
          <h1>Server Settings</h1>

          <form id="settings-form">
            <section class="settings-section">
              <h2>General</h2>
              <div class="form-group">
                <label for="server-name">Server Name</label>
                <input type="text" id="server-name" class="input" placeholder="My Server">
              </div>
              <div class="form-group">
                <label for="server-description">Description</label>
                <textarea id="server-description" class="input" rows="3" placeholder="Server description..."></textarea>
              </div>
            </section>

            <section class="settings-section">
              <h2>Resource Limits</h2>
              <div class="form-row">
                <div class="form-group">
                  <label for="memory">Memory (MB)</label>
                  <input type="number" id="memory" class="input" min="128" step="128">
                </div>
                <div class="form-group">
                  <label for="cpu">CPU Limit (%)</label>
                  <input type="number" id="cpu" class="input" min="0" max="400">
                </div>
                <div class="form-group">
                  <label for="disk">Disk (MB)</label>
                  <input type="number" id="disk" class="input" min="256" step="256">
                </div>
              </div>
            </section>

            <section class="settings-section">
              <h2>Startup Configuration</h2>
              <div class="form-group">
                <label for="startup-command">Startup Command</label>
                <input type="text" id="startup-command" class="input font-mono" placeholder="java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar server.jar">
                <p class="form-hint">Use {{VARIABLE}} syntax for egg variables</p>
              </div>
              <div class="form-group">
                <label for="docker-image">Docker Image</label>
                <select id="docker-image" class="input">
                  <option value="">Loading...</option>
                </select>
              </div>
            </section>

            <section class="settings-section">
              <h2>Startup Variables</h2>
              <div id="variables-container">
                <p class="text-secondary">Loading variables...</p>
              </div>
            </section>

            <div class="form-actions">
              <button type="submit" class="btn btn-primary">
                ${icon('save', 18)} Save Changes
              </button>
            </div>
          </form>

          <section class="settings-section danger-zone">
            <h2>${icon('alert-triangle', 20)} Danger Zone</h2>
            <div class="danger-actions">
              <div class="danger-item">
                <div>
                  <h4>Reinstall Server</h4>
                  <p class="text-secondary">This will reinstall the server with the current egg configuration.</p>
                </div>
                <button class="btn btn-danger" id="btn-reinstall">Reinstall</button>
              </div>
              <div class="danger-item">
                <div>
                  <h4>Delete Server</h4>
                  <p class="text-secondary">This will permanently delete the server and all its files.</p>
                </div>
                <button class="btn btn-danger" id="btn-delete">Delete Server</button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  `;
}

export async function mount(params) {
  const serverId = params.id;
  let server = null;
  let egg = null;

  async function loadServer() {
    try {
      const res = await api.get(`/servers/${serverId}`);
      server = res.data;
      
      document.getElementById('server-name').value = server.name || '';
      document.getElementById('server-description').value = server.description || '';
      document.getElementById('memory').value = server.memory || 1024;
      document.getElementById('cpu').value = server.cpu || 100;
      document.getElementById('disk').value = server.disk || 10240;
      document.getElementById('startup-command').value = server.startup_command || '';

      if (server.egg_id) {
        await loadEgg(server.egg_id);
      }
    } catch (err) {
      toast.error('Failed to load server settings');
    }
  }

  async function loadEgg(eggId) {
    try {
      const res = await api.get(`/eggs/${eggId}`);
      egg = res.data;

      const imageSelect = document.getElementById('docker-image');
      const images = egg.docker_images || {};
      imageSelect.innerHTML = Object.entries(images).map(([name, image]) => 
        `<option value="${image}" ${server.docker_image === image ? 'selected' : ''}>${name}</option>`
      ).join('');

      const variables = egg.variables || [];
      const serverVars = server.variables || {};
      const varsContainer = document.getElementById('variables-container');
      
      if (variables.length === 0) {
        varsContainer.innerHTML = '<p class="text-secondary">No variables for this egg</p>';
        return;
      }

      varsContainer.innerHTML = variables.map(v => `
        <div class="form-group">
          <label for="var-${v.env_variable}">${v.name}</label>
          <input type="text" id="var-${v.env_variable}" class="input variable-input" 
                 data-env="${v.env_variable}"
                 value="${serverVars[v.env_variable] || v.default_value || ''}"
                 placeholder="${v.default_value || ''}">
          ${v.description ? `<p class="form-hint">${v.description}</p>` : ''}
        </div>
      `).join('');
    } catch (err) {
      document.getElementById('docker-image').innerHTML = '<option value="">Failed to load</option>';
      document.getElementById('variables-container').innerHTML = '<p class="text-danger">Failed to load variables</p>';
    }
  }

  document.getElementById('settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const variables = {};
    document.querySelectorAll('.variable-input').forEach(input => {
      variables[input.dataset.env] = input.value;
    });

    const data = {
      name: document.getElementById('server-name').value,
      description: document.getElementById('server-description').value,
      memory: parseInt(document.getElementById('memory').value),
      cpu: parseInt(document.getElementById('cpu').value),
      disk: parseInt(document.getElementById('disk').value),
      startup_command: document.getElementById('startup-command').value,
      docker_image: document.getElementById('docker-image').value,
      variables
    };

    try {
      await api.put(`/servers/${serverId}`, data);
      toast.success('Settings saved');
    } catch (err) {
      toast.error('Failed to save settings');
    }
  });

  document.getElementById('btn-reinstall').addEventListener('click', async () => {
    const confirmed = await confirmModal(
      'Reinstall Server',
      'This will delete all server files and reinstall from the egg. This action cannot be undone. Are you sure?'
    );
    if (!confirmed) return;

    try {
      await api.post(`/servers/${serverId}/reinstall`);
      toast.success('Server reinstall started');
    } catch (err) {
      toast.error('Failed to reinstall server');
    }
  });

  document.getElementById('btn-delete').addEventListener('click', async () => {
    const confirmed = await confirmModal(
      'Delete Server',
      `Type "${server.name}" to confirm deletion. This will permanently delete the server and all its files.`,
      { input: true, inputPlaceholder: 'Server name' }
    );
    
    if (confirmed !== server.name) {
      if (confirmed !== false) toast.error('Server name does not match');
      return;
    }

    try {
      await api.delete(`/servers/${serverId}`);
      toast.success('Server deleted');
      navigate('/servers');
    } catch (err) {
      toast.error('Failed to delete server');
    }
  });

  await loadServer();
}
