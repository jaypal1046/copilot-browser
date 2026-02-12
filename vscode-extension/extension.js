// VS Code Extension for Copilot Browser
// Manages connection to relay server and exposes commands for Copilot

const vscode = require("vscode");
const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const { spawn, execSync } = require("child_process");
const net = require("net"); // Required for port checking
const fs = require("fs");
const { BrowserAgentViewProvider } = require("./agent-view");

let ws = null;
let isConnected = false;
let clientId = null;
let outputChannel;
let statusBarItem;
let pendingCommands = new Map();
let relayServerProcess = null;
let agentViewProvider = null;

// Default timeout for commands
const COMMAND_TIMEOUT = 30000;

function activate(context) {
  console.log("Copilot Browser activating...");

  // Create output channel
  outputChannel = vscode.window.createOutputChannel("Copilot Browser");
  outputChannel.appendLine("Copilot Browser Extension activated");

  // Create status bar item
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusBarItem.command = "browserAgent.connect";
  updateStatusBar(false);
  statusBarItem.show();

  // Get version dynamically
  const extensionVersion = vscode.extensions.getExtension("jaypal-browser-copilot.copilot-browser-vscode")?.packageJSON.version || "2.1.5";

  // =============== Register Sidebar View ===============
  agentViewProvider = new BrowserAgentViewProvider(
    context.extensionUri,
    extensionVersion,
    () => ({ isConnected })
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      BrowserAgentViewProvider.viewType,
      agentViewProvider
    )
  );

  // =============== Register Commands ===============

  // Connection
  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.connect", connectToRelay)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.disconnect", disconnect)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.launchBrowser", launchBrowser)
  );

  // Original commands
  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.navigate", async () => {
      const url = await vscode.window.showInputBox({
        prompt: "Enter URL to navigate to",
        placeHolder: "https://example.com",
      });
      if (url) return sendCommand("navigate", { url });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.click", async () => {
      const selector = await vscode.window.showInputBox({
        prompt: "Enter CSS selector to click",
        placeHolder: "#submit-btn, .card, button",
      });
      if (selector) return sendCommand("click", { selector });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.type", async () => {
      const selector = await vscode.window.showInputBox({
        prompt: "Enter CSS selector of input",
        placeHolder: "#email, input[name='username']",
      });
      if (!selector) return;
      const text = await vscode.window.showInputBox({
        prompt: "Enter text to type",
      });
      if (text) return sendCommand("type", { selector, text, clear: true });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.getConsole", () =>
      sendCommand("get_console", { limit: 50 })
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.getDOM", async () => {
      const selector = await vscode.window.showInputBox({
        prompt: "CSS selector (leave blank for full page)",
        placeHolder: "#main-content",
      });
      return sendCommand("get_dom", { selector: selector || undefined });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.screenshot", () =>
      sendCommand("get_screenshot", { format: "png" })
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.executeJS", async () => {
      const code = await vscode.window.showInputBox({
        prompt: "Enter JavaScript to execute",
        placeHolder: "document.title",
      });
      if (code) return sendCommand("execute_js", { code });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.getPerformance", () =>
      sendCommand("get_performance", {})
    )
  );

  // =============== NEW: Tab Management Commands ===============

  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.listTabs", () =>
      sendCommand("tab_list", {})
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.openTab", async () => {
      const url = await vscode.window.showInputBox({
        prompt: "URL to open in new tab",
        placeHolder: "https://example.com",
      });
      if (url) return sendCommand("tab_open", { url });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.closeTab", async () => {
      const tabIdStr = await vscode.window.showInputBox({
        prompt: "Tab ID to close (use listTabs to get IDs)",
      });
      if (tabIdStr) return sendCommand("tab_close", { tabId: parseInt(tabIdStr) });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.switchTab", async () => {
      const tabIdStr = await vscode.window.showInputBox({
        prompt: "Tab ID to switch to",
      });
      if (tabIdStr)
        return sendCommand("tab_switch", { tabId: parseInt(tabIdStr) });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.reloadTab", () =>
      sendCommand("tab_reload", {})
    )
  );

  // =============== NEW: Smart Selector Commands ===============

  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.findByText", async () => {
      const text = await vscode.window.showInputBox({
        prompt: "Text to find on the page",
        placeHolder: "Submit, Login, Sign Up",
      });
      if (text) return sendCommand("findByText", { text, click: false });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.findByRole", async () => {
      const role = await vscode.window.showQuickPick(
        [
          "button", "link", "textbox", "checkbox", "radio",
          "heading", "list", "listitem", "img", "navigation",
          "main", "form", "table",
        ],
        { placeHolder: "Select ARIA role" }
      );
      if (role) return sendCommand("findByRole", { role });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.findByLabel", async () => {
      const label = await vscode.window.showInputBox({
        prompt: "Label text to find",
        placeHolder: "Email Address, Password",
      });
      if (label) return sendCommand("findByLabel", { label });
    })
  );

  // =============== NEW: Wait Commands ===============

  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.waitForSelector", async () => {
      const selector = await vscode.window.showInputBox({
        prompt: "CSS selector to wait for",
        placeHolder: ".loaded, #content",
      });
      if (selector)
        return sendCommand("waitForSelector", { selector, timeout: 10000 });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.waitForText", async () => {
      const text = await vscode.window.showInputBox({
        prompt: "Text to wait for",
        placeHolder: "Loading complete",
      });
      if (text)
        return sendCommand("waitForText", { text, timeout: 10000 });
    })
  );

  // =============== NEW: Page Intelligence Commands ===============

  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.summarizePage", () =>
      sendCommand("summarizePage", {})
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.getAccessibility", () =>
      sendCommand("getAccessibility", {})
    )
  );

  // =============== NEW: Keyboard Commands ===============

  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.keyPress", async () => {
      const key = await vscode.window.showInputBox({
        prompt: "Key to press",
        placeHolder: "Enter, Escape, Tab, a, 1",
      });
      if (key) return sendCommand("keyPress", { key });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.keyCombo", async () => {
      const combo = await vscode.window.showInputBox({
        prompt: "Key combination (comma-separated)",
        placeHolder: "Control,a or Control,Shift,i",
      });
      if (combo)
        return sendCommand("keyCombo", {
          keys: combo.split(",").map((k) => k.trim()),
        });
    })
  );

  // =============== NEW: Network & Stats ===============

  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.getNetwork", () =>
      sendCommand("get_network", { limit: 50 })
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.getStats", () =>
      sendCommand("get_stats", {})
    )
  );

  // =============== NEW: Visual Diff ===============

  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.visualSnapshot", async () => {
      const selector = await vscode.window.showInputBox({
        prompt: "CSS selector for snapshot scope (leave blank for full page)",
        placeHolder: "body, #main-content",
      });
      return sendCommand("visual_snapshot", { selector: selector || undefined });
    })
  );

  // =============== NEW: Session Recording ===============

  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.startRecording", () =>
      sendCommand("start_recording", {})
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.stopRecording", () =>
      sendCommand("stop_recording", {})
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.getRecording", () =>
      sendCommand("get_recording", {})
    )
  );

  // Test command
  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.runTests", async () => {
      outputChannel.appendLine("\n=== Running Integration Tests ===\n");
      try {
        const testHelper = require("./test-integration");
        await testHelper.runTests();
        outputChannel.appendLine("\n=== Tests Complete ===\n");
      } catch (error) {
        outputChannel.appendLine(`Test error: ${error.message}`);
      }
    })
  );

  // Auto-connect on startup
  const config = vscode.workspace.getConfiguration("browserAgent");
  if (config.get("autoConnect", false)) {
    setTimeout(connectToRelay, 1000);
  }

  console.log("Copilot Browser activated with all commands registered");
}

