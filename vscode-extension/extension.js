// VS Code Extension for Browser Copilot Agent
// Enables GitHub Copilot to send commands to browser

const vscode = require("vscode");
const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");
const cp = require("child_process");
const path = require("path");
const fs = require("fs");
const { startServer } = require("../relay-server/index.js");

let ws = null;
let relayServerInstance = null;
let clientId = null;
let isConnected = false;
let statusBarItem = null;
let outputChannel = null;
let pendingCommands = new Map(); // commandId -> { resolve, reject, timeout }

/**
 * Extension activation
 */
function activate(context) {
  console.log("Browser Copilot Agent extension is now active");

  // Create output channel
  outputChannel = vscode.window.createOutputChannel("Browser Agent");
  context.subscriptions.push(outputChannel);

  // Create status bar item
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = "browserAgent.connect";
  statusBarItem.text = "$(browser) Browser: Disconnected";
  statusBarItem.tooltip = "Click to connect to browser";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Register commands
  registerCommands(context);

  // Auto-connect if enabled
  const config = vscode.workspace.getConfiguration("browserAgent");
  if (config.get("autoConnect")) {
    setTimeout(() => connectToRelay(), 1000);
  }

  log("Extension activated");
}

/**
 * Register all commands
 */
function registerCommands(context) {
  // Connection commands
  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.connect", async () => {
      await connectToRelay();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.disconnect", async () => {
      disconnectFromRelay();
      vscode.window.showInformationMessage("Disconnected from browser");
    })
  );

  // LAUNCH BROWSER COMMAND - New!
  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.launchBrowser", async () => {
      await startLocalRelay();
    })
  );

  // TEST COMMAND - New!
  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.runTests", async () => {
      outputChannel.clear();
      outputChannel.show();
      outputChannel.appendLine(
        "🧪 Running Browser Copilot Integration Tests...\n"
      );

      try {
        const { runTests } = require("./test-integration");
        const result = await runTests();

        if (result.success) {
          vscode.window.showInformationMessage("✅ All tests passed!");
        } else {
          vscode.window.showErrorMessage(`❌ Tests failed: ${result.error}`);
        }
      } catch (error) {
        outputChannel.appendLine(`❌ Error: ${error.message}`);
        vscode.window.showErrorMessage(`Test error: ${error.message}`);
      }
    })
  );

  // Navigation command
  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.navigate", async () => {
      const url = await vscode.window.showInputBox({
        prompt: "Enter URL to navigate to",
        placeHolder: "https://example.com",
      });

      if (url) {
        const result = await sendCommand("navigate", { url });
        vscode.window.showInformationMessage(
          `Navigated to: ${result.data.url}`
        );
      }
    })
  );

  // Click command
  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.click", async () => {
      const selector = await vscode.window.showInputBox({
        prompt: "Enter CSS selector to click",
        placeHolder: "#button-id or .button-class",
      });

      if (selector) {
        const result = await sendCommand("click", { selector });
        vscode.window.showInformationMessage(`Clicked: ${selector}`);
      }
    })
  );

  // Type command
  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.type", async () => {
      const selector = await vscode.window.showInputBox({
        prompt: "Enter CSS selector for input field",
        placeHolder: '#input-id or input[name="username"]',
      });

      if (!selector) return;

      const text = await vscode.window.showInputBox({
        prompt: "Enter text to type",
        placeHolder: "Text to type",
      });

      if (text) {
        const result = await sendCommand("type", {
          selector,
          text,
          clear: true,
        });
        vscode.window.showInformationMessage(`Typed text into: ${selector}`);
      }
    })
  );

  // Get console logs
  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.getConsole", async () => {
      const result = await sendCommand("get_console", { limit: 50 });

      if (result.success && result.data.logs.length > 0) {
        // Show logs in output channel
        outputChannel.clear();
        outputChannel.appendLine("=== Browser Console Logs ===\n");

        result.data.logs.forEach((log) => {
          const time = new Date(log.timestamp).toLocaleTimeString();
          outputChannel.appendLine(
            `[${time}] [${log.level.toUpperCase()}] ${log.message}`
          );
        });

        outputChannel.show();
      } else {
        vscode.window.showInformationMessage("No console logs found");
      }
    })
  );

  // Get DOM
  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.getDOM", async () => {
      const selector = await vscode.window.showInputBox({
        prompt: "Enter CSS selector (leave empty for full page)",
        placeHolder: "#element-id or leave empty",
      });

      const result = await sendCommand("get_dom", {
        selector: selector || undefined,
      });

      if (result.success) {
        // Create new document with HTML
        const doc = await vscode.workspace.openTextDocument({
          content: result.data.html,
          language: "html",
        });
        await vscode.window.showTextDocument(doc);
      }
    })
  );

  // Screenshot
  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.screenshot", async () => {
      const result = await sendCommand("get_screenshot", { format: "png" });

      if (result.success) {
        // Create HTML preview with screenshot
        const panel = vscode.window.createWebviewPanel(
          "browserScreenshot",
          "Browser Screenshot",
          vscode.ViewColumn.Two,
          {}
        );

        panel.webview.html = `
          <!DOCTYPE html>
          <html>
            <body style="margin: 0; padding: 20px; background: #1e1e1e;">
              <img src="${result.data.screenshot}" style="max-width: 100%; border: 1px solid #333;" />
            </body>
          </html>
        `;
      }
    })
  );

  // Execute JavaScript
  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.executeJS", async () => {
      const code = await vscode.window.showInputBox({
        prompt: "Enter JavaScript code to execute",
        placeHolder: "document.title",
      });

      if (code) {
        const result = await sendCommand("execute_js", { code });

        if (result.success && result.data.success) {
          vscode.window.showInformationMessage(
            `Result: ${JSON.stringify(result.data.result)}`
          );
        }
      }
    })
  );

  // Get performance metrics
  context.subscriptions.push(
    vscode.commands.registerCommand("browserAgent.getPerformance", async () => {
      const result = await sendCommand("get_performance", {});

      if (result.success) {
        outputChannel.clear();
        outputChannel.appendLine("=== Browser Performance Metrics ===\n");
        outputChannel.appendLine(JSON.stringify(result.data, null, 2));
        outputChannel.show();
      }
    })
  );
}

