[33md03f1a0[m[33m ([m[1;36mHEAD[m[33m -> [m[1;32mmain[m[33m, [m[1;31morigin/main[m[33m)[m feat: add webhook image generation and admin webhooks UI
[33m00851bb[m Add roles system (user/moderator/admin) and webhooks (Discord, Slack, generic)
[33md6dd649[m Remove scheduled tasks from TODO
[33m326b8cf[m todo: Updated TODO.md
[33m99ea448[m feat: add password reset functionality
[33m51425e0[m feat: add option to disable server creation for users
[33m77e3fb2[m fix: use location.href for OAuth buttons to bypass SPA router
[33m55b4af7[m feat: implement email-based 2FA system
[33me0593c5[m feat: admin user creation with pre-verified email
[33m316afca[m feat: add user deletion with server cleanup
[33md14e5f0[m feat: email verification system + updated email templates
[33mc200617[m feat: add server transfers, OAuth providers, SSH keys, overallocation, mail system
[33ma8bc4b4[m revert: remove billing system (not production ready)
[33m1f4d5a2[m feat: add billing system with plans, subscriptions, and admin management
[33m7c9a1fc[m test: add tests for helpers, permissions, rate-limiter, and security utilities
[33m48548fd[m feat: add search functionality to admin users, servers, and nodes pages
[33ma209f8c[m remove: resource usage section from servers page
[33mb06db1f[m fix: show loading status, add starting counter in dashboard
[33mb6efa1b[m fix: request server status after WebSocket auth success
[33m69948e4[m fix: real-time server status updates via WebSocket in servers and dashboard pages
[33m6ea2a97[m refactor: sidebar sections + improved dashboard greeting
[33mb5d8795[m changed themes
[33mb869880[m Remove plugin injection system remnants from auth.js
[33m9db4223[m fix: updated contributors tab
[33mce944db[m feat: add icons to eggs, file upload for egg import, fix auth page
[33m326f98f[m Add game server eggs
[33mdc58434[m Add operations features and theme toggle
[33m13f8360[m Add migration scripts
[33m7a03b81[m Add test suite using Node.js native test runner
[33m93cd76f[m Show setup message in CLI when panel not configured
[33mc986225[m Show friendly error when database/redis drivers not installed
[33m208a235[m Update storage description wording
[33m380dcc8[m Increase concurrent users to 500 for simple setup
[33me9309f6[m Replace emojis with SVG icons in deployment section
[33m2fae6cb[m Add deployment options section to landing page
[33m7283d78[m Add setup wizard and update documentation
[33md2821e5[m chore: remove plugin system
[33m563ecc9[m feat: add plugins bundler - generate plugins.json and copy assets to dist
[33m7bd5f72[m feat: inproved bundler
[33m508f8b8[m fix: did some fixes on ai code
[33mc66ed85[m[33m ([m[1;31morigin/dev[m[33m, [m[1;32mdev[m[33m)[m refactor: compact and modern styles overhaul
[33m76018ae[m Update repository URLs to sodiumpanel/panel
[33m129ff0c[m docs: update documentation with external database support
[33m1040a12[m feat(db): add optional external database support (MySQL, PostgreSQL, SQLite)
[33m7fbf231[m Remove production ready FAQ
[33m4be29ae[m Update FAQ Wings compatibility, remove emoji
[33mb9e1412[m Add WIP badge
[33m538e674[m Remove best for row
[33m2ba0a5c[m Remove isolation row from comparison
[33m3914a0d[m Remove Docker row from comparison
[33m803f8d9[m Add comparison table, FAQ and contributors
[33m6b7d311[m Fix punctuation
[33m334e048[m Add phone easter egg
[33mcf48e76[m Add markdown viewer for docs
[33m7409f85[m Add GitHub Pages landing page
[33m9d714f0[m feat: click file to edit, limit editor height with scroll
[33mf55368d[m feat: add copy/chmod file operations and use mimetype for file detection
[33m5ba8674[m refactor: remove duplicate modal styles from admin.scss
[33mfcb2fff[m fix: improve console scroll on mobile devices
[33m07a0ced[m code: changed loading colos
[33m9918893[m code: splitted admin panel in varipus files
[33m8c2f8bd[m chore: remove debug log from announcements endpoint
[33m8c1520b[m fix: add mobile card view for announcements list (list-table hidden on mobile)
[33m5530817[m fix: refactor announcements table rendering - build tableRows before template
[33m6318212[m fix: add null checks for announcement fields in admin table
[33mf1c84a9[m debug: add toast to show announcements count
[33m2273643[m debug: add log to announcements endpoint
[33m9845b94[m fix: auto-upgrade database schema when new collections are added
[33mc946e58[m fix: announcements page - add error handling and null checks
[33mca1766d[m fix: rename form input IDs to avoid collision with header elements
[33m4bb4bd1[m fix: server settings - handle node unavailable and improve error handling
[33mc9362c0[m fix: server settings description not loading and save not working
[33m22ad06f[m build: update dist files
[33mde3423e[m feat: add announcements, audit logs, and activity logs
[33md4c3e21[m feat: implementar API keys para usuarios y aplicaciones
[33m829aa46[m chore: limpiar tareas del TODO
[33m1b0caf2[m fix: corregir imports de auth middleware en plugins.js
[33me2a146a[m test: verificar push desde amp
[33mf6d28d9[m docs: add simplified TODO list
[33md9541f7[m docs: translate plugins README to English
[33mb6f111d[m feat: complete injection system with 80+ injection points, HTML IDs, OAuth example, and full documentation
[33m0352605[m feat: complete plugin system with declarative JSON config, slots, OAuth support, installer, and packaging
[33m95c7b24[m feat: add plugin manager system with hooks, routes, middleware and WebSocket support
[33m1f54353[m fix: deduplicate console logs to prevent duplicate WebSocket messages
[33m4dd3706[m fix: some fixes of style
[33m30fcb1f[m style: removed all borders
[33m769d1e5[m auto: automated commit
[33m27c015a[m auto: automated commit
[33m92e6b5c[m feat: Added egg change option in admin panel
[33med05895[m feat: create admin servers as draft, add Install button when ready
[33mcb97777[m feat: add user search for server owner transfer instead of listing all users
[33m4128341[m feat: create nodes/servers/eggs inline and open detail page instead of modal
[33mdb28212[m feat: add Servers tab in admin user detail to view/manage user servers
[33mf4bde7b[m feat: add Open Server link in admin panel manage tab
[33m2edbc7c[m feat: allow admins to access any server via /server/uuid
[33m21a15ea[m feat: add compression/decompression progress with modified Wing API fallback
[33m04946c4[m Remove startup variables from server creation form
[33ma91606b[m Fix /servers/create page by passing username to limits endpoint
[33mde93cd6[m feat(eggs): add icon, admin_only fields and new create server page
[33m79753ea[m chore: remove testshx folder
[33m5304cdc[m docs: add documentation, license, and contributing guide
[33md1de03c[m style: increase icon size to 128px
[33m07520d8[m style: larger icon, remove loading text
[33mfdc5d62[m feat: add bolt icon with gradient animation to loading screen
[33mb4a491b[m Update styles and dashboard
[33m880192f[m wah
[33m2408342[m fix: remove reference to deleted lastDimensions variable
[33m3884e41[m fix: revert CSS changes that broke terminal
[33m76ee04e[m fix: constrain terminal width to prevent horizontal overflow
[33mdf33194[m fix: hide terminal with opacity during fit
[33m48540a2[m fix: use proposeDimensions + resize for correct sizing
[33m0d4fd3b[m fix: manual terminal resize calculation for instant resize
[33m755dd20[m fix: instant terminal resize with requestAnimationFrame
[33me600cd3[m fix: faster terminal resize (5ms debounce)
[33mbe10858[m fix: hide terminal during fit to prevent visual resize effect
[33m7d02cad[m build: update dist
[33m49bfb9e[m fix: use terminal.resize instead of fitAddon.fit to avoid visual glitch
[33m26db7e6[m fix: debounce xterm fit to prevent shrinking loop
[33mdd5bf4b[m refactor: migrate console logs to logger utility
[33ma4e36ff[m fix: convert remaining fetch to api in admin.js
[33me2fd667[m fix: remove another duplicate user declaration
[33m7563a12[m fix: remove duplicate user declarations
[33m109a4cd[m fix: migrate all server routes to JWT auth
[33m420d5a9[m fix: sidebar uses getUser() for admin check
[33m698bdae[m fix: update user routes to use JWT auth
[33m6b129eb[m a
[33ma29295c[m fix: security hardening - JWT auth, rate limiting, secure tokens
[33m579f567[m Redesign admin panel with Pterodactyl-style layout
[33mf859f3c[m chore: sync
[33m79901d2[m fix: use valid disk icon
[33m1bdcaaf[m feat: redesign sidebar with cards, add uptime, improve resources UI
[33me7ee56b[m fix: non-scaling-stroke for uniform line width
[33m3cbdfdb[m style: thinner sparkline strokes
[33ma58ddf0[m fix: parse stats JSON string
[33m9c2ad2b[m debug: show args[0] keys
[33m4fa3030[m debug: check args structure
[33md8b65da[m debug: log stats values
[33mce68e96[m fix: use correct stats fields from websocket
[33mdfa2505[m debug: show full stats JSON
[33m3f619f6[m feat: sparkline resource charts + debug stats logging
[33m775fe95[m Mobile: power buttons beside title with space-between
[33md039103[m Redesign server page: vertical layout, move address to info card, remove header address
[33m8f30cfc[m Add styles for console command input and text-input class
[33m5ccfce9[m Fix server tabs: remove first-child and set 100% width
[33m1c84cf1[m Fix decompress dialog using modal.confirm and add extract indicator
[33m1ebcce6[m Fix decompress: correct API parameters for Wings
[33m5d6979c[m Fix breadcrumb visibility and remove gap on mobile
[33m6f338b9[m Fix files toolbar: keep buttons beside breadcrumb on mobile
[33m98ba4be[m Improve files toolbar: smaller buttons and simplified breadcrumb
[33m2a7fbb9[m fix: use original modal styles
[33m9fe2ad8[m feat: add custom confirm and prompt modals
[33m00664c1[m fix: checkbox styles
[33m983012a[m fix: editor back button
[33m34ca229[m feat: add CodeMirror editor with syntax highlighting
[33m76015d9[m feat: add multi-select, move, compress files to file manager
[33m86e9091[m fix: use correct Wings upload endpoint with JWT token
[33md3a3498[m feat: add upload progress indicator
[33m7d759f1[m fix: upload and add decompress to file manager
[33mfc5ff36[m update
[33m1c82290[m fix: prevent duplicate console messages
[33md929094[m build
[33m6f1af85[m refactor: polish code and add toast notifications
[33m3f7c705[m feat: add subusers with permissions and server suspension
[33ma16542a[m feat: add binary database and theme system
[33md269d32[m fix: fixed that only admins can created server
[33m29bb7d1[m feat(servers): use icons for power buttons, add section divider
[33mb4cc503[m style: use settings-section style for server cards and resource usage
[33mf208ee0[m style: move resource usage below servers, create btn next to title
[33m2f9f4f6[m style: move resources below content on mobile
[33m68361d0[m fix: adjust server tabs padding and margins
[33m628e1b0[m fix: remove overflow-x hidden from server page
[33m54582f4[m fix: add horizontal padding to server tabs
[33m8ea49c1[m style: match server tabs with admin panel tabs
[33m132ff4b[m style: add spacing above Docker Image field
[33m21dfa89[m style: add spacing above variables section
[33m4b7e835[m fix: add padding to settings-section content
[33m6e42562[m style: use input-wrapper for server settings, move variables/save outside card
[33m76cef42[m style: move variables outside card, fix setting-item padding
[33m6eb1cb1[m style: use settings-section for startup tab
[33md6d526f[m style: use settings-section cards for server danger zone
[33m2e5e9c7[m fix: move settings endpoints before catch-all route
[33m6f4c963[m fix: auto-create config.json with defaults if missing or incomplete
[33m24ce243[m feat(admin): add Panel Settings tab with registration toggle and default user limits
[33md30b09c[m feat: variable validation with rule parsing (required, string, numeric, min, max, in) in frontend and backend
[33m03c8481[m fix: include docker_images in startup API response
[33m6d65328[m feat: full CRUD for nests/eggs with docker_images support and nest selector on import
[33m8069d8d[m fix: use egg docker_images instead of hardcoded list
[33m35e88c3[m security: replace docker image input with approved list dropdown
[33m317fde2[m fix: mobile responsive styles with !important for all panel pages
[33m57f94cd[m fix: standardize all page max-widths to 1200px to prevent layout shifts
[33m8920ca3[m fix: prevent sidebar re-render on navigation, remove margin transition
[33m7b435b1[m feat: replace [SYSTEM] messages with subtle gray status messages
[33mac0654a[m feat: add installing screen when server is being set up
[33m6b3a7ac[m fix: save server to database BEFORE calling Wings (Wings callbacks to verify)
[33m7380ad7[m fix: add process_configuration and default environment to Wings payload
[33m2b13f9d[m fix: improve Wings server creation payload with complete structure
[33mc3efced[m fix: use original modal styles from main.scss
[33mf8bcf84[m fix: use correct CSS variables for modal styles
[33m961cf43[m fix: increase modal z-index to show above all elements
[33md12fe61[m feat: add server settings page with name, description, reinstall and delete
[33m0833215[m feat: auto node selection and random port for user server creation
[33m9e82ca0[m feat: user server creation with allocation ranges
[33m6bbaf7c[m fix: show node FQDN:port instead of internal IP
[33m3f51877[m feat: add Startup tab for server configuration
[33m5ecb15f[m Fix file editor: prevent HTML escaping corruption, add raw content support for Wings
[33m7a9708c[m Fix servers page width 100% on mobile
[33m35775ea[m Enhanced pagination: per-page selector, page numbers, go-to input
[33mb18c776[m Add server-side pagination to admin panel (nodes, servers, users)
[33m3acce6d[m Fix disk icon
[33mafad721[m Status page: show allocated resources instead of usage
[33m67cfe15[m Redesign status page with improved UI and responsiveness
[33m78f045b[m Mobile: full width content and responsive adjustments
[33mb9a8469[m Admin tabs: icons with labels on desktop, icons only on mobile
[33m3953a33[m Add responsive card layout to admin panel
[33md4796e9[m Add allowed_origins wildcard for Wings CORS
[33m5e2a7cb[m Fix remote URL in node config
[33mbc72ef5[m Update daemon branding format to Sodium Daemon:
[33mcb3f862[m Replace Pterodactyl Daemon branding with Sodium Daemon, remove legacy console
[33m26e6101[m fix: improve directory detection using is_file boolean
[33m0530f5e[m fix: folder navigation, hide edit/download for dirs, show resources only in console
[33mf838a6c[m chore: keep only console, files, startup, settings tabs
[33m2d4f843[m feat: add file editor with editable file types detection
[33mc4acab1[m fix: use writeln since Wings sends each line as separate message
[33me5870ec[m debug: alert raw output
[33m6bd0213[m debug: add console.log to see raw output format
[33m59443a1[m fix: simplify xterm output, set initial cols/rows
[33m8d482c7[m fix: split console output by lines and use writeln
[33m8111cf0[m fix: convert \n to \r\n for xterm line breaks
[33m18a913e[m feat: replace console with xterm.js
[33m31be12f[m fix: improve mobile responsiveness for server page
[33mb01b33a[m feat: redesign server page with tabs (console, files)
[33m21e428c[m fix: remove origin header from Wings WS connection
[33m8a72443[m feat: generate JWT token for Wings WebSocket authentication
[33mee1e2a2[m fix: use origin option for WebSocket connection to Wings
[33m902ac5d[m feat: add WebSocket proxy to bypass Wings CORS
[33m38ce88c[m build: update dist
[33m6f1dd47[m chore: remove dist/ from gitignore
[33mc69a843[m feat: add WebSocket console logs with real-time resources from Wings
[33m78b11b9[m fix: log all API requests, not just remote
[33m97869fe[m fix: remove call to non-existent /api/servers/:uuid/resources endpoint
[33m93c106c[m fix: remove token logs, add outgoing wings request logs
[33m163c29c[m fix: add logging for all remote API calls
[33m11850e8[m fix: add debug logs for install status, handle string boolean
[33m8515238[m fix: handle null body in JSON requests from Wings
[33m8c1b6ff[m feat: add node edit modal and deploy command button in admin panel
[33m12a7230[m feat: add deploy command endpoint, add .gitignore to protect sensitive data
[33md267d9e[m fix: remove duplicate /api/remote endpoints, fix SFTP auth to accept user field and validate password
[33md50efd6[m Add debug logs for auth
[33m30ed83c[m Fix Wings auth: use tokenId.token format
[33mbf087d4[m Add Wings remote API endpoints
[33me06d124[m Refactor: New server panel with Wings integration
[33m11b1aaa[m chore: remove gvisor experiment
[33mbae51cd[m fix: sandbox process mode - skip uid/gid without root, allow threads for node/python
[33mac9ece8[m feat: add gVisor sandbox daemon with lightweight isolation
[33m67dc68c[m fix: file manager to proxy requests to daemon
[33m9c6cff8[m fix: daemon connection status, add nodes to sidebar, improve dashboard with charts
[33m6f6d4cd[m fix: add nest selection for server creation, improve egg display
[33mc2c80ed[m feat: add user resource limits config, improve eggs display, enhance admin dashboard, fix profile page styling, and various UI improvements
[33mbb09c63[m fix: pass params instead of context to mount functions
[33m1155ec4[m Guard against undefined node_id in server-view
[33m59efd95[m Add node_id and allocation_id columns to servers table
[33m15c4cad[m Fix dashboard API response handling
[33m44d5acb[m Fix all parameterized route handlers to destructure params
[33m0ecd66b[m Fix route handlers to destructure params from context
[33mf4066c5[m Fix router patternToRegex not matching parameterized routes
[33mcb23251[m Add Pterodactyl-style admin pages for nodes and servers
[33m2744b33[m a
[33m9d84abd[m Complete daemon-panel integration
[33mf506a3a[m feat: add daemon WebSocket endpoint for node communication
[33mc6b20fb[m fix: use IPv4 for panel connection in daemon config
[33me21d982[m feat: add user resource limits, profile system, and admin-only mode
[33m4773adb[m Fix: remove Allocation references from servers API
[33md251293[m Remove nodes and allocations system - simplify to basic CRUD
[33mf48d186[m Update admin panel, server components, and styles
[33ma399755[m feat: add create routes for server, user, node
[33m3fbd1f5[m feat: add /dashboard as alias for /
[33m1b70066[m fix: replace all hash routes with History API routes
[33m93d4aea[m fix: add native form element styles (input, button, select, etc.)
[33m84deac6[m fix: import styles in main.js, first user is admin
[33mee1e452[m feat: add profile route
[33m3a3b8aa[m refactor: switch router from hash to History API
[33m369f14f[m fix: add type=module to script tag
[33m348ffd9[m fix: force exit on SIGINT
[33m00ed2d8[m feat: add eruda devtools
[33me3bb858[m fix: use bcryptjs in admin.js
[33m063e131[m fix: remove wss from exports (now scoped inside startServer)
[33m8c984b5[m feat: add missing server route placeholders
[33mac3f492[m refactor: migrate bundler to ESM with embedded rollup
[33mc82da17[m feat: migrate from better-sqlite3 to sql.js and bcrypt to bcryptjs
[33m0b15620[m Initial Sodium commit.
[33mcc31d0e[m Initial commit
