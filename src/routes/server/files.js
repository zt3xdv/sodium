import * as toast from '../../utils/toast.js';
import { createEditor } from '../../utils/editor.js';
import * as modal from '../../utils/modal.js';

let currentPath = '/';
let currentServerId = null;
let isEditing = false;
let editingPath = null;
let selectedFiles = new Set();
let editorInstance = null;

const EDITABLE_EXTENSIONS = [
  'txt', 'log', 'md', 'json', 'yml', 'yaml', 'toml', 'xml',
  'js', 'ts', 'jsx', 'tsx', 'css', 'scss', 'less', 'html', 'htm',
  'php', 'py', 'rb', 'java', 'c', 'cpp', 'h', 'hpp', 'cs',
  'sh', 'bash', 'bat', 'ps1', 'cmd',
  'properties', 'cfg', 'conf', 'ini', 'env',
  'sql', 'lua', 'go', 'rs', 'swift', 'kt', 'gradle',
  'dockerfile', 'makefile', 'gitignore', 'htaccess'
];

const ARCHIVE_EXTENSIONS = ['zip', 'tar', 'tar.gz', 'tgz', 'gz', 'rar', '7z'];

function isArchive(filename) {
  const name = filename.toLowerCase();
  return ARCHIVE_EXTENSIONS.some(ext => name.endsWith('.' + ext));
}

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
            <button class="btn btn-xs btn-ghost" id="btn-refresh" title="Refresh">
              <span class="material-icons-outlined">refresh</span>
            </button>
            <button class="btn btn-xs btn-ghost" id="btn-new-folder" title="New Folder">
              <span class="material-icons-outlined">create_new_folder</span>
            </button>
            <button class="btn btn-xs btn-ghost" id="btn-new-file" title="New File">
              <span class="material-icons-outlined">note_add</span>
            </button>
            <button class="btn btn-xs btn-ghost" id="btn-upload" title="Upload">
              <span class="material-icons-outlined">upload</span>
            </button>
          </div>
        </div>
        <div class="files-selection-bar" id="files-selection-bar" style="display: none;">
          <div class="selection-info">
            <span id="selection-count">0</span> selected
          </div>
          <div class="selection-actions">
            <button class="btn btn-xs btn-ghost" id="btn-move" title="Move">
              <span class="material-icons-outlined">drive_file_move</span>
            </button>
            <button class="btn btn-xs btn-ghost" id="btn-compress" title="Compress">
              <span class="material-icons-outlined">archive</span>
            </button>
            <button class="btn btn-xs btn-ghost" id="btn-delete-selected" title="Delete">
              <span class="material-icons-outlined">delete</span>
            </button>
            <button class="btn btn-xs btn-ghost" id="btn-clear-selection" title="Clear">
              <span class="material-icons-outlined">close</span>
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
  selectedFiles.clear();
  loadFiles(serverId, currentPath);
  
  document.getElementById('btn-refresh').onclick = () => loadFiles(serverId, currentPath);
  document.getElementById('btn-new-folder').onclick = () => createNewFolder(serverId);
  document.getElementById('btn-new-file').onclick = () => createNewFile(serverId);
  document.getElementById('btn-upload').onclick = () => uploadFile(serverId);
  
  document.getElementById('btn-move').onclick = () => moveSelectedFiles(serverId);
  document.getElementById('btn-compress').onclick = () => compressSelectedFiles(serverId);
  document.getElementById('btn-delete-selected').onclick = () => deleteSelectedFiles(serverId);
  document.getElementById('btn-clear-selection').onclick = () => clearSelection();
}

function updateSelectionBar() {
  const bar = document.getElementById('files-selection-bar');
  const count = document.getElementById('selection-count');
  if (selectedFiles.size > 0) {
    bar.style.display = 'flex';
    count.textContent = selectedFiles.size;
  } else {
    bar.style.display = 'none';
  }
}

