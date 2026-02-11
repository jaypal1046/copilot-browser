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
  relayServerUrl: "ws://localhost:8080", // Default
  autoReconnect: true,
  heartbeatInterval: 25000,
  maxReconnectAttempts: 10,
  selfHeal: true,
  maxRetries: 3
};



// Listen for settings updates
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "settingsUpdated") {
    console.log("Settings updated:", message.settings);
    const { settings } = message;

    // Update config
    if (settings.relayUrl) config.relayServerUrl = settings.relayUrl;
    if (settings.autoReconnect !== undefined) config.autoReconnect = settings.autoReconnect;
    if (settings.heartbeat) config.heartbeatInterval = settings.heartbeat;
    if (settings.maxReconnect) config.maxReconnectAttempts = settings.maxReconnect;
    if (settings.selfHeal !== undefined) config.selfHeal = settings.selfHeal;
    if (settings.maxRetries !== undefined) config.maxRetries = settings.maxRetries;

    // Reconnect with new settings
    if (ws) {
      ws.close(); // Will trigger auto-reconnect or we force it?
      // Force immediate reconnect if auto-connect is true
      if (config.autoReconnect) {
        setTimeout(connectToRelay, 1000);
      }
    } else {
      connectToRelay();
    }
  }
});

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

// Dialog handling configuration
let dialogConfig = {
  autoAccept: true,
  autoResponse: "",
  captureDialogs: true,
};

// Session recording
let isRecording = false;
const recordedCommands = [];

// Command stats
const commandStats = {
  total: 0,
  success: 0,
  failed: 0,
  byCommand: {},
};

// Initialize function
function initializeAndConnect() {
  chrome.storage.local.get([
    "relayUrl", "autoReconnect", "heartbeat",
    "maxReconnect", "selfHeal", "maxRetries"
  ], (result) => {
    if (result.relayUrl) config.relayServerUrl = result.relayUrl;
    if (result.autoReconnect !== undefined) config.autoReconnect = result.autoReconnect;
    if (result.heartbeat) config.heartbeatInterval = result.heartbeat;
    if (result.maxReconnect) config.maxReconnectAttempts = result.maxReconnect;
    if (result.selfHeal !== undefined) config.selfHeal = result.selfHeal;
    if (result.maxRetries !== undefined) config.maxRetries = result.maxRetries;

    console.log("Configuration loaded:", config);
    connectToRelay();
  });
}

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  console.log("Browser Copilot Agent installed");
  initializeAndConnect();
});

