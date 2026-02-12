# Plugin System Plan

> An extensible plugin system for Sodium Panel that allows adding features like billing, tickets, integrations, themes, and more.

---

## Architecture Overview

```
data/plugins/
  my-plugin/
    plugin.json        ← Manifest (metadata, permissions, hooks)
    server.js          ← Backend logic (routes, DB hooks, events)
    client.js          ← Frontend logic (sidebar items, pages, widgets)
    assets/            ← Static files (CSS, images)
```

### Core Components

| File | Responsibility |
|---|---|
| `src/server/plugins/manager.js` | Discovers, loads, activates/deactivates plugins |
| `src/server/plugins/hooks.js` | Hook registry and execution (event emitter with priorities) |
| `src/server/plugins/sandbox.js` | Limited API exposed to plugins (no direct full DB access) |
| `src/server/plugins/api.js` | `sodium` object injected into plugins with safe methods |
| `src/server/routes/plugins.js` | Admin REST API: list, activate, configure plugins |
| `src/routes/admin/plugins.js` | Plugin administration UI (frontend) |

---

## Plugin Types

| Type | Scope | Example |
|---|---|---|
| `hook` | Only reacts to events | Discord alerts, logging |
| `widget` | Adds widgets to dashboard/server | Server stats, graphs |
| `feature` | Full feature: DB, routes, UI, middleware, crons | Billing, tickets, WHMCS sync |
| `theme` | CSS/assets only, modifies appearance | Dark neon, corporate |

---

## Plugin Manifest

```json
{
  "id": "discord-alerts",
  "name": "Discord Alerts",
  "version": "1.0.0",
  "type": "hook",
  "author": "community",
  "description": "Send Discord webhooks on server events",
  "sodium": ">=1.0.0",
  "permissions": ["servers:read", "webhooks:send"],
  "hooks": ["server:onCreate", "server:onStatusChange"],
  "settings": {
    "webhook_url": { "type": "string", "label": "Discord Webhook URL" }
  }
}
```

---

## Hook Points

These are the events plugins can subscribe to, inserted into existing code:

| Hook | Location | Description |
|---|---|---|
| `server:beforeCreate` | `src/server/routes/servers.js` | Before a server is created (can deny) |
| `server:onCreate` | `src/server/routes/servers.js` | After a server is created |
| `server:onDelete` | `src/server/routes/servers.js` | After a server is deleted |
| `server:onStatusChange` | `src/server/routes/servers.js` | Server start/stop/restart |
| `server:resourceUsage` | `src/server/routes/servers.js` | Resource metrics received |
| `auth:afterLogin` | `src/server/routes/auth.js` | After successful login |
| `auth:afterRegister` | `src/server/routes/auth.js` | After user registration |
| `route:register` | `src/server/index.js` | When API routes are mounted |
| `ws:message` | `src/server/socket.js` | WebSocket message received |
| `db:afterSave` | `src/server/db.js` | After any DB write |
| `sidebar:items` | `src/components/sidebar.js` | When sidebar renders |
| `admin:tabs` | `src/routes/admin/index.js` | When admin panel renders |

---

## Plugin API (`sodium` object)

The `sodium` object is injected into every plugin and provides a safe, sandboxed API:

### Backend API (`server.js`)

```js
export default function(sodium) {

  // Database - isolated collections per plugin
  sodium.db.registerCollections(['invoices', 'plans', 'transactions']);
  sodium.db.find('invoices', { user_id: '123' });
  sodium.db.insert('invoices', { ... });
  sodium.db.update('invoices', id, { ... });
  sodium.db.delete('invoices', id);

  // HTTP routes - mounted under /api/plugins/<plugin-id>/
  sodium.http.registerRoutes((router) => {
    router.get('/plans', listPlans);
    router.post('/plans', createPlan);
    router.get('/invoices', getInvoices);
    router.post('/checkout', processPayment);
    router.post('/webhooks/stripe', stripeWebhook);
  });

  // Hooks - subscribe to events
  sodium.hooks.on('server:beforeCreate', async (ctx) => {
    const balance = await getBalance(ctx.user.id);
    if (balance < 0) {
      ctx.deny('Insufficient balance.');
    }
  });

  sodium.hooks.on('server:onDelete', async (ctx) => {
    await cancelSubscription(ctx.server.id);
  });

  // Cron jobs
  sodium.cron.register('billing:cycle', '0 0 1 * *', async () => {
    await generateMonthlyInvoices();
  });

  sodium.cron.register('billing:reminders', '0 9 * * *', async () => {
    await sendPaymentReminders();
  });

  // Logger
  sodium.logger.info('Billing plugin loaded');
  sodium.logger.warn('Payment failed for user X');
  sodium.logger.error('Stripe webhook error');

  // Config - read/write plugin-specific settings only
  sodium.config.get('webhook_url');
  sodium.config.set('webhook_url', 'https://...');

  // Inter-plugin communication
  sodium.plugins.call('other-plugin', 'methodName', args);
}
```

### Frontend API (`client.js`)

