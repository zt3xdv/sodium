import { api } from '../../utils/api.js';
import * as toast from '../../utils/toast.js';
import { escapeHtml } from '../../utils/security.js';

let currentServerId = null;
let serverData = null;
let eggData = null;

function parseRules(rulesString) {
  const rules = {
    required: false,
    nullable: false,
    type: null,
    min: null,
    max: null,
    in: [],
    regex: null
  };
  
  if (!rulesString) return rules;
  
  const parts = rulesString.split('|');
  for (const part of parts) {
    const trimmed = part.trim();
    
    if (trimmed === 'required') rules.required = true;
    else if (trimmed === 'nullable') rules.nullable = true;
    else if (trimmed === 'string') rules.type = 'string';
    else if (trimmed === 'numeric' || trimmed === 'integer') rules.type = 'number';
    else if (trimmed === 'boolean') rules.type = 'boolean';
    else if (trimmed.startsWith('min:')) rules.min = parseInt(trimmed.split(':')[1]);
    else if (trimmed.startsWith('max:')) rules.max = parseInt(trimmed.split(':')[1]);
    else if (trimmed.startsWith('in:')) rules.in = trimmed.split(':')[1].split(',');
    else if (trimmed.startsWith('regex:')) rules.regex = trimmed.split(':').slice(1).join(':');
  }
  
  return rules;
}

function renderVariableInput(variable, currentValue, rules) {
  const id = `var-${variable.env_variable}`;
  const dataAttr = `data-var="${variable.env_variable}" data-rules="${escapeHtml(variable.rules || '')}"`;
  const placeholder = escapeHtml(variable.default_value || '');
  const value = escapeHtml(currentValue);
  
  // Boolean type - render as toggle/select
  if (rules.type === 'boolean') {
    const isTrue = currentValue === '1' || currentValue === 'true' || currentValue === true;
    return `
      <select id="${id}" name="env_${variable.env_variable}" class="select-input" ${dataAttr}>
        <option value="0" ${!isTrue ? 'selected' : ''}>False (0)</option>
        <option value="1" ${isTrue ? 'selected' : ''}>True (1)</option>
      </select>
    `;
  }
  
  // Has predefined options - render as select
  if (rules.in.length > 0) {
    return `
      <select id="${id}" name="env_${variable.env_variable}" class="select-input" ${dataAttr}>
        ${rules.in.map(opt => `
          <option value="${escapeHtml(opt)}" ${currentValue === opt ? 'selected' : ''}>${escapeHtml(opt)}</option>
        `).join('')}
      </select>
    `;
  }
  
  // Number type
  if (rules.type === 'number') {
    return `
      <input 
        type="number" 
        id="${id}"
        name="env_${variable.env_variable}" 
        value="${value}"
        placeholder="${placeholder}"
        ${dataAttr}
        ${rules.min !== null ? `min="${rules.min}"` : ''}
        ${rules.max !== null ? `max="${rules.max}"` : ''}
        ${rules.required ? 'required' : ''}
      />
    `;
  }
  
  // Default: text input
  return `
    <input 
      type="text" 
      id="${id}"
      name="env_${variable.env_variable}" 
      value="${value}"
      placeholder="${placeholder}"
      ${dataAttr}
      ${rules.max !== null ? `maxlength="${rules.max}"` : ''}
      ${rules.required ? 'required' : ''}
    />
  `;
}

function validateVariable(value, rulesString) {
  const rules = parseRules(rulesString);
  const errors = [];
  
  // Check required
  if (rules.required && (value === '' || value === null || value === undefined)) {
    errors.push('This field is required');
    return errors;
  }
  
  // If nullable and empty, skip other validations
  if (rules.nullable && (value === '' || value === null || value === undefined)) {
    return errors;
  }
  
  // Type validations
  if (rules.type === 'number' && value !== '') {
    if (isNaN(Number(value))) {
      errors.push('Must be a number');
    } else {
      const num = Number(value);
      if (rules.min !== null && num < rules.min) {
        errors.push(`Minimum value is ${rules.min}`);
      }
      if (rules.max !== null && num > rules.max) {
        errors.push(`Maximum value is ${rules.max}`);
      }
    }
  }
  
  if (rules.type === 'string' && value !== '') {
    if (rules.min !== null && value.length < rules.min) {
      errors.push(`Minimum length is ${rules.min} characters`);
    }
    if (rules.max !== null && value.length > rules.max) {
      errors.push(`Maximum length is ${rules.max} characters`);
    }
  }
  
  // In validation
  if (rules.in.length > 0 && value !== '' && !rules.in.includes(value)) {
    errors.push(`Must be one of: ${rules.in.join(', ')}`);
  }
  
  // Regex validation
  if (rules.regex && value !== '') {
    try {
      const regex = new RegExp(rules.regex);
      if (!regex.test(value)) {
        errors.push('Invalid format');
      }
    } catch (e) {
      // Invalid regex, skip
    }
  }
  
  return errors;
}

