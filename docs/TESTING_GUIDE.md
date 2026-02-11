# 🧪 Testing Guide for Copilot Browser

## Quick Test Checklist

### ✅ Step 1: Start Relay Server

The relay server is the message broker. Start it first:

```bash
cd relay-server
npm start
```

**Expected Output:**

```
[2026-02-10T...] [INFO] Relay server started on localhost:8080
```

**Status:** Server should be running and listening on port 8080.

---

### ✅ Step 2: Load Browser Extension

1. Open Chrome or Edge
2. Navigate to: `chrome://extensions/`
3. Enable **"Developer mode"** (toggle in top-right)
4. Click **"Load unpacked"**
5. Select folder: `/Users/JayprakashPal/browser-copilot-integration/browser-extension`

**Expected Result:**

- Extension appears in toolbar
- Badge shows **✓** (green) = Connected
- Badge shows **✗** (red) = Not connected (check relay server)

**Click the extension icon to verify:**

- Status: "Connected"
- Client ID: (some UUID)

---

### ✅ Step 3: Launch VS Code Extension

**Option A: Development Mode (Recommended for testing)**

1. Open this workspace in VS Code
2. Press **F5** (or Run → Start Debugging)
3. New VS Code window opens ("Extension Development Host")
4. Check status bar (bottom-right): Should show **"Browser: Connected"**

**Option B: Install as Extension**

```bash
cd vscode-extension
code --install-extension .
```

---

### ✅ Step 4: Run Automated Tests

In the VS Code Extension Development Host window:

1. Press **Cmd+Shift+P** (Mac) or **Ctrl+Shift+P** (Windows/Linux)
2. Type: **"Browser Agent: Run Integration Tests"**
3. Press Enter

**Expected Output in Output Panel:**

```
🧪 Starting Copilot Browser Integration Tests...

Test 1: Navigation
✓ Navigation successful

Test 2: Execute JavaScript
✓ Page title: Example Domain

Test 3: Get DOM Structure
✓ Found heading: Example Domain

Test 4: Get Console Logs
✓ Retrieved X console logs

Test 5: Get Performance Metrics
✓ Load time: XXXms

Test 6: Find Element
✓ Found element: H1

Test 7: Click Element
✓ Clicked link

🎉 All tests passed!
```

---

## Manual Testing Commands

### Test Navigation

```
Command: Browser Agent: Navigate to URL
Input: https://example.com
Expected: Browser navigates, notification shows "Navigated to: https://example.com"
```

### Test Console Logs

```
Command: Browser Agent: Get Console Logs
Expected: Output panel shows console logs from current page
```

### Test DOM Extraction

```
Command: Browser Agent: Get DOM Structure
Input: (leave empty for full page, or enter selector like "h1")
Expected: New document opens with HTML content
```

### Test Screenshot

```
Command: Browser Agent: Take Screenshot
Expected: Webview panel opens showing screenshot of current page
```

### Test JavaScript Execution

```
Command: Browser Agent: Execute JavaScript
Input: document.title
Expected: Notification shows page title
```

### Test Click

```
Command: Browser Agent: Click Element
Input: a (or any CSS selector)
Expected: Element is clicked in browser
```

### Test Type

```
Command: Browser Agent: Type Text
Input Selector: input[type="text"]
Input Text: Hello World
Expected: Text appears in input field
```

---

## Testing with GitHub Copilot

Once everything is connected, I (GitHub Copilot) can control the browser. Try asking me:

### Example 1: Simple Navigation

**You:** "Navigate to google.com"

**I will execute:**

```javascript
const { getBrowserAgent } = require("./copilot-helper");
const browser = getBrowserAgent();
await browser.navigate("https://google.com");
```

### Example 2: Get Page Info

**You:** "What's the page title?"

**I will execute:**

```javascript
const browser = getBrowserAgent();
const title = await browser.executeJS("document.title");
// Returns: "Google"
```

### Example 3: Complex Workflow

**You:** "Test the search on google.com"

**I will execute:**

```javascript
const browser = getBrowserAgent();

// Navigate
await browser.navigate("https://google.com");

// Type in search box
await browser.type('textarea[name="q"]', "GitHub Copilot");

// Click search button
await browser.click('input[name="btnK"]');

// Check results
const results = await browser.executeJS(
  'document.querySelectorAll("h3").length'
);
browser.log(`Found ${results} search results`);
```

