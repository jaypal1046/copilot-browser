# 🤖 GitHub Copilot Integration Guide

## Overview

This guide explains how to use GitHub Copilot with the Browser Agent to create an automated browser control system similar to Google Antigravity.

## How It Works

Once all three components are running and connected:

1. **You ask Copilot** in natural language
2. **Copilot executes** browser commands via the VS Code extension
3. **Browser responds** with results (console logs, screenshots, DOM, etc.)
4. **Copilot analyzes** the results and continues the conversation

## Setup for Copilot Integration

### Step 1: Start Everything

```bash
# Terminal 1: Start relay server
./start.sh

# Terminal 2: Keep this open to see logs
```

### Step 2: Load Browser Extension

1. Open Chrome: `chrome://extensions/`
2. Enable "Developer mode" (top-right)
3. Click "Load unpacked"
4. Select: `browser-extension` folder
5. Check extension icon shows ✓ (green = connected)

### Step 3: Launch VS Code Extension

```bash
# In VS Code
1. Open this workspace
2. Press F5 (Extension Development Host)
3. In new window, check status bar shows "Browser: Connected"
```

## Using Copilot to Control Browser

### Basic Interactions

**You:** "Navigate to google.com"

```javascript
// Copilot will execute:
await vscode.commands.executeCommand("browserAgent.navigate");
// Then enter: https://google.com
```

**You:** "Get the console logs from the current page"

```javascript
// Copilot will execute:
await vscode.commands.executeCommand("browserAgent.getConsole");
// Results appear in Output panel
```

**You:** "Click the search button"

```javascript
// Copilot will execute:
await vscode.commands.executeCommand("browserAgent.click");
// Then enter selector: button[type="submit"]
```

**You:** "Take a screenshot"

```javascript
// Copilot will execute:
await vscode.commands.executeCommand("browserAgent.screenshot");
// Screenshot appears in webview panel
```

### Advanced Workflows

**Example 1: Form Testing**

**You:** "Test the login form on the current page"

**Copilot will:**

1. Get DOM structure to find form elements
2. Type username into input field
3. Type password into password field
4. Click submit button
5. Check console for errors
6. Report results

**Example 2: Performance Analysis**

**You:** "Analyze the performance of this page"

**Copilot will:**

1. Execute `browserAgent.getPerformance`
2. Parse metrics (load time, FCP, LCP, etc.)
3. Identify bottlenecks
4. Suggest optimizations

**Example 3: Debugging**

**You:** "Debug why this button isn't working"

**Copilot will:**

1. Get element info for the button
2. Check if it's visible and clickable
3. Inspect console for JavaScript errors
4. Check event listeners
5. Suggest fixes

## Programmatic API for Copilot

Copilot can directly call these functions in your code:

```javascript
// Import the extension API
const browserAgent = vscode.extensions.getExtension(
  "browser-copilot.browser-copilot-agent"
);

if (browserAgent.isActive) {
  const api = browserAgent.exports;

  // Check connection
  const status = api.getConnectionStatus();
  console.log("Connected:", status.isConnected);

  // Send command
  const result = await api.sendCommand("navigate", {
    url: "https://example.com",
  });

  // Send multiple commands
  await api.sendCommand("click", { selector: "#submit" });
  await api.sendCommand("type", {
    selector: "#username",
    text: "testuser",
  });

  // Get data
  const console_logs = await api.sendCommand("get_console", {});
  const dom = await api.sendCommand("get_dom", {});
  const screenshot = await api.sendCommand("get_screenshot", {});
}
```

## Command Reference for Copilot

### Navigation Commands

```javascript
// Navigate to URL
await sendCommand("navigate", { url: "https://example.com" });

// Scroll to element
await sendCommand("scroll", { selector: "#section-2" });

// Scroll to position
await sendCommand("scroll", { position: { top: 1000 } });
```

### Interaction Commands

```javascript
// Click element
await sendCommand("click", { selector: "button.submit" });

// Type text (with clear)
await sendCommand("type", {
  selector: 'input[name="email"]',
  text: "test@example.com",
  clear: true,
});

// Hover over element
await sendCommand("hover", { selector: ".dropdown-menu" });

// Submit form
await sendCommand("submit", { selector: "form#login" });
```

### Data Extraction Commands

```javascript
// Get console logs
const logs = await sendCommand("get_console", {
  level: "error", // optional: 'log', 'warn', 'error', 'info'
  limit: 50,
});

// Get DOM structure
const dom = await sendCommand("get_dom", {
  selector: "#main-content", // optional, omit for full page
});

// Get element information
const element = await sendCommand("get_element", {
  selector: "button.primary",
});

// Get performance metrics
const perf = await sendCommand("get_performance", {});

// Get cookies
const cookies = await sendCommand("get_cookies", {
  url: "https://example.com",
});

// Get storage
const storage = await sendCommand("get_storage", {
  type: "local", // or 'session'
});

// Take screenshot
const screenshot = await sendCommand("get_screenshot", {
  format: "png",
  quality: 90,
});
```

### JavaScript Execution

```javascript
// Execute custom JavaScript
const result = await sendCommand("execute_js", {
  code: "document.title",
});

// Complex execution
const result = await sendCommand("execute_js", {
  code: `
    const buttons = document.querySelectorAll('button');
    return Array.from(buttons).map(b => b.textContent);
  `,
});
```

### Monitoring Commands

