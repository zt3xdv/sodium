export const API_URL = '/api';
export const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

export const SERVER_STATUS = {
  OFFLINE: 'offline',
  STARTING: 'starting',
  ONLINE: 'online',
  STOPPING: 'stopping',
  INSTALLING: 'installing',
  SUSPENDED: 'suspended',
  ERROR: 'error'
};

export const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin'
};

export const DEFAULT_LIMITS = {
  MEMORY: 1024,
  DISK: 10240,
  CPU: 100,
  DATABASES: 0,
  BACKUPS: 2,
  ALLOCATIONS: 1
};

export const STORAGE_KEYS = {
  TOKEN: 'sodium_token',
  USER: 'sodium_user'
};
