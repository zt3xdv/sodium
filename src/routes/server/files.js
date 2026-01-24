import { renderNav } from '../../components/nav.js';
import { renderServerSidebar } from '../../components/sidebar.js';
import { icon } from '../../components/icon.js';
import { api } from '../../utils/api.js';
import { toast } from '../../components/toast.js';
import { formatBytes, formatDate } from '../../utils/format.js';
import { openModal, closeModal, confirmModal } from '../../components/modal.js';

export default function(params) {
  const serverId = params.id;
  
  return `
    ${renderNav()}
    <div class="server-layout">
      ${renderServerSidebar(serverId, 'files')}
      <main class="server-content">
        <div class="file-manager" id="file-manager">
          <div class="file-toolbar">
            <div class="breadcrumb" id="breadcrumb">
              <span class="breadcrumb-item" data-path="/">/home/container</span>
            </div>
            <div class="file-search">
              <input type="text" id="search-input" class="input input-sm" placeholder="Search files...">
              <button class="btn btn-ghost btn-sm" id="btn-clear-search">${icon('x', 14)}</button>
            </div>
            <div class="file-actions">
              <div class="view-toggle">
                <button class="btn btn-ghost btn-sm active" id="btn-view-list" title="List View">
                  ${icon('list', 16)}
                </button>
                <button class="btn btn-ghost btn-sm" id="btn-view-grid" title="Grid View">
                  ${icon('grid', 16)}
                </button>
              </div>
              <button class="btn btn-ghost" id="btn-refresh" title="Refresh">
                ${icon('refresh', 18)}
              </button>
              <button class="btn btn-ghost" id="btn-new-file" title="New File">
                ${icon('file-plus', 18)}
              </button>
              <button class="btn btn-ghost" id="btn-new-folder" title="New Folder">
                ${icon('folder-plus', 18)}
              </button>
              <button class="btn btn-primary" id="btn-upload">
                ${icon('upload', 18)} Upload
              </button>
              <input type="file" id="file-upload-input" multiple hidden>
            </div>
          </div>

          <div class="bulk-actions" id="bulk-actions" style="display:none">
            <span class="bulk-count"><span id="bulk-count">0</span> selected</span>
            <button class="btn btn-ghost btn-sm" id="bulk-download">${icon('download', 16)} Download</button>
            <button class="btn btn-ghost btn-sm" id="bulk-compress">${icon('archive', 16)} Compress</button>
            <button class="btn btn-ghost btn-sm" id="bulk-move">${icon('move', 16)} Move</button>
            <button class="btn btn-ghost btn-sm" id="bulk-copy">${icon('copy', 16)} Copy</button>
            <button class="btn btn-danger btn-sm" id="bulk-delete">${icon('trash', 16)} Delete</button>
            <button class="btn btn-ghost btn-sm" id="bulk-clear">${icon('x', 16)}</button>
          </div>

          <div class="clipboard-indicator" id="clipboard-indicator" style="display:none">
            <span id="clipboard-info"></span>
            <button class="btn btn-primary btn-sm" id="clipboard-paste">${icon('clipboard', 14)} Paste</button>
            <button class="btn btn-ghost btn-sm" id="clipboard-clear">${icon('x', 14)}</button>
          </div>

          <div class="file-list-container" id="file-list-container">
            <div class="drop-zone" id="drop-zone">
              <div class="drop-zone-content">
                ${icon('upload-cloud', 48)}
                <p>Drop files here to upload</p>
              </div>
            </div>
            <table class="file-table" id="file-table">
              <thead>
                <tr>
                  <th class="col-checkbox"><input type="checkbox" id="select-all"></th>
                  <th class="col-name">Name</th>
                  <th class="col-size">Size</th>
                  <th class="col-modified">Modified</th>
                  <th class="col-actions"></th>
                </tr>
              </thead>
              <tbody id="file-list">
                <tr><td colspan="5" class="loading">Loading...</td></tr>
              </tbody>
            </table>
            <div class="file-grid" id="file-grid" style="display:none"></div>
          </div>

          <div class="file-status" id="file-status">
            <span id="selection-info"></span>
            <span id="usage-info"></span>
          </div>
        </div>

        <div class="context-menu" id="context-menu" style="display:none">
          <div class="context-item" data-action="open">${icon('folder-open', 16)} Open</div>
          <div class="context-item" data-action="edit">${icon('edit-2', 16)} Edit</div>
          <div class="context-divider"></div>
          <div class="context-item" data-action="download">${icon('download', 16)} Download</div>
          <div class="context-item" data-action="rename">${icon('type', 16)} Rename</div>
          <div class="context-divider"></div>
          <div class="context-item" data-action="copy">${icon('copy', 16)} Copy</div>
          <div class="context-item" data-action="cut">${icon('scissors', 16)} Cut</div>
          <div class="context-item" data-action="paste">${icon('clipboard', 16)} Paste</div>
          <div class="context-divider"></div>
          <div class="context-item" data-action="compress">${icon('archive', 16)} Compress</div>
          <div class="context-item" data-action="decompress">${icon('package', 16)} Extract</div>
          <div class="context-divider"></div>
          <div class="context-item danger" data-action="delete">${icon('trash', 16)} Delete</div>
        </div>

        <div class="upload-overlay" id="upload-overlay" style="display:none">
          <div class="upload-modal">
            <h3>Uploading Files</h3>
            <div class="upload-list" id="upload-list"></div>
            <div class="upload-progress">
              <div class="upload-bar" id="upload-bar" style="width:0%"></div>
            </div>
            <div class="upload-info" id="upload-info">Preparing...</div>
            <button class="btn btn-ghost" id="upload-cancel">Cancel</button>
          </div>
        </div>
      </main>
    </div>
  `;
}

