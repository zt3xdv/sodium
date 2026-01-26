let currentPath = '/';
let currentServerId = null;
let isEditing = false;
let editingPath = null;

const EDITABLE_EXTENSIONS = [
  'txt', 'log', 'md', 'json', 'yml', 'yaml', 'toml', 'xml',
  'js', 'ts', 'jsx', 'tsx', 'css', 'scss', 'less', 'html', 'htm',
  'php', 'py', 'rb', 'java', 'c', 'cpp', 'h', 'hpp', 'cs',
  'sh', 'bash', 'bat', 'ps1', 'cmd',
  'properties', 'cfg', 'conf', 'ini', 'env',
  'sql', 'lua', 'go', 'rs', 'swift', 'kt', 'gradle',
  'dockerfile', 'makefile', 'gitignore', 'htaccess'
];

function isEditable(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const name = filename.toLowerCase();
  return EDITABLE_EXTENSIONS.includes(ext) || 
         EDITABLE_EXTENSIONS.includes(name) ||
         !filename.includes('.');
}

export function renderFilesTab() {
  return `
    <div class="files-tab">
      <div class="card">
        <div class="files-toolbar">
          <div class="files-breadcrumb" id="files-breadcrumb">
            <span class="breadcrumb-item" data-path="/">/</span>
          </div>
          <div class="files-actions">
            <button class="btn btn-sm btn-ghost" id="btn-refresh" title="Refresh">
              <span class="material-icons-outlined">refresh</span>
            </button>
            <button class="btn btn-sm btn-ghost" id="btn-new-folder" title="New Folder">
              <span class="material-icons-outlined">create_new_folder</span>
            </button>
            <button class="btn btn-sm btn-ghost" id="btn-new-file" title="New File">
              <span class="material-icons-outlined">note_add</span>
            </button>
            <button class="btn btn-sm btn-ghost" id="btn-upload" title="Upload">
              <span class="material-icons-outlined">upload</span>
            </button>
          </div>
        </div>
        <div class="files-list" id="files-list">
          <div class="files-loading">Loading files...</div>
        </div>
      </div>
    </div>
  `;
}

export function initFilesTab(serverId) {
  currentPath = '/';
  currentServerId = serverId;
  isEditing = false;
  editingPath = null;
  loadFiles(serverId, currentPath);
  
  document.getElementById('btn-refresh').onclick = () => loadFiles(serverId, currentPath);
  document.getElementById('btn-new-folder').onclick = () => createNewFolder(serverId);
  document.getElementById('btn-new-file').onclick = () => createNewFile(serverId);
  document.getElementById('btn-upload').onclick = () => uploadFile(serverId);
}

async function loadFiles(serverId, path) {
  const username = localStorage.getItem('username');
  const filesList = document.getElementById('files-list');
  
  filesList.innerHTML = '<div class="files-loading">Loading files...</div>';
  
  try {
    const res = await fetch(`/api/servers/${serverId}/files/list?username=${encodeURIComponent(username)}&path=${encodeURIComponent(path)}`);
    const data = await res.json();
    
    if (data.error) {
      filesList.innerHTML = `<div class="files-error">${data.error}</div>`;
      return;
    }
    
    currentPath = path;
    updateBreadcrumb(path, serverId);
    renderFilesList(data.files || [], serverId);
  } catch (e) {
    console.error('Failed to load files:', e);
    filesList.innerHTML = '<div class="files-error">Failed to load files</div>';
  }
}

function updateBreadcrumb(path, serverId) {
  const breadcrumb = document.getElementById('files-breadcrumb');
  const parts = path.split('/').filter(p => p);
  
  let html = `<span class="breadcrumb-item clickable" data-path="/">/</span>`;
  let currentPath = '';
  
  parts.forEach((part, i) => {
    currentPath += '/' + part;
    const isLast = i === parts.length - 1;
    html += `<span class="breadcrumb-separator">/</span>`;
    html += `<span class="breadcrumb-item ${isLast ? '' : 'clickable'}" data-path="${currentPath}">${part}</span>`;
  });
  
  breadcrumb.innerHTML = html;
  
  breadcrumb.querySelectorAll('.breadcrumb-item.clickable').forEach(item => {
    item.onclick = () => loadFiles(serverId, item.dataset.path);
  });
}

