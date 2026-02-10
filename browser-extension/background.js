// Background Service Worker for Browser Copilot Agent
// Handles WebSocket connection to relay server and command execution

let ws = null;
let clientId = null;
let isConnected = false;
let reconnectAttempts = 0;
let maxReconnectAttempts = 10;
let reconnectInterval = 5000;
let keepAliveInterval = null;

const config = {
  relayServerUrl: "ws://localhost:8080",
  autoReconnect: true,
  heartbeatInterval: 25000, // Send ping every 25s to keep service worker alive
};

// Console log interceptor storage
const consoleBuffer = [];
const maxConsoleBuffer = 1000;

// Network request storage
const networkBuffer = [];
const maxNetworkBuffer = 100;

// Event monitoring
let monitoringEnabled = false;
const eventBuffer = [];
const maxEventBuffer = 500;

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  console.log("Browser Copilot Agent installed");
  connectToRelay();
});

// Connect on startup
chrome.runtime.onStartup.addListener(() => {
  console.log("Browser Copilot Agent started");
  connectToRelay();
});

// Keep service worker alive
function keepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }

  keepAliveInterval = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      sendMessage({
        type: "ping",
        timestamp: Date.now(),
      });
    }

    // Also send a message to content scripts to keep them alive
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, { type: "keepalive" }).catch(() => {});
      });
    });
  }, config.heartbeatInterval);
}

// Connect to relay server
function connectToRelay() {
  if (
    ws &&
    (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)
  ) {
    console.log("Already connected or connecting");
    return;
  }

  console.log("Connecting to relay server:", config.relayServerUrl);

  try {
    ws = new WebSocket(config.relayServerUrl);

    ws.onopen = () => {
      console.log("Connected to relay server");
      isConnected = true;
      reconnectAttempts = 0;

      // Register as browser client
      sendMessage({
        type: "register",
        clientType: "browser",
        metadata: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          timestamp: Date.now(),
        },
      });

      // Update badge
      chrome.action.setBadgeText({ text: "✓" });
      chrome.action.setBadgeBackgroundColor({ color: "#00AA00" });

      // Start keep-alive
      keepAlive();
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleMessage(message);
      } catch (error) {
        console.error("Error parsing message:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      isConnected = false;
    };

    ws.onclose = () => {
      console.log("Disconnected from relay server");
      isConnected = false;
      ws = null;

      // Update badge
      chrome.action.setBadgeText({ text: "✗" });
      chrome.action.setBadgeBackgroundColor({ color: "#AA0000" });

      // Clear keep-alive
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
      }

      // Auto-reconnect
      if (config.autoReconnect && reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        console.log(
          `Reconnecting... Attempt ${reconnectAttempts}/${maxReconnectAttempts}`
        );
        setTimeout(connectToRelay, reconnectInterval);
      }
    };
  } catch (error) {
    console.error("Error creating WebSocket:", error);
    isConnected = false;
  }
}

// Handle incoming messages
async function handleMessage(message) {
  console.log("Received message:", message.type, message.command);

  switch (message.type) {
    case "connection":
      clientId = message.clientId;
      console.log("Assigned client ID:", clientId);
      break;

    case "registered":
      console.log("Registered successfully as browser client");
      break;

    case "command":
      await handleCommand(message);
      break;

    case "status":
      console.log("Server status:", message.clients);
      break;

    case "pong":
      // Heartbeat response
      break;

    case "error":
      console.error("Server error:", message.error);
      break;

    default:
      console.warn("Unknown message type:", message.type);
  }
}

// Handle commands from VS Code
async function handleCommand(message) {
  const { id, command, params } = message;

  try {
    let result;

    switch (command) {
      // Navigation commands
      case "navigate":
        result = await executeNavigate(params);
        break;

      // DOM manipulation
      case "click":
        result = await executeClick(params);
        break;

      case "type":
        result = await executeType(params);
        break;

      case "scroll":
        result = await executeScroll(params);
        break;

      case "hover":
        result = await executeHover(params);
        break;

      case "submit":
        result = await executeSubmit(params);
        break;

      // Data retrieval
      case "get_console":
        result = await getConsole(params);
        break;

      case "get_dom":
        result = await getDOM(params);
        break;

      case "get_element":
        result = await getElement(params);
        break;

      case "get_screenshot":
        result = await getScreenshot(params);
        break;

      case "get_performance":
        result = await getPerformance(params);
        break;

      case "get_cookies":
        result = await getCookies(params);
        break;

      case "get_storage":
        result = await getStorage(params);
        break;

      // JavaScript execution
      case "execute_js":
        result = await executeJS(params);
        break;

      // Monitoring
      case "start_monitoring":
        result = startMonitoring(params);
        break;

      case "stop_monitoring":
        result = stopMonitoring(params);
        break;

      case "get_events":
        result = getEvents(params);
        break;

      default:
        throw new Error(`Unknown command: ${command}`);
    }

    // Send success response
    sendResponse(id, true, result);
  } catch (error) {
    console.error(`Error executing command ${command}:`, error);
    sendResponse(id, false, null, {
      code: "EXECUTION_ERROR",
      message: error.message,
      stack: error.stack,
    });
  }
}

