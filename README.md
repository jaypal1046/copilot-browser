# 🤖 Browser-Copilot Integration

A powerful system that enables **GitHub Copilot** to control your browser automatically, similar to Google's Antigravity browser agent. This creates a bidirectional communication channel between VS Code, GitHub Copilot, and your browser for automated testing, debugging, and web automation.

## 🎯 Features

- **Bidirectional Communication**: Commands flow from Copilot → Browser, results flow back Browser → Copilot
- **Browser Automation**: Click, type, navigate, scroll, and interact with web pages
- **Real-time Monitoring**: Console logs, network requests, DOM changes, performance metrics
- **Data Extraction**: Screenshots, DOM structure, storage data, cookies
- **JavaScript Execution**: Run custom code directly in the browser context
- **Privacy-First**: All communication happens locally (localhost), no cloud dependencies
- **GitHub Copilot Integration**: Copilot can naturally interact with your browser through conversation

## 🏗️ Architecture

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   VS Code       │◄───────►│  Relay Server   │◄───────►│ Browser Extension│
│   Extension     │  WebSocket│  (localhost:8080)│ WebSocket│   (Chrome)      │
│                 │         │                 │         │                 │
│  GitHub Copilot │         │  Message Broker │         │  Command Executor│
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

### Components

1. **Relay Server** (Node.js): WebSocket message broker that routes commands and responses
2. **Browser Extension** (Chrome/Edge): Executes commands in web pages and captures browser data
3. **VS Code Extension**: Sends commands and integrates with GitHub Copilot

## 🚀 Quick Start

### Prerequisites

- Node.js v18+ installed
- VS Code installed
- Chrome or Edge browser

### Installation

#### 1. Install the Browser Extension
1. Open Chrome/Edge
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode" (top-right toggle)
4. Click "Load unpacked"
5. Select the `browser-extension` folder

#### 2. Install the VS Code Extension
1. Download the `.vsix` file from the releases page (or build it yourself).
2. In VS Code, press `Cmd+Shift+P` → "Extensions: Install from VSIX..."
3. Select the `.vsix` file.

That's it! NO separate server installation is required.

### Packaging for Release

To package this extension for the VS Code Marketplace:

1.  **Install vsce** (VS Code Extensions CLI):
    ```bash
    npm install -g @vscode/vsce
    ```

2.  **Install Dependencies**:
    ```bash
    cd vscode-extension
    npm install
    ```

3.  **Package**:
    ```bash
    vsce package
    ```
    This generates a `.vsix` file (e.g., `browser-copilot-agent-1.0.0.vsix`).