---

## Programmatic Testing (For Copilot)

I can use this helper module directly in code:

```javascript
// Import the helper
const { getBrowserAgent } = require("./copilot-helper");

// Get browser instance
const browser = getBrowserAgent();

// Test suite
async function testWebsite() {
  try {
    // Navigate
    await browser.navigate("https://example.com");

    // Get title
    const title = await browser.executeJS("document.title");
    console.log("Title:", title);

    // Get console logs
    const logs = await browser.getConsole("error");
    console.log("Errors:", logs.length);

    // Get performance
    const perf = await browser.getPerformance();
    console.log("Load time:", perf.navigation?.loadComplete);

    // Take screenshot
    const screenshot = await browser.screenshot();
    console.log("Screenshot captured");

    return { success: true };
  } catch (error) {
    console.error("Test failed:", error);
    return { success: false, error };
  }
}
```

---

## Troubleshooting

### Problem: "Not connected to browser"

**Solutions:**

1. Check relay server is running: `lsof -i :8080`
2. Check browser extension is loaded and shows ✓
3. In VS Code, run: "Browser Agent: Connect to Browser"
4. Check Output panel for connection logs

### Problem: Commands timeout

**Solutions:**

1. Increase timeout in VS Code settings:
   ```json
   {
     "browserAgent.commandTimeout": 30000
   }
   ```
2. Check if page is responsive (open DevTools)
3. Ensure browser tab is active

### Problem: Extension not loading in VS Code

**Solutions:**

1. Install dependencies: `cd vscode-extension && npm install`
2. Reload window: Cmd+Shift+P → "Reload Window"
3. Check console: Help → Toggle Developer Tools

### Problem: Browser extension not connecting

**Solutions:**

1. Check relay server URL in extension popup
2. Open browser DevTools console for errors
3. Reload extension: chrome://extensions/ → Reload button
4. Check relay server is on localhost:8080

---

## Connection Status Check

### Check Relay Server

```bash
lsof -i :8080
# Should show node process listening on port 8080
```

### Check Browser Extension

1. Click extension icon
2. Should show: "Connected" with green indicator
3. Client ID should be displayed

### Check VS Code Extension

1. Look at status bar (bottom-right)
2. Should show: "Browser: Connected" (without warning color)
3. Check Output panel → "Browser Agent" for logs

---

## Running the Full Test Suite

### From Command Palette:

1. Press **Cmd+Shift+P**
2. Type: **"Browser Agent: Run Integration Tests"**
3. Watch Output panel for results

### From Code (for Copilot):

```javascript
const { runTests } = require("./test-integration");
const result = await runTests();
console.log(result);
```

---

## Expected Test Results

All 7 tests should pass:

- ✓ Navigation
- ✓ JavaScript Execution
- ✓ DOM Extraction
- ✓ Console Logs
- ✓ Performance Metrics
- ✓ Element Finding
- ✓ Click Interaction

**If any test fails:**

1. Check which test failed
2. Open browser DevTools
3. Check Output panel for detailed error
4. Verify page loaded correctly

---

## Next Steps After Testing

Once all tests pass:

1. ✅ **System is working!**
2. 🤖 **Start using with GitHub Copilot**
3. 🚀 **Build custom automation workflows**
4. 📝 **Create test scripts for your applications**

---

## Example: Real-World Testing Workflow

```javascript
// test-my-website.js
const { getBrowserAgent } = require("./copilot-helper");

async function testLoginFlow() {
  const browser = getBrowserAgent();

  browser.log("🧪 Testing login flow...");

  // Navigate to login page
  await browser.navigate("https://myapp.com/login");

  // Fill form
  await browser.type('input[name="email"]', "test@example.com");
  await browser.type('input[name="password"]', "testpass123");

  // Submit
  await browser.click('button[type="submit"]');

  // Wait for redirect
  await new Promise((r) => setTimeout(r, 2000));

  // Check if logged in
  const url = await browser.executeJS("window.location.href");
  const success = url.includes("/dashboard");

  browser.log(success ? "✅ Login successful" : "❌ Login failed");

  return { success };
}

// Ask Copilot: "Run the login test"
```

---

**Ready to test! 🚀**
