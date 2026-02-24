#!/usr/bin/env node

/**
 * Download script for Codex Linux NPM package
 * Downloads the latest AppImage from GitHub releases
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO = 'ranker-org/codex-linux-app';
const APP_NAME = 'Codex Linux';
const BINARY_NAME = 'codex-linux';

// Colors for terminal output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    blue: '\x1b[34m'
};

function log(message) {
    console.log(message);
}

function success(message) {
    console.log(`${colors.green}✓${colors.reset} ${message}`);
}

function info(message) {
    console.log(`${colors.blue}→${colors.reset} ${message}`);
}

function warn(message) {
    console.log(`${colors.yellow}⚠${colors.reset} ${message}`);
}

function error(message) {
    console.error(`${colors.red}✗${colors.reset} ${message}`);
}

function getArch() {
    const arch = process.arch;
    switch (arch) {
        case 'x64': return 'x64';
        case 'arm64': return 'arm64';
        default:
            error(`Unsupported architecture: ${arch}`);
            process.exit(1);
    }
}

function getPlatform() {
    if (process.platform !== 'linux') {
        error(`${APP_NAME} is only available for Linux`);
        error(`Your platform: ${process.platform}`);
        process.exit(1);
    }
    return 'linux';
}

async function fetchLatestVersion() {
    const apiUrl = `https://api.github.com/repos/${REPO}/releases/latest`;

    return new Promise((resolve, reject) => {
        const req = https.get(apiUrl, {
            headers: {
                'User-Agent': 'CodexLinux-Installer'
            }
        }, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                // Follow redirect
                const newUrl = res.headers.location;
                https.get(newUrl, { headers: { 'User-Agent': 'CodexLinux-Installer' } }, (res2) => {
                    handleResponse(res2, resolve, reject);
                }).on('error', reject);
            } else {
                handleResponse(res, resolve, reject);
            }
        });

        req.on('error', (err) => {
            reject(new Error(`Failed to fetch version: ${err.message}`));
        });

        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

function handleResponse(res, resolve, reject) {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.tag_name) {
                resolve(json.tag_name);
            } else {
                reject(new Error('Invalid response from GitHub API'));
            }
        } catch (err) {
            reject(new Error(`Failed to parse response: ${err.message}`));
        }
    });
    res.on('error', reject);
}

function downloadFile(url, dest, onProgress) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        let downloaded = 0;
        let total = 0;

        https.get(url, { headers: { 'User-Agent': 'CodexLinux-Installer' } }, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                // Follow redirect
                file.close();
                fs.unlinkSync(dest);
                downloadFile(response.headers.location, dest, onProgress)
                    .then(resolve)
                    .catch(reject);
                return;
            }

            if (response.statusCode !== 200) {
                file.close();
                fs.unlinkSync(dest);
                reject(new Error(`HTTP ${response.statusCode}`));
                return;
            }

            total = parseInt(response.headers['content-length'], 10);

            response.on('data', (chunk) => {
                downloaded += chunk.length;
                if (onProgress && total) {
                    const percent = Math.round((downloaded / total) * 100);
                    onProgress(percent, downloaded, total);
                }
            });

            response.pipe(file);

            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlinkSync(dest);
            reject(err);
        });
    });
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function main() {
    const forceDownload = process.argv.includes('--force');

    log('');
    log(`${colors.blue}╔══════════════════════════════════════╗${colors.reset}`);
    log(`${colors.blue}║${colors.reset}      ${APP_NAME} Installer      ${colors.blue}║${colors.reset}`);
    log(`${colors.blue}╚══════════════════════════════════════╝${colors.reset}`);
    log('');

    // Check platform
    getPlatform();

    const installDir = path.join(os.homedir(), '.local', 'bin');
    const appImagePath = path.join(installDir, `${BINARY_NAME}.AppImage`);
    const versionFile = path.join(installDir, `.${BINARY_NAME}-version`);

    // Check if already installed
    if (!forceDownload && fs.existsSync(appImagePath)) {
        let currentVersion = '';
        if (fs.existsSync(versionFile)) {
            currentVersion = fs.readFileSync(versionFile, 'utf8').trim();
        }

        if (currentVersion) {
            info(`Already installed: ${currentVersion}`);
            info('Use --force to reinstall or npm update -g codex-linux');
            return;
        }
    }

    // Get latest version
    info('Fetching latest version...');
    let version;
    try {
        version = await fetchLatestVersion();
        info(`Latest version: ${version}`);
    } catch (err) {
        error(`Failed to fetch version: ${err.message}`);
        warn('Using fallback version v1.0.0');
        version = 'v1.0.0';
    }

    const arch = getArch();
    const downloadUrl = `https://github.com/${REPO}/releases/download/${version}/Codex-Linux-${version}-${arch}.AppImage`;

    // Create install directory
    if (!fs.existsSync(installDir)) {
        fs.mkdirSync(installDir, { recursive: true });
    }

    // Download
    const tempPath = `${appImagePath}.tmp`;

    info(`Downloading ${APP_NAME} ${version} (${arch})...`);
    info(`URL: ${downloadUrl}`);

    let lastPercent = -1;
    try {
        await downloadFile(downloadUrl, tempPath, (percent, downloaded, total) => {
            if (percent !== lastPercent) {
                process.stdout.write(`\r${colors.blue}→${colors.reset} Progress: ${percent}% (${formatBytes(downloaded)}/${formatBytes(total)})`);
                lastPercent = percent;
            }
        });
        process.stdout.write('\n');
    } catch (err) {
        error(`Download failed: ${err.message}`);
        process.exit(1);
    }

    // Move to final location
    fs.renameSync(tempPath, appImagePath);
    fs.chmodSync(appImagePath, 0o755);

    // Save version
    fs.writeFileSync(versionFile, version);

    // Create symlink
    const symlinkPath = path.join(installDir, BINARY_NAME);
    if (fs.existsSync(symlinkPath)) {
        fs.unlinkSync(symlinkPath);
    }
    fs.symlinkSync(appImagePath, symlinkPath);

    success(`Installed ${APP_NAME} ${version}`);
    success(`Location: ${appImagePath}`);

    // Check if in PATH
    const envPath = process.env.PATH || '';
    if (!envPath.includes(installDir)) {
        warn(`${installDir} is not in your PATH`);
        info('Add to your shell profile:');
        log(`  export PATH="${installDir}:$PATH"`);
    }

    log('');
    log(`${colors.green}${APP_NAME} is ready!${colors.reset}`);
    log(`Run: ${colors.yellow}codex-linux${colors.reset}`);
    log('');
}

main().catch(err => {
    error(`Unexpected error: ${err.message}`);
    process.exit(1);
});
