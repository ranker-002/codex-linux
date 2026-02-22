# Codex Linux API Documentation

## Base URL
```
http://localhost:3001/api
```

## Authentication
All API requests require an API key header:
```
X-API-Key: your-api-key-here
```

## Endpoints

### Health Check

#### GET /health
Check if the server is running.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Agents

#### GET /agents
List all agents.

**Response:**
```json
[
  {
    "id": "agent-uuid",
    "name": "My Agent",
    "status": "idle",
    "projectPath": "/path/to/project",
    "model": "gpt-4o",
    "createdAt": "2024-01-15T10:00:00.000Z"
  }
]
```

#### POST /agents
Create a new agent.

**Request Body:**
```json
{
  "name": "My Agent",
  "projectPath": "/path/to/project",
  "providerId": "openai",
  "model": "gpt-4o",
  "skills": ["skill-1", "skill-2"]
}
```

**Response:**
```json
{
  "id": "agent-uuid",
  "name": "My Agent",
  "status": "idle",
  "projectPath": "/path/to/project",
  "worktreeName": "codex-agent-xxx",
  "providerId": "openai",
  "model": "gpt-4o",
  "skills": ["skill-1", "skill-2"],
  "createdAt": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2024-01-15T10:00:00.000Z"
}
```

#### GET /agents/:id
Get agent details.

**Response:**
```json
{
  "id": "agent-uuid",
  "name": "My Agent",
  "status": "running",
  "projectPath": "/path/to/project",
  "worktreeName": "codex-agent-xxx",
  "providerId": "openai",
  "model": "gpt-4o",
  "skills": ["skill-1"],
  "messages": [...],
  "tasks": [...],
  "createdAt": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

#### DELETE /agents/:id
Delete an agent.

**Response:** `204 No Content`

#### POST /agents/:id/messages
Send a message to an agent.

**Request Body:**
```json
{
  "message": "Hello, can you help me refactor this code?"
}
```

**Response:**
```json
{
  "id": "message-uuid",
  "role": "assistant",
  "content": "I'd be happy to help you refactor your code...",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "metadata": {
    "usage": {
      "prompt_tokens": 50,
      "completion_tokens": 100,
      "total_tokens": 150
    }
  }
}
```

#### POST /agents/:id/tasks
Execute a task with an agent.

**Request Body:**
```json
{
  "task": "Refactor all JavaScript files to use async/await"
}
```

**Response:**
```json
{
  "id": "task-uuid",
  "description": "Refactor all JavaScript files to use async/await",
  "status": "running",
  "progress": 0,
  "startedAt": "2024-01-15T10:30:00.000Z"
}
```

### Skills

#### GET /skills
List all available skills.

**Response:**
```json
[
  {
    "id": "code-review",
    "name": "Code Review",
    "description": "Comprehensive code review guidelines",
    "version": "1.0.0",
    "tags": ["review", "quality"]
  }
]
```

### Automations

#### GET /automations
List all automations.

#### POST /automations
Create a new automation.

**Request Body:**
```json
{
  "name": "Daily Code Review",
  "description": "Run code review every morning",
  "trigger": {
    "type": "schedule",
    "config": {
      "cron": "0 9 * * *"
    }
  },
  "actions": [
    {
      "type": "createAgent",
      "config": {
        "name": "Review Agent",
        "skill": "code-review"
      }
    }
  ]
}
```

### Webhooks

#### POST /webhooks/automation
Trigger an automation via webhook.

**Request Body:**
```json
{
  "automationId": "automation-uuid",
  "payload": {
    "event": "push",
    "branch": "main"
  }
}
```

## WebSocket Events

Connect to WebSocket at:
```
ws://localhost:3001
```

### Events

#### Subscribe to Agent
```json
{
  "type": "subscribe_agent",
  "agentId": "agent-uuid"
}
```

#### Send Message
```json
{
  "type": "send_message",
  "data": {
    "agentId": "agent-uuid",
    "message": "Hello"
  }
}
```

#### Receive Agent Message
```json
{
  "type": "agent_message",
  "data": {
    "agentId": "agent-uuid",
    "message": {
      "id": "msg-uuid",
      "role": "assistant",
      "content": "Response content"
    }
  }
}
```

#### Task Completed
```json
{
  "type": "task_completed",
  "data": {
    "agentId": "agent-uuid",
    "task": {
      "id": "task-uuid",
      "status": "completed",
      "result": "Task completed successfully"
    }
  }
}
```

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Status Codes
- `200` - Success
- `201` - Created
- `204` - No Content
- `400` - Bad Request
- `401` - Unauthorized
- `404` - Not Found
- `500` - Internal Server Error

## Rate Limiting

API requests are limited to:
- 100 requests per 15 minutes per IP
- 1000 requests per hour per API key

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```