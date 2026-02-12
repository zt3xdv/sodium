# File Manager v2

> A modern, full-featured file manager for game servers with drag & drop, bulk operations, image preview, and multi-file upload.

---

## Current State

### What exists today

**Backend** (`src/server/routes/servers.js` lines 664-870):
- List directory, create folder, write file, delete, rename, compress, decompress, copy, chmod, download, upload
- All proxied to Wings daemon API via `wingsRequest()`
- Permission checks per operation (`file.read`, `file.create`, `file.update`, `file.delete`, `file.archive`)

**Frontend** (`src/routes/server/files.js`, ~1168 lines):
- Directory listing with breadcrumbs
- Single file upload with XHR progress bar
- CodeMirror editor for text files
- Compress/decompress with WebSocket progress
- Multi-select with bulk delete, move, compress
- File type detection by MIME + extension fallback
- Context menu (right-click) on files

### What's missing
- Drag & drop upload (files and folders)
- Multi-file upload
- Image/media preview
- Drag & drop to move files between folders
- Copy/paste keyboard shortcuts
- Search/filter files
- File size limits and validation
- Grid/list view toggle
- Sort by name/size/date
- Folder size calculation
- Clipboard (cut/copy/paste between directories)

---

## Plan

### Phase 1 - Multi-file & Drag-Drop Upload

**Backend changes** (`src/server/routes/servers.js`):
- No backend changes needed - Wings already accepts multi-file FormData uploads
- Add `POST /:id/files/upload-url` that returns a signed URL for chunked uploads (large files)

**Frontend changes** (`src/routes/server/files.js`):

```js
// Drop zone overlay on the file list area
function initDragDrop(serverId) {
  const filesList = document.getElementById('files-list');

  filesList.addEventListener('dragover', (e) => {
    e.preventDefault();
    filesList.classList.add('drag-over');
  });

  filesList.addEventListener('dragleave', () => {
    filesList.classList.remove('drag-over');
  });

  filesList.addEventListener('drop', async (e) => {
    e.preventDefault();
    filesList.classList.remove('drag-over');

    const items = e.dataTransfer.items;
    const files = [];

    for (const item of items) {
      if (item.webkitGetAsEntry) {
        const entry = item.webkitGetAsEntry();
        await traverseEntry(entry, '', files);
      } else {
        files.push({ file: item.getAsFile(), path: '' });
      }
    }

    uploadMultipleFiles(serverId, files);
  });
}

// Traverse folder entries recursively
async function traverseEntry(entry, basePath, files) {
  if (entry.isFile) {
    const file = await new Promise(r => entry.file(r));
    files.push({ file, path: basePath });
  } else if (entry.isDirectory) {
    const reader = entry.createDirectoryReader();
    const entries = await new Promise(r => reader.readEntries(r));
    for (const child of entries) {
      await traverseEntry(child, `${basePath}/${entry.name}`, files);
    }
  }
}
```

Upload queue with concurrent uploads (max 3):

```js
async function uploadMultipleFiles(serverId, fileList) {
  const queue = [...fileList];
  const MAX_CONCURRENT = 3;
  const active = new Set();
  const indicators = new Map();

  for (const item of fileList) {
    indicators.set(item, showUploadIndicator(item.file.name));
  }

  async function processNext() {
    if (queue.length === 0) return;
    const item = queue.shift();
    active.add(item);

    try {
      await uploadSingleFile(serverId, item.file, item.path, indicators.get(item));
    } finally {
      active.delete(item);
      indicators.get(item).remove();
      processNext();
    }
  }

  const initial = queue.splice(0, MAX_CONCURRENT);
  await Promise.all(initial.map(item => {
    queue.unshift(item); // put back for processNext
    return processNext();
  }));

  loadFiles(serverId, currentPath);
}
```

### Phase 2 - File Preview

Support preview for common file types without opening the editor:

| Type | Preview method |
|---|---|
| Images (png, jpg, gif, webp, svg) | `<img>` tag with Wings download URL |
| Video (mp4, webm) | `<video>` player |
| Audio (mp3, ogg, wav) | `<audio>` player |
| PDF | `<iframe>` or `<embed>` |
| Markdown | Rendered HTML preview |
| Text/Code | Existing CodeMirror editor (read-only mode) |

**Backend**: Add `GET /:id/files/preview` endpoint that returns a temporary signed URL for direct file access from the browser (bypasses proxy for large media files).

