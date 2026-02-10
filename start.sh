#!/bin/bash

# Quick Start Script for Browser-Copilot Integration

echo "🤖 Browser-Copilot Integration - Quick Start"
echo "============================================"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v18+ first."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo ""

# Start relay server
echo "🚀 Starting Relay Server..."
cd relay-server

if [ ! -d "node_modules" ]; then
    echo "📦 Installing relay server dependencies..."
    npm install
fi

echo ""
echo "✨ Relay Server is starting on ws://localhost:8080"
echo ""
echo "Next steps:"
echo "1. Load browser extension in Chrome:"
echo "   - Open chrome://extensions/"
echo "   - Enable 'Developer mode'"
echo "   - Click 'Load unpacked'"
echo "   - Select: $(pwd)/../browser-extension"
echo ""
echo "2. Install VS Code extension:"
echo "   - Open VS Code in this workspace"
echo "   - Press F5 to launch Extension Development Host"
echo "   - Or run: code --install-extension vscode-extension"
echo ""
echo "3. Test the connection:"
echo "   - Open any webpage in your browser"
echo "   - In VS Code, press Cmd+Shift+P"
echo "   - Run: 'Browser Agent: Get Console Logs'"
echo ""
echo "🎉 Ready! GitHub Copilot can now control your browser!"
echo ""

# Start the server
node index.js