/**
 * Connect to relay server
 */
async function connectToRelay() {
  if (isConnected) {
    vscode.window.showInformationMessage("Already connected to browser");
    return;
  }

  const config = vscode.workspace.getConfiguration("browserAgent");
  const relayUrl = config.get("relayServerUrl") || "ws://localhost:8080";

  log(`Connecting to relay server: ${relayUrl}`);

  try {
    ws = new WebSocket(relayUrl);

    ws.on("open", () => {
      log("Connected to relay server");
      isConnected = true;

      // Register as VS Code client
      sendMessage({
        type: "register",
        clientType: "vscode",
        metadata: {
          version: vscode.version,
          workspace: vscode.workspace.name || "unknown",
        },
      });

      updateStatusBar();
      vscode.window.showInformationMessage("Connected to browser agent");
    });

    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleMessage(message);
      } catch (error) {
        log(`Error parsing message: ${error.message}`);
      }
    });

    ws.on("close", () => {
      log("Disconnected from relay server");
      isConnected = false;
      ws = null;
      updateStatusBar();

      // Reject all pending commands
      pendingCommands.forEach((cmd, id) => {
        clearTimeout(cmd.timeout);
        cmd.reject(new Error("Connection closed"));
      });
      pendingCommands.clear();
    });

    ws.on("error", (error) => {
      log(`WebSocket error: ${error.message}`);
      vscode.window.showErrorMessage(
        `Browser Agent connection error: ${error.message}`
      );
    });
  } catch (error) {
    log(`Failed to connect: ${error.message}`);
    vscode.window.showErrorMessage(
      `Failed to connect to browser agent: ${error.message}`
    );
  }
}

/**
 * Start Local Relay Server with Browser Launch
 */
/**
 * Start Local Relay Server with Browser Launch
 */