function renderFilesList(files, serverId) {
  const filesList = document.getElementById('files-list');
  
  if (files.length === 0) {
    filesList.innerHTML = '<div class="files-empty">This directory is empty</div>';
    return;
  }
  
  const sorted = [...files].sort((a, b) => {
    const aIsDir = a.is_directory || a.directory || !a.is_file;
    const bIsDir = b.is_directory || b.directory || !b.is_file;
    if (aIsDir && !bIsDir) return -1;
    if (!aIsDir && bIsDir) return 1;
    return a.name.localeCompare(b.name);
  });
  
  filesList.innerHTML = sorted.map(file => {
    const isDir = file.is_directory || file.directory || !file.is_file;
    return `
    <div class="file-item ${isDir ? 'directory' : 'file'}" data-name="${file.name}" data-is-dir="${isDir}">
      <div class="file-icon">
        <span class="material-icons-outlined">${isDir ? 'folder' : getFileIcon(file.name)}</span>
      </div>
      <div class="file-info">
        <span class="file-name">${file.name}</span>
        <span class="file-meta">${isDir ? '--' : formatBytes(file.size)} • ${formatDate(file.modified_at)}</span>
      </div>
      <div class="file-actions">
        ${!isDir && isEditable(file.name) ? `
          <button class="btn btn-sm btn-ghost btn-edit" title="Edit">
            <span class="material-icons-outlined">edit</span>
          </button>
        ` : ''}
        ${!isDir ? `
          <button class="btn btn-sm btn-ghost btn-download" title="Download">
            <span class="material-icons-outlined">download</span>
          </button>
        ` : ''}
        <button class="btn btn-sm btn-ghost btn-rename" title="Rename">
          <span class="material-icons-outlined">drive_file_rename_outline</span>
        </button>
        <button class="btn btn-sm btn-ghost btn-delete" title="Delete">
          <span class="material-icons-outlined">delete</span>
        </button>
      </div>
    </div>
  `}).join('');
  
  filesList.querySelectorAll('.file-item.directory').forEach(item => {
    item.onclick = () => {
      const name = item.dataset.name;
      const newPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
      loadFiles(serverId, newPath);
    };
  });
  
  filesList.querySelectorAll('.file-item .btn-edit').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const name = btn.closest('.file-item').dataset.name;
      editFile(serverId, currentPath === '/' ? `/${name}` : `${currentPath}/${name}`);
    };
  });
  
  filesList.querySelectorAll('.file-item .btn-delete').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const name = btn.closest('.file-item').dataset.name;
      deleteFile(serverId, currentPath === '/' ? `/${name}` : `${currentPath}/${name}`);
    };
  });
  
  filesList.querySelectorAll('.file-item .btn-rename').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const name = btn.closest('.file-item').dataset.name;
      renameFile(serverId, name);
    };
  });
  
  filesList.querySelectorAll('.file-item .btn-download').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const name = btn.closest('.file-item').dataset.name;
      downloadFile(serverId, currentPath === '/' ? `/${name}` : `${currentPath}/${name}`);
    };
  });
}

function getFileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const icons = {
    'js': 'javascript', 'ts': 'javascript', 'json': 'data_object',
    'html': 'html', 'css': 'css', 'scss': 'css',
    'md': 'description', 'txt': 'description', 'log': 'description',
    'yml': 'settings', 'yaml': 'settings', 'toml': 'settings',
    'properties': 'settings', 'cfg': 'settings', 'conf': 'settings',
    'jar': 'inventory_2', 'zip': 'folder_zip', 'tar': 'folder_zip', 'gz': 'folder_zip',
    'png': 'image', 'jpg': 'image', 'jpeg': 'image', 'gif': 'image', 'svg': 'image',
    'sh': 'terminal', 'bat': 'terminal', 'ps1': 'terminal'
  };
  return icons[ext] || 'insert_drive_file';
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateStr) {
  if (!dateStr) return '--';
  const date = new Date(dateStr);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

async function createNewFolder(serverId) {
  const name = prompt('Folder name:');
  if (!name) return;
  
  const username = localStorage.getItem('username');
  const path = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
  
  try {
    const res = await fetch(`/api/servers/${serverId}/files/folder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, path })
    });
    
    if (res.ok) {
      loadFiles(serverId, currentPath);
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to create folder');
    }
  } catch (e) {
    alert('Failed to create folder');
  }
}

async function createNewFile(serverId) {
  const name = prompt('File name:');
  if (!name) return;
  
  const username = localStorage.getItem('username');
  const path = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
  
  try {
    const res = await fetch(`/api/servers/${serverId}/files/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, path, content: '' })
    });
    
    if (res.ok) {
      loadFiles(serverId, currentPath);
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to create file');
    }
  } catch (e) {
    alert('Failed to create file');
  }
}

