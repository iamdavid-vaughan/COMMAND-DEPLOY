# Building focal-deploy

This document explains how to build `focal-deploy` for different platforms and architectures.

## Prerequisites

- Node.js 18 or higher
- npm or yarn
- Platform-specific build tools (see below)

## Native Modules

`focal-deploy` uses native Node.js modules (particularly `keytar` for secure credential storage). These modules must be compiled for the specific target architecture.

### Important Notes

⚠️ **Architecture Matching**: Native modules must be built on or for the target architecture:
- **macOS ARM64 (Apple Silicon)**: Must be built on an Apple Silicon Mac
- **macOS x64 (Intel)**: Must be built on an Intel Mac or cross-compiled
- **Linux ARM64**: Must be built on ARM64 Linux or using Docker/QEMU
- **Linux x64**: Must be built on x64 Linux
- **Windows x64**: Must be built on Windows x64

### Fallback Behavior

If the native `keytar` module fails to load (e.g., due to architecture mismatch), `focal-deploy` will automatically fall back to encrypted file-based credential storage. This ensures the application works even when keytar is unavailable.

## Platform-Specific Build Tools

### macOS

```bash
# Install Xcode Command Line Tools
xcode-select --install
```

### Linux

```bash
# Debian/Ubuntu
sudo apt-get install build-essential libsecret-1-dev

# RHEL/CentOS/Fedora
sudo yum install gcc-c++ make libsecret-devel

# Arch Linux
sudo pacman -S base-devel libsecret
```

### Windows

```bash
# Install Visual Studio Build Tools
# https://visualstudio.microsoft.com/downloads/
# Or use windows-build-tools
npm install --global windows-build-tools
```

## Building

### Quick Start

```bash
# Install dependencies
npm install

# Build for all platforms
npm run package:all

# Build for specific platforms
npm run package:macos
npm run package:linux
npm run package:windows
```

### Building for Specific Architectures

The build process creates architecture-specific binaries in the `dist/` directory:

```
dist/
├── macos/
│   ├── focal-deploy-x64
│   └── focal-deploy-arm64
├── linux/
│   ├── focal-deploy-x64
│   └── focal-deploy-arm64
└── windows/
    └── focal-deploy.exe
```

### Cross-Architecture Builds

**Important**: For production builds with native modules, you should build on the target architecture.

#### Option 1: Build on Native Hardware

The most reliable approach:

1. **macOS ARM64**: Build on Apple Silicon Mac
   ```bash
   npm run package:macos
   # This creates dist/macos/focal-deploy-arm64
   ```

2. **macOS x64**: Build on Intel Mac
   ```bash
   npm run package:macos
   # This creates dist/macos/focal-deploy-x64
   ```

3. **Linux**: Build on the target architecture
   ```bash
   npm run package:linux
   ```

#### Option 2: Use GitHub Actions

Use CI/CD with matrix builds to build on multiple architectures:

```yaml
strategy:
  matrix:
    os: [macos-latest, macos-13, ubuntu-latest]
    arch: [x64, arm64]
```

See `.github/workflows/build.yml` for the full configuration.

#### Option 3: Use Docker with QEMU (Linux only)

For Linux builds, you can use Docker with QEMU emulation:

```bash
# Set up QEMU
docker run --rm --privileged multiarch/qemu-user-static --reset -p yes

# Build for ARM64
docker run --rm -v "$PWD":/app -w /app --platform linux/arm64 node:18 bash -c "npm install && npm run package:linux"

# Build for x64
docker run --rm -v "$PWD":/app -w /app --platform linux/amd64 node:18 bash -c "npm install && npm run package:linux"
```

## Troubleshooting

### Error: `ERR_DLOPEN_FAILED` (Architecture Mismatch)

```
Error: dlopen(...keytar.node, 0x0001): tried: '...'
(mach-o file, but is an incompatible architecture (have 'x86_64', need 'arm64'))
```

**Cause**: The binary was built on a different architecture than the one it's running on.

**Solution**:
1. Build on the target architecture
2. Or use the GitHub Actions workflow to build all architectures
3. The application will fall back to encrypted file storage if keytar fails

### Native Module Build Failures

If native modules fail to build:

```bash
# Clean and reinstall
rm -rf node_modules package-lock.json
npm install

# Rebuild native modules
npm rebuild

# For specific architecture (macOS example)
npm rebuild --arch=arm64
```

### Testing the Build

```bash
# Test the built binary
./dist/macos/focal-deploy-arm64 --version
./dist/macos/focal-deploy-arm64 --help

# Check which architecture it is
file ./dist/macos/focal-deploy-arm64
# Should show: Mach-O 64-bit executable arm64

file ./dist/macos/focal-deploy-x64
# Should show: Mach-O 64-bit executable x86_64
```

## Development

For development, you don't need to build binaries:

```bash
# Run directly with Node.js
npm start

# Or
node bin/focal-deploy.js
```

## Release Process

1. **Update version** in `package.json`

2. **Build all architectures** using GitHub Actions or build on each platform:
   ```bash
   npm run package:all
   ```

3. **Test each binary** on the target platform:
   ```bash
   ./dist/macos/focal-deploy-arm64 --version
   ./dist/macos/focal-deploy-x64 --version
   ./dist/linux/focal-deploy-arm64 --version
   ./dist/linux/focal-deploy-x64 --version
   ./dist/windows/focal-deploy.exe --version
   ```

4. **Create release** with all binaries

## Additional Resources

- [pkg documentation](https://github.com/vercel/pkg)
- [keytar documentation](https://github.com/atom/node-keytar)
- [Node.js native addons](https://nodejs.org/api/addons.html)
- [Cross-compilation guide](https://nodejs.org/api/n-api.html#n_api_building)
