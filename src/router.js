class Router {
  constructor() {
    this.routes = new Map();
    this.middlewares = [];
    this.currentRoute = null;
    this.outlet = null;
    this.notFoundHandler = null;
    this.transitioning = false;

    window.addEventListener('hashchange', () => this.handleRoute());
    window.addEventListener('load', () => this.handleRoute());
  }

  setOutlet(element) {
    this.outlet = typeof element === 'string' ? document.querySelector(element) : element;
  }

  use(middleware) {
    this.middlewares.push(middleware);
    return this;
  }

  route(path, handler, options = {}) {
    this.routes.set(path, { handler, ...options });
    return this;
  }

  notFound(handler) {
    this.notFoundHandler = handler;
    return this;
  }

  getPath() {
    return window.location.hash.slice(1) || '/';
  }

  matchRoute(path) {
    if (this.routes.has(path)) {
      return { route: this.routes.get(path), params: {} };
    }

    for (const [pattern, route] of this.routes) {
      const regex = this.patternToRegex(pattern);
      const match = path.match(regex);
      if (match) {
        const params = this.extractParams(pattern, match);
        return { route, params };
      }
    }
    return null;
  }

  patternToRegex(pattern) {
    const escaped = pattern
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\\:([a-zA-Z_][a-zA-Z0-9_]*)/g, '([^/]+)');
    return new RegExp(`^${escaped}$`);
  }

  extractParams(pattern, match) {
    const params = {};
    const paramNames = pattern.match(/:([a-zA-Z_][a-zA-Z0-9_]*)/g) || [];
    paramNames.forEach((name, i) => {
      params[name.slice(1)] = match[i + 1];
    });
    return params;
  }

  async handleRoute() {
    const path = this.getPath();
    const matched = this.matchRoute(path);

    if (!matched) {
      this.handle404(path);
      return;
    }

    const { route, params } = matched;
    const context = { path, params, router: this };

    this.emit('beforeNavigate', context);

    for (const middleware of this.middlewares) {
      const result = await middleware(context);
      if (result === false) return;
    }

    await this.render(route, context);
    this.currentRoute = path;

    this.emit('afterNavigate', context);
  }

  async render(route, context) {
    if (!this.outlet) return;

    this.transitioning = true;
    this.outlet.classList.add('route-exit');

    await this.wait(150);

    let handler = route.handler;
    let mountFn = null;

    if (route.lazy && typeof handler === 'function') {
      const module = await handler();
      handler = module.default || module;
      mountFn = module.mount;
    }

    if (typeof handler === 'function') {
      const content = await handler(context);
      if (typeof content === 'string') {
        this.outlet.innerHTML = content;
      } else if (content instanceof Node) {
        this.outlet.innerHTML = '';
        this.outlet.appendChild(content);
      }
    }

    this.outlet.classList.remove('route-exit');
    this.outlet.classList.add('route-enter');

    if (typeof mountFn === 'function') {
      setTimeout(() => mountFn(context), 0);
    }

    await this.wait(150);
    this.outlet.classList.remove('route-enter');
    this.transitioning = false;
  }

  handle404(path) {
    if (this.notFoundHandler) {
      this.notFoundHandler({ path, router: this });
    } else if (this.outlet) {
      this.outlet.innerHTML = `<div class="not-found"><h1>404</h1><p>Page not found</p></div>`;
    }
  }

  navigate(path) {
    if (path === this.getPath()) return;
    window.location.hash = path;
  }

  back() {
    window.history.back();
  }

  forward() {
    window.history.forward();
  }

  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  emit(event, detail) {
    window.dispatchEvent(new CustomEvent(`router:${event}`, { detail }));
  }

  on(event, handler) {
    window.addEventListener(`router:${event}`, e => handler(e.detail));
    return this;
  }
}

export const router = new Router();

export function navigate(path) {
  router.navigate(path);
}

export function authGuard(redirectTo = '/login') {
  return (context) => {
    const token = localStorage.getItem('sodium_token');
    if (!token) {
      context.router.navigate(redirectTo);
      return false;
    }
    return true;
  };
}

export function adminGuard(redirectTo = '/') {
  return (context) => {
    const user = JSON.parse(localStorage.getItem('sodium_user') || 'null');
    if (!user || user.role !== 'admin') {
      context.router.navigate(redirectTo);
      return false;
    }
    return true;
  };
}

export function guestGuard(redirectTo = '/') {
  return (context) => {
    const token = localStorage.getItem('sodium_token');
    if (token) {
      context.router.navigate(redirectTo);
      return false;
    }
    return true;
  };
}