```js
export default function(sodium) {

  // Register full pages
  sodium.ui.registerPages({
    '/billing':          { render: renderBillingDashboard, title: 'Billing' },
    '/billing/invoices': { render: renderInvoices, title: 'Invoices' },
    '/billing/plans':    { render: renderPlans, title: 'Plans' },
  });

  // Sidebar item with badge
  sodium.ui.addSidebarItem({
    label: 'Billing',
    icon: 'credit-card',
    href: '/billing',
    badge: () => getUnpaidCount(),
    position: 'after:servers'
  });

  // Tab in server page
  sodium.ui.addServerTab({
    id: 'billing',
    label: 'Usage & Cost',
    render: (serverId) => renderServerBilling(serverId)
  });

  // Dashboard widget
  sodium.ui.addDashboardWidget({
    id: 'billing-summary',
    title: 'Balance',
    render: renderBalanceWidget,
    size: 'small'
  });

  // Admin panel tab
  sodium.ui.addAdminTab({
    id: 'billing',
    label: 'Billing',
    subtabs: ['Plans', 'Revenue', 'Transactions'],
    render: renderAdminBilling
  });
}
```

---

## Full API Reference

| Capability | Method | Purpose |
|---|---|---|
| Own DB | `sodium.db.registerCollections()` | Isolated tables/collections per plugin |
| API routes | `sodium.http.registerRoutes()` | Endpoints under `/api/plugins/<id>/` |
| Global middleware | `sodium.hooks.on('*:before*')` | Intercept actions (e.g. block if no balance) |
| Cron jobs | `sodium.cron.register()` | Periodic tasks (billing cycles, cleanup) |
| Frontend pages | `sodium.ui.registerPages()` | Full routes in the SPA |
| Sidebar/tabs | `sodium.ui.addSidebarItem()` | Dynamic navigation |
| Dashboard widgets | `sodium.ui.addDashboardWidget()` | Widgets on the main dashboard |
| Server tabs | `sodium.ui.addServerTab()` | Tabs in the server view |
| Admin tabs | `sodium.ui.addAdminTab()` | Sections in the admin panel |
| Settings UI | `plugin.json → settings` | Plugin-specific config visible in admin |
| Inter-plugin | `sodium.plugins.call()` | Communication between plugins |
| Logger | `sodium.logger.*` | Scoped logging |
| Config | `sodium.config.get/set()` | Plugin settings read/write |

---

## Configuration

In `data/config.json`:

```json
{
  "plugins": {
    "enabled": true,
    "directory": "data/plugins",
    "active": ["discord-alerts", "billing", "custom-theme"]
  }
}
```

---

## Security

- Plugins run in the same process but with a limited API (no direct `require('fs')`)
- Permissions declared in `plugin.json`, validated on load
- Isolated DB collection per plugin (`plugins_<id>`)
- Rate limiting on plugin routes
- Only admins can install/activate plugins
- Plugin settings are never exposed to non-admin users

---

## Changes Required in Core

To support the plugin system, these existing files need modifications:

| File | Change |
|---|---|
| `src/router.js` | Dynamic route registration (not just static `routes` object) |
| `src/components/sidebar.js` | Extensible array of sidebar items |
| `src/routes/dashboard.js` | Widget slots for plugin dashboard widgets |
| `src/server/db.js` | Dynamic `COLLECTIONS` (not hardcoded) |
| `src/server/routes/schedules.js` | Support plugin-registered cron jobs |
| `src/server/index.js` | Load plugins on startup, mount plugin routes |
| `src/server/socket.js` | Emit `ws:message` hook for plugins |
| `src/routes/routes.js` | Accept dynamically registered routes |
| `src/routes/server/index.js` | Dynamic server tab registry |
| `src/routes/admin/index.js` | Dynamic admin tab registry |

---

## Implementation Order

### Phase 1 - Core Plugin System
1. `src/server/plugins/hooks.js` - Event system with priorities
2. `src/server/plugins/sandbox.js` + `api.js` - Safe API object
3. `src/server/plugins/manager.js` - Discovery, lifecycle, loading

### Phase 2 - Make Core Extensible
4. Dynamic `COLLECTIONS` in `db.js`
5. Dynamic route registration in `router.js` and `routes.js`
6. Extensible sidebar, dashboard, server tabs, admin tabs

### Phase 3 - Plugin Infrastructure
7. `src/server/routes/plugins.js` - Admin API for plugins
8. Plugin cron system (extend `schedules.js`)
9. Plugin admin UI (frontend)

### Phase 4 - Reference Plugins
10. Example plugin: Discord Alerts (`hook` type)
11. Example plugin: Billing (`feature` type)
12. Developer documentation and plugin SDK guide

---

## Example: Billing Plugin Structure

```
data/plugins/billing/
  plugin.json
  server.js
  client.js
  assets/
    billing.css
```

### `plugin.json`

```json
{
  "id": "billing",
  "name": "Billing & Payments",
  "version": "1.0.0",
  "type": "feature",
  "author": "sodium",
  "description": "Server billing, invoices, plans, and payment processing",
  "sodium": ">=1.0.0",
  "permissions": [
    "servers:read",
    "users:read",
    "db:own",
    "http:routes",
    "ui:pages",
    "ui:sidebar",
    "ui:admin",
    "cron:register"
  ],
  "hooks": [
    "server:beforeCreate",
    "server:onCreate",
    "server:onDelete",
    "server:resourceUsage"
  ],
  "settings": {
    "currency": { "type": "select", "label": "Currency", "options": ["USD", "EUR", "GBP"], "default": "USD" },
    "stripe_key": { "type": "string", "label": "Stripe API Key", "secret": true },
    "billing_cycle": { "type": "select", "label": "Billing Cycle", "options": ["monthly", "hourly"], "default": "monthly" },
    "auto_suspend": { "type": "boolean", "label": "Auto-suspend on unpaid invoice", "default": true }
  }
}
```