// Connect on startup
chrome.runtime.onStartup.addListener(() => {
  console.log("Browser Copilot Agent started");
  initializeAndConnect();
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
        chrome.tabs.sendMessage(tab.id, { type: "keepalive" }).catch(() => { });
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
          version: "2.0.0",
          capabilities: [
            "navigate", "click", "type", "scroll", "hover", "submit",
            "get_console", "get_dom", "get_element", "get_screenshot",
            "get_performance", "get_cookies", "get_storage", "execute_js",
            "tab_list", "tab_open", "tab_close", "tab_switch", "tab_reload",
            "findByText", "findByRole", "findByLabel", "findByPlaceholder",
            "waitForSelector", "waitForText",
            "summarizePage", "getAccessibility",
            "keyPress", "keyCombo", "dragAndDrop", "selectOption",
            "executeInIframe", "highlight", "visual_snapshot",
            "start_monitoring", "stop_monitoring", "get_events",
            "start_recording", "stop_recording", "get_recording",
            "set_dialog_config", "get_network", "get_stats",
          ],
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
  const startTime = Date.now();

  // Track stats
  commandStats.total++;
  commandStats.byCommand[command] = (commandStats.byCommand[command] || 0) + 1;

  // Record if recording
  if (isRecording) {
    recordedCommands.push({
      command,
      params,
      timestamp: Date.now(),
    });
  }

  try {
    let result;

    switch (command) {
      // ============= Navigation =============
      case "navigate":
        result = await executeNavigate(params);
        break;

      // ============= DOM Interaction =============
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

      // ============= Data Retrieval =============
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

      // ============= JavaScript Execution =============
      case "execute_js":
        result = await executeJS(params);
        break;

      // ============= TAB MANAGEMENT (NEW) =============
      case "tab_list":
        result = await tabList(params);
        break;
      case "tab_open":
        result = await tabOpen(params);
        break;
      case "tab_close":
        result = await tabClose(params);
        break;
      case "tab_switch":
        result = await tabSwitch(params);
        break;
      case "tab_reload":
        result = await tabReload(params);
        break;

      // ============= SMART SELECTORS (NEW) =============
      case "findByText":
      case "findByRole":
      case "findByLabel":
      case "findByPlaceholder":
        result = await executeInContentScript(command, params);
        break;

      // ============= WAIT COMMANDS (NEW) =============
      case "waitForSelector":
      case "waitForText":
        result = await executeInContentScript(command, params);
        break;

      // ============= PAGE INTELLIGENCE (NEW) =============
      case "summarizePage":
      case "getAccessibility":
        result = await executeInContentScript(command, params || {});
        break;

      // ============= KEYBOARD & MOUSE (NEW) =============
      case "keyPress":
      case "keyCombo":
      case "dragAndDrop":
        result = await executeInContentScript(command, params);
        break;

      // ============= SELECT/DROPDOWN (NEW) =============
      case "selectOption":
        result = await executeInContentScript(command, params);
        break;

      // ============= IFRAME (NEW) =============
      case "executeInIframe":
        result = await executeInContentScript(command, params);
        break;

      // ============= ELEMENT HIGHLIGHT (NEW) =============
      case "highlight":
        result = await executeInContentScript(command, params);
        break;

      // ============= VISUAL DIFF (NEW) =============
      case "visual_snapshot":
        result = await executeInContentScript(command, params);
        break;

      // ============= DIALOG CONFIG (NEW) =============
      case "set_dialog_config":
        result = setDialogConfig(params);
        break;

      // ============= NETWORK (NEW) =============
      case "get_network":
        result = getNetworkLogs(params);
        break;

      // ============= MONITORING =============
      case "start_monitoring":
        result = startMonitoring(params);
        break;
      case "stop_monitoring":
        result = stopMonitoring(params);
        break;
      case "get_events":
        result = getEvents(params);
        break;

      // ============= SESSION RECORDING (NEW) =============
      case "start_recording":
        result = startRecording();
        break;
      case "stop_recording":
        result = stopRecording();
        break;
      case "get_recording":
        result = getRecording();
        break;

      // ============= STATS (NEW) =============
      case "get_stats":
        result = getStats();
        break;

      default:
        throw new Error(`Unknown command: ${command}`);
    }

    // Track success
    commandStats.success++;

    // Send success response
    sendResponse(id, true, result);
  } catch (error) {
    commandStats.failed++;
    console.error(`Error executing command ${command}:`, error);
    sendResponse(id, false, null, {
      code: "EXECUTION_ERROR",
      message: error.message,
      stack: error.stack,
    });
  }
}

// ============================================
// Tab Management Commands
// ============================================

async function tabList(params) {
  const queryOptions = {};
  if (params.currentWindow !== false) {
    queryOptions.currentWindow = true;
  }

  const tabs = await chrome.tabs.query(queryOptions);
  return {
    tabs: tabs.map((tab) => ({
      id: tab.id,
      index: tab.index,
      title: tab.title,
      url: tab.url,
      active: tab.active,
      pinned: tab.pinned,
      audible: tab.audible,
      status: tab.status,
      favIconUrl: tab.favIconUrl,
      windowId: tab.windowId,
    })),
    total: tabs.length,
    activeTabId: tabs.find((t) => t.active)?.id,
  };
}

async function tabOpen(params) {
  const { url = "about:blank", active = true, pinned = false } = params;
  const tab = await chrome.tabs.create({ url, active, pinned });

  // Wait for load if URL provided
  if (url !== "about:blank") {
    await new Promise((resolve) => {
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === tab.id && info.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      });
    });
  }

  return {
    id: tab.id,
    url: tab.url || url,
    title: tab.title,
    index: tab.index,
  };
}

async function tabClose(params) {
  const { tabId, tabIds } = params;
  const idsToClose = tabIds || [tabId];

  await chrome.tabs.remove(idsToClose);

  return {
    closed: idsToClose,
    count: idsToClose.length,
  };
}

