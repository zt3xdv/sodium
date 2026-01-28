# API Reference

All endpoints are prefixed with `/api`. Authentication uses JWT tokens in the `Authorization: Bearer <token>` header.

## Authentication

### Register

```http
POST /api/auth/register
Content-Type: application/json

{"username": "string", "password": "string"}
```

### Login

```http
POST /api/auth/login
Content-Type: application/json

{"username": "string", "password": "string"}
```

Response:
```json
{"success": true, "user": {...}, "token": "jwt-token"}
```

## Servers

### List Servers

```http
GET /api/servers
```

### Create Server

```http
POST /api/servers

{"name": "string", "egg_id": "string", "memory": 1024, "disk": 5120, "cpu": 100}
```

### Power Actions

```http
POST /api/servers/:id/power

{"action": "start|stop|restart|kill"}
```

### Send Command

```http
POST /api/servers/:id/command

{"command": "string"}
```

### File Management

```http
GET  /api/servers/:id/files?path=/
GET  /api/servers/:id/files/content?path=/file.txt
POST /api/servers/:id/files/save
POST /api/servers/:id/files/rename
POST /api/servers/:id/files/delete
POST /api/servers/:id/files/create-folder
```

## Admin Endpoints

Require admin privileges.

### Nodes

```http
GET    /api/admin/nodes
POST   /api/admin/nodes
PUT    /api/admin/nodes/:id
DELETE /api/admin/nodes/:id
GET    /api/admin/nodes/:id/config
GET    /api/admin/nodes/:id/deploy
```

### Users

```http
GET /api/admin/users
PUT /api/admin/users/:id
```

### Nests and Eggs

```http
GET    /api/admin/nests
POST   /api/admin/nests
DELETE /api/admin/nests/:id

GET    /api/admin/eggs
POST   /api/admin/eggs
POST   /api/admin/eggs/import
PUT    /api/admin/eggs/:id
DELETE /api/admin/eggs/:id
```

### Settings

```http
GET /api/admin/settings
PUT /api/admin/settings
```

## WebSocket

Console access:

```
ws://panel.example.com/ws/console?server=<id>&token=<jwt>
```

Events: `auth`, `console output`, `status`, `stats`
