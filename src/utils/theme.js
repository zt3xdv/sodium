const THEMES = ['dark', 'light', 'amoled'];
const STORAGE_KEY = 'sodium-theme';

export function getTheme() {
  return localStorage.getItem(STORAGE_KEY) || 'dark';
}

export function setTheme(theme) {
  if (!THEMES.includes(theme)) theme = 'dark';
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
}

export function applyTheme(theme) {
  if (!theme) theme = getTheme();
  document.documentElement.setAttribute('data-theme', theme);
}

export function getAvailableThemes() {
  return [
    { id: 'dark', name: 'Dark' },
    { id: 'light', name: 'Light' },
    { id: 'amoled', name: 'AMOLED' }
  ];
}

export function initTheme() {
  applyTheme(getTheme());
}