// Connect to relay server
async function connectToRelay(overrideUrl) {
  if (isConnected) {
    vscode.window.showInformationMessage("Already connected to relay server");
    return;
  }

  const config = vscode.workspace.getConfiguration("browserAgent");
  const relayUrl =
    overrideUrl || config.get("relayServerUrl") || "ws://localhost:8080";

  outputChannel.appendLine(`Connecting to relay server: ${relayUrl}`);

  return new Promise((resolve, reject) => {
    try {
      ws = new WebSocket(relayUrl);

      ws.on("open", () => {
        isConnected = true;
        outputChannel.appendLine("Connected to relay server");
        updateStatusBar(true);

        // Register as VS Code client
        ws.send(
          JSON.stringify({
            type: "register",
            clientType: "vscode",
            metadata: {
              editor: "vscode",
              version: vscode.version,
              extensionVersion: extensionVersion,
              timestamp: Date.now(),
            },
          })
        );

        vscode.window.showInformationMessage(
          "Copilot Browser: Connected to relay server"
        );
        resolve();
      });

      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());
          handleMessage(message);
        } catch (error) {
          outputChannel.appendLine(`Error parsing message: ${error.message}`);
        }
      });

      ws.on("error", (error) => {
        outputChannel.appendLine(`WebSocket error: ${error.message}`);
        isConnected = false;
        updateStatusBar(false);
      });

      ws.on("close", () => {
        isConnected = false;
        ws = null;
        updateStatusBar(false);
        outputChannel.appendLine("Disconnected from relay server");

        // Reject any pending commands
        for (const [id, { reject: rej }] of pendingCommands) {
          rej(new Error("Connection closed"));
        }
        pendingCommands.clear();
      });

      // Connection timeout
      setTimeout(() => {
        if (!isConnected) {
          if (ws) ws.close();
          reject(new Error("Connection timeout"));
          vscode.window.showErrorMessage(
            "Copilot Browser: Connection timeout. Is the relay server running?"
          );
        }
      }, 10000);
    } catch (error) {
      outputChannel.appendLine(`Connection error: ${error.message}`);
      reject(error);
      vscode.window.showErrorMessage(
        `Copilot Browser: ${error.message}`
      );
    }
  });
}

