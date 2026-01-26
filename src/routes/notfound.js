export function renderNotFound() {
  const app = document.getElementById('app');
  app.className = 'notfound-page';
  
  app.innerHTML = `
    <div class="notfound-container">
      <div class="notfound-content">
        <span class="notfound-code">404</span>
        <h1>Page Not Found</h1>
        <p>The page you're looking for doesn't exist or has been moved.</p>
        <a href="/dashboard" class="btn btn-primary">
          <span class="material-icons-outlined">home</span>
          <span>Back to Dashboard</span>
        </a>
      </div>
    </div>
  `;
}