async function deleteFile(serverId, path) {
  if (!confirm(`Delete ${path}?`)) return;
  
  const username = localStorage.getItem('username');
  
  try {
    const res = await fetch(`/api/servers/${serverId}/files/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, path })
    });
    
    if (res.ok) {
      loadFiles(serverId, currentPath);
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to delete');
    }
  } catch (e) {
    alert('Failed to delete');
  }
}

async function renameFile(serverId, oldName) {
  const newName = prompt('New name:', oldName);
  if (!newName || newName === oldName) return;
  
  const username = localStorage.getItem('username');
  const from = currentPath === '/' ? `/${oldName}` : `${currentPath}/${oldName}`;
  const to = currentPath === '/' ? `/${newName}` : `${currentPath}/${newName}`;
  
  try {
    const res = await fetch(`/api/servers/${serverId}/files/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, from, to })
    });
    
    if (res.ok) {
      loadFiles(serverId, currentPath);
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to rename');
    }
  } catch (e) {
    alert('Failed to rename');
  }
}

async function editFile(serverId, path) {
  const username = localStorage.getItem('username');
  const filesList = document.getElementById('files-list');
  const filename = path.split('/').pop();
  
  filesList.innerHTML = '<div class="files-loading">Loading file...</div>';
  
  try {
    const res = await fetch(`/api/servers/${serverId}/files/contents?username=${encodeURIComponent(username)}&path=${encodeURIComponent(path)}`);
    const data = await res.json();
    
    if (data.error) {
      alert(data.error);
      loadFiles(serverId, currentPath);
      return;
    }
    
    isEditing = true;
    editingPath = path;
    
    const container = document.querySelector('.files-tab .card');
    container.innerHTML = `
      <div class="file-editor">
        <div class="editor-header">
          <div class="editor-title">
            <button class="btn btn-ghost btn-sm" id="btn-back">
              <span class="material-icons-outlined">arrow_back</span>
            </button>
            <span class="editor-filename">${filename}</span>
          </div>
          <div class="editor-actions">
            <button class="btn btn-primary btn-sm" id="btn-save">
              <span class="material-icons-outlined">save</span>
              Save
            </button>
          </div>
        </div>
        <div class="editor-content">
          <textarea id="file-content" spellcheck="false">${escapeHtml(data.content || '')}</textarea>
        </div>
      </div>
    `;
    
    document.getElementById('btn-back').onclick = () => {
      isEditing = false;
      editingPath = null;
      initFilesTab(serverId);
    };
    
    document.getElementById('btn-save').onclick = () => saveFile(serverId, path);
    
    document.getElementById('file-content').addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveFile(serverId, path);
      }
      
      if (e.key === 'Tab') {
        e.preventDefault();
        const textarea = e.target;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }
    });
    
  } catch (e) {
    console.error('Failed to load file:', e);
    alert('Failed to load file');
    loadFiles(serverId, currentPath);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function saveFile(serverId, path) {
  const username = localStorage.getItem('username');
  const content = document.getElementById('file-content').value;
  const saveBtn = document.getElementById('btn-save');
  
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<span class="material-icons-outlined">hourglass_empty</span> Saving...';
  
  try {
    const res = await fetch(`/api/servers/${serverId}/files/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, path, content })
    });
    
    if (res.ok) {
      saveBtn.innerHTML = '<span class="material-icons-outlined">check</span> Saved';
      setTimeout(() => {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<span class="material-icons-outlined">save</span> Save';
      }, 1500);
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to save file');
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<span class="material-icons-outlined">save</span> Save';
    }
  } catch (e) {
    alert('Failed to save file');
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<span class="material-icons-outlined">save</span> Save';
  }
}

async function downloadFile(serverId, path) {
  const username = localStorage.getItem('username');
  window.open(`/api/servers/${serverId}/files/download?username=${encodeURIComponent(username)}&path=${encodeURIComponent(path)}`);
}

async function uploadFile(serverId) {
  const input = document.createElement('input');
  input.type = 'file';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    
    const username = localStorage.getItem('username');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('username', username);
    formData.append('path', currentPath);
    
    try {
      const res = await fetch(`/api/servers/${serverId}/files/upload`, {
        method: 'POST',
        body: formData
      });
      
      if (res.ok) {
        loadFiles(serverId, currentPath);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to upload');
      }
    } catch (e) {
      alert('Failed to upload');
    }
  };
  input.click();
}

export function cleanupFilesTab() {
  currentPath = '/';
}
