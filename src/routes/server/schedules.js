import { api } from '../../utils/api.js';
import { escapeHtml } from '../../utils/security.js';
import * as toast from '../../utils/toast.js';
import * as modal from '../../utils/modal.js';

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
            <button class="btn btn-sm btn-ghost" title="Duplicate" data-action="duplicate" data-id="${schedule.id}">
              <span class="material-icons-outlined">content_copy</span>
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
      const confirmed = await modal.confirm({ title: 'Execute Schedule', message: 'Execute this schedule now?', confirmText: 'Execute' });
      if (!confirmed) return;
      
      const id = btn.dataset.id;
      const card = btn.closest('.schedule-card');
      const icon = btn.querySelector('.material-icons-outlined');
      
      btn.disabled = true;
      card?.classList.add('executing');
      if (icon) icon.textContent = 'sync';
      
      try {
        await api(`/api/servers/${currentServerId}/schedules/${id}/execute`, { method: 'POST' });
        toast.success('Schedule executed');
        await loadSchedules();
      } catch {
        toast.error('Failed to execute schedule');
      }
      
      btn.disabled = false;
      card?.classList.remove('executing');
      if (icon) icon.textContent = 'play_arrow';
    };
  });
  
  document.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.onclick = () => showEditScheduleModal(btn.dataset.id);
  });
  
  document.querySelectorAll('[data-action="duplicate"]').forEach(btn => {
    btn.onclick = () => duplicateSchedule(btn.dataset.id);
  });
  
  document.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.onclick = async () => {
      const confirmed = await modal.confirm({ title: 'Delete Schedule', message: 'Delete this schedule?', danger: true });
      if (!confirmed) return;
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
      const confirmed = await modal.confirm({ title: 'Delete Task', message: 'Delete this task?', danger: true });
      if (!confirmed) return;
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

async function duplicateSchedule(id) {
  try {
    const res = await api(`/api/servers/${currentServerId}/schedules/${id}`);
    const data = await res.json();
    const original = data.schedule;
    
    // Crear copia con nombre modificado
    const duplicate = {
      ...original,
      id: null,
      name: `${original.name} (Copy)`,
      is_active: false
    };
    
    showScheduleModal(duplicate, true);
  } catch {
    toast.error('Failed to load schedule');
  }
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

function showScheduleModal(schedule, isDuplicate = false) {
  const existing = document.getElementById('schedule-modal');
  if (existing) existing.remove();
  
  const isEdit = !!schedule && !isDuplicate;
  
  const modal = document.createElement('div');
  modal.id = 'schedule-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal modal-md">
      <div class="modal-header">
        <h3>${isEdit ? 'Edit Schedule' : isDuplicate ? 'Duplicate Schedule' : 'Create Schedule'}</h3>
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
        
        <div class="cron-error" id="cron-error" style="display: none;"></div>
        
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
          <button type="submit" class="btn btn-primary">${isEdit ? 'Save' : isDuplicate ? 'Duplicate' : 'Create'}</button>
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
    const cronError = document.getElementById('cron-error');
    
    // Validar campos cron
    const errors = validateAllCronFields(form);
    if (errors.length > 0) {
      cronError.textContent = errors.join('. ');
      cronError.style.display = 'block';
      return;
    }
    cronError.style.display = 'none';
    
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
function validateCronField(value, min, max, fieldName) {
  if (value === '*') return null;
  
  // Soportar rangos (e.g., 1-5), listas (e.g., 1,3,5), y pasos (e.g., */5)
  const patterns = value.split(',');
  for (const pattern of patterns) {
    if (pattern.includes('/')) {
      const [range, step] = pattern.split('/');
      if (range !== '*' && !validateCronField(range, min, max, fieldName)) {
        return `Invalid step in ${fieldName}`;
      }
      const stepNum = parseInt(step);
      if (isNaN(stepNum) || stepNum < 1) {
        return `Invalid step value in ${fieldName}`;
      }
    } else if (pattern.includes('-')) {
      const [start, end] = pattern.split('-').map(Number);
      if (isNaN(start) || isNaN(end) || start < min || end > max || start > end) {
        return `Invalid range in ${fieldName} (${min}-${max})`;
      }
    } else {
      const num = parseInt(pattern);
      if (isNaN(num) || num < min || num > max) {
        return `${fieldName} must be ${min}-${max} or *`;
      }
    }
  }
  return null;
}

function validateAllCronFields(form) {
  const errors = [];
  
  const minuteErr = validateCronField(form.minute.value || '*', 0, 59, 'Minute');
  if (minuteErr) errors.push(minuteErr);
  
  const hourErr = validateCronField(form.hour.value || '*', 0, 23, 'Hour');
  if (hourErr) errors.push(hourErr);
  
  const dayErr = validateCronField(form.day_of_month.value || '*', 1, 31, 'Day of month');
  if (dayErr) errors.push(dayErr);
  
  const dowErr = validateCronField(form.day_of_week.value || '*', 0, 6, 'Day of week');
  if (dowErr) errors.push(dowErr);
  
  const monthErr = validateCronField(form.month.value || '*', 1, 12, 'Month');
  if (monthErr) errors.push(monthErr);
  
  return errors;
}

function formatCron(cron) {
  if (!cron) return 'Not set';
  const { minute, hour, day_of_month, day_of_week, month } = cron;
  
  const allWildcard = minute === '*' && hour === '*' && day_of_month === '*' && day_of_week === '*' && month === '*';
  if (allWildcard) return 'Every minute';
  
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
  // Casos comunes legibles
  if (day_of_month === '*' && month === '*') {
    if (hour !== '*' && minute !== '*' && day_of_week === '*') {
      return `Daily at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
    }
    if (hour !== '*' && minute !== '*' && day_of_week !== '*') {
      const dayName = days[parseInt(day_of_week)] || day_of_week;
      return `Every ${dayName} at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
    }
    if (hour === '*' && minute !== '*' && day_of_week === '*') {
      return `Every hour at minute ${minute}`;
    }
  }
  
  if (minute !== '*' && hour !== '*' && day_of_month !== '*' && month !== '*') {
    const monthName = months[parseInt(month)] || month;
    return `${monthName} ${day_of_month} at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  }
  
  // Formato descriptivo genérico
  let desc = [];
  
  if (minute !== '*' && hour !== '*') {
    desc.push(`at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`);
  } else if (minute !== '*') {
    desc.push(`at minute ${minute}`);
  } else if (hour !== '*') {
    desc.push(`at hour ${hour}`);
  }
  
  if (day_of_month !== '*') desc.push(`on day ${day_of_month}`);
  if (day_of_week !== '*') {
    const dayName = days[parseInt(day_of_week)] || day_of_week;
    desc.push(`on ${dayName}`);
  }
  if (month !== '*') {
    const monthName = months[parseInt(month)] || month;
    desc.push(`in ${monthName}`);
  }
  
  return desc.length > 0 ? desc.join(', ') : 'Every minute';
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
