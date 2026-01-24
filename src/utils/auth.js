import { STORAGE_KEYS, USER_ROLES } from './constants.js';

export function getToken() {
  return localStorage.getItem(STORAGE_KEYS.TOKEN);
}

export function setToken(token) {
  localStorage.setItem(STORAGE_KEYS.TOKEN, token);
}

export function removeToken() {
  localStorage.removeItem(STORAGE_KEYS.TOKEN);
}

export function getUser() {
  const data = localStorage.getItem(STORAGE_KEYS.USER);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function setUser(user) {
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
}

export function removeUser() {
  localStorage.removeItem(STORAGE_KEYS.USER);
}

export function isAuthenticated() {
  return !!getToken();
}

export function isAdmin() {
  const user = getUser();
  return user?.role === USER_ROLES.ADMIN;
}

export function logout() {
  removeToken();
  removeUser();
}
