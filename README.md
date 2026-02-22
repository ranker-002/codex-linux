# Codex Linux

A Linux port of OpenAI Codex - A powerful command center for managing multiple AI coding agents in parallel.

## Features

- **Multi-Agent Orchestration**: Manage multiple AI agents working in parallel on different tasks
- **Git Worktrees**: Isolate agent changes in separate worktrees for safe experimentation
- **Skills System**: Create and apply reusable skills to customize agent behavior
- **Automation**: Schedule recurring tasks and create automated workflows
- **Multi-Provider Support**: Works with OpenAI (GPT-4, GPT-5, Codex) and Anthropic (Claude) models
- **Change Review**: Review, approve, or reject agent code changes before applying
- **Linux Native**: Built specifically for Linux with AppImage, deb, and rpm packages

## Installation

### Prerequisites

- Node.js 18+ 
- Git
- Linux (Ubuntu 20.04+, Fedora 35+, or Arch Linux)

### From Source

```bash
# Clone the repository
git clone https://github.com/yourusername/codex-linux.git
cd codex-linux

# Install dependencies
npm install

# Build the application
npm run build

# Run in development mode
npm run dev

# Package for Linux
npm run package:linux
```

### Pre-built Packages

Download the latest release:

- **AppImage** (Universal): `Codex-Linux-1.0.0.AppImage`
- **Debian/Ubuntu**: `codex-linux_1.0.0_amd64.deb`
- **Fedora/RHEL**: `codex-linux-1.0.0.x86_64.rpm`
- **Arch Linux**: `codex-linux-1.0.0.pacman`

## Quick Start

1. **Launch Codex Linux** - Run the application from your applications menu or terminal

2. **Configure AI Provider**:
   - Go to Settings → AI Providers
   - Add your OpenAI or Anthropic API key
   - Test the connection

3. **Create Your First Agent**:
   - Click "+ New Agent"
   - Select a project folder
   - Choose a provider and model
   - Optionally apply skills

4. **Start Coding**:
   - Send messages to your agent
   - Assign tasks for parallel execution
   - Review changes in worktrees

## Configuration

### Environment Variables

```bash
# Optional: Set default API keys
export OPENAI_API_KEY="your-key-here"
export ANTHROPIC_API_KEY="your-key-here"
```

### Settings File

Settings are stored in `~/.config/codex/config.json`:

```json
{
  "theme": "dark",
  "defaultProvider": "openai",
  "defaultModel": "gpt-4o",
  "maxParallelAgents": 5,
  "shortcuts": {
    "agent:new": "Ctrl+Shift+N",
    "agent:send": "Ctrl+Enter"
  }
}
```

## Skills

Skills are reusable instructions that customize agent behavior:

1. Create skills in the Skills panel
2. Write instructions in markdown
3. Apply skills to agents when creating or editing

### Example Skill Structure

```
~/.config/codex/skills/my-skill/
├── skill.yaml          # Skill metadata
├── instructions.md     # Core instructions
└── templates/
    └── code-review.md  # Review template
```

## Automations

Create automated workflows:

- **Schedule**: Run on cron schedule (e.g., daily code review)
- **Event**: Trigger on git events or file changes
- **Webhook**: Trigger via HTTP requests
- **Manual**: Run on demand

## Worktrees

Git worktrees provide isolated environments for each agent:

- Changes are isolated from main branch
- Easy to review and merge
- Automatic cleanup on agent deletion
- Visual diff and merge tools

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| New Agent | `Ctrl+Shift+N` |
| Send Message | `Ctrl+Enter` |
| New Worktree | `Ctrl+Shift+W` |
| Open Skills | `Ctrl+Shift+S` |
| Open Automations | `Ctrl+Shift+A` |
| Open Settings | `Ctrl+,` |
| Command Palette | `Ctrl+Shift+P` |

## Architecture

```
codex-linux/
├── src/
│   ├── main/              # Electron main process
│   │   ├── agents/        # Agent orchestration
│   │   ├── git/           # Git worktree management
│   │   ├── skills/        # Skills system
│   │   ├── automations/   # Automation scheduler
│   │   └── providers/     # AI provider integrations
│   ├── renderer/          # React frontend
│   │   └── components/    # UI components
│   └── shared/            # Shared types
├── assets/                # Icons and images
└── tests/                 # Test suites
```

## Development

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint
npm run lint:fix
```

### Type Checking

```bash
npm run typecheck
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- Inspired by OpenAI Codex
- Built with Electron, React, and TypeScript
- Uses Simple Git for git operations
- Icons by Lucide

## Support

- GitHub Issues: [Report bugs or request features](https://github.com/yourusername/codex-linux/issues)
- Documentation: [Full documentation](https://codex-linux.readthedocs.io)
- Discord: [Join our community](https://discord.gg/codex-linux)