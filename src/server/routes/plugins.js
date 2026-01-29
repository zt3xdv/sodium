import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { authMiddleware, adminMiddleware } from '../utils/auth.js';
import pluginManager from '../plugins/manager.js';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGINS_DIR = path.join(__dirname, '../../../plugins');

router.get('/', authMiddleware, adminMiddleware, (req, res) => {
  const plugins = pluginManager.getLoadedPlugins();
  res.json({ plugins });
});

router.get('/available', authMiddleware, adminMiddleware, (req, res) => {
  if (!fs.existsSync(PLUGINS_DIR)) {
    return res.json({ plugins: [] });
  }

  const entries = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true });
  const available = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    
    let manifest = { name: entry.name, version: '1.0.0' };
    
    if (entry.isDirectory()) {
      const manifestPath = path.join(PLUGINS_DIR, entry.name, 'plugin.json');
      if (fs.existsSync(manifestPath)) {
        try {
          manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        } catch {}
      }
    } else if (entry.name.endsWith('.js')) {
      manifest.name = entry.name.replace('.js', '');
    } else {
      continue;
    }

    const loaded = pluginManager.plugins.has(manifest.name);
    available.push({
      ...manifest,
      loaded,
      path: entry.name
    });
  }

  res.json({ plugins: available });
});

router.post('/reload/:name', authMiddleware, adminMiddleware, async (req, res) => {
  const { name } = req.params;
  
  try {
    const success = await pluginManager.reloadPlugin(name);
    if (success) {
      res.json({ message: `Plugin ${name} reloaded` });
    } else {
      res.status(404).json({ error: 'Plugin not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/unload/:name', authMiddleware, adminMiddleware, async (req, res) => {
  const { name } = req.params;
  
  try {
    const success = await pluginManager.unloadPlugin(name);
    if (success) {
      res.json({ message: `Plugin ${name} unloaded` });
    } else {
      res.status(404).json({ error: 'Plugin not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/load/:name', authMiddleware, adminMiddleware, async (req, res) => {
  const { name } = req.params;
  
  const pluginPath = path.join(PLUGINS_DIR, name);
  const pluginFile = path.join(PLUGINS_DIR, `${name}.js`);
  
  try {
    if (fs.existsSync(pluginPath) && fs.statSync(pluginPath).isDirectory()) {
      await pluginManager.loadPlugin(pluginPath);
    } else if (fs.existsSync(pluginFile)) {
      await pluginManager.loadPluginFile(pluginFile);
    } else {
      return res.status(404).json({ error: 'Plugin not found' });
    }
    
    res.json({ message: `Plugin ${name} loaded` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/hooks', authMiddleware, adminMiddleware, (req, res) => {
  const hooks = Array.from(pluginManager.hooks.keys());
  res.json({ hooks });
});

export default router;
