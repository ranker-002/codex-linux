# Codex Linux - User Guide

## Table of Contents
1. [Installation](#installation)
2. [Quick Start](#quick-start)
3. [Interface Overview](#interface-overview)
4. [Features](#features)
5. [Agents](#agents)
6. [Skills](#skills)
7. [Git Integration](#git-integration)
8. [Automation](#automation)
9. [CLI Usage](#cli-usage)
10. [VS Code Extension](#vs-code-extension)
11. [Configuration](#configuration)
12. [Troubleshooting](#troubleshooting)

---

## Installation

### Prerequisites
- Node.js 18+ 
- Git
- npm or pnpm

### Linux Installation

```bash
# Clone the repository
git clone https://github.com/codex-linux/codex-linux-app.git
cd codex-linux-app

# Install dependencies
npm install

# Build the application
npm run build

# Run in development mode
npm run dev

# Package for Linux
npm run package:linux
```

### Docker Installation

```bash
# Using docker-compose
docker-compose up -d

# Access the application
# Open http://localhost:3000 in your browser
```

---

## Quick Start

1. **Launch Codex Linux**: Run `npm run dev` or launch the packaged app
2. **Configure API Keys**: Go to Settings and add your OpenAI/Anthropic API keys
3. **Create Your First Agent**: Click "+ New Agent" in the sidebar
4. **Start Coding**: Use the chat interface to instruct your agent

---

## Interface Overview

### Main Layout
- **Sidebar**: Navigation, agents list, file explorer
- **Main Panel**: Chat interface, code editor, diff viewer
- **Terminal**: Integrated terminal for command execution
- **Header**: App controls, search, settings

### Panels
- **Chat Interface**: AI-powered conversations with agents
- **File Explorer**: Browse and manage project files
- **Git Panel**: Version control operations
- **Skills Panel**: Manage AI skills and instructions
- **Automation Panel**: Schedule and run automated tasks

---

## Features

### Multi-Agent Orchestration
Run multiple AI agents in parallel with isolated workspaces:
- Each agent gets its own Git worktree
- Agents can collaborate on complex tasks
- Real-time status updates

### Code Editor (Monaco)
- Syntax highlighting for 50+ languages
- Auto-completion and IntelliSense
- Diff view for code review
- Multiple themes (VS Dark, Light, High Contrast)

### Git Integration
- Worktree management per agent
- Branch creation and switching
- Commit history visualization
- PR monitoring and auto-merge

### Skills System
Define custom AI behaviors:
- Code review skills
- Refactoring skills
- Testing skills
- Custom skill creation

### Automation
Schedule recurring tasks:
- Code quality checks
- Automated testing
- Deployment scripts
- Custom cron schedules

---

## Agents

### Creating an Agent
```bash
# Via CLI
codex agent create --name "MyAgent" --skill "code-review"

# Via UI
1. Click "+ New Agent"
2. Configure name, skills, and worktree
3. Click "Create"
```

### Agent Configuration
- **Name**: Unique identifier
- **Skills**: Attached AI capabilities
- **Worktree**: Isolated Git branch
- **Model**: AI model to use (GPT-4, Claude, etc.)

### Managing Agents
- Start/Stop agents
- View agent logs
- Delete inactive agents
- Monitor resource usage

---

## Skills

### Built-in Skills

#### Code Review
Analyzes code for:
- Security vulnerabilities
- Performance issues
- Code quality
- Best practices

#### Refactoring
Suggests improvements for:
- Code structure
- Naming conventions
- Design patterns
- Technical debt

#### Testing
Generates:
- Unit tests
- Integration tests
- E2E tests
- Test coverage reports

### Custom Skills

Create custom skills in `assets/skills/`:

```yaml
name: my-custom-skill
description: Custom skill description
instructions: |
  You are an expert in...
  When analyzing code, look for:
  - Performance bottlenecks
  - Security issues
```

---

## Git Integration

### Worktrees
Each agent works in an isolated Git worktree:
```bash
# Create worktree for agent
codex worktree create --agent my-agent --branch feature/new-feature

# List all worktrees
codex worktree list

# Delete worktree
codex worktree delete --agent my-agent
```

### PR Monitoring
Configure GitHub PR auto-handling:
- Auto-review on PR creation
- Auto-fix linting errors
- Auto-merge when checks pass

---

## Automation

### Creating Automations
```bash
# Create scheduled automation
codex automation create \
  --name "daily-build" \
  --schedule "0 9 * * *" \
  --command "npm run build"
```

### Available Triggers
- **Cron**: Time-based scheduling
- **Git Hooks**: Post-commit, pre-push
- **File Watch**: On file change
- **Manual**: On-demand execution

---

## CLI Usage

### Installation
```bash
# Install CLI globally
npm install -g @codex-linux/cli

# Or use npx
npx @codex-linux/cli [command]
```

### Commands

#### Agent Management
```bash
codex agents list              # List all agents
codex agents create           # Create new agent
codex agents start <id>       # Start agent
codex agents stop <id>        # Stop agent
codex agents logs <id>        # View agent logs
```

#### Task Management
```bash
codex tasks list              # List running tasks
codex tasks create            # Create new task
codex tasks cancel <id>      # Cancel task
codex tasks logs <id>         # View task logs
```

#### File Operations
```bash
codex files read <path>       # Read file contents
codex files write <path>     # Write to file
codex files diff <path>      # Show file diff
codex files search <query>   # Search files
```

---

## VS Code Extension

### Installation
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search "Codex Linux"
4. Click Install

### Features
- **Agent Panel**: Manage agents from VS Code
- **Chat Integration**: Chat with agents inline
- **Code Actions**: AI-powered code suggestions
- **Inline Completion**: Smart code completion

### Configuration
```json
{
  "codexLinux.endpoint": "http://localhost:3000",
  "codexLinux.apiKey": "your-api-key",
  "codexLinux.defaultModel": "gpt-4"
}
```

---

## Configuration

### Environment Variables
```bash
# .env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_PATH=./data/codex.db
PORT=3000
LOG_LEVEL=info
```

### Settings UI
Access settings via:
- **Menu**: Settings > Preferences
- **Shortcut**: Ctrl+,
- **CLI**: `codex settings`

---

## Frequently Asked Questions (FAQ)

### General

**Q: What is Codex Linux?**
A: Codex Linux is a powerful AI-powered coding assistant that runs locally on your Linux machine. It leverages OpenAI's Codex and Claude models to help you write, debug, and refactor code.

**Q: How is Codex Linux different from Claude Code?**
A: Codex Linux is designed specifically for Linux with native integrations (Git worktrees, terminal, file system), while providing similar AI agent capabilities with additional enterprise features.

**Q: Is Codex Linux free to use?**
A: The application itself is open source. However, you'll need to provide your own API keys for AI providers (OpenAI, Anthropic, etc.).

### Installation

**Q: What are the system requirements?**
A: 
- Linux distribution (Ubuntu 20.04+ recommended)
- Node.js 18+ 
- Git
- 4GB RAM minimum (8GB recommended)
- 500MB disk space

**Q: Installation fails with permission errors**
A: Try running with sudo or fix npm permissions:
```bash
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH
```

**Q: Application won't start after installation**
A: 
1. Check Node.js version: `node --version` (must be 18+)
2. Clear cache: `npm cache clean --force`
3. Reinstall: `rm -rf node_modules && npm install`

### Usage

**Q: How do I create an agent?**
A: Click "+ New Agent" in the sidebar, give your agent a name and project path, then click "Create Agent".

**Q: Can I use multiple AI providers?**
A: Yes! Go to Settings > AI Providers to configure multiple providers (OpenAI, Anthropic, etc.). You can set a default provider or specify per-agent.

**Q: How do permissions work?**
A: 
- **Ask**: Agent asks before each action
- **Auto-accept edits**: Auto-accepts file edits, asks for commands
- **Plan**: Only analyzes, doesn't make changes
- **Bypass**: No permission prompts (use with caution)

**Q: Can I use my own fine-tuned models?**
A: Yes! Configure custom providers in Settings > AI Providers with your fine-tuned model endpoints.

### Features

**Q: What are Skills?**
A: Skills are reusable AI capabilities (code review, refactoring, testing) that can be applied to agents. See the Skills panel for available options.

**Q: How do worktrees work?**
A: Git worktrees let you work on multiple branches simultaneously. Create a worktree from the Worktrees panel - each gets its own isolated directory.

**Q: Can I automate tasks?**
A: Yes! Use the Automation panel to create scheduled tasks, git hooks, or file watchers.

### Troubleshooting

**Q: API key errors**
A: 
```bash
# Set environment variable
export OPENAI_API_KEY=sk-your-key
# Or configure in Settings UI
```

**Q: Slow performance**
A:
- Close unused agents
- Reduce context window size in settings
- Use a faster model (gpt-4o-mini)
- Check system resources

**Q: Database locked**
A:
```bash
pkill -f codex
rm ~/.config/codex/codex.db
npm run dev
```

**Q: Extension not working**
A: Reload VS Code: `Developer: Reload Window` from command palette

---

## Troubleshooting

### Common Issues

#### "API Key not found"
```bash
# Set API key
export OPENAI_API_KEY=sk-...
# Or use settings UI
```

#### "Database locked"
```bash
# Kill existing processes
pkill -f codex-linux
# Restart application
npm run dev
```

#### "Build failed"
```bash
# Clear node_modules and reinstall
rm -rf node_modules
npm install
npm run build
```

### Logs
- **Application logs**: `~/.codex-linux/logs/`
- **CLI logs**: `~/.codex-linux/cli.log`
- **Database**: `~/.codex-linux/codex.db`

### Getting Help
- GitHub Issues: https://github.com/codex-linux/codex-linux-app/issues
- Discord: https://discord.gg/codex-linux
- Documentation: https://docs.codex-linux.dev

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| New Chat | Ctrl+N |
| Search | Ctrl+K |
| Settings | Ctrl+, |
| Toggle Sidebar | Ctrl+B |
| Toggle Terminal | Ctrl+` |
| Save File | Ctrl+S |
| Format Code | Shift+Alt+F |
| Quick Actions | Ctrl+Shift+P |

---

## Security

- All data encrypted at rest (AES-256)
- API keys stored securely
- Audit logging for all operations
- Sandboxed agent execution

---

## License

MIT License - See LICENSE file for details