function clearSelection() {
  selectedFiles.clear();
  document.querySelectorAll('.file-item.selected').forEach(el => el.classList.remove('selected'));
  updateSelectionBar();
}

async function loadFiles(serverId, path) {
  const username = localStorage.getItem('username');
  const filesList = document.getElementById('files-list');
  
  filesList.innerHTML = '<div class="files-loading">Loading files...</div>';
  selectedFiles.clear();
  updateSelectionBar();
  
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
  
  let html = `<span class="breadcrumb-item clickable" data-path="/"><span class="material-icons-outlined" style="font-size: 16px; vertical-align: middle;">home</span></span>`;
  
  if (parts.length === 0) {
    // En home, no mostrar nada más
  } else if (parts.length === 1) {
    // home/carpeta
    html += `<span class="breadcrumb-separator">/</span>`;
    html += `<span class="breadcrumb-item" data-path="/${parts[0]}">${parts[0]}</span>`;
  } else {
    // home/.../ultima_carpeta
    const lastPath = '/' + parts.join('/');
    html += `<span class="breadcrumb-separator">/</span>`;
    html += `<span class="breadcrumb-ellipsis">...</span>`;
    html += `<span class="breadcrumb-separator">/</span>`;
    html += `<span class="breadcrumb-item" data-path="${lastPath}">${parts[parts.length - 1]}</span>`;
  }
  
  breadcrumb.innerHTML = html;
  
  breadcrumb.querySelectorAll('.breadcrumb-item.clickable').forEach(item => {
    item.onclick = () => loadFiles(serverId, item.dataset.path);
  });
}

function isDirectory(file) {
  if (typeof file.is_file === 'boolean') return !file.is_file;
  if (typeof file.is_directory === 'boolean') return file.is_directory;
  if (typeof file.directory === 'boolean') return file.directory;
  if (file.mime === 'inode/directory') return true;
  return false;
}

function renderFilesList(files, serverId) {
  const filesList = document.getElementById('files-list');
  
  if (files.length === 0) {
    filesList.innerHTML = '<div class="files-empty">This directory is empty</div>';
    return;
  }
  
  const sorted = [...files].sort((a, b) => {
    if (isDirectory(a) && !isDirectory(b)) return -1;
    if (!isDirectory(a) && isDirectory(b)) return 1;
    return a.name.localeCompare(b.name);
  });
  
  filesList.innerHTML = sorted.map(file => {
    const isDir = isDirectory(file);
    return `
    <div class="file-item ${isDir ? 'directory' : 'file'}" data-name="${file.name}" data-is-dir="${isDir}">
      <div class="file-select">
        <input type="checkbox" class="file-checkbox" data-name="${file.name}">
      </div>
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
        ${!isDir && isArchive(file.name) ? `
          <button class="btn btn-sm btn-ghost btn-decompress" title="Extract">
            <span class="material-icons-outlined">unarchive</span>
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
  
  filesList.querySelectorAll('.file-checkbox').forEach(checkbox => {
    checkbox.onclick = (e) => {
      e.stopPropagation();
      const name = checkbox.dataset.name;
      const item = checkbox.closest('.file-item');
      if (checkbox.checked) {
        selectedFiles.add(name);
        item.classList.add('selected');
      } else {
        selectedFiles.delete(name);
        item.classList.remove('selected');
      }
      updateSelectionBar();
    };
  });
  
  filesList.querySelectorAll('.file-item.directory .file-info').forEach(info => {
    info.onclick = () => {
      const item = info.closest('.file-item');
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
  
  filesList.querySelectorAll('.file-item .btn-decompress').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const name = btn.closest('.file-item').dataset.name;
      showDecompressDialog(serverId, name);
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
  const name = await modal.prompt('Enter folder name:', { title: 'New Folder', placeholder: 'folder-name' });
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
      toast.error(data.error || 'Failed to create folder');
    }
  } catch (e) {
    toast.error('Failed to create folder');
  }
}

async function createNewFile(serverId) {
  const name = await modal.prompt('Enter file name:', { title: 'New File', placeholder: 'file.txt' });
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
      toast.error(data.error || 'Failed to create file');
    }
  } catch (e) {
    toast.error('Failed to create file');
  }
}

async function deleteFile(serverId, path) {
  const confirmed = await modal.confirm(`Are you sure you want to delete "${path.split('/').pop()}"?`, { 
    title: 'Delete File', 
    confirmText: 'Delete', 
    danger: true 
  });
  if (!confirmed) return;
  
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
      toast.error(data.error || 'Failed to delete');
    }
  } catch (e) {
    toast.error('Failed to delete');
  }
}

