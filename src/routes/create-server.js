import { escapeHtml } from '../utils/security.js';
import * as toast from '../utils/toast.js';
import { api, getUser } from '../utils/api.js';

let selectedNest = null;
let selectedEgg = null;
let nestsData = null;
let limitsData = null;
let nodesData = null;
let selectedNode = null;
let currentResources = { memory: 512, disk: 1024 };

export async function renderCreateServer() {
  const app = document.getElementById('app');
  const user = getUser();
  
  app.innerHTML = `
    <div class="create-server-page">
      <div class="page-header">
        <a href="/servers" class="back-link">
          <span class="material-icons-outlined">arrow_back</span>
          <span>Back to Servers</span>
        </a>
        <h1>Create Server</h1>
      </div>
      <div class="create-server-content">
        <div class="loading-spinner"></div>
      </div>
    </div>
  `;
  
  try {
    const [nestsRes, limitsRes, nodesRes] = await Promise.all([
      api('/api/servers/nests'),
      api(`/api/user/limits?username=${encodeURIComponent(user.username)}`),
      api('/api/servers/available-nodes')
    ]);
    
    nestsData = await nestsRes.json();
    limitsData = await limitsRes.json();
    nodesData = await nodesRes.json();
    
    if (!nestsData.nests || nestsData.nests.length === 0) {
      document.querySelector('.create-server-content').innerHTML = `
        <div class="empty-state">
          <span class="material-icons-outlined">egg_alt</span>
          <p>No eggs configured. Contact an administrator.</p>
          <a href="/servers" class="btn btn-primary">Go Back</a>
        </div>
      `;
      return;
    }
    
    if (!nodesData.nodes || nodesData.nodes.length === 0) {
      document.querySelector('.create-server-content').innerHTML = `
        <div class="empty-state">
          <span class="material-icons-outlined">dns</span>
          <p>No nodes available. Contact an administrator.</p>
          <a href="/servers" class="btn btn-primary">Go Back</a>
        </div>
      `;
      return;
    }
    
    const remaining = {
      servers: limitsData.limits.servers - limitsData.used.servers,
      memory: limitsData.limits.memory - limitsData.used.memory,
      disk: limitsData.limits.disk - limitsData.used.disk,
      cpu: limitsData.limits.cpu - limitsData.used.cpu,
      allocations: (limitsData.limits.allocations || 5) - (limitsData.used.allocations || 0)
    };
    
    if (remaining.servers <= 0) {
      document.querySelector('.create-server-content').innerHTML = `
        <div class="empty-state">
          <span class="material-icons-outlined">block</span>
          <p>Server limit reached (${limitsData.limits.servers} max)</p>
          <a href="/servers" class="btn btn-primary">Go Back</a>
        </div>
      `;
      return;
    }
    
    selectedNest = nestsData.nests[0];
    selectedEgg = selectedNest.eggs[0];
    selectedNode = nodesData.nodes[0];
    
    renderCreateForm(remaining);
    
  } catch (e) {
    console.error('Failed to load data:', e);
    document.querySelector('.create-server-content').innerHTML = `
      <div class="error">Failed to load data. Please try again.</div>
    `;
  }
}

