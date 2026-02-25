#!/bin/bash
set -e

# Codex Linux Universal Installer
# Works on ALL Linux distributions via AppImage
# Usage: curl -fsSL https://codex-linux.dev/install.sh | bash

REPO="ranker-002/codex-linux"
APP_NAME="Codex Linux"
BINARY_NAME="codex-linux"
DESKTOP_ENTRY="codex-linux.desktop"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_banner() {
    echo -e "${BLUE}"
    echo "=========================================="
    echo "        Codex Linux Installer"
    echo "=========================================="
    echo -e "${NC}"
    echo -e "${GREEN}Universal Installer (AppImage)${NC}"
    echo ""
}

info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

detect_arch() {
    local arch=$(uname -m)
    case $arch in
        x86_64) echo "x64" ;;
        aarch64|arm64) echo "arm64" ;;
        *) error "Unsupported architecture: $arch"; exit 1 ;;
    esac
}

get_latest_version() {
    local api_url="https://api.github.com/repos/${REPO}/releases/latest"
    local version=$(curl -fsSL "$api_url" 2>/dev/null | grep -o '"tag_name": "[^"]*"' | cut -d'"' -f4)
    if [ -z "$version" ]; then
        error "Failed to get latest version. Using fallback v1.0.0"
        echo "v1.0.0"
    else
        echo "$version"
    fi
}

download_appimage() {
    local version=$1
    local arch=$2
    local url="https://github.com/${REPO}/releases/download/${version}/Codex.Linux-${version#v}.AppImage"
    local output="$BINARY_NAME.AppImage"

    info "Downloading ${APP_NAME} ${version} (${arch})..."

    if command -v curl &> /dev/null; then
        curl -fsSL -o "$output" "$url" -# || {
            error "Download failed. Trying wget..."
            return 1
        }
    elif command -v wget &> /dev/null; then
        wget -q --show-progress -O "$output" "$url" || {
            error "Download failed"
            return 1
        }
    else
        error "curl or wget is required"
        exit 1
    fi

    if [ ! -f "$output" ]; then
        error "Download failed - file not found"
        return 1
    fi

    chmod +x "$output"
    success "Downloaded $output"
}

create_desktop_entry() {
    local install_dir=$1
    cat > "$DESKTOP_ENTRY" << EOF
[Desktop Entry]
Name=Codex Linux
Comment=Multi-agent AI coding command center
Exec=$install_dir/$BINARY_NAME.AppImage
Icon=$install_dir/$BINARY_NAME.png
Type=Application
Categories=Development;IDE;
Terminal=false
StartupNotify=true
MimeType=text/plain;text/x-python;text/javascript;
EOF
}

install_user() {
    local install_dir="$HOME/.local/bin"
    local apps_dir="$HOME/.local/share/applications"
    local icons_dir="$HOME/.local/share/icons/hicolor/512x512/apps"

    info "Installing to user directory (~/.local)..."

    mkdir -p "$install_dir" "$apps_dir" "$icons_dir"

    mv "$BINARY_NAME.AppImage" "$install_dir/"
    ln -sf "$install_dir/$BINARY_NAME.AppImage" "$install_dir/$BINARY_NAME"

    create_desktop_entry "$install_dir"
    mv "$DESKTOP_ENTRY" "$apps_dir/"

    # Try to extract icon
    if "$install_dir/$BINARY_NAME.AppImage" --appimage-extract .DirIcon &> /dev/null; then
        mv squashfs-root/.DirIcon "$icons_dir/$BINARY_NAME.png" 2>/dev/null || true
        rm -rf squashfs-root 2>/dev/null || true
    fi

    if command -v update-desktop-database &> /dev/null; then
        update-desktop-database "$apps_dir" 2>/dev/null || true
    fi

    # Add to PATH if needed
    if [[ ":$PATH:" != *":$install_dir:"* ]]; then
        if [ -f "$HOME/.bashrc" ]; then
            echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
        fi
        if [ -f "$HOME/.zshrc" ]; then
            echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.zshrc"
        fi
        warn "Added ~/.local/bin to PATH. Run: source ~/.bashrc (or restart terminal)"
    fi

    # Create uninstall script
    cat > "$install_dir/uninstall-codex-linux.sh" << 'UNINSTALLEOF'
#!/bin/bash
echo "Uninstalling Codex Linux..."
rm -f "$HOME/.local/bin/codex-linux"
rm -f "$HOME/.local/bin/codex-linux.AppImage"
rm -f "$HOME/.local/share/applications/codex-linux.desktop"
rm -f "$HOME/.local/share/icons/hicolor/512x512/apps/codex-linux.png"
update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
echo "Uninstalled successfully!"
UNINSTALLEOF
    chmod +x "$install_dir/uninstall-codex-linux.sh"

    success "Installed to $install_dir"
}

