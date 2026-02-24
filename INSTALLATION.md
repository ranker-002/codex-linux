# Installation Guide

## Quick Install (Recommended)

### Option 1: One-line Installer (All Linux Distributions)

```bash
curl -fsSL https://codex-linux.dev/install.sh | bash
```

This installs the AppImage to `~/.local/bin/` and creates a desktop entry.

**System-wide install (requires sudo):**
```bash
curl -fsSL https://codex-linux.dev/install.sh | sudo bash -s -- --system
```

**Uninstall:**
```bash
~/.local/bin/uninstall-codex-linux.sh
```

---

### Option 2: NPM (For Node.js Developers)

```bash
# Install globally
npm install -g codex-linux

# Launch
codex-linux
```

**Run without installing:**
```bash
npx codex-linux
```

**Update:**
```bash
npm update -g codex-linux
```

---

## Manual Installation

### AppImage (Universal)

1. Download the latest AppImage from [Releases](https://github.com/ranker-org/codex-linux-app/releases)
2. Make it executable: `chmod +x Codex-Linux-*.AppImage`
3. Run it: `./Codex-Linux-*.AppImage`

### Debian/Ubuntu

```bash
wget https://github.com/ranker-org/codex-linux-app/releases/latest/download/codex-linux_amd64.deb
sudo dpkg -i codex-linux_amd64.deb
sudo apt-get install -f  # Fix any dependency issues
```

### Fedora/RHEL

```bash
wget https://github.com/ranker-org/codex-linux-app/releases/latest/download/codex-linux.x86_64.rpm
sudo rpm -i codex-linux.x86_64.rpm
```

### Arch Linux

```bash
wget https://github.com/ranker-org/codex-linux-app/releases/latest/download/codex-linux.pacman
sudo pacman -U codex-linux.pacman
```

---

## Post-Installation

1. **Launch Codex Linux**:
   - From applications menu
   - Or run `codex-linux` from terminal

2. **Configure AI Provider**:
   - Open Settings → AI Providers
   - Add your API key (OpenAI, Anthropic, or use free models)

3. **Create your first agent**:
   - Click "+ New Agent"
   - Select a project folder
   - Choose provider and model
   - Start coding!

---

## Troubleshooting

### AppImage won't run

If the AppImage doesn't launch, you may need to install FUSE:

**Ubuntu/Debian:**
```bash
sudo apt install libfuse2
```

**Fedora/RHEL:**
```bash
sudo dnf install fuse
```

**Arch:**
```bash
sudo pacman -S fuse2
```

### Permission denied

Make sure the AppImage is executable:
```bash
chmod +x Codex-Linux-*.AppImage
```

### Not in PATH

If `codex-linux` command is not found after installation:

```bash
# Add to your shell profile
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

---

## Supported Platforms

| Platform | Architecture | Status |
|----------|-------------|--------|
| Linux (glibc) | x64 | ✅ Fully supported |
| Linux (glibc) | arm64 | ✅ Fully supported |
| Linux (musl) | x64 | ⚠️ May require FUSE |

---

## Auto-Updates

Codex Linux includes automatic update checking. When a new version is available, you'll be notified in the application.

To manually check for updates:
- Go to Settings → About → Check for Updates