export async function mount(params) {
  const serverId = params.id;
  const fileManager = document.getElementById('file-manager');
  const fileList = document.getElementById('file-list');
  const fileGrid = document.getElementById('file-grid');
  const fileTable = document.getElementById('file-table');
  const breadcrumb = document.getElementById('breadcrumb');
  const uploadInput = document.getElementById('file-upload-input');
  const contextMenu = document.getElementById('context-menu');
  const bulkActions = document.getElementById('bulk-actions');
  const clipboardIndicator = document.getElementById('clipboard-indicator');
  const dropZone = document.getElementById('drop-zone');
  const searchInput = document.getElementById('search-input');
  
  let currentPath = '/';
  let files = [];
  let filteredFiles = [];
  let selectedFiles = new Set();
  let clipboard = { files: [], mode: null, sourcePath: '' };
  let viewMode = 'list';
  let contextTarget = null;

  const fileIcons = {
    folder: 'folder',
    js: 'file-code', ts: 'file-code', json: 'file-code', yml: 'file-code', yaml: 'file-code',
    properties: 'settings', cfg: 'settings', conf: 'settings', ini: 'settings',
    txt: 'file-text', log: 'file-text', md: 'file-text', readme: 'file-text',
    jar: 'package', war: 'package',
    zip: 'archive', tar: 'archive', gz: 'archive', rar: 'archive', '7z': 'archive',
    png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image',
    mp3: 'music', wav: 'music', ogg: 'music', flac: 'music',
    mp4: 'video', avi: 'video', mkv: 'video', mov: 'video',
    sh: 'terminal', bash: 'terminal', bat: 'terminal', cmd: 'terminal',
    default: 'file'
  };

  const archiveExts = ['zip', 'tar', 'gz', 'tar.gz', 'tgz', 'rar', '7z'];

  function getFileIcon(file) {
    if (file.is_directory) return fileIcons.folder;
    const ext = file.name.split('.').pop().toLowerCase();
    return fileIcons[ext] || fileIcons.default;
  }

  function isArchive(name) {
    const ext = name.split('.').pop().toLowerCase();
    return archiveExts.includes(ext);
  }

  function buildPath(...parts) {
    return parts.filter(Boolean).join('/').replace(/\/+/g, '/').replace(/^(?!\/)/, '/');
  }

  async function loadFiles(path = '/') {
    currentPath = path;
    fileList.innerHTML = '<tr><td colspan="5" class="loading">Loading...</td></tr>';
    selectedFiles.clear();
    updateBulkActions();

    try {
      const res = await api.get(`/servers/${serverId}/files/list?path=${encodeURIComponent(path)}`);
      files = res.data || [];
      filteredFiles = [...files];
      renderFiles();
      renderBreadcrumb();
      loadUsage();
    } catch (err) {
      toast.error('Failed to load files');
      fileList.innerHTML = '<tr><td colspan="5" class="empty">Failed to load files</td></tr>';
    }
  }

  async function loadUsage() {
    try {
      const res = await api.get(`/servers/${serverId}/files/usage`);
      document.getElementById('usage-info').textContent = `Used: ${formatBytes(res.used)}`;
    } catch {}
  }

  function renderFiles() {
    const sorted = [...filteredFiles].sort((a, b) => {
      if (a.is_directory !== b.is_directory) return b.is_directory - a.is_directory;
      return a.name.localeCompare(b.name);
    });

    if (sorted.length === 0) {
      fileList.innerHTML = '<tr><td colspan="5" class="empty">This folder is empty</td></tr>';
      fileGrid.innerHTML = '<div class="empty-grid">This folder is empty</div>';
      updateSelectionInfo();
      return;
    }

    if (viewMode === 'list') {
      fileList.innerHTML = sorted.map(file => `
        <tr class="file-row ${selectedFiles.has(file.name) ? 'selected' : ''}" data-name="${escapeHtml(file.name)}" data-dir="${file.is_directory}">
          <td class="col-checkbox">
            <input type="checkbox" class="file-checkbox" ${selectedFiles.has(file.name) ? 'checked' : ''}>
          </td>
          <td class="col-name">
            <span class="file-icon">${icon(getFileIcon(file), 18)}</span>
            <span class="file-name">${escapeHtml(file.name)}</span>
          </td>
          <td class="col-size">${file.is_directory ? '—' : formatBytes(file.size)}</td>
          <td class="col-modified">${formatDate(file.modified)}</td>
          <td class="col-actions">
            <button class="btn btn-ghost btn-sm action-btn" data-action="rename" title="Rename">
              ${icon('edit', 14)}
            </button>
            ${!file.is_directory ? `
              <button class="btn btn-ghost btn-sm action-btn" data-action="download" title="Download">
                ${icon('download', 14)}
              </button>
            ` : ''}
            ${isArchive(file.name) ? `
              <button class="btn btn-ghost btn-sm action-btn" data-action="decompress" title="Extract">
                ${icon('package', 14)}
              </button>
            ` : ''}
            <button class="btn btn-ghost btn-sm action-btn" data-action="delete" title="Delete">
              ${icon('trash', 14)}
            </button>
          </td>
        </tr>
      `).join('');
    } else {
      fileGrid.innerHTML = sorted.map(file => `
        <div class="file-grid-item ${selectedFiles.has(file.name) ? 'selected' : ''}" data-name="${escapeHtml(file.name)}" data-dir="${file.is_directory}">
          <input type="checkbox" class="file-checkbox" ${selectedFiles.has(file.name) ? 'checked' : ''}>
          <div class="file-grid-icon">${icon(getFileIcon(file), 40)}</div>
          <div class="file-grid-name">${escapeHtml(file.name)}</div>
        </div>
      `).join('');
    }

    attachFileListeners();
    updateSelectionInfo();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderBreadcrumb() {
    const parts = currentPath.split('/').filter(Boolean);
    let path = '';
    
    breadcrumb.innerHTML = `
      <span class="breadcrumb-item" data-path="/">${icon('home', 16)}</span>
      ${parts.map(part => {
        path += '/' + part;
        return `<span class="breadcrumb-sep">/</span><span class="breadcrumb-item" data-path="${path}">${escapeHtml(part)}</span>`;
      }).join('')}
    `;

    breadcrumb.querySelectorAll('.breadcrumb-item').forEach(item => {
      item.addEventListener('click', () => loadFiles(item.dataset.path));
    });
  }

  function attachFileListeners() {
    const rows = viewMode === 'list' 
      ? document.querySelectorAll('.file-row')
      : document.querySelectorAll('.file-grid-item');

    rows.forEach(row => {
      row.addEventListener('dblclick', () => handleOpen(row.dataset.name, row.dataset.dir === 'true'));
      row.addEventListener('contextmenu', (e) => showContextMenu(e, row.dataset.name, row.dataset.dir === 'true'));

      row.querySelector('.file-checkbox').addEventListener('change', (e) => {
        e.stopPropagation();
        toggleSelection(row.dataset.name, e.target.checked);
        row.classList.toggle('selected', e.target.checked);
      });

      row.querySelectorAll?.('.action-btn')?.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          handleAction(btn.dataset.action, row.dataset.name, row.dataset.dir === 'true');
        });
      });
    });
  }

  function toggleSelection(name, selected) {
    if (selected) {
      selectedFiles.add(name);
    } else {
      selectedFiles.delete(name);
    }
    updateBulkActions();
    updateSelectionInfo();
  }

  function updateBulkActions() {
    const count = selectedFiles.size;
    bulkActions.style.display = count > 0 ? 'flex' : 'none';
    document.getElementById('bulk-count').textContent = count;
  }

  function updateSelectionInfo() {
    const info = document.getElementById('selection-info');
    info.textContent = selectedFiles.size > 0 
      ? `${selectedFiles.size} of ${files.length} selected`
      : `${files.length} items`;
  }

  function handleOpen(name, isDir) {
    if (isDir) {
      loadFiles(buildPath(currentPath, name));
    } else if (isArchive(name)) {
      decompressFile(name);
    } else {
      editFile(name);
    }
  }

  function handleAction(action, name, isDir) {
    switch(action) {
      case 'open': handleOpen(name, isDir); break;
      case 'edit': editFile(name); break;
      case 'rename': renameFile(name); break;
      case 'download': downloadFile(name); break;
      case 'delete': deleteFile(name); break;
      case 'copy': copyToClipboard([name], 'copy'); break;
      case 'cut': copyToClipboard([name], 'cut'); break;
      case 'compress': compressFiles([name]); break;
      case 'decompress': decompressFile(name); break;
    }
  }

  function showContextMenu(e, name, isDir) {
    e.preventDefault();
    contextTarget = { name, isDir };

    const items = contextMenu.querySelectorAll('.context-item');
    items.forEach(item => {
      const action = item.dataset.action;
      if (action === 'edit' && isDir) item.style.display = 'none';
      else if (action === 'download' && isDir) item.style.display = 'none';
      else if (action === 'decompress' && !isArchive(name)) item.style.display = 'none';
      else if (action === 'paste' && clipboard.files.length === 0) item.style.display = 'none';
      else item.style.display = 'flex';
    });

    contextMenu.style.display = 'block';
    contextMenu.style.left = `${Math.min(e.clientX, window.innerWidth - 200)}px`;
    contextMenu.style.top = `${Math.min(e.clientY, window.innerHeight - 300)}px`;
  }

  function hideContextMenu() {
    contextMenu.style.display = 'none';
    contextTarget = null;
  }

  async function editFile(name) {
    const filePath = buildPath(currentPath, name);
    try {
      const res = await api.get(`/servers/${serverId}/files/read?path=${encodeURIComponent(filePath)}`);
      
      openModal({
        title: `Edit: ${name}`,
        content: `<textarea id="file-editor" class="file-editor">${escapeHtml(res.content || '')}</textarea>`,
        size: 'large',
        actions: [
          { label: 'Cancel', class: 'btn-ghost', action: closeModal },
          { label: 'Save', class: 'btn-primary', action: async () => {
            const content = document.getElementById('file-editor').value;
            try {
              await api.post(`/servers/${serverId}/files/write`, { path: filePath, content });
              toast.success('File saved');
              closeModal();
            } catch {
              toast.error('Failed to save file');
            }
          }}
        ]
      });
    } catch {
      toast.error('Failed to read file');
    }
  }

  async function renameFile(name) {
    openModal({
      title: 'Rename',
      content: `<input type="text" id="new-name" class="input" value="${escapeHtml(name)}">`,
      actions: [
        { label: 'Cancel', class: 'btn-ghost', action: closeModal },
        { label: 'Rename', class: 'btn-primary', action: async () => {
          const newName = document.getElementById('new-name').value.trim();
          if (!newName || newName === name) return closeModal();
          
          try {
            await api.post(`/servers/${serverId}/files/rename`, {
              from: buildPath(currentPath, name),
              to: buildPath(currentPath, newName)
            });
            toast.success('Renamed');
            closeModal();
            loadFiles(currentPath);
          } catch {
            toast.error('Failed to rename');
          }
        }}
      ]
    });
  }

  async function deleteFile(name) {
    const confirmed = await confirmModal('Delete', `Delete "${name}"?`);
    if (!confirmed) return;

    try {
      await api.delete(`/servers/${serverId}/files/delete?path=${encodeURIComponent(buildPath(currentPath, name))}`);
      toast.success('Deleted');
      loadFiles(currentPath);
    } catch {
      toast.error('Failed to delete');
    }
  }

  function downloadFile(name) {
    const token = localStorage.getItem('token');
    const path = buildPath(currentPath, name);
    window.open(`/api/servers/${serverId}/files/download?path=${encodeURIComponent(path)}&token=${token}`, '_blank');
  }

  function copyToClipboard(names, mode) {
    clipboard = {
      files: names.map(n => buildPath(currentPath, n)),
      mode,
      sourcePath: currentPath
    };
    updateClipboardIndicator();
    toast.info(`${names.length} item(s) ${mode === 'copy' ? 'copied' : 'cut'}`);
  }

  function updateClipboardIndicator() {
    if (clipboard.files.length > 0) {
      clipboardIndicator.style.display = 'flex';
      document.getElementById('clipboard-info').textContent = 
        `${clipboard.files.length} item(s) ${clipboard.mode === 'copy' ? 'copied' : 'cut'}`;
      clipboardIndicator.className = `clipboard-indicator ${clipboard.mode}`;
    } else {
      clipboardIndicator.style.display = 'none';
    }
  }

  async function pasteFromClipboard() {
    if (clipboard.files.length === 0) return;

    try {
      if (clipboard.mode === 'copy') {
        for (const srcPath of clipboard.files) {
          const fileName = srcPath.split('/').pop();
          await api.post(`/servers/${serverId}/files/copy`, {
            from: srcPath,
            to: buildPath(currentPath, fileName)
          });
        }
      } else {
        await api.post(`/servers/${serverId}/files/bulk-move`, {
          paths: clipboard.files,
          destination: currentPath
        });
        clipboard = { files: [], mode: null, sourcePath: '' };
        updateClipboardIndicator();
      }
      toast.success('Pasted');
      loadFiles(currentPath);
    } catch {
      toast.error('Failed to paste');
    }
  }

  async function compressFiles(names) {
    const paths = names.map(n => buildPath(currentPath, n));
    const defaultName = names.length === 1 ? `${names[0]}.zip` : 'archive.zip';

    openModal({
      title: 'Compress Files',
      content: `<input type="text" id="archive-name" class="input" value="${defaultName}" placeholder="archive.zip">`,
      actions: [
        { label: 'Cancel', class: 'btn-ghost', action: closeModal },
        { label: 'Compress', class: 'btn-primary', action: async () => {
          const archiveName = document.getElementById('archive-name').value.trim() || defaultName;
          try {
            await api.post(`/servers/${serverId}/files/compress`, {
              paths,
              destination: buildPath(currentPath, archiveName)
            });
            toast.success('Compressed');
            closeModal();
            loadFiles(currentPath);
          } catch {
            toast.error('Failed to compress');
          }
        }}
      ]
    });
  }

  async function decompressFile(name) {
    const filePath = buildPath(currentPath, name);
    const folderName = name.replace(/\.(zip|tar|gz|tar\.gz|tgz)$/i, '');

    openModal({
      title: 'Extract Archive',
      content: `
        <p>Extract to:</p>
        <input type="text" id="extract-path" class="input" value="${currentPath}" placeholder="Destination path">
      `,
      actions: [
        { label: 'Cancel', class: 'btn-ghost', action: closeModal },
        { label: 'Extract', class: 'btn-primary', action: async () => {
          const dest = document.getElementById('extract-path').value.trim() || currentPath;
          try {
            await api.post(`/servers/${serverId}/files/decompress`, {
              path: filePath,
              destination: dest
            });
            toast.success('Extracted');
            closeModal();
            loadFiles(currentPath);
          } catch {
            toast.error('Failed to extract');
          }
        }}
      ]
    });
  }

  async function bulkDelete() {
    const count = selectedFiles.size;
    const confirmed = await confirmModal('Delete', `Delete ${count} item(s)?`);
    if (!confirmed) return;

    try {
      await api.post(`/servers/${serverId}/files/bulk-delete`, {
        paths: [...selectedFiles].map(n => buildPath(currentPath, n))
      });
      toast.success(`Deleted ${count} items`);
      loadFiles(currentPath);
    } catch {
      toast.error('Failed to delete');
    }
  }

  async function bulkMove() {
    openModal({
      title: 'Move Files',
      content: `<input type="text" id="move-dest" class="input" value="${currentPath}" placeholder="Destination path">`,
      actions: [
        { label: 'Cancel', class: 'btn-ghost', action: closeModal },
        { label: 'Move', class: 'btn-primary', action: async () => {
          const dest = document.getElementById('move-dest').value.trim();
          if (!dest) return;
          try {
            await api.post(`/servers/${serverId}/files/bulk-move`, {
              paths: [...selectedFiles].map(n => buildPath(currentPath, n)),
              destination: dest
            });
            toast.success('Moved');
            closeModal();
            loadFiles(currentPath);
          } catch {
            toast.error('Failed to move');
          }
        }}
      ]
    });
  }

  async function uploadFiles(filesList) {
    const overlay = document.getElementById('upload-overlay');
    const uploadList = document.getElementById('upload-list');
    const uploadBar = document.getElementById('upload-bar');
    const uploadInfo = document.getElementById('upload-info');

    overlay.style.display = 'flex';
    uploadList.innerHTML = [...filesList].map(f => `<div class="upload-file">${escapeHtml(f.name)}</div>`).join('');

    const formData = new FormData();
    for (const file of filesList) {
      formData.append('files', file);
    }
    formData.append('path', currentPath);

    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/servers/${serverId}/files/upload`);
      xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('token')}`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          uploadBar.style.width = `${pct}%`;
          uploadInfo.textContent = `${formatBytes(e.loaded)} / ${formatBytes(e.total)}`;
        }
      };

      xhr.onload = () => {
        overlay.style.display = 'none';
        if (xhr.status >= 200 && xhr.status < 300) {
          toast.success('Upload complete');
          loadFiles(currentPath);
        } else {
          toast.error('Upload failed');
        }
      };

      xhr.onerror = () => {
        overlay.style.display = 'none';
        toast.error('Upload failed');
      };

      document.getElementById('upload-cancel').onclick = () => {
        xhr.abort();
        overlay.style.display = 'none';
        toast.info('Upload cancelled');
      };

      xhr.send(formData);
    } catch {
      overlay.style.display = 'none';
      toast.error('Upload failed');
    }
  }

  function filterFiles(query) {
    if (!query) {
      filteredFiles = [...files];
    } else {
      const q = query.toLowerCase();
      filteredFiles = files.filter(f => f.name.toLowerCase().includes(q));
    }
    renderFiles();
  }

  function setViewMode(mode) {
    viewMode = mode;
    document.getElementById('btn-view-list').classList.toggle('active', mode === 'list');
    document.getElementById('btn-view-grid').classList.toggle('active', mode === 'grid');
    fileTable.style.display = mode === 'list' ? 'table' : 'none';
    fileGrid.style.display = mode === 'grid' ? 'grid' : 'none';
    renderFiles();
  }

  // Event Listeners
  document.getElementById('btn-refresh').addEventListener('click', () => loadFiles(currentPath));
  document.getElementById('btn-view-list').addEventListener('click', () => setViewMode('list'));
  document.getElementById('btn-view-grid').addEventListener('click', () => setViewMode('grid'));

  document.getElementById('btn-new-file').addEventListener('click', () => {
    openModal({
      title: 'New File',
      content: '<input type="text" id="new-file-name" class="input" placeholder="filename.txt">',
      actions: [
        { label: 'Cancel', class: 'btn-ghost', action: closeModal },
        { label: 'Create', class: 'btn-primary', action: async () => {
          const name = document.getElementById('new-file-name').value.trim();
          if (!name) return;
          try {
            await api.post(`/servers/${serverId}/files/write`, { 
              path: buildPath(currentPath, name), 
              content: '' 
            });
            toast.success('File created');
            closeModal();
            loadFiles(currentPath);
          } catch {
            toast.error('Failed to create file');
          }
        }}
      ]
    });
  });

  document.getElementById('btn-new-folder').addEventListener('click', () => {
    openModal({
      title: 'New Folder',
      content: '<input type="text" id="new-folder-name" class="input" placeholder="folder-name">',
      actions: [
        { label: 'Cancel', class: 'btn-ghost', action: closeModal },
        { label: 'Create', class: 'btn-primary', action: async () => {
          const name = document.getElementById('new-folder-name').value.trim();
          if (!name) return;
          try {
            await api.post(`/servers/${serverId}/files/mkdir`, { path: buildPath(currentPath, name) });
            toast.success('Folder created');
            closeModal();
            loadFiles(currentPath);
          } catch {
            toast.error('Failed to create folder');
          }
        }}
      ]
    });
  });

  document.getElementById('btn-upload').addEventListener('click', () => uploadInput.click());
  uploadInput.addEventListener('change', (e) => {
    if (e.target.files.length) uploadFiles(e.target.files);
    e.target.value = '';
  });

  document.getElementById('select-all').addEventListener('change', (e) => {
    if (e.target.checked) {
      files.forEach(f => selectedFiles.add(f.name));
    } else {
      selectedFiles.clear();
    }
    renderFiles();
  });

  // Bulk actions
  document.getElementById('bulk-delete').addEventListener('click', bulkDelete);
  document.getElementById('bulk-move').addEventListener('click', bulkMove);
  document.getElementById('bulk-copy').addEventListener('click', () => copyToClipboard([...selectedFiles], 'copy'));
  document.getElementById('bulk-compress').addEventListener('click', () => compressFiles([...selectedFiles]));
  document.getElementById('bulk-download').addEventListener('click', () => {
    if (selectedFiles.size === 1) {
      downloadFile([...selectedFiles][0]);
    } else {
      compressFiles([...selectedFiles]);
    }
  });
  document.getElementById('bulk-clear').addEventListener('click', () => {
    selectedFiles.clear();
    renderFiles();
    updateBulkActions();
  });

  // Clipboard
  document.getElementById('clipboard-paste').addEventListener('click', pasteFromClipboard);
  document.getElementById('clipboard-clear').addEventListener('click', () => {
    clipboard = { files: [], mode: null, sourcePath: '' };
    updateClipboardIndicator();
  });

  // Context menu
  contextMenu.querySelectorAll('.context-item').forEach(item => {
    item.addEventListener('click', () => {
      if (contextTarget) {
        handleAction(item.dataset.action, contextTarget.name, contextTarget.isDir);
      } else if (item.dataset.action === 'paste') {
        pasteFromClipboard();
      }
      hideContextMenu();
    });
  });

  document.addEventListener('click', hideContextMenu);
  document.addEventListener('contextmenu', (e) => {
    if (!e.target.closest('.file-row') && !e.target.closest('.file-grid-item')) {
      hideContextMenu();
    }
  });

  // Search
  searchInput.addEventListener('input', (e) => filterFiles(e.target.value));
  document.getElementById('btn-clear-search').addEventListener('click', () => {
    searchInput.value = '';
    filterFiles('');
  });

  // Drag & Drop
  const container = document.getElementById('file-list-container');
  
  container.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dropZone.classList.add('active');
  });

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  container.addEventListener('dragleave', (e) => {
    if (!container.contains(e.relatedTarget)) {
      dropZone.classList.remove('active');
    }
  });

  container.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('active');
    if (e.dataTransfer.files.length) {
      uploadFiles(e.dataTransfer.files);
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'c' && selectedFiles.size > 0) {
        e.preventDefault();
        copyToClipboard([...selectedFiles], 'copy');
      } else if (e.key === 'x' && selectedFiles.size > 0) {
        e.preventDefault();
        copyToClipboard([...selectedFiles], 'cut');
      } else if (e.key === 'v' && clipboard.files.length > 0) {
        e.preventDefault();
        pasteFromClipboard();
      } else if (e.key === 'a') {
        e.preventDefault();
        files.forEach(f => selectedFiles.add(f.name));
        renderFiles();
        updateBulkActions();
      }
    } else if (e.key === 'Delete' && selectedFiles.size > 0) {
      bulkDelete();
    } else if (e.key === 'F2' && selectedFiles.size === 1) {
      renameFile([...selectedFiles][0]);
    }
  });

  await loadFiles('/');
}