install_system() {
    local install_dir="/opt/$BINARY_NAME"
    local apps_dir="/usr/share/applications"
    local icons_dir="/usr/share/icons/hicolor/512x512/apps"

    info "Installing system-wide to /opt..."

    if [ "$EUID" -ne 0 ]; then
        error "System-wide install requires sudo. Run with sudo or use --user flag"
        exit 1
    fi

    mkdir -p "$install_dir" "$apps_dir" "$icons_dir"

    mv "$BINARY_NAME.AppImage" "$install_dir/"
    ln -sf "$install_dir/$BINARY_NAME.AppImage" "/usr/local/bin/$BINARY_NAME"

    create_desktop_entry "$install_dir"
    mv "$DESKTOP_ENTRY" "$apps_dir/"

    if "$install_dir/$BINARY_NAME.AppImage" --appimage-extract .DirIcon &> /dev/null; then
        mv squashfs-root/.DirIcon "$icons_dir/$BINARY_NAME.png" 2>/dev/null || true
        rm -rf squashfs-root 2>/dev/null || true
    fi

    if command -v update-desktop-database &> /dev/null; then
        update-desktop-database "$apps_dir" 2>/dev/null || true
    fi

    success "Installed to $install_dir"
}

uninstall() {
    info "Uninstalling ${APP_NAME}..."

    rm -f "$HOME/.local/bin/$BINARY_NAME"
    rm -f "$HOME/.local/bin/$BINARY_NAME.AppImage"
    rm -f "$HOME/.local/share/applications/$DESKTOP_ENTRY"
    rm -f "$HOME/.local/share/icons/hicolor/512x512/apps/$BINARY_NAME.png"
    rm -f "$HOME/.local/bin/uninstall-$BINARY_NAME.sh"

    if [ "$EUID" -eq 0 ]; then
        rm -f "/usr/local/bin/$BINARY_NAME"
        rm -rf "/opt/$BINARY_NAME" 2>/dev/null || true
        rm -f "/usr/share/applications/$DESKTOP_ENTRY"
        rm -f "/usr/share/icons/hicolor/512x512/apps/$BINARY_NAME.png"
    fi

    if command -v update-desktop-database &> /dev/null; then
        update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
    fi

    success "Uninstalled successfully"
}

main() {
    print_banner

    local install_mode="user"
    local version=""

    while [[ $# -gt 0 ]]; do
        case $1 in
            --user) install_mode="user"; shift ;;
            --system) install_mode="system"; shift ;;
            --uninstall) uninstall; exit 0 ;;
            --version) version="$2"; shift 2 ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --user         Install to ~/.local/bin (default)"
                echo "  --system       Install to /opt (requires sudo)"
                echo "  --uninstall    Remove Codex Linux"
                echo "  --version TAG  Install specific version"
                echo "  --help         Show this help"
                echo ""
                echo "Examples:"
                echo "  curl -fsSL https://codex-linux.dev/install.sh | bash"
                echo "  curl -fsSL https://codex-linux.dev/install.sh | sudo bash -s -- --system"
                exit 0
                ;;
            *) error "Unknown option: $1"; exit 1 ;;
        esac
    done

    if ! command -v curl &> /dev/null && ! command -v wget &> /dev/null; then
        error "curl or wget is required"
        exit 1
    fi

    if [ -z "$version" ]; then
        info "Fetching latest version..."
        version=$(get_latest_version)
    fi

    info "Installing ${APP_NAME} ${version}..."

    local arch=$(detect_arch)
    info "Detected architecture: $arch"

    download_appimage "$version" "$arch" || {
        error "Failed to download. Please check your internet connection."
        exit 1
    }

    if [ "$install_mode" = "system" ]; then
        install_system
    else
        install_user
    fi

    echo ""
    success "${APP_NAME} installed successfully!"
    echo ""
    echo -e "Run with: ${GREEN}codex-linux${NC}"
    echo -e "Or find it in your application menu"
    echo ""
}

main "$@"