async function deleteSelectedFiles(serverId) {
  if (selectedFiles.size === 0) return;
  
  const confirmed = await modal.confirm(`Are you sure you want to delete ${selectedFiles.size} file(s)?`, {
    title: 'Delete Files',
    confirmText: 'Delete All',
    danger: true
  });
  if (!confirmed) return;
  
  const username = localStorage.getItem('username');
  const files = Array.from(selectedFiles);
  
  try {
    const res = await fetch(`/api/servers/${serverId}/files/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, root: currentPath, files })
    });
    
    if (res.ok) {
      clearSelection();
      loadFiles(serverId, currentPath);
    } else {
      const data = await res.json();
      toast.error(data.error || 'Failed to delete');
    }
  } catch (e) {
    toast.error('Failed to delete');
  }
}

async function renameFile(serverId, oldName) {
  const newName = await modal.prompt('Enter new name:', { 
    title: 'Rename', 
    defaultValue: oldName,
    confirmText: 'Rename'
  });
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
      toast.error(data.error || 'Failed to rename');
    }
  } catch (e) {
    toast.error('Failed to rename');
  }
}

async function moveSelectedFiles(serverId) {
  if (selectedFiles.size === 0) return;
  
  const destination = await modal.prompt('Enter destination path:', {
    title: 'Move Files',
    defaultValue: currentPath,
    placeholder: '/path/to/folder',
    confirmText: 'Move'
  });
  if (!destination || destination === currentPath) return;
  
  const username = localStorage.getItem('username');
  const files = Array.from(selectedFiles).map(name => ({
    from: name,
    to: `${destination.replace(/\/$/, '')}/${name}`.replace(/^\/+/, '')
  }));
  
  try {
    const res = await fetch(`/api/servers/${serverId}/files/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, root: currentPath, files })
    });
    
    if (res.ok) {
      toast.success('Files moved');
      clearSelection();
      loadFiles(serverId, currentPath);
    } else {
      const data = await res.json();
      toast.error(data.error || 'Failed to move');
    }
  } catch (e) {
    toast.error('Failed to move');
  }
}

async function compressSelectedFiles(serverId) {
  if (selectedFiles.size === 0) return;
  
  const username = localStorage.getItem('username');
  const files = Array.from(selectedFiles);
  
  toast.info('Compressing...');
  
  try {
    const res = await fetch(`/api/servers/${serverId}/files/compress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, root: currentPath, files })
    });
    
    if (res.ok) {
      toast.success('Compressed successfully');
      clearSelection();
      loadFiles(serverId, currentPath);
    } else {
      const data = await res.json();
      toast.error(data.error || 'Failed to compress');
    }
  } catch (e) {
    toast.error('Failed to compress');
  }
}

function showDecompressDialog(serverId, filename) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>Extract ${filename}</h3>
        <button class="btn btn-ghost btn-sm modal-close">
          <span class="material-icons-outlined">close</span>
        </button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Extract to:</label>
          <div class="radio-group">
            <label class="radio-label">
              <input type="radio" name="extract-location" value="here" checked>
              Current folder
            </label>
            <label class="radio-label">
              <input type="radio" name="extract-location" value="folder">
              New folder (${filename.replace(/\.(zip|tar|tar\.gz|tgz|gz|rar|7z)$/i, '')})
            </label>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="btn-cancel-extract">Cancel</button>
        <button class="btn btn-primary" id="btn-confirm-extract">Extract</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  const close = () => modal.remove();
  modal.querySelector('.modal-close').onclick = close;
  modal.querySelector('#btn-cancel-extract').onclick = close;
  modal.onclick = (e) => { if (e.target === modal) close(); };
  
  modal.querySelector('#btn-confirm-extract').onclick = async () => {
    const extractHere = modal.querySelector('input[name="extract-location"]:checked').value === 'here';
    close();
    
    if (!extractHere) {
      const folderName = filename.replace(/\.(zip|tar|tar\.gz|tgz|gz|rar|7z)$/i, '');
      const folderPath = currentPath === '/' ? `/${folderName}` : `${currentPath}/${folderName}`;
      
      const username = localStorage.getItem('username');
      await fetch(`/api/servers/${serverId}/files/folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, path: folderPath })
      });
      
      await decompressFile(serverId, filename, currentPath, folderPath);
    } else {
      await decompressFile(serverId, filename, currentPath, currentPath);
    }
  };
}

