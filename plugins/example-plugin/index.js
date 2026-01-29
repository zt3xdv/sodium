export default {
  async init(api) {
    api.log.info('Example plugin initialized via JS entry point');
    
    api.hook('server:ready', async () => {
      api.log.info('Server is ready - from JS hook');
    });
    
    api.route.get('/api/example/hello', (req, res) => {
      res.json({ 
        message: 'Hello from example plugin!',
        timestamp: Date.now(),
        plugin: api.name,
        version: api.version
      });
    });
    
    api.route.get('/api/example/settings', async (req, res) => {
      const settings = api.settings.getAll();
      res.json({ settings });
    });
    
    api.route.post('/api/example/settings', async (req, res) => {
      const { key, value } = req.body;
      api.settings.set(key, value);
      res.json({ success: true });
    });
  },
  
  async unload(api) {
    api.log.info('Example plugin unloading...');
  }
};
