let currentServerId = null;
let allocations = [];

export function renderNetworkTab() {
  return `
    <div class="network-tab">
      <div class="network-header">
        <h3>Network Allocations</h3>
        <button class="btn btn-primary btn-sm" id="btn-add-allocation">
          <span class="material-icons-outlined">add</span>
          Add Allocation
        </button>
      </div>
      <div class="allocations-list" id="allocations-list">
        <div class="loading-spinner"></div>
      </div>
    </div>
  `;
}

export async function initNetworkTab(serverId) {
  currentServerId = serverId;
  await loadAllocations();
  
  document.getElementById('btn-add-allocation').onclick = addAllocation;
}

async function loadAllocations() {
  const username = localStorage.getItem('username');
  const list = document.getElementById('allocations-list');
  
  try {
    const res = await fetch(`/api/servers/${currentServerId}/allocations?username=${encodeURIComponent(username)}`);
    const data = await res.json();
    
    if (data.error) {
      list.innerHTML = `<div class="error">${data.error}</div>`;
      return;
    }
    
    allocations = data.allocations || [];
    renderAllocations();
  } catch (e) {
    list.innerHTML = '<div class="error">Failed to load allocations</div>';
  }
}

function renderAllocations() {
  const list = document.getElementById('allocations-list');
  
  if (allocations.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="material-icons-outlined">lan</span>
        <p>No allocations configured</p>
      </div>
    `;
    return;
  }
  
  list.innerHTML = allocations.map(alloc => `
    <div class="allocation-item ${alloc.primary ? 'primary' : ''}">
      <div class="allocation-info">
        <span class="allocation-address">${alloc.ip}:${alloc.port}</span>
        ${alloc.primary ? '<span class="badge primary">Primary</span>' : ''}
      </div>
      <div class="allocation-actions">
        ${!alloc.primary ? `
          <button class="btn btn-ghost btn-sm" onclick="window.setAllocationPrimary('${alloc.id}')" title="Make Primary">
            <span class="material-icons-outlined">star</span>
          </button>
          <button class="btn btn-ghost btn-sm btn-danger-hover" onclick="window.deleteAllocation('${alloc.id}')" title="Delete">
            <span class="material-icons-outlined">delete</span>
          </button>
        ` : ''}
      </div>
    </div>
  `).join('');
}

async function addAllocation() {
  const username = localStorage.getItem('username');
  const btn = document.getElementById('btn-add-allocation');
  
  btn.disabled = true;
  btn.innerHTML = '<span class="material-icons-outlined spinning">sync</span>';
  
  try {
    const res = await fetch(`/api/servers/${currentServerId}/allocations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    
    const data = await res.json();
    
    if (data.error) {
      alert(data.error);
    } else {
      await loadAllocations();
    }
  } catch (e) {
    alert('Failed to add allocation');
  }
  
  btn.disabled = false;
  btn.innerHTML = '<span class="material-icons-outlined">add</span> Add Allocation';
}

window.setAllocationPrimary = async (allocId) => {
  const username = localStorage.getItem('username');
  
  try {
    const res = await fetch(`/api/servers/${currentServerId}/allocations/${allocId}/primary`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    
    if (res.ok) {
      await loadAllocations();
    } else {
      const data = await res.json();
      alert(data.error);
    }
  } catch (e) {
    alert('Failed to set primary');
  }
};

window.deleteAllocation = async (allocId) => {
  if (!confirm('Delete this allocation?')) return;
  
  const username = localStorage.getItem('username');
  
  try {
    const res = await fetch(`/api/servers/${currentServerId}/allocations/${allocId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    
    if (res.ok) {
      await loadAllocations();
    } else {
      const data = await res.json();
      alert(data.error);
    }
  } catch (e) {
    alert('Failed to delete allocation');
  }
};

export function cleanupNetworkTab() {
  currentServerId = null;
  allocations = [];
}