// Handle incoming messages
function handleMessage(message) {
  switch (message.type) {
    case "connection":
      clientId = message.clientId;
      outputChannel.appendLine(`Assigned client ID: ${clientId}`);
      break;

    case "registered":
      outputChannel.appendLine("Registered as VS Code client");
      break;

    case "response":
      handleResponse(message);
      break;

    case "event":
      handleEvent(message);
      break;

    case "status":
      outputChannel.appendLine(
        `Server status: ${JSON.stringify(message.clients)}`
      );
      break;

    case "pong":
      break;

    case "error":
      outputChannel.appendLine(`Server error: ${message.error}`);
      break;
  }
}

// Handle command responses
function handleResponse(message) {
  const { id, success, data, error } = message;
  const pending = pendingCommands.get(id);

  if (pending) {
    clearTimeout(pending.timeout);
    pendingCommands.delete(id);

    if (success) {
      outputChannel.appendLine(
        `✓ Command ${pending.command} completed`
      );
      if (data) {
        outputChannel.appendLine(
          JSON.stringify(data, null, 2).substring(0, 5000)
        );
      }
      pending.resolve(data);
    } else {
      outputChannel.appendLine(
        `✗ Command ${pending.command} failed: ${error?.message || "Unknown error"}`
      );
      pending.reject(new Error(error?.message || "Command failed"));
    }
  }
}

// Handle events from browser
function handleEvent(message) {
  const { eventType, data } = message;
  outputChannel.appendLine(`[Event] ${eventType}: ${JSON.stringify(data).substring(0, 500)}`);
}

