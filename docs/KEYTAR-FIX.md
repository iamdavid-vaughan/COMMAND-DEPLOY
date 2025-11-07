# Keytar Architecture Fix

## Problem

When building cross-platform binaries with `pkg`, native Node.js modules like `keytar` are compiled for the host architecture, not the target architecture. This causes the following error when running a binary on a different architecture:

```
Error: dlopen(...keytar.node, 0x0001): tried: '...'
(mach-o file, but is an incompatible architecture (have 'x86_64', need 'arm64'))
```

For example:
- Building on an **Intel Mac (x86_64)** produces `keytar.node` for x86_64
- When pkg creates an ARM64 binary, it includes the x86_64 version of `keytar.node`
- Running the ARM64 binary on **Apple Silicon (ARM64)** fails because it tries to load the x86_64 native module

## Solution

This repository implements a **multi-layered solution** to handle the keytar architecture mismatch:

### 1. Keytar Wrapper with Fallback

**File**: `lib/utils/keytar-wrapper.js`

A wrapper module that:
- Attempts to load the native `keytar` module
- If keytar fails to load (architecture mismatch, missing dependencies, etc.), it automatically falls back to **encrypted file-based storage**
- Provides the same API as keytar, ensuring no code changes are needed

**Benefits**:
- ✅ Application works even when keytar fails
- ✅ Graceful degradation
- ✅ Encrypted credential storage as fallback
- ✅ No breaking changes to existing code

**Security**:
- File storage uses AES-256-GCM encryption
- Credentials stored in `~/.focal-deploy/credentials.enc`
- File permissions restricted to owner only (Unix-like systems)

### 2. Architecture-Specific Build Process

**Files**:
- `scripts/build-native.js` - Node.js build script for native modules
- `scripts/package-with-native.sh` - Shell script for comprehensive builds
- `.github/workflows/build-release.yml` - GitHub Actions workflow

**GitHub Actions Matrix Build**:
- Builds **macOS ARM64** on `macos-14` (Apple Silicon runner)
- Builds **macOS x64** on `macos-13` (Intel runner)
- Builds **Linux x64** and **Linux ARM64** on Ubuntu with QEMU
- Builds **Windows x64** on Windows runner

Each build runs on the correct architecture, ensuring native modules are compiled correctly.

### 3. Documentation

**Files**:
- `docs/BUILDING.md` - Comprehensive build instructions
- `docs/KEYTAR-FIX.md` - This document

## Implementation Details

### Changes Made

1. **Created keytar wrapper** (`lib/utils/keytar-wrapper.js`)
   - Drop-in replacement for keytar
   - Automatic fallback to encrypted file storage
   - Same API as keytar

2. **Updated credential collector** (`lib/wizard/credential-collector.js`)
   ```javascript
   // Before
   const keytar = require('keytar');

   // After
   const keytar = require('../utils/keytar-wrapper');
   ```

3. **Added build scripts**
   - `scripts/build-native.js` - Rebuild native modules for target arch
   - `scripts/package-with-native.sh` - Comprehensive build script
   - Added npm scripts: `package:current`, postinstall hook

4. **Created GitHub Actions workflow**
   - Matrix build for all platforms and architectures
   - Builds on native hardware for each arch
   - Automatic artifact upload
   - Release creation with checksums

5. **Added documentation**
   - Build instructions (`docs/BUILDING.md`)
   - This troubleshooting guide

## Usage

### For End Users

The application will automatically work on any architecture. If keytar fails to load:

1. You'll see a warning message:
   ```
   ⚠️  Warning: Could not load keytar native module
      Falling back to encrypted file storage
   ```

2. Credentials will be stored in encrypted files at:
   - **macOS/Linux**: `~/.focal-deploy/credentials.enc`
   - **Windows**: `%USERPROFILE%\.focal-deploy\credentials.enc`

3. The application functions exactly the same, just using different storage

### For Developers

#### Building Locally