export function renderStartupTab() {
  return `
    <div class="startup-tab">
      <div class="settings-content">
        <div class="settings-section">
          <div class="section-header">
            <span class="material-icons-outlined">terminal</span>
            <h3>Startup Configuration</h3>
          </div>
          <div id="startup-card-content">
            <div class="loading-spinner"></div>
          </div>
        </div>
      </div>
      <div class="startup-content" id="startup-content"></div>
    </div>
  `;
}

export async function initStartupTab(serverId) {
  currentServerId = serverId;
  await loadStartupData(serverId);
}

async function loadStartupData(serverId) {
  const username = localStorage.getItem('username');
  const content = document.getElementById('startup-content');
  
  try {
    const [serverRes, startupRes] = await Promise.all([
      api(`/api/servers/${serverId}`),
      api(`/api/servers/${serverId}/startup`)
    ]);
    
    const serverJson = await serverRes.json();
    const startupJson = await startupRes.json();
    
    if (serverJson.error || startupJson.error) {
      content.innerHTML = `<div class="error">${serverJson.error || startupJson.error}</div>`;
      return;
    }
    
    serverData = serverJson.server;
    eggData = startupJson.egg;
    
    renderStartupForm(serverData, eggData);
  } catch (e) {
    console.error('Failed to load startup data:', e);
    content.innerHTML = '<div class="error">Failed to load startup configuration</div>';
  }
}

function renderStartupForm(server, egg) {
  const cardContent = document.getElementById('startup-card-content');
  const externalContent = document.getElementById('startup-content');
  const variables = egg?.variables || [];
  
  // Content inside the card
  cardContent.innerHTML = `
    <div class="form-group">
      <label>Startup Command</label>
      <div class="textarea-wrapper">
        <textarea name="startup" id="startup-command" rows="3" spellcheck="false" placeholder="java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar server.jar">${escapeHtml(server.startup || egg?.startup || '')}</textarea>
      </div>
      <small class="form-hint">Use {{VARIABLE}} syntax for variables</small>
    </div>
    <div class="startup-preview">
      <span class="preview-label">Preview:</span>
      <code id="startup-preview">${escapeHtml(parseStartupCommand(server.startup || egg?.startup || '', server.environment || {}))}</code>
    </div>
    
    <div class="form-group" style="margin-top: 20px;">
      <label>Docker Image</label>
      <div class="input-wrapper">
        <span class="material-icons-outlined">inventory_2</span>
        <select name="docker_image" class="select-input">
          ${getDockerImagesOptions(server, egg)}
        </select>
      </div>
    </div>
  `;
  
  // Content outside the card (variables + save button)
  externalContent.innerHTML = `
    <form id="startup-form" class="startup-form">
      <div class="variables-section">
        <h4>Environment Variables</h4>
        <p class="form-hint">Configure the variables used by this server.</p>
        
        <div class="variables-list">
          ${variables.length === 0 ? '<div class="empty">No variables defined for this egg</div>' : ''}
          ${variables.map(v => {
            const rules = parseRules(v.rules || '');
            const currentValue = server.environment?.[v.env_variable] ?? v.default_value ?? '';
            return `
            <div class="variable-item">
              <div class="variable-header">
                <label for="var-${v.env_variable}">
                  ${escapeHtml(v.name)}
                  ${rules.required ? '<span class="required">*</span>' : ''}
                </label>
                <code class="variable-key">${escapeHtml(v.env_variable)}</code>
              </div>
              <p class="variable-description">${escapeHtml(v.description || '')}</p>
              ${renderVariableInput(v, currentValue, rules)}
              <div class="variable-meta">
                ${rules.required ? '<span class="rule-badge required">Required</span>' : '<span class="rule-badge optional">Optional</span>'}
                ${rules.type ? `<span class="rule-badge type">${escapeHtml(rules.type)}</span>` : ''}
                ${rules.min !== null ? `<span class="rule-badge">Min: ${rules.min}</span>` : ''}
                ${rules.max !== null ? `<span class="rule-badge">Max: ${rules.max}</span>` : ''}
                ${rules.in.length > 0 ? `<span class="rule-badge">Options: ${rules.in.join(', ')}</span>` : ''}
              </div>
              <div class="variable-error" id="error-${v.env_variable}"></div>
            </div>
          `}).join('')}
        </div>
      </div>
      
      <div class="form-actions">
        <button type="submit" class="btn btn-primary" id="save-startup">
          <span class="material-icons-outlined">save</span>
          Save Changes
        </button>
        <button type="button" class="btn btn-ghost" id="reset-startup">
          <span class="material-icons-outlined">restart_alt</span>
          Reset to Defaults
        </button>
      </div>
    </form>
  `;
  
  const form = document.getElementById('startup-form');
  const startupInput = document.getElementById('startup-command');
  const previewEl = document.getElementById('startup-preview');
  
  const updatePreview = () => {
    const env = getEnvironmentFromForm();
    const cmd = startupInput.value;
    previewEl.textContent = parseStartupCommand(cmd, env);
  };
  
  startupInput.addEventListener('input', updatePreview);
  
  document.querySelectorAll('.variable-item input').forEach(input => {
    input.addEventListener('input', updatePreview);
  });
  
  form.onsubmit = (e) => {
    e.preventDefault();
    saveStartup();
  };
  
  document.getElementById('reset-startup').onclick = () => {
    if (confirm('Reset startup configuration to egg defaults?')) {
      resetToDefaults();
    }
  };
}

