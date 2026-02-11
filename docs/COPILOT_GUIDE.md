# Browser Copilot Agent — Command Reference & Copilot Guide

## Quick Start

```bash
# 1. Start relay server
node relay-server/index.js

# 2. Load browser extension
# Chrome → chrome://extensions → Load unpacked → select browser-extension/

# 3. Install VS Code extension
cd vscode-extension && npx @vscode/vsce package && code --install-extension *.vsix

# 4. Connect via Command Palette (Ctrl+Shift+P)
# → "Browser Agent: Connect to Relay Server"
```

---

## Command Reference

### Navigation & Interaction

| Command | Description | Copilot API |
|---------|-------------|-------------|
| `navigate` | Navigate to URL | `agent.navigate('https://...')` |
| `click` | Click element by CSS selector | `agent.click('#btn')` |
| `type` | Type text into input | `agent.type('#email', 'test@test.com')` |
| `hover` | Hover over element | `agent.hover('.menu')` |
| `scroll` | Scroll to element or position | `agent.scroll('#footer')` |
| `submit` | Submit a form | `agent.submit('form')` |
| `highlight` | Highlight element on page | `agent.highlight('#target')` |

### Smart Selectors (AI-Powered)

| Command | Description | Copilot API |
|---------|-------------|-------------|
| `findByText` | Find element by visible text | `agent.findByText('Submit')` |
| `findByRole` | Find by ARIA role | `agent.findByRole('button')` |
| `findByLabel` | Find input by label text | `agent.findByLabel('Email')` |
| `findByPlaceholder` | Find by placeholder text | `agent.findByPlaceholder('Search...')` |
| `clickByText` | Click element by text | `agent.clickByText('Sign In')` |
| `clickByRole` | Click by role + name | `agent.clickByRole('button', 'Submit')` |

### Tab Management

| Command | Description | Copilot API |
|---------|-------------|-------------|
| `tab_list` | List all open tabs | `agent.listTabs()` |
| `tab_open` | Open new tab with URL | `agent.openTab('https://...')` |
| `tab_close` | Close a tab by ID | `agent.closeTab(tabId)` |
| `tab_switch` | Switch to a tab | `agent.switchTab(tabId)` |
| `tab_reload` | Reload active/specific tab | `agent.reloadTab()` |

### Wait Commands

| Command | Description | Copilot API |
|---------|-------------|-------------|
| `waitForSelector` | Wait for CSS selector to appear | `agent.waitForSelector('.loaded')` |
| `waitForText` | Wait for text to appear on page | `agent.waitForText('Success')` |

### Page Intelligence

| Command | Description | Copilot API |
|---------|-------------|-------------|
| `summarizePage` | Get structured page summary | `agent.summarizePage()` |
| `getAccessibility` | Run accessibility audit | `agent.getAccessibility()` |
| `get_performance` | Get performance metrics | `agent.getPerformance()` |

### Data Retrieval

| Command | Description | Copilot API |
|---------|-------------|-------------|
| `get_console` | Get captured console logs | `agent.getConsole(50)` |
| `get_dom` | Get DOM HTML | `agent.getDOM('#content')` |
| `get_element` | Get element details | `agent.getElement('#btn')` |
| `get_screenshot` | Capture screenshot | `agent.screenshot()` |
| `get_cookies` | Get cookies | `agent.getCookies()` |
| `get_storage` | Get localStorage/sessionStorage | `agent.getStorage('local')` |
| `get_network` | Get network request logs | `agent.getNetwork(50)` |
| `execute_js` | Execute JavaScript on page | `agent.executeJS('document.title')` |

### Keyboard & Mouse

| Command | Description | Copilot API |
|---------|-------------|-------------|
| `keyPress` | Press a key | `agent.keyPress('Enter')` |
| `keyCombo` | Key combination | `agent.keyCombo(['Control', 'a'])` |
| `dragAndDrop` | Drag and drop | `agent.dragAndDrop('#src', '#dest')` |
| `selectOption` | Select dropdown option | `agent.selectOption('select', {text:'Option 1'})` |

### iframe Support

| Command | Description | Copilot API |
|---------|-------------|-------------|
| `executeInIframe` | Run command inside iframe | `agent.executeInIframe('#frame', 'click', {selector: '#btn'})` |

### Session Recording

| Command | Description | Copilot API |
|---------|-------------|-------------|
| `start_recording` | Start recording commands | `agent.startRecording()` |
| `stop_recording` | Stop recording | `agent.stopRecording()` |
| `get_recording` | Get recorded commands | `agent.getRecording()` |

---

## Copilot Conversation Examples

### Test a Web Page
```
You: @copilot Use the browser agent to test https://example.com
     - Navigate to the page
     - Summarize the page content
     - Run an accessibility audit
     - Check performance metrics
```

### Fill a Form
```
You: @copilot Use the browser agent to fill the login form:
     - Find the email field by label "Email"
     - Type "test@example.com"
     - Find the password field
     - Type "password123"
     - Click the "Sign In" button by text
```

### Multi-Tab Testing
```
You: @copilot Use the browser agent to:
     - Open https://example.com in a new tab
     - Open https://example.org in another tab
     - List all tabs
     - Switch between them and take screenshots
```

### Record a Flow
```javascript
const agent = require('./copilot-helper');
const flow = await agent.recordFlow(async (a) => {
  await a.navigate('https://example.com');
  await a.clickByText('Login');
  await a.fillForm({ 'Email': 'test@test.com', 'Password': 'secret' });
  await a.clickByRole('button', 'Sign In');
  await a.waitForText('Welcome');
});
console.log(flow); // All recorded steps
```

### Full Page Test
```javascript
const agent = require('./copilot-helper');
const results = await agent.testPage('https://example.com');
// Returns: navigation, summary, accessibility issues, performance
```

---

## Architecture

```
┌──────────────┐    WebSocket    ┌──────────────┐    WebSocket    ┌──────────────┐
│   VS Code    │ ◄────────────► │ Relay Server │ ◄────────────► │   Browser    │
│  Extension   │                │  (Node.js)   │                │  Extension   │
│              │                │              │                │              │
│  31 commands │                │  Port 8080   │                │  30+ actions │
│  Copilot API │                │  Dashboard   │                │  Smart find  │
│  Status bar  │                │  Metrics     │                │  Premium UI  │
└──────────────┘                └──────────────┘                └──────────────┘
```
