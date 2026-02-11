// Browser Agent Sidebar View Provider
// Provides a webview panel in the VS Code activity bar sidebar

const vscode = require("vscode");

class BrowserAgentViewProvider {


  constructor(extensionUri, getState) {
    this._extensionUri = extensionUri;
    this._getState = getState; // () => { isConnected, logs }
    this._view = undefined;
  }

  resolveWebviewView(webviewView) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtml();

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage((msg) => {
      switch (msg.command) {
        case "launchBrowser":
          vscode.commands.executeCommand("browserAgent.launchBrowser");
          break;
        case "connect":
          vscode.commands.executeCommand("browserAgent.connect");
          break;
        case "disconnect":
          vscode.commands.executeCommand("browserAgent.disconnect");
          break;
        case "navigate":
          vscode.commands.executeCommand("browserAgent.navigate");
          break;
        case "screenshot":
          vscode.commands.executeCommand("browserAgent.screenshot");
          break;
        case "getDOM":
          vscode.commands.executeCommand("browserAgent.getDOM");
          break;
        case "getConsole":
          vscode.commands.executeCommand("browserAgent.getConsole");
          break;
        case "executeJS":
          vscode.commands.executeCommand("browserAgent.executeJS");
          break;
        case "getPerformance":
          vscode.commands.executeCommand("browserAgent.getPerformance");
          break;
        case "getNetwork":
          vscode.commands.executeCommand("browserAgent.getNetwork");
          break;
        case "listTabs":
          vscode.commands.executeCommand("browserAgent.listTabs");
          break;
      }
    });

    // Push initial state
    this.updateConnectionStatus(this._getState().isConnected);
  }

  updateConnectionStatus(connected) {
    if (this._view) {
      this._view.webview.postMessage({
        type: "statusUpdate",
        connected,
      });
    }
  }

  addLog(message) {
    if (this._view) {
      this._view.webview.postMessage({
        type: "log",
        message,
        timestamp: new Date().toLocaleTimeString(),
      });
    }
  }

  _getHtml() {
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      padding: 12px;
    }

    /* ── Status Banner ── */
    .status-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border-radius: 6px;
      margin-bottom: 14px;
      font-weight: 600;
      font-size: 12px;
      transition: all 0.3s ease;
    }
    .status-banner.disconnected {
      background: rgba(255, 80, 80, 0.12);
      border: 1px solid rgba(255, 80, 80, 0.25);
      color: #ff6b6b;
    }
    .status-banner.connected {
      background: rgba(80, 220, 100, 0.12);
      border: 1px solid rgba(80, 220, 100, 0.25);
      color: #50dc64;
    }
    .status-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .disconnected .status-dot { background: #ff6b6b; box-shadow: 0 0 6px #ff6b6b55; }
    .connected .status-dot   { background: #50dc64; box-shadow: 0 0 6px #50dc6455; animation: pulse 2s infinite; }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    /* ── Section Headers ── */
    .section-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--vscode-descriptionForeground);
      margin: 16px 0 8px;
    }

    /* ── Primary Buttons ── */
    .btn-primary {
      width: 100%;
      padding: 9px 14px;
      border: none;
      border-radius: 4px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: background 0.15s;
      margin-bottom: 6px;
    }
    .btn-primary:hover { background: var(--vscode-button-hoverBackground); }

    .btn-secondary {
      width: 100%;
      padding: 7px 12px;
      border: 1px solid var(--vscode-button-secondaryBorder, var(--vscode-input-border));
      border-radius: 4px;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      font-size: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: background 0.15s;
      margin-bottom: 6px;
    }
    .btn-secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }

    /* ── Action Grid ── */
    .action-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 5px;
    }
    .action-btn {
      padding: 8px 6px;
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      background: transparent;
      color: var(--vscode-foreground);
      font-size: 11px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      transition: all 0.15s;
    }
    .action-btn:hover {
      background: var(--vscode-list-hoverBackground);
      border-color: var(--vscode-focusBorder);
    }
    .action-btn .icon { font-size: 16px; }

    /* ── Log Area ── */
    .log-area {
      margin-top: 8px;
      max-height: 200px;
      overflow-y: auto;
      font-family: var(--vscode-editor-font-family);
      font-size: 11px;
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      padding: 6px 8px;
    }
    .log-entry {
      padding: 2px 0;
      border-bottom: 1px solid var(--vscode-input-border);
      opacity: 0.85;
      word-break: break-all;
    }
    .log-entry:last-child { border-bottom: none; }
    .log-time { color: var(--vscode-descriptionForeground); margin-right: 6px; }
    .log-empty {
      color: var(--vscode-descriptionForeground);
      font-style: italic;
      text-align: center;
      padding: 12px 0;
    }

    /* ── Connection buttons row ── */
    .conn-row {
      display: flex;
      gap: 5px;
    }
    .conn-row .btn-secondary { flex: 1; }
  </style>
