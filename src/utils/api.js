const TOKEN_KEY = 'auth_token';
const USER_KEY = 'user';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    // Invalid JSON in localStorage
    return null;
  }
}

export function setUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem('loggedIn');
  localStorage.removeItem('username');
}

export function isLoggedIn() {
  return !!getToken();
}

export async function api(endpoint, options = {}) {
  const token = getToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(endpoint, {
    ...options,
    headers
  });
  
  if (response.status === 401) {
    clearAuth();
    window.location.href = '/auth';
    throw new Error('Session expired');
  }
  
  return response;
}

export async function apiJson(endpoint, options = {}) {
  const response = await api(endpoint, options);
  return response.json();
}
