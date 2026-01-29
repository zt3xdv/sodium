export default {
  async init(api) {
    api.log.info('Example plugin initializing...');
    
    // Register a custom API route
    api.route.get('/api/example/hello', (req, res) => {
      res.json({ message: 'Hello from example plugin!', timestamp: Date.now() });
    });
    
    // Hook into server startup
    api.hook('server:ready', async ({ app, server }) => {
      api.log.info('Server is ready!');
    });
    
    // Hook into WebSocket messages
    api.hook('ws:message', async (data) => {
      // Example: log all console output events
      if (data.message?.event === 'console output') {
        // You can modify, block, or just observe messages
        // Return { blocked: true } to prevent the message from being sent
        // Return { message: modifiedMessage } to modify the message
      }
      return data;
    });
    
    // Register a custom WebSocket event handler
    api.ws('custom_event', async (args, context) => {
      api.log.info(`Custom event received: ${JSON.stringify(args)}`);
      return { handled: true, data: ['Response from plugin'] };
    });
    
    // Use plugin storage
    const visitCount = api.storage.get('visitCount') || 0;
    api.storage.set('visitCount', visitCount + 1);
    api.log.info(`Plugin loaded ${visitCount + 1} times`);
    
    api.log.info('Example plugin initialized!');
  },
  
  async unload() {
    console.log('[example-plugin] Unloading...');
  }
};
