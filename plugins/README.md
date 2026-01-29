# Sodium Plugin System

Sistema de plugins completo para Sodium, inspirado en Blueprint para Pterodactyl.

## Estructura de Plugin

```
plugins/
├── my-plugin/
│   ├── plugin.json          # Manifest (requerido)
│   ├── index.js              # Código JS (opcional)
│   ├── assets/               # Assets estáticos
│   │   ├── style.css
│   │   └── client.js
│   ├── injections/           # Templates HTML para inyección
│   │   └── my-component.html
│   └── pages/                # Páginas personalizadas
│       └── example.html
└── simple-plugin.js          # Plugin single-file
```

## plugin.json

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "Plugin description",
  "author": "Your Name",
  "website": "https://example.com",
  "license": "MIT",
  
  "main": "index.js",
  
  "permissions": ["routes", "hooks", "ui", "websocket", "storage", "injections"],
  
  "sidebar": [
    {
      "path": "/my-page",
      "icon": "extension",
      "label": "My Page",
      "position": "bottom",
      "priority": 50,
      "adminOnly": false
    }
  ],
  
  "injections": [
    {
      "target": "inject-auth-login-providers",
      "file": "injections/oauth-buttons.html",
      "position": "append",
      "priority": 10
    },
    {
      "target": "inject-dashboard-header-after",
      "html": "<div class='banner'>Inline HTML injection</div>",
      "priority": 5
    }
  ],
  
  "styles": ["assets/style.css"],
  "scripts": ["assets/client.js"],
  
  "pages": [
    {
      "path": "/my-page",
      "title": "My Page",
      "template": "pages/my-page.html"
    }
  ],
  
  "settings": {
    "schema": [
      { "key": "api_key", "type": "string", "label": "API Key", "required": false },
      { "key": "enabled", "type": "boolean", "label": "Enable", "default": true }
    ]
  }
}
```

## Puntos de Inyección

Los puntos de inyección permiten añadir contenido HTML en ubicaciones específicas del UI.

### Nomenclatura de IDs

Todos los IDs siguen el patrón: `inject-{area}-{location}-{position}`

### Auth Page

| ID | Descripción |
|----|-------------|
| `inject-auth-container-before` | Antes del contenedor auth |
| `inject-auth-header-before` | Antes del header |
| `inject-auth-header-after` | Después del header |
| `inject-auth-tabs-before` | Antes de los tabs |
| `inject-auth-tabs-after` | Después de los tabs |
| `inject-auth-login-before` | Antes del form login |
| `inject-auth-login-fields-before` | Antes de campos login |
| `inject-auth-login-fields-after` | Después de campos login |
| `inject-auth-login-button-before` | Antes del botón login |
| `inject-auth-login-button-after` | Después del botón login |
| `inject-auth-login-providers` | **OAuth buttons (Google, Discord, GitHub)** |
| `inject-auth-login-after` | Después del form login |
| `inject-auth-register-before` | Antes del form registro |
| `inject-auth-register-fields-before` | Antes de campos registro |
| `inject-auth-register-fields-after` | Después de campos registro |
| `inject-auth-register-button-before` | Antes del botón registro |
| `inject-auth-register-button-after` | Después del botón registro |
| `inject-auth-register-providers` | OAuth buttons para registro |
| `inject-auth-register-after` | Después del form registro |
| `inject-auth-container-after` | Después del contenedor auth |

### Dashboard

| ID | Descripción |
|----|-------------|
| `inject-dashboard-before` | Antes del dashboard |
| `inject-dashboard-header-before` | Antes del header |
| `inject-dashboard-header-after` | Después del header (banners) |
| `inject-dashboard-stats-before` | Antes de stats |
| `inject-dashboard-stats-after` | Después de stats |
| `inject-dashboard-servers-before` | Antes de lista servers |
| `inject-dashboard-servers-after` | Después de lista servers |
| `inject-dashboard-after` | Después del dashboard |

### Server View

| ID | Descripción |
|----|-------------|
| `inject-server-header-before` | Antes del header servidor |
| `inject-server-header-info` | Info adicional en header |
| `inject-server-header-actions` | Botones de acción |
| `inject-server-header-after` | Después del header |
| `inject-server-tabs-start` | Inicio de tabs (izquierda) |
| `inject-server-tabs-end` | Final de tabs (derecha) |
| `inject-server-console-before` | Antes de consola |
| `inject-server-console-actions` | Botones en consola |
| `inject-server-console-after` | Después de consola |
| `inject-server-files-toolbar-actions` | Acciones en file manager |
| `inject-server-backups-actions` | Acciones en backups |

### Sidebar

| ID | Descripción |
|----|-------------|
| `inject-sidebar-header-before` | Antes del header sidebar |
| `inject-sidebar-header-after` | Después del header |
| `inject-sidebar-nav-start` | Inicio de navegación |
| `inject-sidebar-nav-end` | Final de navegación |
| `inject-sidebar-footer-before` | Antes del footer |
| `inject-sidebar-footer-after` | Después del footer |

### Admin

| ID | Descripción |
|----|-------------|
| `inject-admin-sidebar-items` | Items en sidebar admin |
| `inject-admin-content-before` | Antes del contenido |
| `inject-admin-content-after` | Después del contenido |
| `inject-admin-users-actions` | Acciones en usuarios |
| `inject-admin-servers-actions` | Acciones en servidores |
| `inject-admin-nodes-actions` | Acciones en nodos |

### Global

| ID | Descripción |
|----|-------------|
| `inject-global-head` | Dentro de `<head>` |
| `inject-global-body-start` | Inicio de `<body>` |
| `inject-global-body-end` | Final de `<body>` |

## API de Plugin (index.js)

```javascript
export default {
  async init(api) {
    // === INFO ===
    api.name              // Nombre del plugin
    api.version           // Versión
    api.manifest          // Manifest completo
    api.path              // Path del plugin
    
    // === HOOKS ===
    api.hook('server:ready', async (data) => {});
    // Eventos: server:init, server:routes, server:ready, ws:message
    
    // === RUTAS ===
    api.route.get('/api/my-route', (req, res) => {});
    api.route.post('/api/my-route', handler);
    api.route.put('/api/my-route', handler);
    api.route.delete('/api/my-route', handler);
    
    // === MIDDLEWARE ===
    api.middleware((req, res, next) => next());
    api.middleware('/api/path', handler);
    
    // === WEBSOCKET ===
    api.ws('custom_event', async (args, context) => {
      return { handled: true, data: ['response'] };
    });
    
    // === SIDEBAR ===
    api.sidebar({ path: '/my-page', icon: 'extension', label: 'My Page' });
    
    // === UI / INYECCIÓN ===
    api.ui.style('css string');
    api.ui.styleUrl('/plugins/my-plugin/style.css');
    api.ui.script('js code');
    api.ui.scriptUrl('/plugins/my-plugin/client.js');
    api.ui.slot('auth:login:providers', { html: '<button>OAuth</button>' });
    api.ui.page('/my-page', { title: 'Page', html: '<div>Content</div>' });
    api.ui.component('my-button', { html: '<button>{{label}}</button>' });
    
    // Inyección directa por ID
    api.ui.inject('inject-auth-login-providers', '<button>OAuth</button>', 'append', 10);
    
    // === STORAGE ===
    api.storage.set('key', value);
    api.storage.get('key');
    api.storage.delete('key');
    api.storage.getAll();
    
    // === SETTINGS ===
    api.settings.get('api_key');
    api.settings.set('api_key', 'value');
    api.settings.getAll();
    api.settings.getSchema();
    
    // === LOGGING ===
    api.log.info('message');
    api.log.warn('message');
    api.log.error('message');
    
    // === UTILS ===
    api.emit('custom:event', data);
    api.getPlugins();
    api.require('lib/helper.js');
  },
  
  async unload(api) {
    // Cleanup
  }
};
```

## API REST

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/plugins` | Lista plugins cargados |
| GET | `/api/plugins/available` | Lista plugins disponibles |
| GET | `/api/plugins/assets` | Assets del cliente (styles, scripts, injections) |
| GET | `/api/plugins/hooks` | Hooks registrados |
| GET | `/api/plugins/injection-points` | Puntos de inyección disponibles |
| GET | `/api/plugins/:name` | Info de plugin |
| GET | `/api/plugins/:name/settings` | Settings de plugin |
| PUT | `/api/plugins/:name/settings` | Actualizar settings |
| POST | `/api/plugins/install` | Instalar plugin |
| POST | `/api/plugins/load/:name` | Cargar plugin |
| POST | `/api/plugins/unload/:name` | Descargar plugin |
| POST | `/api/plugins/reload/:name` | Recargar plugin |
| DELETE | `/api/plugins/:name` | Desinstalar plugin |
| POST | `/api/plugins/:name/package` | Empaquetar como .sodium |

## Ejemplo: Plugin OAuth

```json
{
  "id": "oauth-providers",
  "name": "OAuth Providers",
  "version": "1.0.0",
  
  "injections": [
    {
      "target": "inject-auth-login-providers",
      "file": "injections/oauth-buttons.html"
    }
  ],
  
  "styles": ["assets/oauth.css"],
  "scripts": ["assets/oauth.js"],
  
  "settings": {
    "schema": [
      { "key": "google_client_id", "type": "string", "label": "Google Client ID" },
      { "key": "google_enabled", "type": "boolean", "label": "Enable Google", "default": false },
      { "key": "discord_client_id", "type": "string", "label": "Discord Client ID" },
      { "key": "discord_enabled", "type": "boolean", "label": "Enable Discord", "default": false }
    ]
  }
}
```

## Paquetes .sodium

Distribuir plugins como archivos `.sodium` (tar.gz):

```bash
# Crear paquete
POST /api/plugins/my-plugin/package

# Instalar desde archivo/URL
POST /api/plugins/install
{ "source": "/path/to/plugin.sodium" }
{ "source": "https://example.com/plugin.sodium" }
```