```javascript
// Start monitoring events
await sendCommand("start_monitoring", {});

// Stop monitoring
await sendCommand("stop_monitoring", {});

// Get captured events
const events = await sendCommand("get_events", { limit: 100 });
```

## Example Copilot Conversations

### Example 1: Automated Testing

**You:** "Test the search functionality on this page"

**Copilot Response:**

```
I'll test the search functionality for you:

1. Finding search input...
   ✓ Found: input#search-box

2. Typing search query...
   ✓ Typed: "test query"

3. Clicking search button...
   ✓ Clicked: button[type="submit"]

4. Checking for results...
   ✓ Found 15 results

5. Checking console for errors...
   ✓ No errors found

Search functionality is working correctly!
```

### Example 2: Debugging

**You:** "Why is the login form not working?"

**Copilot Response:**

```
Let me investigate the login form:

1. Checking form structure...
   ✓ Form found: form#login-form
   ✓ Username input: input[name="username"]
   ✓ Password input: input[name="password"]
   ✓ Submit button: button[type="submit"]

2. Checking console errors...
   ✗ Found error: "Uncaught TypeError: Cannot read property 'value' of null"

3. Inspecting JavaScript...
   ✗ Code is trying to access: document.getElementById('user-name')
   ✓ But actual ID is: 'username' (no hyphen)

Issue: JavaScript is looking for wrong element ID.
Fix: Change 'user-name' to 'username' in your JavaScript code.
```

### Example 3: Performance Analysis

**You:** "Is this page loading slowly?"

**Copilot Response:**

```
Performance Analysis:

📊 Page Load Metrics:
- DOM Content Loaded: 1,245ms
- Full Load: 3,567ms
- First Contentful Paint: 892ms
- Largest Contentful Paint: 2,341ms

🐌 Bottlenecks Found:
1. Large JavaScript bundle (2.3MB) - Consider code splitting
2. Unoptimized images (4 images > 500KB) - Compress or use WebP
3. Blocking render resources (3 CSS files) - Use async loading

✅ Recommendations:
1. Lazy load images below the fold
2. Minify and compress JavaScript
3. Use CDN for static assets
4. Enable browser caching

Overall: Page is slower than optimal (Target: <2s load time)
```

## Creating Automated Workflows

You can create JavaScript files that Copilot can execute:

```javascript
// test-workflow.js
const vscode = require("vscode");

async function testLoginFlow() {
  // Navigate to login page
  await vscode.commands.executeCommand("browserAgent.navigate");
  // User enters: https://example.com/login

  // Wait for page load
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Fill username
  await vscode.commands.executeCommand("browserAgent.type");
  // Selector: input[name="username"]
  // Text: testuser

  // Fill password
  await vscode.commands.executeCommand("browserAgent.type");
  // Selector: input[name="password"]
  // Text: testpass123

  // Click login
  await vscode.commands.executeCommand("browserAgent.click");
  // Selector: button[type="submit"]

  // Check for success
  await new Promise((resolve) => setTimeout(resolve, 2000));
  const logs = await vscode.commands.executeCommand("browserAgent.getConsole");

  console.log("Test complete!");
}
```

**Ask Copilot:** "Run the login test workflow"

## Tips for Better Copilot Integration

### 1. Be Specific

❌ "Check the page"
✅ "Get the console logs and check for JavaScript errors"

### 2. Provide Context

❌ "Click the button"
✅ "Click the submit button with ID 'login-submit'"

### 3. Chain Commands

✅ "Navigate to google.com, type 'VS Code' in the search box, click search, and take a screenshot of the results"

### 4. Use Natural Language

✅ "Test if the form validation works by submitting empty fields"

### 5. Ask for Analysis

✅ "Analyze the page performance and suggest optimizations"

## Troubleshooting

### Copilot Can't Execute Commands

**Problem:** Copilot suggests commands but doesn't execute them

**Solution:**

1. Check VS Code extension is active (status bar shows "Browser: Connected")
2. Ensure relay server is running
3. Try manually running a command first: Cmd+Shift+P → "Browser Agent: Get Console Logs"
4. Check Output panel for errors

### Commands Timeout

**Problem:** Commands timeout before completing

**Solution:**

1. Increase timeout in settings:
   ```json
   {
     "browserAgent.commandTimeout": 20000
   }
   ```
2. Check if page is responsive
3. Try simpler commands first

### Extension Not Loading

**Problem:** VS Code extension won't activate

**Solution:**

1. Check dependencies are installed: `cd vscode-extension && npm install`
2. Reload VS Code: Cmd+Shift+P → "Reload Window"
3. Check extension host logs: Help → Toggle Developer Tools → Console

## Advanced: Creating Custom Commands

You can extend the system with custom commands:

```javascript
// In extension.js, add new command:
context.subscriptions.push(
  vscode.commands.registerCommand("browserAgent.customTest", async () => {
    // Your custom logic
    const result1 = await sendCommand("get_dom", {});
    const result2 = await sendCommand("get_console", {});

    // Analyze and report
    vscode.window.showInformationMessage("Custom test complete!");
  })
);
```

## Next Steps

1. ✅ Complete setup (relay server, browser extension, VS Code extension)
2. ✅ Test basic commands manually
3. ✅ Start using Copilot with natural language
4. 🚀 Build automated test suites
5. 🚀 Create custom workflows
6. 🚀 Share your automation scripts

## Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Chrome Extension API](https://developer.chrome.com/docs/extensions/)
- [WebSocket Protocol](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)

---

**Happy Automating with GitHub Copilot! 🤖✨**