async function tabSwitch(params) {
  const { tabId, index } = params;

  let targetTab;
  if (tabId) {
    targetTab = await chrome.tabs.update(tabId, { active: true });
  } else if (index !== undefined) {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const tab = tabs[index];
    if (!tab) throw new Error(`No tab at index ${index}`);
    targetTab = await chrome.tabs.update(tab.id, { active: true });
  } else {
    throw new Error("Provide tabId or index");
  }

  return {
    id: targetTab.id,
    title: targetTab.title,
    url: targetTab.url,
    index: targetTab.index,
  };
}

async function tabReload(params) {
  const { tabId, bypassCache = false } = params;

  const activeTab = tabId
    ? await chrome.tabs.get(tabId)
    : (await chrome.tabs.query({ active: true, currentWindow: true }))[0];

  await chrome.tabs.reload(activeTab.id, { bypassCache });

  // Wait for reload to complete
  await new Promise((resolve) => {
    chrome.tabs.onUpdated.addListener(function listener(updatedTabId, info) {
      if (updatedTabId === activeTab.id && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    });
  });

  const updatedTab = await chrome.tabs.get(activeTab.id);
  return {
    id: updatedTab.id,
    title: updatedTab.title,
    url: updatedTab.url,
    bypassCache,
  };
}

// ============================================
// Dialog Configuration
// ============================================

function setDialogConfig(params) {
  dialogConfig = { ...dialogConfig, ...params };
  return {
    success: true,
    config: dialogConfig,
  };
}

// ============================================
// Network Logs
// ============================================

function getNetworkLogs(params) {
  const { limit = 50, filter } = params || {};

  let logs = [...networkBuffer];

  if (filter) {
    if (filter.url) {
      logs = logs.filter((l) => l.url.includes(filter.url));
    }
    if (filter.method) {
      logs = logs.filter(
        (l) => l.method.toUpperCase() === filter.method.toUpperCase()
      );
    }
    if (filter.statusCode) {
      logs = logs.filter((l) => l.statusCode === filter.statusCode);
    }
    if (filter.type) {
      logs = logs.filter((l) => l.type === filter.type);
    }
  }

  return {
    logs: logs.slice(-limit),
    total: networkBuffer.length,
    filtered: logs.length,
  };
}

// ============================================
// Session Recording
// ============================================

function startRecording() {
  isRecording = true;
  recordedCommands.length = 0;
  return {
    recording: true,
    startedAt: Date.now(),
  };
}

function stopRecording() {
  isRecording = false;
  return {
    recording: false,
    commands: recordedCommands.length,
    stoppedAt: Date.now(),
  };
}

function getRecording() {
  return {
    recording: isRecording,
    commands: [...recordedCommands],
    total: recordedCommands.length,
  };
}

// ============================================
// Stats
// ============================================

function getStats() {
  return {
    ...commandStats,
    connected: isConnected,
    clientId,
    reconnectAttempts,
    networkBufferSize: networkBuffer.length,
    consoleBufferSize: consoleBuffer.length,
    eventBufferSize: eventBuffer.length,
    recording: isRecording,
    recordedCommands: recordedCommands.length,
  };
}

// ============================================
// Original command implementations
// ============================================

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

// Execute command in content script (with auto-retry self-healing)
async function executeInContentScript(command, params, tabId) {
  const activeTab = tabId
    ? await chrome.tabs.get(tabId)
    : (await chrome.tabs.query({ active: true, currentWindow: true }))[0];

  if (!activeTab) {
    throw new Error("No active tab found");
  }

  // Check if we can access this tab
  if (activeTab.url && (activeTab.url.startsWith("chrome://") || activeTab.url.startsWith("chrome-extension://"))) {
    throw new Error(`Cannot execute commands on ${activeTab.url} (restricted URL)`);
  }

  // Self-healing: commands with selectors get auto-retry with fallback strategies
  const selectorCommands = ["click", "type", "hover", "submit", "scroll", "getElement", "highlight"];
  const maxRetries = 3;
  const retryDelay = 500;
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await chrome.tabs.sendMessage(activeTab.id, {
        type: "execute",
        command,
        params,
      });

      // Check if response indicates a failure
      if (response && response.success === false && response.error) {
        throw new Error(response.error.message || "Command failed");
      }

      // Attach healing info if we retried
      if (attempt > 0 && response) {
        response._healed = true;
        response._healAttempt = attempt;
        response._originalSelector = params.selector;
      }

      return response;
    } catch (error) {
      lastError = error;

      // Only retry selector-based commands with "not found" errors
      const isNotFound = error.message && (
        error.message.includes("not found") ||
        error.message.includes("No element") ||
        error.message.includes("Cannot read")
      );

      if (!isNotFound || !selectorCommands.includes(command) || !params.selector) {
        throw error; // Don't retry non-selector errors
      }

      if (attempt < maxRetries) {
        console.log(`[Self-Heal] ${command} failed (attempt ${attempt + 1}), trying fallback...`);
        await new Promise(r => setTimeout(r, retryDelay * (attempt + 1)));

        // Fallback strategy 1: Try with aria-label or text content
        if (attempt === 0 && params.selector) {
          // Try finding by text that might match the selector
          const selectorText = params.selector.replace(/[#.\[\]='"]/g, ' ').trim();
          if (selectorText) {
            try {
              const found = await chrome.tabs.sendMessage(activeTab.id, {
                type: "execute",
                command: "findByText",
                params: { text: selectorText },
              });
              if (found && found.success && found.tagName) {
                // Build a new selector based on the found element
                if (found.id) {
                  params = { ...params, selector: `#${found.id}` };
                  continue;
                }
              }
            } catch (_) { }
          }
        }

        // Fallback strategy 2: Try broader selector (remove pseudo-classes, nth-child, etc.)
        if (attempt === 1 && params.selector) {
          const simplified = params.selector
            .replace(/:nth-child\([^)]*\)/g, '')
            .replace(/:first-child|:last-child/g, '')
            .replace(/\s*>\s*/g, ' ')
            .trim();
          if (simplified !== params.selector) {
            params = { ...params, selector: simplified };
            continue;
          }
        }

        // Fallback strategy 3: Wait longer for element to appear
        if (attempt === 2) {
          try {
            await chrome.tabs.sendMessage(activeTab.id, {
              type: "execute",
              command: "waitForSelector",
              params: { selector: params.selector, timeout: 3000 },
            });
          } catch (_) { }
        }
      }
    }
  }

  throw lastError || new Error(`Command ${command} failed after ${maxRetries} retries`);
}

