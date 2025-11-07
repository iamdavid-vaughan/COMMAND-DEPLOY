# PKG Build Configuration

## Common Issues and Solutions

### 1. Axios Module Not Found

**Problem:**
```
Error: Cannot find module '/snapshot/focal-deploy/node_modules/axios/dist/node/axios.cjs'
```

**Cause:** Axios uses conditional exports that pkg doesn't handle well by default.

**Solution:** Use the `--public-packages` flag to tell pkg to bundle axios as a public package:
```bash
pkg . --targets node18-macos-arm64 --out-path dist/macos --public-packages axios
```

This is already configured in the npm scripts:
```bash
npm run package:macos
npm run package:linux
npm run package:windows
```

### 2. Keytar Architecture Mismatch

**Problem:**
```
Error: dlopen(...keytar.node...): mach-o file, but is an incompatible architecture
```

**Solution:** The application automatically falls back to encrypted file storage when keytar fails. This is expected behavior when cross-compiling.

**To build with proper native keytar support:**
- Build on the target architecture (e.g., ARM64 Mac for ARM64 binaries)
- Or use the GitHub Actions workflow which builds on correct runners

### 3. Building Binaries

**Quick Build:**
```bash
# For current platform
npm run package:macos   # macOS (both x64 and arm64)
npm run package:linux   # Linux (both x64 and arm64)
npm run package:windows # Windows x64

# All platforms
npm run package:all
```

**Manual Build with Options:**
```bash
# macOS with all options
pkg . \
  --targets node18-macos-arm64 \
  --out-path dist/macos \
  --public-packages axios \
  --compress GZip

# Linux
pkg . \
  --targets node18-linux-x64,node18-linux-arm64 \
  --out-path dist/linux \
  --public-packages axios \
  --compress GZip

# Windows
pkg . \
  --targets node18-win-x64 \
  --out-path dist/windows \
  --public-packages axios \
  --compress GZip
```

### 4. Testing Binaries

```bash
# macOS
./dist/macos/focal-deploy-arm64 --version
./dist/macos/focal-deploy-arm64 --help

# Linux
./dist/linux/focal-deploy-x64 --version

# Windows
.\dist\windows\focal-deploy.exe --version
```

### 5. Expected Warnings

When running the binary, you may see:
```
⚠️  Warning: Could not load keytar native module
   Falling back to encrypted file storage
```

**This is normal** when:
- Binary was built on a different architecture
- System keychain libraries are not available
- Running in a containerized environment

The application will continue to work using encrypted file storage for credentials.

## Build Flags Explained

- `--targets node18-macos-arm64`: Target platform and architecture
- `--out-path dist/macos`: Output directory
- `--public-packages axios`: Bundle axios as a public package (fixes module resolution)
- `--compress GZip`: Compress the binary (reduces size by ~30-40%)

## Package Configuration

The pkg configuration is in `package-config.json`:

```json
{
  "pkg": {
    "scripts": ["bin/**/*.js", "lib/**/*.js"],
    "assets": [
      "templates/**/*",
      "config/**/*",
      "docs/**/*",
      "node_modules/axios/**/*"
    ],
    "targets": [
      "node18-macos-x64",
      "node18-macos-arm64",
      "node18-linux-x64",
      "node18-linux-arm64",
      "node18-win-x64"
    ]
  }
}
```

## Troubleshooting

### Binary Size is Large

This is normal. The binary includes:
- Node.js runtime (~40MB)
- All dependencies
- Your application code

To reduce size:
- Use `--compress GZip` flag (already in npm scripts)
- Consider using UPX for additional compression (optional)

### Module Not Found Errors

If you get errors about other missing modules:

1. Add them to `--public-packages`:
   ```bash
   pkg . --public-packages axios,other-module
   ```

2. Or add to assets in `package-config.json`:
   ```json
   "assets": [
     "node_modules/problem-module/**/*"
   ]
   ```

### Permission Denied

Make binaries executable:
```bash
chmod +x dist/macos/focal-deploy-*
chmod +x dist/linux/focal-deploy-*
```

## CI/CD

The GitHub Actions workflow (`.github/workflows/build-release.yml`) automatically:
- Builds on correct architecture for each target
- Includes all necessary flags
- Compresses binaries
- Creates releases with all artifacts

To trigger a release build:
```bash
git tag v1.0.0
git push origin v1.0.0
```

## References

- [pkg Documentation](https://github.com/vercel/pkg)
- [pkg Public Packages](https://github.com/vercel/pkg#config)
- [Building Guide](./BUILDING.md)
- [Keytar Fix](./KEYTAR-FIX.md)
