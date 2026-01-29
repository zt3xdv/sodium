# Sodium Plugins

Place your plugins in this directory. Plugins can be:
- A folder with `index.js` and optional `plugin.json`
- A single `.js` file

## Plugin Structure

```
plugins/
├── my-plugin/
│   ├── plugin.json    # Optional manifest
│   └── index.js       # Required entry point
└── simple-plugin.js   # Single file plugin
```

## plugin.json

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "My awesome plugin",
  "author": "Your Name"
}
```

## Plugin API

```javascript
export default {
  async init(api) {
    // api.name - Plugin name
    // api.version - Plugin version
    
    // === HOOKS ===
    api.hook('event:name', async (data) => {
      // Modify and return data, or just observe
      return data;
    }, priority); // Lower priority runs first
    
    // Available hooks:
    // - server:init      - Server initializing
    // - server:routes    - Routes registered
    // - server:ready     - Server started
    // - ws:message       - WebSocket message (return { blocked: true } to block)
    
    // === ROUTES ===
    api.route.get('/api/my-route', handler, [middlewares]);
    api.route.post('/api/my-route', handler);
    api.route.put('/api/my-route', handler);
    api.route.patch('/api/my-route', handler);
    api.route.delete('/api/my-route', handler);
    
    // === MIDDLEWARE ===
    api.middleware((req, res, next) => { next(); });
    api.middleware('/api/path', handler);
    
    // === WEBSOCKET ===
    api.ws('event_name', async (args, context) => {
      // context: { user, serverData, clientWs, wingsWs }
      return { handled: true, data: ['response'] };
    });
    
    // === STORAGE ===
    api.storage.set('key', value);
    api.storage.get('key');
    api.storage.delete('key');
    
    // === LOGGING ===
    api.log.info('message');
    api.log.warn('message');
    api.log.error('message');
    
    // === UTILITIES ===
    api.emit('custom:event', data);  // Trigger custom hooks
    api.getPlugins();                // List loaded plugins
    api.override('target', fn);      // Override functions
    api.wrap(originalFn, beforeFn, afterFn); // Wrap functions
  },
  
  async unload() {
    // Cleanup when plugin is unloaded
  }
};
```

## API Endpoints

- `GET /api/plugins` - List loaded plugins (admin)
- `GET /api/plugins/available` - List available plugins (admin)
- `POST /api/plugins/load/:name` - Load a plugin (admin)
- `POST /api/plugins/unload/:name` - Unload a plugin (admin)
- `POST /api/plugins/reload/:name` - Reload a plugin (admin)
- `GET /api/plugins/hooks` - List registered hooks (admin)

## Example Plugin

See `example-plugin/` for a complete example.
