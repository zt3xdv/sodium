# Sodium Plugins

Sistema de plugins estilo Blueprint para Sodium.

## Estructura de Plugin

```
plugins/
├── my-plugin/
│   ├── plugin.json      # Manifest (requerido)
│   ├── index.js         # Código JS (opcional)
│   ├── assets/          # Assets estáticos
│   │   ├── style.css
│   │   └── client.js
│   └── pages/           # Templates de páginas
│       └── example.html
└── simple-plugin.js     # Plugin de un solo archivo
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
  
  "permissions": ["routes", "hooks", "ui", "websocket", "storage"],
  
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
  
  "routes": [
    {
      "method": "GET",
      "path": "/api/my-plugin/data",
      "handler": "handlers/data.js"
    }
  ],
  
  "slots": {
    "auth:login:providers": [
      {
        "html": "<button class='btn-oauth'>Login with OAuth</button>",
        "priority": 10
      }
    ],
    "dashboard:header": [
      { "html": "<div class='banner'>Welcome!</div>" }
    ]
  },
  
  "styles": ["assets/style.css"],
  "scripts": ["assets/client.js"],
  "assets": "assets",
  
  "pages": [
    {
      "path": "/my-page",
      "title": "My Page",
      "template": "pages/my-page.html"
    }
  ],
  
  "settings": {
    "schema": [
      {
        "key": "api_key",
        "type": "string",
        "label": "API Key",
        "required": false
      },
      {
        "key": "enabled",
        "type": "boolean",
        "label": "Enable Feature",
        "default": true
      }
    ]
  }
}
```

## Slots Disponibles

| Slot | Descripción |
|------|-------------|
| `auth:login:buttons` | Después del botón de login |
| `auth:login:providers` | Proveedores OAuth (Google, Discord, etc.) |
| `auth:register:buttons` | Después del botón de registro |
| `dashboard:header` | Header del dashboard |
| `dashboard:footer` | Footer del dashboard |
| `server:tabs` | Tabs adicionales en vista de servidor |
| `server:actions` | Botones de acción del servidor |
| `admin:sidebar` | Items adicionales en sidebar admin |
| `global:head` | Inyección en <head> |
| `global:body` | Inyección antes de </body> |

## API de Plugin (index.js)

```javascript
export default {
  async init(api) {
    // === INFO ===
    api.name           // Nombre del plugin
    api.version        // Versión
    api.manifest       // Manifest completo
    api.path           // Path del plugin
    
    // === HOOKS ===
    api.hook('server:ready', async (data) => {
      // Eventos: server:init, server:routes, server:ready, ws:message
    });
    
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
      // context: { user, serverData, clientWs, wingsWs }
      return { handled: true, data: ['response'] };
    });
    
    // === SIDEBAR ===
    api.sidebar({
      path: '/my-page',
      icon: 'extension',
      label: 'My Page'
    });
    
    // === UI ===
    api.ui.style('css string');
    api.ui.styleUrl('/plugins/my-plugin/style.css');
    api.ui.script('js code');
    api.ui.scriptUrl('/plugins/my-plugin/client.js');
    api.ui.slot('auth:login:providers', { html: '<button>OAuth</button>' });
    api.ui.page('/my-page', { title: 'Page', html: '<div>Content</div>' });
    api.ui.component('my-button', { html: '<button>{{label}}</button>' });
    
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
| GET | `/api/plugins/assets` | Assets del cliente |
| GET | `/api/plugins/hooks` | Hooks registrados |
| GET | `/api/plugins/:name` | Info de plugin |
| GET | `/api/plugins/:name/settings` | Settings de plugin |
| PUT | `/api/plugins/:name/settings` | Actualizar settings |
| POST | `/api/plugins/install` | Instalar plugin |
| POST | `/api/plugins/load/:name` | Cargar plugin |
| POST | `/api/plugins/unload/:name` | Descargar plugin |
| POST | `/api/plugins/reload/:name` | Recargar plugin |
| DELETE | `/api/plugins/:name` | Desinstalar plugin |
| POST | `/api/plugins/:name/package` | Empaquetar como .sodium |

## Paquetes .sodium

Los plugins se pueden distribuir como archivos `.sodium` (tar.gz):

```bash
# Crear paquete
POST /api/plugins/my-plugin/package

# Instalar desde archivo/URL
POST /api/plugins/install
{ "source": "/path/to/plugin.sodium" }
{ "source": "https://example.com/plugin.sodium" }
```

## Ejemplo: OAuth con Google

```json
{
  "id": "google-oauth",
  "name": "Google OAuth",
  "version": "1.0.0",
  
  "slots": {
    "auth:login:providers": [{
      "html": "<button class='btn-oauth btn-google' onclick='googleLogin()'><img src='/plugins/google-oauth/assets/google.svg'> Continue with Google</button>"
    }]
  },
  
  "styles": ["assets/oauth.css"],
  "scripts": ["assets/oauth.js"],
  
  "settings": {
    "schema": [
      { "key": "client_id", "type": "string", "label": "Client ID", "required": true },
      { "key": "client_secret", "type": "string", "label": "Client Secret", "required": true }
    ]
  }
}
```