// Direct content script call (no retry, for internal use)
async function executeInContentScriptDirect(command, params, tabId) {
  const activeTab = tabId
    ? await chrome.tabs.get(tabId)
    : (await chrome.tabs.query({ active: true, currentWindow: true }))[0];

  if (!activeTab) throw new Error("No active tab found");

  return chrome.tabs.sendMessage(activeTab.id, {
    type: "execute",
    command,
    params,
  });
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

// Web request monitoring (Enhanced)
chrome.webRequest.onCompleted.addListener(
  (details) => {
    const entry = {
      url: details.url,
      method: details.method,
      statusCode: details.statusCode,
      timestamp: details.timeStamp,
      type: details.type,
      tabId: details.tabId,
      fromCache: details.fromCache,
      ip: details.ip,
    };

    networkBuffer.push(entry);

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

// Also capture failed requests
chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    const entry = {
      url: details.url,
      method: details.method,
      error: details.error,
      timestamp: details.timeStamp,
      type: details.type,
      tabId: details.tabId,
      statusCode: 0,
    };

    networkBuffer.push(entry);
    if (networkBuffer.length > maxNetworkBuffer) {
      networkBuffer.shift();
    }

    sendEvent("network_error", {
      url: details.url,
      error: details.error,
      type: details.type,
    });
  },
  { urls: ["<all_urls>"] }
);

// Commands from popup and options page
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
      stats: commandStats,
      networkCount: networkBuffer.length,
      consoleCount: consoleBuffer.length,
    });
  } else if (message.action === "getFullStats") {
    sendResponse(getStats());
  } else if (message.action === "settingsUpdated") {
    // Apply settings from options page
    const settings = message.settings || {};
    if (settings.relayUrl) config.relayServerUrl = settings.relayUrl;
    if (settings.autoReconnect !== undefined) config.autoReconnect = settings.autoReconnect;
    if (settings.heartbeat) config.heartbeatInterval = settings.heartbeat;
    if (settings.maxReconnect) maxReconnectAttempts = settings.maxReconnect;
    console.log("Settings updated:", settings);
    sendResponse({ success: true });
  }

  return true;
});

console.log("Background service worker initialized — Enhanced v2.0");
