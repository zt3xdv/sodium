import { api, getToken } from '../../utils/api.js';
import * as toast from '../../utils/toast.js';
import { createEditor } from '../../utils/editor.js';
import * as modal from '../../utils/modal.js';

let currentPath = '/';
let currentServerId = null;
let progressSocket = null;
let activeProgressIndicators = new Map();
let isEditing = false;
let editingPath = null;
let selectedFiles = new Set();
let editorInstance = null;

const EDITABLE_MIMETYPES = [
  'text/', 'application/json', 'application/xml', 'application/javascript',
  'application/x-yaml', 'application/toml', 'application/x-sh',
  'application/x-httpd-php', 'application/sql', 'application/x-lua',
  'inode/x-empty'
];

const ARCHIVE_MIMETYPES = [
  'application/zip', 'application/x-tar', 'application/gzip', 
  'application/x-gzip', 'application/x-rar', 'application/x-7z-compressed',
  'application/x-compressed-tar', 'application/x-bzip2'
];

function connectProgressSocket(serverId) {
  if (progressSocket && progressSocket.readyState === WebSocket.OPEN) {
    return;
  }
  
  const token = getToken();
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${window.location.host}/ws/console?server=${serverId}&token=${encodeURIComponent(token)}`;
  
  progressSocket = new WebSocket(wsUrl);
  
  progressSocket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      handleProgressEvent(message);
    } catch (e) {
      // Ignore parse errors
    }
  };
  
  progressSocket.onerror = () => {
    // Silent fail - will use fallback
  };
}

function handleProgressEvent(message) {
  const { event, args } = message;
  
  if (!args || !args[0]) return;
  const data = args[0];
  
  switch (event) {
    case 'compress progress': {
      const indicator = activeProgressIndicators.get('compress');
      if (indicator) {
        indicator.update(data.percent, `${data.processed_files}/${data.total_files} files`);
        indicator.hasProgress = true;
      }
      break;
    }
    
    case 'compress completed': {
      const indicator = activeProgressIndicators.get('compress');
      if (indicator) {
        indicator.complete(data.success, data.error);
        activeProgressIndicators.delete('compress');
      }
      break;
    }
    
    case 'decompress progress': {
      const indicator = activeProgressIndicators.get('decompress');
      if (indicator) {
        indicator.update(data.percent, data.current_file ? data.current_file.split('/').pop() : '');
        indicator.hasProgress = true;
      }
      break;
    }
    
    case 'decompress completed': {
      const indicator = activeProgressIndicators.get('decompress');
      if (indicator) {
        indicator.complete(data.success, data.error);
        activeProgressIndicators.delete('decompress');
      }
      break;
    }
  }
}

function showCompressIndicator() {
  const filesList = document.getElementById('files-list');
  
  const el = document.createElement('div');
  el.className = 'file-item compress-indicator';
  el.innerHTML = `
    <div class="file-select"></div>
    <div class="file-icon">
      <span class="material-icons-outlined rotating">archive</span>
    </div>
    <div class="file-info">
      <span class="file-name">Compressing files...</span>
      <div class="upload-progress">
        <div class="upload-progress-bar" style="width: 0%"></div>
      </div>
      <span class="file-meta compress-percent">Preparing...</span>
    </div>
  `;
  
  filesList.insertBefore(el, filesList.firstChild);
  
  return {
    hasProgress: false,
    update: (percent, detail) => {
      const bar = el.querySelector('.upload-progress-bar');
      const text = el.querySelector('.compress-percent');
      if (bar) bar.style.width = `${percent}%`;
      if (text) text.textContent = detail ? `Compressing... ${percent}% - ${detail}` : `Compressing... ${percent}%`;
    },
    complete: (success, error) => {
      el.remove();
      if (success) {
        toast.success('Compressed successfully');
        loadFiles(currentServerId, currentPath);
      } else {
        toast.error(error || 'Failed to compress');
      }
    },
    remove: () => el.remove()
  };
}

function showDecompressIndicator(filename) {
  const filesList = document.getElementById('files-list');
  
  const el = document.createElement('div');
  el.className = 'file-item decompress-indicator';
  el.innerHTML = `
    <div class="file-select"></div>
    <div class="file-icon">
      <span class="material-icons-outlined rotating">unarchive</span>
    </div>
    <div class="file-info">
      <span class="file-name">Extracting ${filename}...</span>
      <div class="upload-progress">
        <div class="upload-progress-bar" style="width: 0%"></div>
      </div>
      <span class="file-meta decompress-percent">Preparing...</span>
    </div>
  `;
  
  filesList.insertBefore(el, filesList.firstChild);
  
  return {
    hasProgress: false,
    update: (percent, currentFile) => {
      const bar = el.querySelector('.upload-progress-bar');
      const text = el.querySelector('.decompress-percent');
      if (bar) bar.style.width = `${percent}%`;
      if (text) text.textContent = currentFile ? `Extracting... ${percent}% - ${currentFile}` : `Extracting... ${percent}%`;
    },
    complete: (success, error) => {
      el.remove();
      if (success) {
        toast.success('Extracted successfully');
        loadFiles(currentServerId, currentPath);
      } else {
        toast.error(error || 'Failed to extract');
      }
    },
    remove: () => el.remove()
  };
}

function isArchive(file) {
  const mime = (file.mimetype || file.mime || '').toLowerCase();
  
  // Si hay mimetype, usarlo como fuente de verdad
  if (mime) {
    // Si es texto o editable, NO es archivo comprimido aunque tenga extensión .zip
    if (mime.startsWith('text/') || mime === 'application/json' || mime === 'application/javascript') {
      return false;
    }
    if (ARCHIVE_MIMETYPES.some(m => mime.includes(m.replace('application/', '')))) return true;
  }
  
  // Fallback a extensión solo si no hay mimetype
  if (!mime) {
    const name = file.name.toLowerCase();
    return name.endsWith('.zip') || name.endsWith('.tar') || name.endsWith('.tar.gz') || 
           name.endsWith('.tgz') || name.endsWith('.gz') || name.endsWith('.rar') || name.endsWith('.7z');
  }
  
  return false;
}

function isEditable(file) {
  const mime = (file.mimetype || file.mime || '').toLowerCase();
  
  // Si hay mimetype, usarlo como fuente de verdad
  if (mime) {
    // Es editable si es texto o tipos conocidos de texto
    if (EDITABLE_MIMETYPES.some(m => mime.startsWith(m))) return true;
    if (mime === 'inode/x-empty') return true;
    
    // NO es editable si es binario/comprimido aunque tenga extensión .txt
    if (ARCHIVE_MIMETYPES.some(m => mime.includes(m.replace('application/', '')))) return false;
    if (mime.startsWith('image/') || mime.startsWith('video/') || mime.startsWith('audio/')) return false;
    if (mime === 'application/octet-stream') return false;
  }
  
  // Fallback a extensión si no hay mimetype o es desconocido
  const ext = file.name.split('.').pop().toLowerCase();
  const textExts = ['txt', 'log', 'md', 'json', 'yml', 'yaml', 'toml', 'xml', 'js', 'ts', 'jsx', 'tsx', 
    'css', 'scss', 'less', 'html', 'htm', 'php', 'py', 'rb', 'java', 'c', 'cpp', 'h', 'hpp', 'cs',
    'sh', 'bash', 'bat', 'ps1', 'cmd', 'properties', 'cfg', 'conf', 'ini', 'env', 'sql', 'lua', 
    'go', 'rs', 'swift', 'kt', 'gradle'];
  return textExts.includes(ext) || !file.name.includes('.');
}

function getFileIcon(file) {
  const mime = (file.mimetype || file.mime || '').toLowerCase();
  const ext = file.name.split('.').pop().toLowerCase();
  
  if (mime.startsWith('text/')) {
    if (mime.includes('html')) return 'html';
    if (mime.includes('css')) return 'css';
    if (mime.includes('javascript')) return 'javascript';
    return 'description';
  }
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'movie';
  if (mime.startsWith('audio/')) return 'audio_file';
  if (mime === 'application/json') return 'data_object';
  if (mime === 'application/pdf') return 'picture_as_pdf';
  if (mime === 'application/zip' || mime.includes('compressed') || mime.includes('tar') || mime.includes('gzip')) return 'folder_zip';
  if (mime === 'application/java-archive') return 'inventory_2';
  if (mime === 'application/x-sh' || mime === 'application/x-shellscript') return 'terminal';
  if (mime.includes('xml') || mime.includes('yaml')) return 'settings';
  
  const icons = {
    'js': 'javascript', 'ts': 'javascript', 'json': 'data_object',
    'html': 'html', 'css': 'css', 'scss': 'css',
    'md': 'description', 'txt': 'description', 'log': 'description',
    'yml': 'settings', 'yaml': 'settings', 'toml': 'settings',
    'properties': 'settings', 'cfg': 'settings', 'conf': 'settings',
    'jar': 'inventory_2', 'zip': 'folder_zip', 'tar': 'folder_zip', 'gz': 'folder_zip',
    'png': 'image', 'jpg': 'image', 'jpeg': 'image', 'gif': 'image', 'svg': 'image',
    'sh': 'terminal', 'bat': 'terminal', 'ps1': 'terminal',
    'pdf': 'picture_as_pdf', 'mp3': 'audio_file', 'mp4': 'movie', 'avi': 'movie'
  };
  return icons[ext] || 'insert_drive_file';
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
    const res = await api(`/api/servers/${serverId}/files/list?path=${encodeURIComponent(path)}`);
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
        <span class="material-icons-outlined">${isDir ? 'folder' : getFileIcon(file)}</span>
      </div>
      <div class="file-info">
        <span class="file-name">${file.name}</span>
        <span class="file-meta">${isDir ? '--' : formatBytes(file.size)} • ${formatDate(file.modified_at)}</span>
      </div>
      <div class="file-actions">
        ${!isDir && isEditable(file) ? `
          <button class="btn btn-sm btn-ghost btn-edit" title="Edit">
            <span class="material-icons-outlined">edit</span>
          </button>
        ` : ''}
        ${!isDir && isArchive(file) ? `
          <button class="btn btn-sm btn-ghost btn-decompress" title="Extract">
            <span class="material-icons-outlined">unarchive</span>
          </button>
        ` : ''}
        ${!isDir ? `
          <button class="btn btn-sm btn-ghost btn-download" title="Download">
            <span class="material-icons-outlined">download</span>
          </button>
          <button class="btn btn-sm btn-ghost btn-copy" title="Copy">
            <span class="material-icons-outlined">content_copy</span>
          </button>
        ` : ''}
        <button class="btn btn-sm btn-ghost btn-chmod" title="Permissions">
          <span class="material-icons-outlined">lock</span>
        </button>
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
  
  filesList.querySelectorAll('.file-item .btn-copy').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const name = btn.closest('.file-item').dataset.name;
      copyFile(serverId, currentPath === '/' ? `/${name}` : `${currentPath}/${name}`);
    };
  });
  
  filesList.querySelectorAll('.file-item .btn-chmod').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const item = btn.closest('.file-item');
      const name = item.dataset.name;
      chmodFile(serverId, name);
    };
  });
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
    const res = await api(`/api/servers/${serverId}/files/folder`, {
      method: 'POST',
      
      body: JSON.stringify({ path })
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
    const res = await api(`/api/servers/${serverId}/files/write`, {
      method: 'POST',
      
      body: JSON.stringify({ path, content: '' })
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
    const res = await api(`/api/servers/${serverId}/files/delete`, {
      method: 'POST',
      
      body: JSON.stringify({ path })
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
    const res = await api(`/api/servers/${serverId}/files/delete`, {
      method: 'POST',
      
      body: JSON.stringify({ root: currentPath, files })
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
  
  const from = currentPath === '/' ? `/${oldName}` : `${currentPath}/${oldName}`;
  const to = currentPath === '/' ? `/${newName}` : `${currentPath}/${newName}`;
  
  try {
    const res = await api(`/api/servers/${serverId}/files/rename`, {
      method: 'POST',
      body: JSON.stringify({ from, to })
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

async function copyFile(serverId, location) {
  try {
    const res = await api(`/api/servers/${serverId}/files/copy`, {
      method: 'POST',
      body: JSON.stringify({ location })
    });
    
    if (res.ok) {
      toast.success('File copied');
      loadFiles(serverId, currentPath);
    } else {
      const data = await res.json();
      toast.error(data.error || 'Failed to copy');
    }
  } catch (e) {
    toast.error('Failed to copy file');
  }
}

async function chmodFile(serverId, name) {
  const mode = await modal.prompt('Enter permissions (e.g. 755, 644):', {
    title: 'Change Permissions',
    placeholder: '755',
    confirmText: 'Apply'
  });
  if (!mode) return;
  
  if (!/^[0-7]{3,4}$/.test(mode)) {
    toast.error('Invalid permission format');
    return;
  }
  
  try {
    const res = await api(`/api/servers/${serverId}/files/chmod`, {
      method: 'POST',
      body: JSON.stringify({
        root: currentPath,
        files: [{ file: name, mode }]
      })
    });
    
    if (res.ok) {
      toast.success('Permissions updated');
    } else {
      const data = await res.json();
      toast.error(data.error || 'Failed to change permissions');
    }
  } catch (e) {
    toast.error('Failed to change permissions');
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
    const res = await api(`/api/servers/${serverId}/files/rename`, {
      method: 'POST',
      
      body: JSON.stringify({ root: currentPath, files })
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
  
  const files = Array.from(selectedFiles);
  
  connectProgressSocket(serverId);
  
  const indicator = showCompressIndicator();
  activeProgressIndicators.set('compress', indicator);
  clearSelection();
  
  try {
    const res = await api(`/api/servers/${serverId}/files/compress`, {
      method: 'POST',
      body: JSON.stringify({ root: currentPath, files })
    });
    
    // If we received progress events, the completion is handled by WebSocket
    if (indicator.hasProgress) {
      return;
    }
    
    // Fallback for Wings without progress API
    activeProgressIndicators.delete('compress');
    indicator.remove();
    
    if (res.ok) {
      toast.success('Compressed successfully');
      loadFiles(serverId, currentPath);
    } else {
      const data = await res.json();
      toast.error(data.error || 'Failed to compress');
    }
  } catch (e) {
    activeProgressIndicators.delete('compress');
    indicator.remove();
    toast.error('Failed to compress');
  }
}

function showDecompressDialog(serverId, filename) {
  const folderName = filename.replace(/\.(zip|tar|tar\.gz|tgz|gz|rar|7z)$/i, '');
  
  modal.confirm(`Extract "${filename}" to current folder?`, {
    title: 'Extract Archive',
    confirmText: 'Extract Here',
    cancelText: 'New Folder'
  }).then(async (extractHere) => {
    if (extractHere === null) return;
    
    if (!extractHere) {
      const folderPath = currentPath === '/' ? `/${folderName}` : `${currentPath}/${folderName}`;
      const username = localStorage.getItem('username');
      
      await api(`/api/servers/${serverId}/files/folder`, {
        method: 'POST',
        
        body: JSON.stringify({ path: folderPath })
      });
      
      await decompressFile(serverId, filename, currentPath, folderPath);
    } else {
      await decompressFile(serverId, filename, currentPath, currentPath);
    }
  });
}

async function decompressFile(serverId, filename, archiveDir, extractTo) {
  connectProgressSocket(serverId);
  
  const indicator = showDecompressIndicator(filename);
  activeProgressIndicators.set('decompress', indicator);
  
  try {
    const res = await api(`/api/servers/${serverId}/files/decompress`, {
      method: 'POST',
      body: JSON.stringify({ 
        root: archiveDir,
        file: filename,
        extractTo: extractTo
      })
    });
    
    // If we received progress events, the completion is handled by WebSocket
    if (indicator.hasProgress) {
      return;
    }
    
    // Fallback for Wings without progress API
    activeProgressIndicators.delete('decompress');
    indicator.remove();
    
    if (res.ok) {
      toast.success('Extracted successfully');
      loadFiles(serverId, currentPath);
    } else {
      const data = await res.json();
      toast.error(data.error || 'Failed to extract');
    }
  } catch (e) {
    activeProgressIndicators.delete('decompress');
    indicator.remove();
    toast.error('Failed to extract');
  }
}

async function editFile(serverId, path) {
  const username = localStorage.getItem('username');
  const filesList = document.getElementById('files-list');
  const filename = path.split('/').pop();
  
  filesList.innerHTML = '<div class="files-loading">Loading file...</div>';
  
  try {
    const res = await api(`/api/servers/${serverId}/files/contents?path=${encodeURIComponent(path)}`);
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
    const res = await api(`/api/servers/${serverId}/files/write`, {
      method: 'POST',
      
      body: JSON.stringify({ path, content })
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
  window.open(`/api/servers/${serverId}/files/download?path=${encodeURIComponent(path)}`);
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
      const res = await api(`/api/servers/${serverId}/files/upload`, {
        method: 'POST',
        
        body: JSON.stringify({ path: currentPath })
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
  activeProgressIndicators.clear();
  if (progressSocket) {
    progressSocket.close();
    progressSocket = null;
  }
  if (editorInstance) {
    editorInstance.destroy();
    editorInstance = null;
  }
}