</head>
<body>

  <!-- Status -->
  <div class="status-banner disconnected" id="statusBanner">
    <span class="status-dot"></span>
    <span id="statusText">Disconnected</span>
  </div>

  <!-- Launch -->
  <button class="btn-primary" onclick="send('launchBrowser')">
    🚀 Launch Isolated Browser
  </button>

  <!-- Connect / Disconnect -->
  <div class="conn-row">
    <button class="btn-secondary" onclick="send('connect')" id="connectBtn">
      ⚡ Connect
    </button>
    <button class="btn-secondary" onclick="send('disconnect')" id="disconnectBtn">
      ⏹ Disconnect
    </button>
  </div>

  <!-- Quick Actions -->
  <div class="section-title">Quick Actions</div>
  <div class="action-grid">
    <button class="action-btn" onclick="send('navigate')">
      <span class="icon">🌐</span> Navigate
    </button>
    <button class="action-btn" onclick="send('screenshot')">
      <span class="icon">📸</span> Screenshot
    </button>
    <button class="action-btn" onclick="send('getDOM')">
      <span class="icon">🏗️</span> Get DOM
    </button>
    <button class="action-btn" onclick="send('getConsole')">
      <span class="icon">📋</span> Console
    </button>
    <button class="action-btn" onclick="send('executeJS')">
      <span class="icon">⚙️</span> Execute JS
    </button>
    <button class="action-btn" onclick="send('getPerformance')">
      <span class="icon">📊</span> Performance
    </button>
    <button class="action-btn" onclick="send('getNetwork')">
      <span class="icon">🔗</span> Network
    </button>
    <button class="action-btn" onclick="send('listTabs')">
      <span class="icon">📑</span> List Tabs
    </button>
  </div>

  <!-- Logs -->
  <div class="section-title">Activity Log</div>
  <div class="log-area" id="logArea">
    <div class="log-empty">No activity yet</div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function send(command) {
      vscode.postMessage({ command });
    }

    window.addEventListener("message", (event) => {
      const msg = event.data;

      if (msg.type === "statusUpdate") {
        const banner = document.getElementById("statusBanner");
        const text = document.getElementById("statusText");
        if (msg.connected) {
          banner.className = "status-banner connected";
          text.textContent = "Connected";
        } else {
          banner.className = "status-banner disconnected";
          text.textContent = "Disconnected";
        }
      }

      if (msg.type === "log") {
        const area = document.getElementById("logArea");
        // Remove empty placeholder
        const empty = area.querySelector(".log-empty");
        if (empty) empty.remove();

        const entry = document.createElement("div");
        entry.className = "log-entry";
        entry.innerHTML = '<span class="log-time">' + msg.timestamp + '</span>' + msg.message;
        area.appendChild(entry);
        area.scrollTop = area.scrollHeight;

        // Keep max 50 entries
        while (area.children.length > 50) {
          area.removeChild(area.firstChild);
        }
      }
    });
  </script>
</body>
</html>`;
  }
}

BrowserAgentViewProvider.viewType = "browserAgentView";

module.exports = { BrowserAgentViewProvider };