async function startLocalRelay() {
  if (relayServerInstance) {
    vscode.window.showInformationMessage("Local relay server is already running.");
    if (!isConnected) connectToRelay();
    return;
  }

  vscode.window.showInformationMessage("🚀 Starting Browser Copilot Local Server...");

  try {
    const platform = process.platform; // win32, darwin, linux

    // Start server in-process
    relayServerInstance = startServer({
      launchBrowser: true,
      platform: platform,
      port: 8080 // Ensure this matches config or default
    });

    log("Local relay server started internally.");

    // Loop to connect
    let retries = 10;
    const connectLoop = setInterval(() => {
      if (isConnected) {
        clearInterval(connectLoop);
        vscode.window.showInformationMessage("✅ Connected to Isolated Browser!");
      } else if (retries-- > 0) {
        connectToRelay();
      } else {
        clearInterval(connectLoop);
        vscode.window.showErrorMessage("❌ Timed out waiting for server connection.");
      }
    }, 1000);

  } catch (e) {
    vscode.window.showErrorMessage(`❌ Error launching server: ${e.message}`);
    log(`Server launch error: ${e.stack}`);
  }
}

/**
 * Disconnect from relay server
 */
function disconnectFromRelay() {
  if (ws) {
    ws.close();
    ws = null;
  }
  isConnected = false;
  updateStatusBar();
}

/**
 * Handle incoming messages
 */
function handleMessage(message) {
  log(`Received: ${message.type}`);

  switch (message.type) {
    case "connection":
      clientId = message.clientId;
      log(`Assigned client ID: ${clientId}`);
      break;

    case "registered":
      log("Registered as VS Code client");
      break;

    case "response":
      handleCommandResponse(message);
      break;

    case "event":
      handleEvent(message);
      break;

    case "status":
      log(
        `Server status - Browser clients: ${message.clients.browser}, VS Code clients: ${message.clients.vscode}`
      );
      break;

    case "error":
      log(`Server error: ${message.error.message}`);
      break;
  }
}

/**
 * Handle command response
 */
function handleCommandResponse(message) {
  const pending = pendingCommands.get(message.id);

  if (pending) {
    clearTimeout(pending.timeout);
    pendingCommands.delete(message.id);

    if (message.success) {
      pending.resolve(message);
    } else {
      pending.reject(new Error(message.error?.message || "Command failed"));
    }
  }
}

/**
 * Handle events from browser
 */
function handleEvent(message) {
  log(`Event: ${message.eventType}`);
  // Can be extended to show notifications or update UI based on events
}

/**
 * Send command to browser
 */
async function sendCommand(command, params = {}) {
  if (!isConnected) {
    throw new Error("Not connected to browser. Please connect first.");
  }

  const commandId = uuidv4();
  const config = vscode.workspace.getConfiguration("browserAgent");
  const timeout = config.get("commandTimeout") || 10000;

  log(`Sending command: ${command}`);

  return new Promise((resolve, reject) => {
    // Set timeout
    const timer = setTimeout(() => {
      pendingCommands.delete(commandId);
      reject(new Error(`Command timeout: ${command}`));
    }, timeout);

    // Store pending command
    pendingCommands.set(commandId, { resolve, reject, timeout: timer });

    // Send command
    sendMessage({
      type: "command",
      id: commandId,
      command,
      params,
      timestamp: Date.now(),
    });
  });
}

/**
 * Send message to relay server
 */
function sendMessage(message) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

/**
 * Update status bar
 */
function updateStatusBar() {
  if (isConnected) {
    statusBarItem.text = "$(browser) Browser: Connected";
    statusBarItem.tooltip = "Connected to browser - Click to disconnect";
    statusBarItem.command = "browserAgent.disconnect";
    statusBarItem.backgroundColor = undefined;
  } else {
    statusBarItem.text = "$(browser) Browser: Disconnected";
    statusBarItem.tooltip = "Click to connect to browser";
    statusBarItem.command = "browserAgent.connect";
    statusBarItem.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.warningBackground"
    );
  }
}

/**
 * Log message
 */
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  if (outputChannel) {
    outputChannel.appendLine(logMessage);
  }
}

/**
 * Extension deactivation
 */
function deactivate() {
  disconnectFromRelay();
  if (relayServerInstance) {
    if (relayServerInstance.wss) relayServerInstance.wss.close();
    if (relayServerInstance.server) relayServerInstance.server.close();
    relayServerInstance = null;
  }
  log("Extension deactivated");
}

// Export API for Copilot Chat integration
module.exports = {
  activate,
  deactivate,
  // Export functions that Copilot can call
  sendCommand,
  getConnectionStatus: () => ({ isConnected, clientId }),
};
