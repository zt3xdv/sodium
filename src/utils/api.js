import { API_URL } from './constants.js';
import { getToken } from './auth.js';

export class ApiClient {
  constructor(baseUrl = API_URL) {
    this.baseUrl = baseUrl;
    this.timeout = 30000;
  }

  setTimeout(ms) {
    this.timeout = ms;
  }

  async request(method, endpoint, body = null, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const token = getToken();

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : null,
        signal: controller.signal,
        ...options
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type');
      const isJson = contentType?.includes('application/json');
      const data = isJson ? await response.json() : await response.text();

      if (!response.ok) {
        const error = new Error(data?.message || data || `Request failed with status ${response.status}`);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        const error = new Error('Request timeout');
        error.status = 408;
        throw error;
      }
      throw err;
    }
  }

  get(endpoint, options) {
    return this.request('GET', endpoint, null, options);
  }

  post(endpoint, body, options) {
    return this.request('POST', endpoint, body, options);
  }

  put(endpoint, body, options) {
    return this.request('PUT', endpoint, body, options);
  }

  patch(endpoint, body, options) {
    return this.request('PATCH', endpoint, body, options);
  }

  delete(endpoint, options) {
    return this.request('DELETE', endpoint, null, options);
  }
}

export const api = new ApiClient();