function renderCreateForm(remaining) {
  const content = document.querySelector('.create-server-content');
  
  content.innerHTML = `
    <div class="create-server-layout">
      <div class="create-server-main">
        <div class="step-card">
          <div class="step-header">
            <span class="step-number">1</span>
            <h3>Select Egg</h3>
          </div>
          
          <div class="nest-tabs" id="nest-tabs">
            ${nestsData.nests.map((nest, idx) => `
              <button class="nest-tab ${idx === 0 ? 'active' : ''}" data-nest-id="${nest.id}">
                ${escapeHtml(nest.name)}
              </button>
            `).join('')}
          </div>
          
          <div class="eggs-grid" id="eggs-grid">
            ${renderEggsGrid(selectedNest)}
          </div>
        </div>
        
        <div class="step-card">
          <div class="step-header">
            <span class="step-number">2</span>
            <h3>Server Details</h3>
          </div>
          
          <form id="create-server-form">
            <div class="form-group">
              <label>Server Name</label>
              <input type="text" name="name" required placeholder="My Awesome Server" maxlength="50" />
            </div>
            
            <div class="form-group">
              <label>Description (optional)</label>
              <textarea name="description" rows="2" placeholder="What is this server for?"></textarea>
            </div>
            
            <div class="form-group">
              <label>Node</label>
              <input type="hidden" name="node_id" id="node-id-input" value="${nodesData.nodes[0]?.id || ''}" />
              <div class="nodes-grid" id="nodes-grid">
                ${renderNodesGrid(512, 1024)}
              </div>
            </div>
            
            <div class="form-section">
              <h4>Resources</h4>
              <div class="resources-grid">
                <div class="resource-input">
                  <label>
                    <span class="material-icons-outlined">memory</span>
                    Memory (MB)
                  </label>
                  <input type="number" name="memory" value="512" min="128" max="${remaining.memory}" required />
                  <span class="resource-hint">Max: ${remaining.memory} MB</span>
                </div>
                <div class="resource-input">
                  <label>
                    <span class="material-icons-outlined">storage</span>
                    Disk (MB)
                  </label>
                  <input type="number" name="disk" value="1024" min="256" max="${remaining.disk}" required />
                  <span class="resource-hint">Max: ${remaining.disk} MB</span>
                </div>
                <div class="resource-input">
                  <label>
                    <span class="material-icons-outlined">speed</span>
                    CPU (%)
                  </label>
                  <input type="number" name="cpu" value="100" min="25" max="${remaining.cpu}" required />
                  <span class="resource-hint">Max: ${remaining.cpu}%</span>
                </div>
                <div class="resource-input">
                  <label>
                    <span class="material-icons-outlined">lan</span>
                    Allocations
                  </label>
                  <input type="number" name="allocations" value="1" min="1" max="${remaining.allocations}" required />
                  <span class="resource-hint">Max: ${remaining.allocations}</span>
                </div>
              </div>
            </div>
            
            <div class="form-section" id="docker-image-section" style="display: none;">
              <h4>Docker Image</h4>
              <div class="form-group">
                <select name="docker_image" id="docker-image-select"></select>
              </div>
            </div>
            
            <div id="create-server-error" class="error-message" style="display: none;"></div>
            
            <div class="form-actions">
              <a href="/servers" class="btn btn-ghost">Cancel</a>
              <button type="submit" class="btn btn-primary btn-large" id="submit-btn">
                <span class="material-icons-outlined">add</span>
                Create Server
              </button>
            </div>
          </form>
        </div>
      </div>
      
      <div class="create-server-sidebar">
        <div class="sidebar-card">
          <h4>Selected Egg</h4>
          <div id="selected-egg-preview">
            ${renderEggPreview(selectedEgg)}
          </div>
        </div>
        
        <div class="sidebar-card">
          <h4>Available Resources</h4>
          <div class="limits-list">
            <div class="limit-row">
              <span>Servers</span>
              <span class="limit-value">${remaining.servers} remaining</span>
            </div>
            <div class="limit-row">
              <span>Memory</span>
              <span class="limit-value">${remaining.memory} MB</span>
            </div>
            <div class="limit-row">
              <span>Disk</span>
              <span class="limit-value">${remaining.disk} MB</span>
            </div>
            <div class="limit-row">
              <span>CPU</span>
              <span class="limit-value">${remaining.cpu}%</span>
            </div>
            <div class="limit-row">
              <span>Allocations</span>
              <span class="limit-value">${remaining.allocations}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  setupEventListeners(remaining);
  updateDockerImages();
}

function renderEggsGrid(nest) {
  if (!nest.eggs || nest.eggs.length === 0) {
    return '<div class="empty-eggs">No eggs in this category</div>';
  }
  
  return nest.eggs.map(egg => `
    <div class="egg-select-card ${egg.id === selectedEgg?.id ? 'selected' : ''}" data-egg-id="${egg.id}">
      <div class="egg-select-icon">
        ${renderEggIcon(egg)}
      </div>
      <div class="egg-select-info">
        <h4>${escapeHtml(egg.name)}</h4>
        <p>${escapeHtml(egg.description || 'No description')}</p>
      </div>
      <span class="egg-select-check material-icons-outlined">check_circle</span>
    </div>
  `).join('');
}

function renderEggIcon(egg) {
  if (!egg.icon) {
    return '<span class="material-icons-outlined">egg_alt</span>';
  }
  
  // Check if it's a Material Icon name
  if (!egg.icon.includes('/') && !egg.icon.includes('.')) {
    return `<span class="material-icons-outlined">${escapeHtml(egg.icon)}</span>`;
  }
  
  // Check if it's a URL (image)
  if (egg.icon.startsWith('http') || egg.icon.startsWith('/') || egg.icon.includes('.')) {
    return `<img src="${escapeHtml(egg.icon)}" alt="${escapeHtml(egg.name)}" onerror="this.outerHTML='<span class=\\'material-icons-outlined\\'>egg_alt</span>'" />`;
  }
  
  return '<span class="material-icons-outlined">egg_alt</span>';
}

function renderEggPreview(egg) {
  if (!egg) return '<p class="no-selection">No egg selected</p>';
  
  return `
    <div class="egg-preview">
      <div class="egg-preview-icon">
        ${renderEggIcon(egg)}
      </div>
      <div class="egg-preview-info">
        <h5>${escapeHtml(egg.name)}</h5>
        <p>${escapeHtml(egg.description || 'No description')}</p>
      </div>
    </div>
  `;
}

function renderNodesGrid(requestedMemory, requestedDisk) {
  if (!nodesData?.nodes || nodesData.nodes.length === 0) {
    return '<div class="empty-nodes">No nodes available</div>';
  }
  
  return nodesData.nodes.map(node => {
    const hasEnoughMemory = node.available_memory >= requestedMemory;
    const hasEnoughDisk = node.available_disk >= requestedDisk;
    const canFit = hasEnoughMemory && hasEnoughDisk;
    const isSelected = node.id === selectedNode?.id;
    
    const memoryPercent = Math.min(100, Math.round((requestedMemory / node.available_memory) * 100));
    const diskPercent = Math.min(100, Math.round((requestedDisk / node.available_disk) * 100));
    
    return `
      <div class="node-select-card ${isSelected ? 'selected' : ''} ${!canFit ? 'insufficient' : ''}" 
           data-node-id="${node.id}" 
           ${!canFit ? 'title="Insufficient resources"' : ''}>
        <div class="node-select-icon">
          <span class="material-icons-outlined">${canFit ? 'dns' : 'block'}</span>
        </div>
        <div class="node-select-info">
          <h4>${escapeHtml(node.name)}</h4>
          <div class="node-resources">
            <div class="node-resource ${!hasEnoughMemory ? 'exceeded' : ''}">
              <span class="resource-label">RAM</span>
              <div class="resource-bar">
                <div class="resource-fill" style="width: ${memoryPercent}%"></div>
              </div>
              <span class="resource-values">${requestedMemory} / ${node.available_memory} MB</span>
            </div>
            <div class="node-resource ${!hasEnoughDisk ? 'exceeded' : ''}">
              <span class="resource-label">Disk</span>
              <div class="resource-bar">
                <div class="resource-fill" style="width: ${diskPercent}%"></div>
              </div>
              <span class="resource-values">${requestedDisk} / ${node.available_disk} MB</span>
            </div>
          </div>
        </div>
        <span class="node-select-check material-icons-outlined">check_circle</span>
      </div>
    `;
  }).join('');
}

function updateNodesGrid() {
  const nodesGrid = document.getElementById('nodes-grid');
  if (nodesGrid) {
    nodesGrid.innerHTML = renderNodesGrid(currentResources.memory, currentResources.disk);
    setupNodeCardListeners();
  }
}

function setupEventListeners(remaining) {
  // Nest tabs
  document.querySelectorAll('.nest-tab').forEach(tab => {
    tab.onclick = () => {
      const nestId = tab.dataset.nestId;
      selectedNest = nestsData.nests.find(n => n.id === nestId);
      
      document.querySelectorAll('.nest-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      selectedEgg = selectedNest.eggs[0];
      
      document.getElementById('eggs-grid').innerHTML = renderEggsGrid(selectedNest);
      document.getElementById('selected-egg-preview').innerHTML = renderEggPreview(selectedEgg);
      
      setupEggCardListeners();
      updateDockerImages();
    };
  });
  
  setupEggCardListeners();
  setupNodeCardListeners();
  
  // Resource input listeners to update nodes grid
  const memoryInput = document.querySelector('input[name="memory"]');
  const diskInput = document.querySelector('input[name="disk"]');
  
  if (memoryInput) {
    memoryInput.addEventListener('input', () => {
      currentResources.memory = parseInt(memoryInput.value) || 0;
      updateNodesGrid();
    });
  }
  
  if (diskInput) {
    diskInput.addEventListener('input', () => {
      currentResources.disk = parseInt(diskInput.value) || 0;
      updateNodesGrid();
    });
  }
  
  // Form submit
  document.getElementById('create-server-form').onsubmit = async (e) => {
    e.preventDefault();
    await submitCreateServer(remaining);
  };
}

function setupNodeCardListeners() {
  document.querySelectorAll('.node-select-card:not(.insufficient)').forEach(card => {
    card.onclick = () => {
      const nodeId = card.dataset.nodeId;
      selectedNode = nodesData.nodes.find(n => n.id === nodeId);
      
      document.querySelectorAll('.node-select-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      
      document.getElementById('node-id-input').value = nodeId;
    };
  });
}

function setupEggCardListeners() {
  document.querySelectorAll('.egg-select-card').forEach(card => {
    card.onclick = () => {
      const eggId = card.dataset.eggId;
      selectedEgg = selectedNest.eggs.find(e => e.id === eggId);
      
      document.querySelectorAll('.egg-select-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      
      document.getElementById('selected-egg-preview').innerHTML = renderEggPreview(selectedEgg);
      updateDockerImages();
    };
  });
}

function updateDockerImages() {
  const section = document.getElementById('docker-image-section');
  const select = document.getElementById('docker-image-select');
  
  if (!selectedEgg?.docker_images || Object.keys(selectedEgg.docker_images).length <= 1) {
    section.style.display = 'none';
    return;
  }
  
  section.style.display = 'block';
  select.innerHTML = Object.entries(selectedEgg.docker_images).map(([label, image]) => 
    `<option value="${escapeHtml(image)}">${escapeHtml(label)}</option>`
  ).join('');
}

async function submitCreateServer(remaining) {
  const form = document.getElementById('create-server-form');
  const formData = new FormData(form);
  const errorEl = document.getElementById('create-server-error');
  const submitBtn = document.getElementById('submit-btn');
  
  // Validation
  const memory = parseInt(formData.get('memory'));
  const disk = parseInt(formData.get('disk'));
  const cpu = parseInt(formData.get('cpu'));
  const allocations = parseInt(formData.get('allocations')) || 1;
  
  if (memory > remaining.memory) {
    errorEl.textContent = `Memory exceeds limit (max: ${remaining.memory} MB)`;
    errorEl.style.display = 'block';
    return;
  }
  if (disk > remaining.disk) {
    errorEl.textContent = `Disk exceeds limit (max: ${remaining.disk} MB)`;
    errorEl.style.display = 'block';
    return;
  }
  if (cpu > remaining.cpu) {
    errorEl.textContent = `CPU exceeds limit (max: ${remaining.cpu}%)`;
    errorEl.style.display = 'block';
    return;
  }
  if (allocations > remaining.allocations) {
    errorEl.textContent = `Allocations exceeds limit (max: ${remaining.allocations})`;
    errorEl.style.display = 'block';
    return;
  }
  
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="material-icons-outlined spinning">sync</span> Creating...';
  errorEl.style.display = 'none';
  
  try {
    const res = await api('/api/servers', {
      method: 'POST',
      body: JSON.stringify({
        name: formData.get('name'),
        description: formData.get('description'),
        node_id: formData.get('node_id'),
        egg_id: selectedEgg.id,
        docker_image: formData.get('docker_image') || null,
        memory,
        disk,
        cpu,
        allocations
      })
    });
    
    const data = await res.json();
    
    if (res.ok) {
      toast.success('Server created successfully');
      window.router.navigateTo('/servers');
    } else {
      errorEl.textContent = data.error || 'Failed to create server';
      errorEl.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span class="material-icons-outlined">add</span> Create Server';
    }
  } catch (err) {
    errorEl.textContent = 'Network error. Please try again.';
    errorEl.style.display = 'block';
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span class="material-icons-outlined">add</span> Create Server';
  }
}

export function cleanupCreateServer() {
  selectedNest = null;
  selectedEgg = null;
  nestsData = null;
  limitsData = null;
  nodesData = null;
  selectedNode = null;
  currentResources = { memory: 512, disk: 1024 };
}