async function decompressFile(serverId, filename, archiveDir, extractTo) {
  const username = localStorage.getItem('username');
  
  toast.info('Extracting...');
  
  try {
    const res = await fetch(`/api/servers/${serverId}/files/decompress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        username, 
        root: archiveDir,
        file: filename,
        extractTo: extractTo
      })
    });
    
    if (res.ok) {
      toast.success('Extracted successfully');
      loadFiles(serverId, currentPath);
    } else {
      const data = await res.json();
      toast.error(data.error || 'Failed to extract');
    }
  } catch (e) {
    toast.error('Failed to extract');
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
      toast.error(data.error);
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
        <div class="editor-content" id="editor-container"></div>
      </div>
    `;
    
    if (editorInstance) {
      editorInstance.destroy();
    }
    
    const editorContainer = document.getElementById('editor-container');
    editorInstance = createEditor(
      editorContainer,
      data.content || '',
      filename,
      () => saveFile(serverId, path)
    );
    
    document.getElementById('btn-back').onclick = () => {
      if (editorInstance) {
        editorInstance.destroy();
        editorInstance = null;
      }
      isEditing = false;
      editingPath = null;
      restoreFilesList(serverId);
    };
    
    document.getElementById('btn-save').onclick = () => saveFile(serverId, path);
    
  } catch (e) {
    console.error('Failed to load file:', e);
    toast.error('Failed to load file');
    loadFiles(serverId, currentPath);
  }
}

async function saveFile(serverId, path) {
  const username = localStorage.getItem('username');
  const content = editorInstance ? editorInstance.getValue() : '';
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
      toast.error(data.error || 'Failed to save');
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<span class="material-icons-outlined">save</span> Save';
    }
  } catch (e) {
    toast.error('Failed to save file');
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
    
    const indicator = showUploadIndicator(file.name);
    
    try {
      const res = await fetch(`/api/servers/${serverId}/files/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, path: currentPath })
      });
      
      const data = await res.json();
      if (!res.ok || !data.url) {
        indicator.remove();
        toast.error(data.error || 'Failed to get upload URL');
        return;
      }
      
      const uploadPath = currentPath === '/' ? '' : currentPath.replace(/^\//, '');
      const uploadUrl = `${data.url}&directory=${encodeURIComponent(uploadPath)}`;
      
      const formData = new FormData();
      formData.append('files', file);
      
      const xhr = new XMLHttpRequest();
      xhr.open('POST', uploadUrl);
      
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          indicator.update(percent);
        }
      };
      
      xhr.onload = () => {
        indicator.remove();
        if (xhr.status >= 200 && xhr.status < 300) {
          toast.success('File uploaded');
          loadFiles(serverId, currentPath);
        } else {
          toast.error('Failed to upload file');
        }
      };
      
      xhr.onerror = () => {
        indicator.remove();
        toast.error('Failed to upload');
      };
      
      xhr.send(formData);
    } catch (e) {
      indicator.remove();
      toast.error('Failed to upload');
    }
  };
  input.click();
}

function showUploadIndicator(filename) {
  const filesList = document.getElementById('files-list');
  
  const el = document.createElement('div');
  el.className = 'file-item upload-indicator';
  el.innerHTML = `
    <div class="file-select"></div>
    <div class="file-icon">
      <span class="material-icons-outlined rotating">sync</span>
    </div>
    <div class="file-info">
      <span class="file-name">${filename}</span>
      <div class="upload-progress">
        <div class="upload-progress-bar" style="width: 0%"></div>
      </div>
      <span class="file-meta upload-percent">Uploading... 0%</span>
    </div>
  `;
  
  filesList.insertBefore(el, filesList.firstChild);
  
  return {
    update: (percent) => {
      const bar = el.querySelector('.upload-progress-bar');
      const text = el.querySelector('.upload-percent');
      if (bar) bar.style.width = `${percent}%`;
      if (text) text.textContent = `Uploading... ${percent}%`;
    },
    remove: () => el.remove()
  };
}

function restoreFilesList(serverId) {
  const container = document.querySelector('.files-tab .card');
  container.innerHTML = `
    <div class="files-toolbar">
      <div class="files-breadcrumb" id="files-breadcrumb">
        <span class="breadcrumb-item" data-path="/">/</span>
      </div>
      <div class="files-actions">
        <button class="btn btn-xs btn-ghost" id="btn-refresh" title="Refresh">
          <span class="material-icons-outlined">refresh</span>
        </button>
        <button class="btn btn-xs btn-ghost" id="btn-new-folder" title="New Folder">
          <span class="material-icons-outlined">create_new_folder</span>
        </button>
        <button class="btn btn-xs btn-ghost" id="btn-new-file" title="New File">
          <span class="material-icons-outlined">note_add</span>
        </button>
        <button class="btn btn-xs btn-ghost" id="btn-upload" title="Upload">
          <span class="material-icons-outlined">upload</span>
        </button>
      </div>
    </div>
    <div class="files-selection-bar" id="files-selection-bar" style="display: none;">
      <div class="selection-info">
        <span id="selection-count">0</span> selected
      </div>
      <div class="selection-actions">
        <button class="btn btn-xs btn-ghost" id="btn-move" title="Move">
          <span class="material-icons-outlined">drive_file_move</span>
        </button>
        <button class="btn btn-xs btn-ghost" id="btn-compress" title="Compress">
          <span class="material-icons-outlined">archive</span>
        </button>
        <button class="btn btn-xs btn-ghost" id="btn-delete-selected" title="Delete">
          <span class="material-icons-outlined">delete</span>
        </button>
        <button class="btn btn-xs btn-ghost" id="btn-clear-selection" title="Clear">
          <span class="material-icons-outlined">close</span>
        </button>
      </div>
    </div>
    <div class="files-list" id="files-list">
      <div class="files-loading">Loading files...</div>
    </div>
  `;
  
  document.getElementById('btn-refresh').onclick = () => loadFiles(serverId, currentPath);
  document.getElementById('btn-new-folder').onclick = () => createNewFolder(serverId);
  document.getElementById('btn-new-file').onclick = () => createNewFile(serverId);
  document.getElementById('btn-upload').onclick = () => uploadFile(serverId);
  document.getElementById('btn-move').onclick = () => moveSelectedFiles(serverId);
  document.getElementById('btn-compress').onclick = () => compressSelectedFiles(serverId);
  document.getElementById('btn-delete-selected').onclick = () => deleteSelectedFiles(serverId);
  document.getElementById('btn-clear-selection').onclick = () => clearSelection();
  
  loadFiles(serverId, currentPath);
}

export function cleanupFilesTab() {
  currentPath = '/';
  selectedFiles.clear();
  if (editorInstance) {
    editorInstance.destroy();
    editorInstance = null;
  }
}
