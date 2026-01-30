export class WingsClient {
  constructor(node) {
    this.node = node;
    this.baseUrl = `${node.scheme}://${node.fqdn}:${node.daemon_port}`;
  }

  async request(method, endpoint, data = null) {
    const headers = {
      'Authorization': `Bearer ${this.node.daemon_token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    const options = { method, headers };
    if (data) options.body = JSON.stringify(data);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, options);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `HTTP ${response.status}`);
      }
      return response.json().catch(() => ({}));
    } catch (error) {
      throw error;
    }
  }

  async getSystemInfo() {
    return this.request('GET', '/api/system');
  }

  async getServerStatus(uuid) {
    return this.request('GET', `/api/servers/${uuid}`);
  }

  async createServer(uuid, config) {
    return this.request('POST', `/api/servers`, { uuid, ...config });
  }

  async deleteServer(uuid) {
    return this.request('DELETE', `/api/servers/${uuid}`);
  }

  async reinstallServer(uuid) {
    return this.request('POST', `/api/servers/${uuid}/reinstall`);
  }

  async powerAction(uuid, action) {
    return this.request('POST', `/api/servers/${uuid}/power`, { action });
  }

  async sendCommand(uuid, command) {
    return this.request('POST', `/api/servers/${uuid}/commands`, { command });
  }

  async getResources(uuid) {
    return this.request('GET', `/api/servers/${uuid}/resources`);
  }

  async getLogs(uuid, size = 100) {
    return this.request('GET', `/api/servers/${uuid}/logs?size=${size}`);
  }

  async createBackup(uuid, config) {
    return this.request('POST', `/api/servers/${uuid}/backup`, config);
  }

  async restoreBackup(uuid, backupUuid, config) {
    return this.request('POST', `/api/servers/${uuid}/backup/${backupUuid}/restore`, config);
  }

  async syncServer(uuid, serverConfig) {
    return this.request('POST', `/api/servers/${uuid}/sync`, serverConfig);
  }

  async installServer(uuid) {
    return this.request('POST', `/api/servers/${uuid}/install`);
  }

  async copyFile(uuid, location) {
    return this.request('POST', `/api/servers/${uuid}/files/copy`, { location });
  }

  async chmodFile(uuid, root, files) {
    return this.request('POST', `/api/servers/${uuid}/files/chmod`, { root, files });
  }

  async listDirectory(uuid, directory) {
    return this.request('GET', `/api/servers/${uuid}/files/list-directory?directory=${encodeURIComponent(directory)}`);
  }

  async renameFiles(uuid, root, files) {
    return this.request('PUT', `/api/servers/${uuid}/files/rename`, { root, files });
  }

  async deleteFiles(uuid, root, files) {
    return this.request('POST', `/api/servers/${uuid}/files/delete`, { root, files });
  }

  async createDirectory(uuid, name, path) {
    return this.request('POST', `/api/servers/${uuid}/files/create-directory`, { name, path });
  }

  async compressFiles(uuid, root, files) {
    return this.request('POST', `/api/servers/${uuid}/files/compress`, { root, files });
  }

  async decompressFile(uuid, root, file) {
    return this.request('POST', `/api/servers/${uuid}/files/decompress`, { root, file });
  }
}

export function createWingsClient(node) {
  return new WingsClient(node);
}