function getDockerImagesOptions(server, egg) {
  const currentImage = server.docker_image || egg?.docker_image || '';
  const eggImages = egg?.docker_images || {};
  
  const images = Object.entries(eggImages);
  
  if (images.length === 0) {
    if (currentImage) {
      return `<option value="${escapeHtml(currentImage)}" selected>${escapeHtml(currentImage)}</option>`;
    }
    return '<option value="">No images available</option>';
  }
  
  return images.map(([label, value]) => `
    <option value="${escapeHtml(value)}" ${currentImage === value ? 'selected' : ''}>
      ${escapeHtml(label)}
    </option>
  `).join('');
}

function getEnvironmentFromForm() {
  const env = {};
  document.querySelectorAll('.variable-item input[data-var], .variable-item select[data-var]').forEach(input => {
    env[input.dataset.var] = input.value;
  });
  return env;
}

function validateAllVariables() {
  let hasErrors = false;
  
  document.querySelectorAll('.variable-item input[data-var], .variable-item select[data-var]').forEach(input => {
    const varName = input.dataset.var;
    const rules = input.dataset.rules || '';
    const value = input.value;
    const errorEl = document.getElementById(`error-${varName}`);
    
    const errors = validateVariable(value, rules);
    
    if (errors.length > 0) {
      hasErrors = true;
      input.classList.add('input-error');
      if (errorEl) errorEl.textContent = errors.join(', ');
    } else {
      input.classList.remove('input-error');
      if (errorEl) errorEl.textContent = '';
    }
  });
  
  return !hasErrors;
}

function parseStartupCommand(command, environment) {
  if (!command) return '';
  
  let parsed = command;
  
  for (const [key, value] of Object.entries(environment)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    parsed = parsed.replace(regex, value || '');
    
    const envRegex = new RegExp(`\\$\\{${key}\\}`, 'g');
    parsed = parsed.replace(envRegex, value || '');
  }
  
  parsed = parsed.replace(/\{\{[A-Z_]+\}\}/g, '');
  parsed = parsed.replace(/\$\{[A-Z_]+\}/g, '');
  
  return parsed;
}

async function saveStartup() {
  const username = localStorage.getItem('username');
  const saveBtn = document.getElementById('save-startup');
  
  // Validate before saving
  if (!validateAllVariables()) {
    toast.warning('Please fix validation errors');
    return;
  }
  
  const startup = document.getElementById('startup-command').value;
  const dockerImage = document.querySelector('select[name="docker_image"]').value;
  const environment = getEnvironmentFromForm();
  
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<span class="material-icons-outlined">hourglass_empty</span> Saving...';
  
  try {
    const res = await api(`/api/servers/${currentServerId}/startup`, {
      method: 'PUT',
      
      body: JSON.stringify({
        username,
        startup,
        docker_image: dockerImage,
        environment
      })
    });
    
    const data = await res.json();
    
    if (res.ok) {
      saveBtn.innerHTML = '<span class="material-icons-outlined">check</span> Saved';
      setTimeout(() => {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<span class="material-icons-outlined">save</span> Save Changes';
      }, 1500);
    } else {
      toast.error(data.error || 'Failed to save');
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<span class="material-icons-outlined">save</span> Save Changes';
    }
  } catch (e) {
    console.error('Failed to save startup:', e);
    toast.error('Failed to save startup');
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<span class="material-icons-outlined">save</span> Save Changes';
  }
}

async function resetToDefaults() {
  if (!eggData) return;
  
  document.getElementById('startup-command').value = eggData.startup || '';
  
  const dockerSelect = document.querySelector('select[name="docker_image"]');
  if (dockerSelect && eggData.docker_image) {
    dockerSelect.value = eggData.docker_image;
  }
  
  (eggData.variables || []).forEach(v => {
    const input = document.getElementById(`var-${v.env_variable}`);
    if (input) {
      input.value = v.default_value || '';
    }
  });
  
  const env = getEnvironmentFromForm();
  document.getElementById('startup-preview').textContent = 
    parseStartupCommand(eggData.startup || '', env);
}

export function cleanupStartupTab() {
  currentServerId = null;
  serverData = null;
  eggData = null;
}
