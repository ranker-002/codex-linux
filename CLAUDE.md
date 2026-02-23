# CLAUDE.md - Codex Linux Configuration

## Project

**Name:** Codex Linux  
**Description:** A powerful Linux port of OpenAI Codex - command center for managing multiple AI coding agents in parallel  
**Language:** TypeScript  
**Framework:** Electron + React

## Coding Standards

**Style:** Follow TypeScript strict mode with explicit types  
**Linter:** ESLint with TypeScript parser  
**Formatter:** Prettier with 2-space indentation  
**Max Line Length:** 100  
**Indent Size:** 2  
**Use Tabs:** false

## Architecture

### Patterns
- Event-driven architecture with EventEmitter
- Manager pattern for core functionality
- Repository pattern for database operations
- Component-based UI architecture
- Provider pattern for AI services

### Conventions
- Use async/await for asynchronous operations
- Prefer dependency injection over singletons
- Implement proper error handling with try/catch
- Use meaningful variable names (no single letter except loops)
- Always clean up resources (intervals, listeners, files)

### Design Principles
- Single Responsibility Principle
- Don't Repeat Yourself (DRY)
- Keep It Simple, Stupid (KISS)
- Fail fast with clear error messages
- Security by default

## Libraries

### Preferred
- electron-log for logging
- better-sqlite3 for database
- simple-git for Git operations
- uuid for unique IDs
- node-cron for scheduling
- zod for validation

### Testing
- Jest for unit tests
- Playwright for E2E tests
- @testing-library/react for component tests

### Utilities
- lodash for utilities
- date-fns for date manipulation
- node-fetch for HTTP requests

### Avoid
- Avoid using any type - always define types
- Avoid callbacks - use promises/async-await
- Avoid mutating state directly in React
- Avoid hardcoded values - use constants

## Review Checklist

### Required
- [ ] All TypeScript types are defined
- [ ] Error handling is implemented
- [ ] No console.log - use electron-log
- [ ] Security best practices followed
- [ ] Database migrations included if needed

### Security
- [ ] No hardcoded secrets or API keys
- [ ] Input validation implemented
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention in rendered content
- [ ] File path validation before operations

### Performance
- [ ] Database queries are optimized
- [ ] No memory leaks (cleanup intervals/listeners)
- [ ] Lazy loading for heavy components
- [ ] Debouncing for frequent operations

## Tools

**Build:** `npm run build`  
**Test:** `npm test`  
**Lint:** `npm run lint`  
**Typecheck:** `npx tsc --noEmit`

## Custom Prompts

### System Prompt
You are an expert TypeScript developer working on Codex Linux, an Electron application for managing AI coding agents. Follow the coding standards defined in this project. Always provide type-safe code with proper error handling.

### Before Action
Check if the operation requires permission based on the current permission mode. Log all actions using electron-log.

### After Action
Verify the changes compile without TypeScript errors. Run the linter and formatter before marking as complete.

### Commit Message
Format: `type(scope): description`

Types: feat, fix, docs, style, refactor, test, chore

Example: `feat(agents): add CLAUDE.md support`

### PR Description
Include:
- What changed
- Why it changed
- Testing performed
- Breaking changes (if any)

## Agents

**Default Model:** gpt-4o  
**Default Provider:** openai  
**Skills:** 
- code-review
- refactoring
- testing

**Permission Mode:** ask

## MCP

### Servers

#### Filesystem
**Command:** npx -y @modelcontextprotocol/server-filesystem  
**Environment:** 
- ALLOWED_DIRS=/home/user/projects

#### Git
**Command:** npx -y @modelcontextprotocol/server-git  
**Environment:**
- REPO_ROOT=/home/user/codex-linux-app

## Hooks

**Pre-Edit:** npm run lint:staged  
**Post-Edit:** npm run format  
**Pre-Commit:** npm run typecheck && npm test  
**Post-Commit:** echo "Changes committed successfully"

## Ignore

- node_modules
- dist
- build
- .git
- *.log
- coverage
- .env
- .env.local
