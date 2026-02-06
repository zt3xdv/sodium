import { api } from '../../utils/api.js';
import { escapeHtml } from '../../utils/security.js';
import * as toast from '../../utils/toast.js';

let currentServerId = null;

export function renderSchedulesTab(serverId) {
  currentServerId = serverId;
  return `
    <div class="schedules-tab">
      <div class="tab-header">
        <h2>Schedules</h2>
        <button class="btn btn-primary" id="create-schedule-btn">
          <span class="material-icons-outlined">add</span>
          New Schedule
        </button>
      </div>
      <div class="schedules-list" id="schedules-list">
        <div class="loading-spinner"></div>
      </div>
    </div>
  `;
}

export async function initSchedulesTab(serverId) {
  currentServerId = serverId;
  await loadSchedules();
  
  document.getElementById('create-schedule-btn')?.addEventListener('click', showCreateScheduleModal);
}

export function cleanupSchedulesTab() {
  currentServerId = null;
}

async function loadSchedules() {
  const container = document.getElementById('schedules-list');
  if (!container) return;
  
  try {
    const res = await api(`/api/servers/${currentServerId}/schedules`);
    const data = await res.json();
    
    if (data.schedules.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="material-icons-outlined">schedule</span>
          <p>No schedules configured</p>
          <span class="text-muted">Create automated tasks for your server</span>
        </div>
      `;
      return;
    }
    
    container.innerHTML = data.schedules.map(schedule => `
      <div class="schedule-card" data-id="${schedule.id}">
        <div class="schedule-header">
          <div class="schedule-info">
            <div class="schedule-name">
              <span class="status-dot ${schedule.is_active ? 'active' : 'inactive'}"></span>
              ${escapeHtml(schedule.name)}
            </div>
            <div class="schedule-cron">${formatCron(schedule.cron)}</div>
          </div>
          <div class="schedule-actions">
            <button class="btn btn-sm btn-ghost" title="Run Now" data-action="execute" data-id="${schedule.id}">
              <span class="material-icons-outlined">play_arrow</span>
            </button>
            <button class="btn btn-sm btn-ghost" title="Edit" data-action="edit" data-id="${schedule.id}">
              <span class="material-icons-outlined">edit</span>
            </button>
            <button class="btn btn-sm btn-ghost btn-danger" title="Delete" data-action="delete" data-id="${schedule.id}">
              <span class="material-icons-outlined">delete</span>
            </button>
          </div>
        </div>
        <div class="schedule-meta">
          <span class="meta-item">
            <span class="material-icons-outlined">task</span>
            ${schedule.tasks?.length || 0} task${schedule.tasks?.length !== 1 ? 's' : ''}
          </span>
          ${schedule.last_run_at ? `
            <span class="meta-item">
              <span class="material-icons-outlined">history</span>
              Last: ${formatRelativeTime(schedule.last_run_at)}
            </span>
          ` : ''}
          ${schedule.next_run_at ? `
            <span class="meta-item">
              <span class="material-icons-outlined">schedule</span>
              Next: ${formatRelativeTime(schedule.next_run_at)}
            </span>
          ` : ''}
        </div>
        <div class="schedule-tasks" id="tasks-${schedule.id}">
          ${renderTasks(schedule.tasks || [], schedule.id)}
        </div>
        <button class="btn btn-sm btn-ghost add-task-btn" data-schedule="${schedule.id}">
          <span class="material-icons-outlined">add</span>
          Add Task
        </button>
      </div>
    `).join('');
    
    attachScheduleListeners();
  } catch (err) {
    container.innerHTML = `<div class="error">Failed to load schedules</div>`;
  }
}

function renderTasks(tasks, scheduleId) {
  if (tasks.length === 0) {
    return '<div class="no-tasks">No tasks configured</div>';
  }
  
  return tasks.sort((a, b) => a.sequence_id - b.sequence_id).map(task => `
    <div class="task-item" data-task="${task.id}" data-schedule="${scheduleId}">
      <div class="task-order">#${task.sequence_id}</div>
      <div class="task-info">
        <span class="task-action ${task.action}">${getActionLabel(task.action)}</span>
        <span class="task-payload">${escapeHtml(task.payload || '-')}</span>
        ${task.time_offset > 0 ? `<span class="task-delay">+${task.time_offset}s delay</span>` : ''}
      </div>
      <div class="task-actions">
        <button class="btn btn-xs btn-ghost" data-action="edit-task" data-task="${task.id}" data-schedule="${scheduleId}">
          <span class="material-icons-outlined">edit</span>
        </button>
        <button class="btn btn-xs btn-ghost btn-danger" data-action="delete-task" data-task="${task.id}" data-schedule="${scheduleId}">
          <span class="material-icons-outlined">close</span>
        </button>
      </div>
    </div>
  `).join('');
}

function attachScheduleListeners() {
  document.querySelectorAll('[data-action="execute"]').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      btn.disabled = true;
      try {
        await api(`/api/servers/${currentServerId}/schedules/${id}/execute`, { method: 'POST' });
        toast.success('Schedule executed');
        await loadSchedules();
      } catch {
        toast.error('Failed to execute schedule');
      }
      btn.disabled = false;
    };
  });
  
  document.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.onclick = () => showEditScheduleModal(btn.dataset.id);
  });
  
  document.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Delete this schedule?')) return;
      try {
        await api(`/api/servers/${currentServerId}/schedules/${btn.dataset.id}`, { method: 'DELETE' });
        toast.success('Schedule deleted');
        await loadSchedules();
      } catch {
        toast.error('Failed to delete schedule');
      }
    };
  });
  
  document.querySelectorAll('.add-task-btn').forEach(btn => {
    btn.onclick = () => showAddTaskModal(btn.dataset.schedule);
  });
  
  document.querySelectorAll('[data-action="edit-task"]').forEach(btn => {
    btn.onclick = () => showEditTaskModal(btn.dataset.schedule, btn.dataset.task);
  });
  
  document.querySelectorAll('[data-action="delete-task"]').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Delete this task?')) return;
      try {
        await api(`/api/servers/${currentServerId}/schedules/${btn.dataset.schedule}/tasks/${btn.dataset.task}`, { method: 'DELETE' });
        toast.success('Task deleted');
        await loadSchedules();
      } catch {
        toast.error('Failed to delete task');
      }
    };
  });
}

function showCreateScheduleModal() {
  showScheduleModal(null);
}

async function showEditScheduleModal(id) {
  try {
    const res = await api(`/api/servers/${currentServerId}/schedules/${id}`);
    const data = await res.json();
    showScheduleModal(data.schedule);
  } catch {
    toast.error('Failed to load schedule');
  }
}

function showScheduleModal(schedule) {
  const existing = document.getElementById('schedule-modal');
  if (existing) existing.remove();
  
  const isEdit = !!schedule;
  
  const modal = document.createElement('div');
  modal.id = 'schedule-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal modal-md">
      <div class="modal-header">
        <h3>${isEdit ? 'Edit Schedule' : 'Create Schedule'}</h3>
        <button class="modal-close" id="close-schedule-modal">
          <span class="material-icons-outlined">close</span>
        </button>
      </div>
      <form id="schedule-form" class="modal-body">
        <div class="form-group">
          <label>Name</label>
          <input type="text" name="name" value="${schedule?.name || ''}" required maxlength="100" placeholder="Daily Restart" />
        </div>
        
        <div class="form-section-title">Schedule (Cron)</div>
        <div class="cron-inputs">
          <div class="form-group">
            <label>Minute</label>
            <input type="text" name="minute" value="${schedule?.cron?.minute || '*'}" placeholder="*" />
            <small>0-59 or *</small>
          </div>
          <div class="form-group">
            <label>Hour</label>
            <input type="text" name="hour" value="${schedule?.cron?.hour || '*'}" placeholder="*" />
            <small>0-23 or *</small>
          </div>
          <div class="form-group">
            <label>Day of Month</label>
            <input type="text" name="day_of_month" value="${schedule?.cron?.day_of_month || '*'}" placeholder="*" />
            <small>1-31 or *</small>
          </div>
          <div class="form-group">
            <label>Day of Week</label>
            <input type="text" name="day_of_week" value="${schedule?.cron?.day_of_week || '*'}" placeholder="*" />
            <small>0-6 or *</small>
          </div>
          <div class="form-group">
            <label>Month</label>
            <input type="text" name="month" value="${schedule?.cron?.month || '*'}" placeholder="*" />
            <small>1-12 or *</small>
          </div>
        </div>
        
        <div class="form-toggles">
          <label class="toggle-item">
            <input type="checkbox" name="is_active" ${schedule?.is_active !== false ? 'checked' : ''} />
            <span class="toggle-content">
              <span class="toggle-title">Active</span>
              <span class="toggle-desc">Enable this schedule</span>
            </span>
          </label>
          <label class="toggle-item">
            <input type="checkbox" name="only_when_online" ${schedule?.only_when_online ? 'checked' : ''} />
            <span class="toggle-content">
              <span class="toggle-title">Only When Online</span>
              <span class="toggle-desc">Only run when server is online</span>
            </span>
          </label>
        </div>
        
        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" id="cancel-schedule-modal">Cancel</button>
          <button type="submit" class="btn btn-primary">${isEdit ? 'Save' : 'Create'}</button>
        </div>
      </form>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  const closeModal = () => modal.remove();
  document.getElementById('close-schedule-modal').onclick = closeModal;
  document.getElementById('cancel-schedule-modal').onclick = closeModal;
  modal.onclick = (e) => { if (e.target === modal) closeModal(); };
  
  document.getElementById('schedule-form').onsubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    
    const payload = {
      name: form.name.value,
      minute: form.minute.value || '*',
      hour: form.hour.value || '*',
      day_of_month: form.day_of_month.value || '*',
      day_of_week: form.day_of_week.value || '*',
      month: form.month.value || '*',
      is_active: form.is_active.checked,
      only_when_online: form.only_when_online.checked
    };
    
    try {
      const url = isEdit 
        ? `/api/servers/${currentServerId}/schedules/${schedule.id}`
        : `/api/servers/${currentServerId}/schedules`;
      
      await api(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      toast.success(isEdit ? 'Schedule updated' : 'Schedule created');
      closeModal();
      await loadSchedules();
    } catch {
      toast.error('Failed to save schedule');
      btn.disabled = false;
    }
  };
}

function showAddTaskModal(scheduleId) {
  showTaskModal(scheduleId, null);
}

async function showEditTaskModal(scheduleId, taskId) {
  try {
    const res = await api(`/api/servers/${currentServerId}/schedules/${scheduleId}`);
    const data = await res.json();
    const task = data.schedule.tasks?.find(t => t.id === taskId);
    if (task) showTaskModal(scheduleId, task);
  } catch {
    toast.error('Failed to load task');
  }
}

function showTaskModal(scheduleId, task) {
  const existing = document.getElementById('task-modal');
  if (existing) existing.remove();
  
  const isEdit = !!task;
  
  const modal = document.createElement('div');
  modal.id = 'task-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>${isEdit ? 'Edit Task' : 'Add Task'}</h3>
        <button class="modal-close" id="close-task-modal">
          <span class="material-icons-outlined">close</span>
        </button>
      </div>
      <form id="task-form" class="modal-body">
        <div class="form-group">
          <label>Action</label>
          <select name="action" id="task-action" required>
            <option value="command" ${task?.action === 'command' ? 'selected' : ''}>Send Command</option>
            <option value="power" ${task?.action === 'power' ? 'selected' : ''}>Power Action</option>
            <option value="backup" ${task?.action === 'backup' ? 'selected' : ''}>Create Backup</option>
          </select>
        </div>
        
        <div class="form-group" id="payload-group">
          <label id="payload-label">Command</label>
          <input type="text" name="payload" id="payload-input" value="${escapeHtml(task?.payload || '')}" placeholder="say Server restarting in 5 minutes!" />
        </div>
        
        <div class="form-group" id="power-group" style="display: none;">
          <label>Power Action</label>
          <select name="power_action" id="power-select">
            <option value="start" ${task?.payload === 'start' ? 'selected' : ''}>Start</option>
            <option value="stop" ${task?.payload === 'stop' ? 'selected' : ''}>Stop</option>
            <option value="restart" ${task?.payload === 'restart' ? 'selected' : ''}>Restart</option>
            <option value="kill" ${task?.payload === 'kill' ? 'selected' : ''}>Kill</option>
          </select>
        </div>
        
        <div class="form-group">
          <label>Time Offset (seconds)</label>
          <input type="number" name="time_offset" value="${task?.time_offset || 0}" min="0" max="900" />
          <small>Delay before executing this task (0-900 seconds)</small>
        </div>
        
        <div class="form-toggles">
          <label class="toggle-item">
            <input type="checkbox" name="continue_on_failure" ${task?.continue_on_failure ? 'checked' : ''} />
            <span class="toggle-content">
              <span class="toggle-title">Continue on Failure</span>
              <span class="toggle-desc">Continue to next task if this one fails</span>
            </span>
          </label>
        </div>
        
        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" id="cancel-task-modal">Cancel</button>
          <button type="submit" class="btn btn-primary">${isEdit ? 'Save' : 'Add Task'}</button>
        </div>
      </form>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  const closeModal = () => modal.remove();
  document.getElementById('close-task-modal').onclick = closeModal;
  document.getElementById('cancel-task-modal').onclick = closeModal;
  modal.onclick = (e) => { if (e.target === modal) closeModal(); };
  
  const actionSelect = document.getElementById('task-action');
  const payloadGroup = document.getElementById('payload-group');
  const powerGroup = document.getElementById('power-group');
  const payloadLabel = document.getElementById('payload-label');
  
  function updatePayloadVisibility() {
    const action = actionSelect.value;
    if (action === 'command') {
      payloadGroup.style.display = 'block';
      powerGroup.style.display = 'none';
      payloadLabel.textContent = 'Command';
    } else if (action === 'power') {
      payloadGroup.style.display = 'none';
      powerGroup.style.display = 'block';
    } else {
      payloadGroup.style.display = 'none';
      powerGroup.style.display = 'none';
    }
  }
  
  actionSelect.onchange = updatePayloadVisibility;
  updatePayloadVisibility();
  
  document.getElementById('task-form').onsubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    
    const action = form.action.value;
    let payload = '';
    
    if (action === 'command') {
      payload = form.payload.value;
    } else if (action === 'power') {
      payload = form.power_action.value;
    }
    
    const data = {
      action,
      payload,
      time_offset: parseInt(form.time_offset.value) || 0,
      continue_on_failure: form.continue_on_failure.checked
    };
    
    try {
      const url = isEdit 
        ? `/api/servers/${currentServerId}/schedules/${scheduleId}/tasks/${task.id}`
        : `/api/servers/${currentServerId}/schedules/${scheduleId}/tasks`;
      
      await api(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      toast.success(isEdit ? 'Task updated' : 'Task added');
      closeModal();
      await loadSchedules();
    } catch {
      toast.error('Failed to save task');
      btn.disabled = false;
    }
  };
}

// Helpers
function formatCron(cron) {
  if (!cron) return 'Not set';
  const { minute, hour, day_of_month, day_of_week, month } = cron;
  
  let desc = [];
  
  if (minute !== '*') desc.push(`at minute ${minute}`);
  if (hour !== '*') desc.push(`at hour ${hour}`);
  if (day_of_month !== '*') desc.push(`on day ${day_of_month}`);
  if (day_of_week !== '*') {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    desc.push(`on ${days[parseInt(day_of_week)] || day_of_week}`);
  }
  if (month !== '*') desc.push(`in month ${month}`);
  
  if (desc.length === 0) return 'Every minute';
  return desc.join(', ');
}

function formatRelativeTime(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diff = date - now;
  const absDiff = Math.abs(diff);
  
  const minutes = Math.floor(absDiff / 60000);
  const hours = Math.floor(absDiff / 3600000);
  const days = Math.floor(absDiff / 86400000);
  
  let text;
  if (minutes < 1) text = 'just now';
  else if (minutes < 60) text = `${minutes}m`;
  else if (hours < 24) text = `${hours}h`;
  else text = `${days}d`;
  
  return diff > 0 ? `in ${text}` : `${text} ago`;
}

function getActionLabel(action) {
  const labels = {
    command: 'Command',
    power: 'Power',
    backup: 'Backup'
  };
  return labels[action] || action;
}