**Option 1: Build on current architecture**
```bash
npm install
npm run package:macos  # or package:linux, package:windows
```

This will create binaries for your current platform. The binary will work on the architecture it was built on.

**Option 2: Use GitHub Actions**

Push a tag to trigger the release workflow:
```bash
git tag v1.0.0
git push origin v1.0.0
```

The workflow will build all architectures correctly and create a release with all binaries.

**Option 3: Build with Docker (Linux only)**

For Linux ARM64 from an x64 machine:
```bash
# Set up QEMU
docker run --rm --privileged multiarch/qemu-user-static --reset -p yes

# Build
docker run --rm -v "$PWD":/app -w /app --platform linux/arm64 node:18 \
  bash -c "npm install && npm run package:linux"
```

#### Testing Locally

To test the keytar wrapper fallback:

```bash
# Temporarily rename keytar to force fallback
mv node_modules/keytar node_modules/keytar.bak

# Run the application
npm start

# You should see the fallback message
# The app should still work using file storage

# Restore keytar
mv node_modules/keytar.bak node_modules/keytar
```

## Architecture Verification

To verify a binary was built for the correct architecture:

### macOS
```bash
file dist/macos/focal-deploy-arm64
# Expected: Mach-O 64-bit executable arm64

file dist/macos/focal-deploy-x64
# Expected: Mach-O 64-bit executable x86_64
```

### Linux
```bash
file dist/linux/focal-deploy-arm64
# Expected: ELF 64-bit LSB executable, ARM aarch64

file dist/linux/focal-deploy-x64
# Expected: ELF 64-bit LSB executable, x86-64
```

### Windows
```bash
file dist/windows/focal-deploy.exe
# Expected: PE32+ executable (console) x86-64
```

## Security Considerations

### System Keychain (keytar)
- ✅ Uses OS-provided secure storage
- ✅ macOS: Keychain
- ✅ Linux: libsecret (GNOME Keyring, KDE Wallet)
- ✅ Windows: Credential Vault
- ✅ Credentials encrypted by OS
- ✅ Protected by user login credentials

### File Storage (fallback)
- ✅ AES-256-GCM encryption
- ✅ Unique encryption key per installation
- ✅ File permissions restricted (Unix-like)
- ⚠️  Less secure than OS keychain
- ⚠️  Encryption key derived from fixed salt (consider using machine-specific salt for production)

## Troubleshooting

### Problem: Binary runs but keytar fallback is used

**Cause**: Native module architecture mismatch

**Solution**: Rebuild the binary on the target architecture or use GitHub Actions

### Problem: `npm rebuild` fails

**Cause**: Missing build tools or dependencies

**Solution**: Install platform-specific build tools (see `docs/BUILDING.md`)

### Problem: File permissions error on Linux/macOS

**Cause**: `~/.focal-deploy` directory not writable

**Solution**:
```bash
mkdir -p ~/.focal-deploy
chmod 700 ~/.focal-deploy
```

### Problem: Binary verification fails in CI

**Cause**: Architecture mismatch in workflow

**Solution**: Ensure workflow uses correct runner for each architecture:
- ARM64 macOS: `macos-14`
- x64 macOS: `macos-13`
- ARM64 Linux: Use QEMU or native ARM64 runner

## Future Improvements

1. **Machine-specific encryption**: Use hardware ID for encryption key derivation
2. **Alternative storage backends**: Support for additional secure storage options
3. **Prebuild support**: Investigate using `prebuild-install` to fetch prebuilt keytar binaries
4. **Pure JS implementation**: Consider replacing keytar with a pure JavaScript solution
5. **Better error messages**: More detailed diagnostics when keytar fails

## References

- [pkg Documentation](https://github.com/vercel/pkg)
- [keytar Documentation](https://github.com/atom/node-keytar)
- [Node.js Native Addons](https://nodejs.org/api/addons.html)
- [GitHub Actions Matrix Builds](https://docs.github.com/en/actions/using-jobs/using-a-matrix-for-your-jobs)