```js
router.get('/:id/files/preview', authenticateUser, async (req, res) => {
  const { path } = req.query;
  const result = await getServerAndNode(req.params.id, req.user, 'file.read');
  if (result.error) return res.status(result.status).json({ error: result.error });
  const { server, node } = result;

  const token = jwt.sign({
    server_uuid: server.uuid,
    file: path,
    exp: Math.floor(Date.now() / 1000) + 300
  }, node.daemon_token);

  const previewUrl = `${node.scheme}://${node.fqdn}:${node.daemon_port}/download/file?token=${token}`;
  res.json({ url: previewUrl });
});
```

**Frontend**: Preview modal component:

```js
function openPreview(serverId, file) {
  const mime = file.mimetype || '';

  if (mime.startsWith('image/')) {
    modal.show({
      title: file.name,
      content: `<img src="${previewUrl}" class="file-preview-image" />`,
      size: 'large'
    });
  } else if (mime.startsWith('video/')) {
    modal.show({
      title: file.name,
      content: `<video src="${previewUrl}" controls class="file-preview-video"></video>`,
      size: 'large'
    });
  }
  // ... audio, pdf, markdown
}
```

### Phase 3 - Clipboard & Keyboard Shortcuts

Internal clipboard for cut/copy/paste between directories:

```js
const clipboard = {
  files: [],      // Array of { name, path }
  operation: null, // 'copy' | 'cut'
  serverId: null
};

function initKeyboardShortcuts(serverId) {
  document.addEventListener('keydown', (e) => {
    if (isEditing) return;

    // Ctrl+C - copy selected
    if (e.ctrlKey && e.key === 'c') {
      clipboard.files = [...selectedFiles];
      clipboard.operation = 'copy';
      clipboard.serverId = serverId;
      toast.info(`${clipboard.files.length} file(s) copied`);
    }

    // Ctrl+X - cut selected
    if (e.ctrlKey && e.key === 'x') {
      clipboard.files = [...selectedFiles];
      clipboard.operation = 'cut';
      clipboard.serverId = serverId;
      toast.info(`${clipboard.files.length} file(s) cut`);
    }

    // Ctrl+V - paste
    if (e.ctrlKey && e.key === 'v' && clipboard.files.length > 0) {
      pasteFiles(serverId, currentPath);
    }

    // Delete key
    if (e.key === 'Delete' && selectedFiles.size > 0) {
      deleteSelectedFiles(serverId);
    }

    // Ctrl+A - select all
    if (e.ctrlKey && e.key === 'a') {
      e.preventDefault();
      selectAll();
    }

    // F2 - rename
    if (e.key === 'F2' && selectedFiles.size === 1) {
      renameFile(serverId, [...selectedFiles][0]);
    }
  });
}
```

### Phase 4 - Search, Sort & View Modes

**Search**: Client-side filter on current directory + server-side recursive search:

```js
// Backend: new endpoint
router.get('/:id/files/search', authenticateUser, async (req, res) => {
  const { query, directory } = req.query;
  // Use Wings pull endpoint to get file tree, filter matches
  // Return flat list of matching paths
});
```

**Sort**:

```js
function sortFiles(files, sortBy = 'name', order = 'asc') {
  const dirs = files.filter(f => f.is_directory);
  const fileList = files.filter(f => !f.is_directory);

  const sorter = (a, b) => {
    let cmp;
    switch (sortBy) {
      case 'name': cmp = a.name.localeCompare(b.name); break;
      case 'size': cmp = (a.size || 0) - (b.size || 0); break;
      case 'modified': cmp = new Date(a.modified_at) - new Date(b.modified_at); break;
      default: cmp = 0;
    }
    return order === 'desc' ? -cmp : cmp;
  };

  return [...dirs.sort(sorter), ...fileList.sort(sorter)];
}
```

**View modes**: Toggle between list view (current) and grid view (thumbnails for images, icons for others).

### Phase 5 - UI Improvements

| Feature | Description |
|---|---|
| Drag to move | Drag files onto folders to move them |
| Breadcrumb dropdown | Click breadcrumb segment to see sibling dirs |
| File info panel | Right sidebar showing file details, permissions, modified date |
| Inline rename | Click file name to rename in-place (not modal) |
| Empty state | Better empty directory message with quick actions |
| Path input | Click breadcrumb bar to type a path directly |
| Right-click context menu | Copy path, open in new tab, download, permissions |

---

## New Backend Endpoints Summary

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/:id/files/preview` | Signed URL for media preview |
| `GET` | `/:id/files/search` | Recursive file search |
| `GET` | `/:id/files/stat` | File metadata (size, permissions, dates) |
| `POST` | `/:id/files/paste` | Server-side copy/move between directories |

All existing endpoints remain unchanged.

---

## Implementation Order

1. Multi-file upload + drag & drop (highest user impact)
2. Image/media preview modal
3. Search bar + sort controls
4. Clipboard (cut/copy/paste) + keyboard shortcuts
5. Grid view toggle
6. Drag to move between folders
7. File info panel + inline rename