4.  **Publish**:
    Upload the `.vsix` file to the [VS Code Marketplace](https://marketplace.visualstudio.com/).

Or manually:

1. Open VS Code
2. Press `F5` to open Extension Development Host
3. Or press `Cmd+Shift+P` → "Install from VSIX" (after packaging)

### First Test

1. **Launch Browser**: In VS Code, run command "Browser Agent: Launch Isolated Browser".
2. **Wait**: Chrome will launch automatically.
3. **Verify**: VS Code status bar should show "Browser: Connected".

2. **Open browser** with the extension installed
3. **Check extension popup** - should show "Connected" with a green indicator
4. **Open VS Code** - status bar should show "Browser: Connected"
5. **Navigate to a website** in your browser
6. **In VS Code**, press `Cmd+Shift+P` and type:
   - "Browser Agent: Get Console Logs"
   - "Browser Agent: Click Element"
   - "Browser Agent: Take Screenshot"

## 💬 Using with GitHub Copilot

Once everything is connected, you can ask Copilot to control your browser naturally:

**Example Copilot Conversations:**

```
You: "Check the console logs on the current page"
Copilot: [executes browserAgent.getConsole command and shows logs]

You: "Click the submit button"
Copilot: [asks for selector and executes click command]

You: "Navigate to google.com and search for 'VS Code'"
Copilot: [executes navigate and type commands]

You: "Take a screenshot of the current page"
Copilot: [captures and displays screenshot]

You: "What's the page load performance?"
Copilot: [retrieves and displays performance metrics]
```

## 📋 Available Commands

### Browser Actions

- `browserAgent.navigate` - Navigate to URL
- `browserAgent.click` - Click element by CSS selector
- `browserAgent.type` - Type text into input field
- `browserAgent.scroll` - Scroll to element or position
- `browserAgent.hover` - Hover over element
- `browserAgent.submit` - Submit form

### Data Retrieval

- `browserAgent.getConsole` - Get browser console logs
- `browserAgent.getDOM` - Get DOM structure (full page or element)
- `browserAgent.screenshot` - Capture screenshot
- `browserAgent.getPerformance` - Get performance metrics
- `browserAgent.getCookies` - Get browser cookies
- `browserAgent.getStorage` - Get localStorage/sessionStorage

### JavaScript Execution

- `browserAgent.executeJS` - Execute custom JavaScript code

### Connection

- `browserAgent.connect` - Connect to relay server
- `browserAgent.disconnect` - Disconnect from relay server

## 🔧 Configuration

### VS Code Settings

```json
{
  "browserAgent.relayServerUrl": "ws://localhost:8080",
  "browserAgent.autoConnect": true,
  "browserAgent.commandTimeout": 10000
}
```

### Relay Server Config (`relay-server/config.json`)

```json
{
  "port": 8080,
  "host": "localhost",
  "maxConnections": 10,
  "heartbeatInterval": 30000,
  "messageTimeout": 10000,
  "logLevel": "info"
}
```

## 📡 Message Protocol

All messages follow this JSON structure:

```json
{
  "id": "unique-message-id",
  "type": "command | response | event",
  "from": "vscode | browser",
  "timestamp": 1234567890,
  "command": "command-name",
  "params": {},
  "data": {},
  "success": true,
  "error": null
}
```

## 🛠️ Development

### Project Structure

```
browser-copilot-integration/
├── relay-server/           # WebSocket relay server
│   ├── index.js           # Main server code
│   ├── config.json        # Server configuration
│   └── package.json
├── browser-extension/      # Chrome extension
│   ├── manifest.json      # Extension manifest
│   ├── background.js      # Service worker
│   ├── content.js         # Content script
│   └── popup/             # Popup UI
└── vscode-extension/       # VS Code extension
    ├── extension.js       # Main extension code
    └── package.json
```

### Running in Development

**Terminal 1 - Relay Server:**

```bash
cd relay-server
npm start
```

**Terminal 2 - VS Code Extension:**

```bash
cd vscode-extension
npm install
# Then press F5 in VS Code
```

**Browser:**
Load unpacked extension from `browser-extension` folder

## 🧪 Testing

### Manual Testing Workflow

1. Start relay server
2. Load browser extension
3. Open a test webpage (e.g., https://example.com)
4. Test commands from VS Code:

```javascript
// In VS Code, open command palette:
"Browser Agent: Navigate to URL" → https://example.com
"Browser Agent: Get Console Logs" → Shows console output
"Browser Agent: Click Element" → Enter selector: h1
"Browser Agent: Get DOM" → Shows HTML structure
"Browser Agent: Take Screenshot" → Displays image
```

### Automated Tests (Coming Soon)

```bash
npm test
```

## 📚 Use Cases

### 1. Automated Testing

Ask Copilot to test your web application:

- Fill out forms
- Navigate through user flows
- Verify page content
- Check for errors

### 2. Debugging

Debug web applications with Copilot's help:

- Inspect console errors
- Check network requests
- Analyze performance issues
- Examine DOM structure

### 3. Web Scraping

Extract data from websites:

- Get page content
- Extract specific elements
- Capture screenshots
- Monitor changes

### 4. Performance Analysis

Monitor web performance:

- Load times
- Resource usage
- Layout shifts
- Memory consumption

## 🔒 Security & Privacy

- **Local-only communication**: All traffic stays on localhost
- **No external servers**: No data sent to cloud services
- **User consent**: Extension requires explicit permissions
- **Sandboxed execution**: JavaScript runs in isolated context
- **Rate limiting**: Prevents command spam
- **Timeout protection**: Commands automatically timeout

## 🐛 Troubleshooting

### Relay Server Won't Start

- Check if port 8080 is already in use: `lsof -i :8080`
- Change port in `relay-server/config.json`

### Browser Extension Not Connecting

- Check if relay server is running
- Open browser console (F12) and check for errors
- Click extension icon and verify connection status

### VS Code Extension Not Working

- Check Output panel → "Browser Agent" for logs
- Verify relay server URL in settings
- Try reconnecting: "Browser Agent: Connect"

### Commands Timeout

- Increase timeout in settings
- Check if browser is responding (open DevTools)
- Verify network connection to relay server

## 🚧 Roadmap

- [x] Phase 1: Foundation (Relay Server, Browser Extension, VS Code Extension)
- [x] Phase 2: Core Commands (Navigation, Click, Type, Data Retrieval)
- [ ] Phase 3: Advanced Features (Event Monitoring, Advanced APIs)
- [ ] Phase 4: Copilot Chat Participant (@browser)
- [ ] Phase 5: Multi-browser Support (Firefox, Safari)
- [ ] Phase 6: Visual Testing (Screenshot comparison)
- [ ] Phase 7: AI-powered Element Detection
- [ ] Phase 8: Test Automation Framework Integration

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines.

## 📄 License

MIT License - See LICENSE file for details

## 🙏 Acknowledgments

Inspired by:

- Google's Antigravity browser agent
- Playwright and Puppeteer
- Browser automation tools

## 📞 Support

- Issues: [GitHub Issues](https://github.com/your-repo/issues)
- Discussions: [GitHub Discussions](https://github.com/your-repo/discussions)

---

**Made with ❤️ for the developer community**

Connect GitHub Copilot to your browser and unlock new possibilities! 🚀