// Command implementations
async function executeNavigate(params) {
  const { url, tabId } = params;

  const activeTab = tabId
    ? await chrome.tabs.get(tabId)
    : (await chrome.tabs.query({ active: true, currentWindow: true }))[0];

  await chrome.tabs.update(activeTab.id, { url });

  // Wait for page load
  return new Promise((resolve) => {
    chrome.tabs.onUpdated.addListener(function listener(updatedTabId, info) {
      if (updatedTabId === activeTab.id && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        chrome.tabs.get(activeTab.id, (tab) => {
          resolve({
            url: tab.url,
            title: tab.title,
            status: "complete",
          });
        });
      }
    });
  });
}

async function executeClick(params) {
  const { selector, tabId } = params;
  return executeInContentScript("click", { selector }, tabId);
}

async function executeType(params) {
  const { selector, text, clear, tabId } = params;
  return executeInContentScript("type", { selector, text, clear }, tabId);
}

async function executeScroll(params) {
  const { selector, position, smooth, tabId } = params;
  return executeInContentScript(
    "scroll",
    { selector, position, smooth },
    tabId
  );
}

async function executeHover(params) {
  const { selector, tabId } = params;
  return executeInContentScript("hover", { selector }, tabId);
}

async function executeSubmit(params) {
  const { selector, tabId } = params;
  return executeInContentScript("submit", { selector }, tabId);
}

async function getConsole(params) {
  const { level, limit = 100 } = params;

  let logs = consoleBuffer;

  if (level) {
    logs = logs.filter((log) => log.level === level);
  }

  return {
    logs: logs.slice(-limit),
    total: consoleBuffer.length,
  };
}

async function getDOM(params) {
  const { selector, tabId } = params;
  return executeInContentScript("getDOM", { selector }, tabId);
}

async function getElement(params) {
  const { selector, tabId } = params;
  return executeInContentScript("getElement", { selector }, tabId);
}

async function getScreenshot(params) {
  const { format = "png", quality = 90, tabId } = params;

  const activeTab = tabId
    ? await chrome.tabs.get(tabId)
    : (await chrome.tabs.query({ active: true, currentWindow: true }))[0];

  const screenshot = await chrome.tabs.captureVisibleTab(activeTab.windowId, {
    format,
    quality,
  });

  return {
    screenshot,
    format,
    timestamp: Date.now(),
  };
}

async function getPerformance(params) {
  const { tabId } = params;
  return executeInContentScript("getPerformance", {}, tabId);
}

async function getCookies(params) {
  const { url, domain } = params;
  const cookies = await chrome.cookies.getAll({ url, domain });
  return { cookies };
}

async function getStorage(params) {
  const { type = "local", tabId } = params;
  return executeInContentScript("getStorage", { type }, tabId);
}

async function executeJS(params) {
  const { code, tabId } = params;
  return executeInContentScript("executeJS", { code }, tabId);
}

// Execute command in content script
async function executeInContentScript(command, params, tabId) {
  const activeTab = tabId
    ? await chrome.tabs.get(tabId)
    : (await chrome.tabs.query({ active: true, currentWindow: true }))[0];

  const response = await chrome.tabs.sendMessage(activeTab.id, {
    type: "execute",
    command,
    params,
  });

  return response;
}

// Monitoring functions
function startMonitoring(params) {
  monitoringEnabled = true;
  eventBuffer.length = 0;
  console.log("Monitoring started");
  return { monitoring: true };
}

function stopMonitoring(params) {
  monitoringEnabled = false;
  console.log("Monitoring stopped");
  return { monitoring: false };
}

function getEvents(params) {
  const { limit = 100 } = params;
  return {
    events: eventBuffer.slice(-limit),
    total: eventBuffer.length,
  };
}

// Send message to relay server
function sendMessage(message) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  } else {
    console.warn("Cannot send message: not connected");
  }
}

// Send response to command
function sendResponse(id, success, data = null, error = null) {
  sendMessage({
    type: "response",
    id,
    success,
    data,
    error,
    timestamp: Date.now(),
  });
}

// Send event to VS Code
function sendEvent(eventType, eventData) {
  if (!monitoringEnabled) return;

  const event = {
    type: "event",
    eventType,
    data: eventData,
    timestamp: Date.now(),
  };

  eventBuffer.push(event);
  if (eventBuffer.length > maxEventBuffer) {
    eventBuffer.shift();
  }

  sendMessage(event);
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "console") {
    consoleBuffer.push(message.data);
    if (consoleBuffer.length > maxConsoleBuffer) {
      consoleBuffer.shift();
    }
    sendEvent("console", message.data);
  } else if (message.type === "event") {
    sendEvent(message.eventType, message.data);
  }

  return true;
});

// Web request monitoring
chrome.webRequest.onCompleted.addListener(
  (details) => {
    networkBuffer.push({
      url: details.url,
      method: details.method,
      statusCode: details.statusCode,
      timestamp: details.timeStamp,
      type: details.type,
    });

    if (networkBuffer.length > maxNetworkBuffer) {
      networkBuffer.shift();
    }

    sendEvent("network", {
      url: details.url,
      method: details.method,
      statusCode: details.statusCode,
      type: details.type,
    });
  },
  { urls: ["<all_urls>"] }
);

// Commands from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "connect") {
    connectToRelay();
    sendResponse({ success: true });
  } else if (message.action === "disconnect") {
    if (ws) {
      ws.close();
    }
    sendResponse({ success: true });
  } else if (message.action === "getStatus") {
    sendResponse({
      connected: isConnected,
      clientId: clientId,
    });
  }

  return true;
});

console.log("Background service worker initialized");