// Send command to browser
function sendCommand(command, params) {
  if (!isConnected || !ws) {
    vscode.window.showWarningMessage(
      "Copilot Browser: Not connected. Use 'Browser Agent: Connect' first."
    );
    return Promise.reject(new Error("Not connected"));
  }

  const id = uuidv4();
  const config = vscode.workspace.getConfiguration("browserAgent");
  const timeoutMs = config.get("commandTimeout", COMMAND_TIMEOUT);

  return new Promise((resolve, reject) => {
    // Set timeout for command
    const timeout = setTimeout(() => {
      pendingCommands.delete(id);
      reject(new Error(`Command '${command}' timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    pendingCommands.set(id, { command, resolve, reject, timeout });

    ws.send(
      JSON.stringify({
        type: "command",
        id,
        command,
        params: params || {},
        timestamp: Date.now(),
      })
    );

    outputChannel.appendLine(`→ Sent: ${command} ${JSON.stringify(params || {}).substring(0, 200)}`);
  });
}

// Disconnect from relay server
function disconnect() {
  if (ws) {
    ws.close();
    ws = null;
  }
  isConnected = false;
  updateStatusBar(false);

  // Kill relay server process if we started it
  if (relayServerProcess) {
    relayServerProcess.kill();
    relayServerProcess = null;
  }

  vscode.window.showInformationMessage("Copilot Browser: Disconnected");
}

// Launch browser with relay server
async function launchBrowser() {
  console.log("Browser Copilot: launchBrowser command triggered");
  outputChannel.show(true);
  outputChannel.appendLine("------------------------------------------------");
  outputChannel.appendLine("Copilot Browser: Launching isolated browser...");
  vscode.window.setStatusBarMessage("Browser Copilot: Launching...", 3000);

  try {
    // Try to find relay-server in multiple locations
    let relayPath = null;
    // ---------------------------------------------------------
    // 1. Resolve Relay Server Path using Node Resolution
    // ---------------------------------------------------------
    try {
      // Try to resolve 'relay-server' as a dependency
      relayPath = require.resolve('relay-server');
      outputChannel.appendLine(`✅ Resolved relay-server module at: ${relayPath}`);
    } catch (e) {
      outputChannel.appendLine(`Module resolution failed: ${e.message}`);
    }

    // ---------------------------------------------------------
    // 2. Fallback File Search
    // ---------------------------------------------------------
    if (!relayPath) {
      const possiblePaths = [
        path.join(__dirname, "relay-server", "index.js"),           // Local source
        path.join(__dirname, "node_modules", "relay-server", "index.js"), // Explicit node_modules
        path.join(__dirname, "..", "relay-server", "index.js")      // Sibling (old dev layout)
      ];

      outputChannel.appendLine(`Searching for relay server in ${possiblePaths.length} fallback locations...`);
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          relayPath = p;
          outputChannel.appendLine(`✅ Found relay server at: ${relayPath}`);
          break;
        }
      }
    }

    if (!relayPath) {
      const msg = "Could not find relay-server/index.js. Ensure the extension is installed correctly.";
      outputChannel.appendLine(`❌ ERROR: ${msg}`);
      vscode.window.showErrorMessage(`Copilot Browser: ${msg}`);
      return;
    }

    const relayCwd = path.dirname(relayPath);
    console.log(`Relay CWD: ${relayCwd}`);

    // Check node version
    try {
      const nodeVer = execSync("node -v").toString().trim();
      outputChannel.appendLine(`System Node Version: ${nodeVer}`);
    } catch (e) {
      outputChannel.appendLine(`⚠ Warning: Could not detect 'node' in PATH. Launch might fail. Error: ${e.message}`);
    }

    // Auto-install dependencies if node_modules is missing
    const nodeModulesPath = path.join(relayCwd, "node_modules");
    if (!fs.existsSync(nodeModulesPath)) {
      outputChannel.appendLine("Installing relay server dependencies (npm install)...");
      try {
        execSync("npm install", { cwd: relayCwd, stdio: "pipe" });
        outputChannel.appendLine("Dependencies installed successfully.");
      } catch (error) {
        const msg = `Failed to install dependencies: ${error.message}`;
        outputChannel.appendLine(`❌ ${msg}`);
        vscode.window.showErrorMessage(`Copilot Browser: ${msg}`);
        return;
      }
    }

    // Find a free port starting from 11800 to avoid common conflicts
    let port = 8080;
    try {
      port = await findFreePort(11800);
      outputChannel.appendLine(`Selected free port: ${port}`);
    } catch (e) {
      outputChannel.appendLine(`Warning: Failed to find free port, defaulting to 8080. Error: ${e.message}`);
    }

    outputChannel.appendLine(`Spawning relay server process on port ${port}...`);

    // Explicitly us 'node' command. If this fails, user needs node in PATH.
    relayServerProcess = spawn(
      "node",
      [relayPath, "--launch-browser", "--platform=desktop", `--port=${port}`],
      {
        env: { ...process.env },
        cwd: relayCwd,
      }
    );

    if (relayServerProcess.pid) {
      outputChannel.appendLine(`Relay server process started (PID: ${relayServerProcess.pid})`);
    } else {
      outputChannel.appendLine(`❌ Failed to spawn relay server process (no PID).`);
    }

    relayServerProcess.stdout.on("data", (data) => {
      const msg = data.toString().trim();
      outputChannel.appendLine(`[Relay] ${msg}`);
      if (agentViewProvider) agentViewProvider.addLog(msg);
    });

    relayServerProcess.stderr.on("data", (data) => {
      const msg = data.toString().trim();
      outputChannel.appendLine(`[Relay Error] ${msg}`);
      if (agentViewProvider) agentViewProvider.addLog(`⚠ ${msg}`);
    });

    relayServerProcess.on("error", (err) => {
      const msg = `Process error: ${err.message}`;
      outputChannel.appendLine(`❌ ${msg}`);
      vscode.window.showErrorMessage(`Copilot Browser: Relay Process Error: ${err.message}`);
    });

    relayServerProcess.on("close", (code) => {
      outputChannel.appendLine(`Relay server exited with code ${code}`);
      relayServerProcess = null;
      if (code !== 0 && code !== null) {
        vscode.window.showErrorMessage(`Copilot Browser: Relay server exited unexpectedly with code ${code}`);
      }
    });

    // Wait for server to start, then connect
    outputChannel.appendLine("Waiting for relay server to start...");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    outputChannel.appendLine(`Attempting to connect to WebSocket at ws://localhost:${port}...`);
    await connectToRelay(`ws://localhost:${port}`);

    vscode.window.showInformationMessage(
      "Copilot Browser: Browser launched and connected!"
    );
  } catch (error) {
    console.error("Launch fatal error:", error);
    outputChannel.appendLine(`❌ Fatal Launch Error: ${error.message}`);
    outputChannel.appendLine(error.stack);
    vscode.window.showErrorMessage(
      `Copilot Browser: Fatal Error: ${error.message}`
    );
  }
}

// Update status bar and sidebar view
function updateStatusBar(connected) {
  if (connected) {
    statusBarItem.text = "$(globe) Browser Agent: Connected";
    statusBarItem.tooltip = "Copilot Browser - Connected to relay server";
    statusBarItem.backgroundColor = undefined;
    statusBarItem.command = "browserAgent.disconnect";
  } else {
    statusBarItem.text = "$(globe) Browser Agent: Disconnected";
    statusBarItem.tooltip = "Click to connect to relay server";
    statusBarItem.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.warningBackground"
    );
    statusBarItem.command = "browserAgent.connect";
  }
  // Sync sidebar view
  if (agentViewProvider) {
    agentViewProvider.updateConnectionStatus(connected);
  }
}

function deactivate() {
  if (ws) {
    ws.close();
  }
  if (relayServerProcess) {
    relayServerProcess.kill();
  }
  if (outputChannel) {
    outputChannel.dispose();
  }
  if (statusBarItem) {
    statusBarItem.dispose();
  }
}

module.exports = {
  activate,
  deactivate,
  // Export API for Copilot and other extensions
  getAPI: () => ({
    isConnected: () => isConnected,
    sendCommand,
    connect: connectToRelay,
    disconnect,
  }),
};

// Helper to find a free port
function findFreePort(startPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(startPort, () => {
      server.close(() => {
        resolve(startPort);
      });
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        // Port taken, try next one
        resolve(findFreePort(startPort + 1));
      } else {
        reject(err);
      }
    });
  });
}
