#!/bin/bash

# Codex Linux Installation Script
# Supports: Ubuntu/Debian, Fedora/RHEL/CentOS, Arch Linux

set -e

echo "🚀 Installing Codex Linux..."

# Detect distribution
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VER=$VERSION_ID
else
    echo "❌ Cannot detect Linux distribution"
    exit 1
fi

# Install dependencies based on distribution
case $OS in
    ubuntu|debian)
        echo "📦 Installing dependencies for Debian/Ubuntu..."
        sudo apt-get update
        sudo apt-get install -y git nodejs npm libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6 xdg-utils libatspi2.0-0 libuuid1 libsecret-1-0
        ;;
    fedora|rhel|centos)
        echo "📦 Installing dependencies for Fedora/RHEL..."
        sudo dnf install -y git nodejs npm gtk3 libnotify nss libXScrnSaver libXtst xdg-utils at-spi2-core libuuid libsecret
        ;;
    arch|manjaro)
        echo "📦 Installing dependencies for Arch Linux..."
        sudo pacman -S --noconfirm git nodejs npm gtk3 libnotify nss libxss libxtst xdg-utils at-spi2-core util-linux-libs libsecret
        ;;
    *)
        echo "⚠️  Unsupported distribution: $OS"
        echo "Please install manually: git, nodejs, npm, and Electron dependencies"
        ;;
esac

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18+ is required. Current version: $(node --version)"
    exit 1
fi

# Create installation directory
INSTALL_DIR="$HOME/.local/share/codex-linux"
mkdir -p "$INSTALL_DIR"

# Copy application files
echo "📂 Installing application files..."
cp -r dist "$INSTALL_DIR/"
cp -r assets "$INSTALL_DIR/"
cp package.json "$INSTALL_DIR/"

# Create desktop entry
echo "🖥️  Creating desktop entry..."
mkdir -p "$HOME/.local/share/applications"
cat > "$HOME/.local/share/applications/codex-linux.desktop" << EOF
[Desktop Entry]
Name=Codex Linux
Comment=Multi-agent AI coding command center
Exec=$INSTALL_DIR/dist/main/main.js
Icon=$INSTALL_DIR/assets/icon.png
Type=Application
Categories=Development;IDE;
Terminal=false
StartupNotify=true
EOF

# Update desktop database
update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true

# Create symlink in PATH
mkdir -p "$HOME/.local/bin"
ln -sf "$INSTALL_DIR/dist/main/main.js" "$HOME/.local/bin/codex-linux"

# Install npm dependencies
echo "📥 Installing npm dependencies..."
cd "$INSTALL_DIR"
npm install --production

# Create config directory
mkdir -p "$HOME/.config/codex"

# Set permissions
chmod +x "$INSTALL_DIR/dist/main/main.js"

echo ""
echo "✅ Codex Linux has been installed successfully!"
echo ""
echo "🎯 Quick Start:"
echo "   1. Launch Codex Linux from your applications menu"
echo "   2. Configure your API keys in Settings → AI Providers"
echo "   3. Create your first agent and start coding!"
echo ""
echo "📖 Documentation: https://codex-linux.readthedocs.io"
echo "🐛 Report issues: https://github.com/yourusername/codex-linux/issues"
echo ""
echo "💡 Tip: Run 'codex-linux' from terminal to see logs"
echo ""