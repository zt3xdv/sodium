import { renderNav } from '../../components/nav.js';
import { renderServerSidebar } from '../../components/sidebar.js';
import { icon } from '../../components/icon.js';
import { api } from '../../utils/api.js';
import { toast } from '../../components/toast.js';
import { formatDate } from '../../utils/format.js';
import { openModal, closeModal, confirmModal } from '../../components/modal.js';

export default function(params) {
  const serverId = params.id;
  
  return `
    ${renderNav()}
    <div class="server-layout">
      ${renderServerSidebar(serverId, 'schedules')}
      <main class="server-content">
        <div class="page-container">
          <div class="page-header">
            <div>
              <h1>Schedules</h1>
              <p class="text-secondary">Automate server tasks with scheduled jobs</p>
            </div>
            <button class="btn btn-primary" id="btn-create-schedule">
              ${icon('plus', 18)} Create Schedule
            </button>
          </div>

          <div class="schedules-list" id="schedules-list">
            <div class="loading">Loading schedules...</div>
          </div>
        </div>
      </main>
    </div>
  `;
}

export async function mount(params) {
  const serverId = params.id;
  const schedulesList = document.getElementById('schedules-list');
  let schedules = [];

  const CRON_PRESETS = {
    '0 0 * * *': 'Daily at midnight',
    '0 */6 * * *': 'Every 6 hours',
    '0 */12 * * *': 'Every 12 hours',
    '0 0 * * 0': 'Weekly on Sunday',
    '*/30 * * * *': 'Every 30 minutes',
    '0 4 * * *': 'Daily at 4 AM'
  };

  async function loadSchedules() {
    try {
      const res = await api.get(`/servers/${serverId}/schedules`);
      schedules = res.data || [];
      renderSchedules();
    } catch (err) {
      toast.error('Failed to load schedules');
      schedulesList.innerHTML = '<div class="empty-state">Failed to load schedules</div>';
    }
  }

  function renderSchedules() {
    if (schedules.length === 0) {
      schedulesList.innerHTML = `
        <div class="empty-state">
          ${icon('clock', 48)}
          <h3>No schedules</h3>
          <p class="text-secondary">Create scheduled tasks to automate server management</p>
        </div>
      `;
      return;
    }

    schedulesList.innerHTML = schedules.map(schedule => `
      <div class="schedule-item card" data-id="${schedule.uuid}">
        <div class="schedule-header">
          <div class="schedule-toggle">
            <label class="switch">
              <input type="checkbox" class="toggle-active" data-id="${schedule.uuid}" ${schedule.is_active ? 'checked' : ''}>
              <span class="slider"></span>
            </label>
          </div>
          <div class="schedule-info">
            <h4>${schedule.name}</h4>
            <p class="text-secondary font-mono">${schedule.cron}</p>
          </div>
          <div class="schedule-meta">
            <span class="badge badge-${getActionBadge(schedule.action)}">${schedule.action}</span>
          </div>
        </div>
        <div class="schedule-details">
          <p class="text-sm text-secondary">
            ${CRON_PRESETS[schedule.cron] || describeCron(schedule.cron)}
          </p>
          ${schedule.last_run ? `
            <p class="text-sm text-secondary">
              Last run: ${formatDate(schedule.last_run)} (${schedule.run_count} times)
            </p>
          ` : '<p class="text-sm text-secondary">Never run</p>'}
          ${schedule.last_error ? `<p class="text-sm text-danger">Error: ${schedule.last_error}</p>` : ''}
        </div>
        <div class="schedule-actions">
          <button class="btn btn-ghost btn-sm run-btn" data-id="${schedule.uuid}">
            ${icon('play', 14)} Run Now
          </button>
          <button class="btn btn-ghost btn-sm edit-btn" data-id="${schedule.uuid}">
            ${icon('edit', 14)} Edit
          </button>
          <button class="btn btn-ghost btn-sm delete-btn" data-id="${schedule.uuid}">
            ${icon('trash', 14)} Delete
          </button>
        </div>
      </div>
    `).join('');

    attachListeners();
  }

  function getActionBadge(action) {
    const badges = { power: 'warning', command: 'primary', backup: 'success' };
    return badges[action] || 'secondary';
  }

  function describeCron(cron) {
    const [min, hour, dom, month, dow] = cron.split(' ');
    const parts = [];
    
    if (min === '*') parts.push('Every minute');
    else if (min.includes('/')) parts.push(`Every ${min.split('/')[1]} minutes`);
    else parts.push(`At minute ${min}`);
    
    if (hour !== '*') parts.push(`at hour ${hour}`);
    
    return parts.join(' ');
  }

  function attachListeners() {
    document.querySelectorAll('.toggle-active').forEach(toggle => {
      toggle.addEventListener('change', async () => {
        try {
          await api.put(`/servers/${serverId}/schedules/${toggle.dataset.id}`, {
            is_active: toggle.checked
          });
          toast.success(toggle.checked ? 'Schedule enabled' : 'Schedule disabled');
        } catch (err) {
          toggle.checked = !toggle.checked;
          toast.error('Failed to update schedule');
        }
      });
    });

    document.querySelectorAll('.run-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await api.post(`/servers/${serverId}/schedules/${btn.dataset.id}/execute`);
          toast.success('Schedule executed');
          loadSchedules();
        } catch (err) {
          toast.error('Failed to execute schedule');
        }
      });
    });

    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const schedule = schedules.find(s => s.uuid === btn.dataset.id);
        showScheduleModal(schedule);
      });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const confirmed = await confirmModal('Delete Schedule', 'Are you sure?');
        if (!confirmed) return;

        try {
          await api.delete(`/servers/${serverId}/schedules/${btn.dataset.id}`);
          toast.success('Schedule deleted');
          loadSchedules();
        } catch (err) {
          toast.error('Failed to delete schedule');
        }
      });
    });
  }

  function showScheduleModal(schedule = null) {
    const isEdit = !!schedule;
    const payload = schedule ? JSON.parse(schedule.payload || '{}') : {};

    openModal({
      title: isEdit ? 'Edit Schedule' : 'Create Schedule',
      content: `
        <form id="schedule-form">
          <div class="form-group">
            <label for="name">Name</label>
            <input type="text" id="name" class="input" value="${schedule?.name || ''}" required>
          </div>
          <div class="form-group">
            <label for="cron">Cron Expression</label>
            <select id="cron-preset" class="input">
              <option value="">Custom...</option>
              ${Object.entries(CRON_PRESETS).map(([cron, label]) => 
                `<option value="${cron}" ${schedule?.cron === cron ? 'selected' : ''}>${label} (${cron})</option>`
              ).join('')}
            </select>
            <input type="text" id="cron" class="input font-mono" value="${schedule?.cron || '0 0 * * *'}" 
                   placeholder="* * * * *" style="margin-top: 0.5rem;">
            <p class="form-hint">minute hour day-of-month month day-of-week</p>
          </div>
          <div class="form-group">
            <label for="action">Action</label>
            <select id="action" class="input">
              <option value="power" ${schedule?.action === 'power' ? 'selected' : ''}>Power Action</option>
              <option value="command" ${schedule?.action === 'command' ? 'selected' : ''}>Send Command</option>
              <option value="backup" ${schedule?.action === 'backup' ? 'selected' : ''}>Create Backup</option>
            </select>
          </div>
          <div id="power-options" class="form-group" style="display: ${schedule?.action !== 'command' && schedule?.action !== 'backup' ? 'block' : 'none'}">
            <label for="power-action">Power Action</label>
            <select id="power-action" class="input">
              <option value="start" ${payload.action === 'start' ? 'selected' : ''}>Start</option>
              <option value="stop" ${payload.action === 'stop' ? 'selected' : ''}>Stop</option>
              <option value="restart" ${payload.action === 'restart' ? 'selected' : ''}>Restart</option>
              <option value="kill" ${payload.action === 'kill' ? 'selected' : ''}>Kill</option>
            </select>
          </div>
          <div id="command-options" class="form-group" style="display: ${schedule?.action === 'command' ? 'block' : 'none'}">
            <label for="command">Command</label>
            <input type="text" id="command" class="input font-mono" value="${payload.command || ''}" placeholder="say Hello!">
          </div>
        </form>
      `,
      actions: [
        { label: 'Cancel', class: 'btn-ghost', action: closeModal },
        { label: isEdit ? 'Save' : 'Create', class: 'btn-primary', action: async () => {
          const action = document.getElementById('action').value;
          let payloadData = {};
          
          if (action === 'power') {
            payloadData = { action: document.getElementById('power-action').value };
          } else if (action === 'command') {
            payloadData = { command: document.getElementById('command').value };
          }

          const data = {
            name: document.getElementById('name').value,
            cron: document.getElementById('cron').value,
            action,
            payload: payloadData
          };

          try {
            if (isEdit) {
              await api.put(`/servers/${serverId}/schedules/${schedule.uuid}`, data);
            } else {
              await api.post(`/servers/${serverId}/schedules`, data);
            }
            toast.success(isEdit ? 'Schedule updated' : 'Schedule created');
            closeModal();
            loadSchedules();
          } catch (err) {
            toast.error(err.message || 'Failed to save schedule');
          }
        }}
      ]
    });

    document.getElementById('cron-preset').addEventListener('change', (e) => {
      if (e.target.value) {
        document.getElementById('cron').value = e.target.value;
      }
    });

    document.getElementById('action').addEventListener('change', (e) => {
      document.getElementById('power-options').style.display = e.target.value === 'power' ? 'block' : 'none';
      document.getElementById('command-options').style.display = e.target.value === 'command' ? 'block' : 'none';
    });
  }

  document.getElementById('btn-create-schedule').addEventListener('click', () => showScheduleModal());

  await loadSchedules();
}
