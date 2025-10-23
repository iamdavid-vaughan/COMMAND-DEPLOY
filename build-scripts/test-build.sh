#!/bin/bash

# Test Build Script
# Tests the built executables to ensure they work correctly

set -e

echo "🧪 Testing Focal Deploy Built Executables"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if dist directory exists
if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Error: dist directory not found. Please run build.sh first.${NC}"
    exit 1
fi

# Function to test an executable
test_executable() {
    local exe_path="$1"
    local platform="$2"
    
    echo -e "${BLUE}🔍 Testing $platform executable: $(basename "$exe_path")${NC}"
    
    if [ ! -f "$exe_path" ]; then
        echo -e "${RED}❌ Executable not found: $exe_path${NC}"
        return 1
    fi
    
    # Make executable (for Unix-like systems)
    if [[ "$platform" != "windows" ]]; then
        chmod +x "$exe_path"
    fi
    
    # Test --version flag
    echo -e "${YELLOW}  Testing --version flag...${NC}"
    if timeout 10s "$exe_path" --version > /dev/null 2>&1; then
        echo -e "${GREEN}  ✅ --version works${NC}"
    else
        echo -e "${RED}  ❌ --version failed${NC}"
        return 1
    fi
    
    # Test --help flag
    echo -e "${YELLOW}  Testing --help flag...${NC}"
    if timeout 10s "$exe_path" --help > /dev/null 2>&1; then
        echo -e "${GREEN}  ✅ --help works${NC}"
    else
        echo -e "${RED}  ❌ --help failed${NC}"
        return 1
    fi
    
    # Test basic command structure
    echo -e "${YELLOW}  Testing command structure...${NC}"
    if timeout 10s "$exe_path" --help 2>&1 | grep -q "new"; then
        echo -e "${GREEN}  ✅ Commands available${NC}"
    else
        echo -e "${RED}  ❌ Commands not found${NC}"
        return 1
    fi
    
    echo -e "${GREEN}  ✅ $platform executable passed all tests${NC}"
    echo ""
    return 0
}

# Test results tracking
total_tests=0
passed_tests=0

# Test macOS executables
if [ -d "dist/macos" ]; then
    echo -e "${BLUE}🍎 Testing macOS executables...${NC}"
    for exe in dist/macos/focal-deploy*; do
        if [ -f "$exe" ] && [[ "$exe" != *.txt ]]; then
            total_tests=$((total_tests + 1))
            if test_executable "$exe" "macos"; then
                passed_tests=$((passed_tests + 1))
            fi
        fi
    done
fi

# Test Linux executables
if [ -d "dist/linux" ]; then
    echo -e "${BLUE}🐧 Testing Linux executables...${NC}"
    for exe in dist/linux/focal-deploy*; do
        if [ -f "$exe" ] && [[ "$exe" != *.txt ]]; then
            total_tests=$((total_tests + 1))
            if test_executable "$exe" "linux"; then
                passed_tests=$((passed_tests + 1))
            fi
        fi
    done
fi

# Test Windows executables (if on compatible system)
if [ -d "dist/windows" ]; then
    echo -e "${BLUE}🪟 Testing Windows executables...${NC}"
    for exe in dist/windows/focal-deploy*.exe; do
        if [ -f "$exe" ]; then
            total_tests=$((total_tests + 1))
            # On macOS/Linux, we can't directly test Windows executables
            # but we can check if they exist and have reasonable size
            size=$(stat -f%z "$exe" 2>/dev/null || stat -c%s "$exe" 2>/dev/null || echo "0")
            if [ "$size" -gt 10000000 ]; then  # > 10MB
                echo -e "${GREEN}  ✅ Windows executable exists and has reasonable size (${size} bytes)${NC}"
                passed_tests=$((passed_tests + 1))
            else
                echo -e "${RED}  ❌ Windows executable too small or missing${NC}"
            fi
        fi
    done
fi

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}📊 Test Summary:${NC}"
echo -e "  Total tests: $total_tests"
echo -e "  Passed: $passed_tests"
echo -e "  Failed: $((total_tests - passed_tests))"

if [ $passed_tests -eq $total_tests ]; then
    echo ""
    echo -e "${GREEN}🎉 All tests passed! Executables are ready for distribution.${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}❌ Some tests failed. Please check the build process.${NC}"
    exit 1
fi