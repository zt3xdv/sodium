import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGINS_DIR = path.join(__dirname, '../../../plugins');

class PluginManager {
  constructor() {
    this.plugins = new Map();
    this.hooks = new Map();
    this.routes = [];
    this.middlewares = [];
    this.wsHandlers = new Map();
    this.overrides = new Map();
    this.app = null;
  }

  setApp(app) {
    this.app = app;
  }

  registerHook(event, callback, priority = 10) {
    if (!this.hooks.has(event)) {
      this.hooks.set(event, []);
    }
    this.hooks.get(event).push({ callback, priority });
    this.hooks.get(event).sort((a, b) => a.priority - b.priority);
  }

  async executeHook(event, data) {
    const handlers = this.hooks.get(event) || [];
    let result = data;
    
    for (const handler of handlers) {
      try {
        const hookResult = await handler.callback(result);
        if (hookResult !== undefined) {
          result = hookResult;
        }
      } catch (err) {
        logger.error(`Plugin hook error [${event}]: ${err.message}`);
      }
    }
    
    return result;
  }

  registerRoute(method, path, handler, middleware = []) {
    this.routes.push({ method, path, handler, middleware });
    
    if (this.app) {
      const fullMiddleware = [...middleware, handler];
      this.app[method.toLowerCase()](path, ...fullMiddleware);
    }
  }

  registerMiddleware(path, handler) {
    this.middlewares.push({ path, handler });
    
    if (this.app) {
      if (path) {
        this.app.use(path, handler);
      } else {
        this.app.use(handler);
      }
    }
  }

  registerWebSocketHandler(event, handler) {
    if (!this.wsHandlers.has(event)) {
      this.wsHandlers.set(event, []);
    }
    this.wsHandlers.get(event).push(handler);
  }

  async handleWebSocketEvent(event, args, context) {
    const handlers = this.wsHandlers.get(event) || [];
    let result = { handled: false, data: args };
    
    for (const handler of handlers) {
      try {
        const handlerResult = await handler(args, context);
        if (handlerResult?.handled) {
          result = handlerResult;
          break;
        }
      } catch (err) {
        logger.error(`Plugin WS handler error [${event}]: ${err.message}`);
      }
    }
    
    return result;
  }

  override(target, replacement) {
    this.overrides.set(target, replacement);
  }

  getOverride(target) {
    return this.overrides.get(target);
  }

  hasOverride(target) {
    return this.overrides.has(target);
  }

  wrapFunction(original, before, after) {
    return async function(...args) {
      let modifiedArgs = args;
      
      if (before) {
        const beforeResult = await before(...args);
        if (beforeResult !== undefined) {
          modifiedArgs = Array.isArray(beforeResult) ? beforeResult : [beforeResult];
        }
      }
      
      let result = await original.apply(this, modifiedArgs);
      
      if (after) {
        const afterResult = await after(result, ...modifiedArgs);
        if (afterResult !== undefined) {
          result = afterResult;
        }
      }
      
      return result;
    };
  }

