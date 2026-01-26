import './styles/main.scss';
import '@xterm/xterm/css/xterm.css';
import { router } from './router.js';

window.addEventListener('DOMContentLoaded', () => {
  const loading = document.getElementById('loading');
  
  setTimeout(() => {
    loading.classList.add('hidden');
    loading.addEventListener('transitionend', () => {
      loading.remove();
    });
    router();
  }, 300);
});