  async loadPlugins() {
    if (!fs.existsSync(PLUGINS_DIR)) {
      fs.mkdirSync(PLUGINS_DIR, { recursive: true });
      return;
    }

    const entries = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await this.loadPlugin(path.join(PLUGINS_DIR, entry.name));
      } else if (entry.name.endsWith('.js')) {
        await this.loadPluginFile(path.join(PLUGINS_DIR, entry.name));
      }
    }
  }

  async loadPlugin(pluginPath) {
    const manifestPath = path.join(pluginPath, 'plugin.json');
    const indexPath = path.join(pluginPath, 'index.js');
    
    if (!fs.existsSync(indexPath)) {
      logger.warn(`Plugin missing index.js: ${pluginPath}`);
      return;
    }

    let manifest = { name: path.basename(pluginPath), version: '1.0.0' };
    if (fs.existsSync(manifestPath)) {
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      } catch (err) {
        logger.warn(`Invalid plugin manifest: ${manifestPath}`);
      }
    }

    await this.loadPluginModule(indexPath, manifest);
  }

  async loadPluginFile(filePath) {
    const name = path.basename(filePath, '.js');
    const manifest = { name, version: '1.0.0' };
    await this.loadPluginModule(filePath, manifest);
  }

  async loadPluginModule(modulePath, manifest) {
    try {
      const pluginModule = await import(`file://${modulePath}`);
      const plugin = pluginModule.default || pluginModule;
      
      if (typeof plugin.init === 'function') {
        await plugin.init(this.createPluginAPI(manifest));
      }
      
      this.plugins.set(manifest.name, {
        manifest,
        module: plugin,
        path: modulePath
      });
      
      logger.info(`Plugin loaded: ${manifest.name} v${manifest.version}`);
    } catch (err) {
      logger.error(`Failed to load plugin ${manifest.name}: ${err.message}`);
    }
  }

  createPluginAPI(manifest) {
    const self = this;
    
    return {
      name: manifest.name,
      version: manifest.version,
      
      hook: (event, callback, priority) => self.registerHook(event, callback, priority),
      
      route: {
        get: (path, handler, middleware) => self.registerRoute('get', path, handler, middleware),
        post: (path, handler, middleware) => self.registerRoute('post', path, handler, middleware),
        put: (path, handler, middleware) => self.registerRoute('put', path, handler, middleware),
        patch: (path, handler, middleware) => self.registerRoute('patch', path, handler, middleware),
        delete: (path, handler, middleware) => self.registerRoute('delete', path, handler, middleware)
      },
      
      middleware: (pathOrHandler, handler) => {
        if (typeof pathOrHandler === 'function') {
          self.registerMiddleware(null, pathOrHandler);
        } else {
          self.registerMiddleware(pathOrHandler, handler);
        }
      },
      
      ws: (event, handler) => self.registerWebSocketHandler(event, handler),
      
      override: (target, replacement) => self.override(target, replacement),
      
      wrap: (original, before, after) => self.wrapFunction(original, before, after),
      
      storage: {
        get: (key) => self.getPluginStorage(manifest.name, key),
        set: (key, value) => self.setPluginStorage(manifest.name, key, value),
        delete: (key) => self.deletePluginStorage(manifest.name, key)
      },
      
      log: {
        info: (msg) => logger.info(`[${manifest.name}] ${msg}`),
        warn: (msg) => logger.warn(`[${manifest.name}] ${msg}`),
        error: (msg) => logger.error(`[${manifest.name}] ${msg}`)
      },

      getPlugins: () => Array.from(self.plugins.keys()),
      
      emit: (event, data) => self.executeHook(event, data)
    };
  }

  getPluginStorage(pluginName, key) {
    const storagePath = path.join(PLUGINS_DIR, '.storage', `${pluginName}.json`);
    
    if (!fs.existsSync(storagePath)) return undefined;
    
    try {
      const data = JSON.parse(fs.readFileSync(storagePath, 'utf-8'));
      return key ? data[key] : data;
    } catch {
      return undefined;
    }
  }

  setPluginStorage(pluginName, key, value) {
    const storageDir = path.join(PLUGINS_DIR, '.storage');
    const storagePath = path.join(storageDir, `${pluginName}.json`);
    
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    
    let data = {};
    if (fs.existsSync(storagePath)) {
      try {
        data = JSON.parse(fs.readFileSync(storagePath, 'utf-8'));
      } catch {}
    }
    
    data[key] = value;
    fs.writeFileSync(storagePath, JSON.stringify(data, null, 2));
  }

  deletePluginStorage(pluginName, key) {
    const storagePath = path.join(PLUGINS_DIR, '.storage', `${pluginName}.json`);
    
    if (!fs.existsSync(storagePath)) return;
    
    try {
      const data = JSON.parse(fs.readFileSync(storagePath, 'utf-8'));
      delete data[key];
      fs.writeFileSync(storagePath, JSON.stringify(data, null, 2));
    } catch {}
  }

  applyRoutes(app) {
    for (const route of this.routes) {
      const fullMiddleware = [...route.middleware, route.handler];
      app[route.method.toLowerCase()](route.path, ...fullMiddleware);
    }
  }

  applyMiddlewares(app) {
    for (const { path: mPath, handler } of this.middlewares) {
      if (mPath) {
        app.use(mPath, handler);
      } else {
        app.use(handler);
      }
    }
  }

  getLoadedPlugins() {
    return Array.from(this.plugins.entries()).map(([name, data]) => ({
      name,
      version: data.manifest.version,
      description: data.manifest.description || '',
      author: data.manifest.author || 'Unknown'
    }));
  }

  async reloadPlugin(name) {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;
    
    if (plugin.module.unload) {
      await plugin.module.unload();
    }
    
    this.plugins.delete(name);
    
    const manifest = plugin.manifest;
    await this.loadPluginModule(plugin.path, manifest);
    
    return true;
  }

  async unloadPlugin(name) {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;
    
    if (plugin.module.unload) {
      await plugin.module.unload();
    }
    
    this.plugins.delete(name);
    logger.info(`Plugin unloaded: ${name}`);
    
    return true;
  }
}

export const pluginManager = new PluginManager();
export default pluginManager;
