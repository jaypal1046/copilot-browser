// Relay Server for Copilot Browser / Copilot Browser-vscode - Enhanced v2.0
// Routes commands between VS Code extension and browser extension

const WebSocket = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ============================================
// Configuration
// ============================================

// Parse command line arguments for port override
const argsPort = process.argv
  .find((a) => a.startsWith("--port="))
  ?.split("=")[1];

const CONFIG = {
  port: parseInt(argsPort || process.env.PORT || "8080"),
  host: process.env.HOST || "0.0.0.0",
  maxPayloadSize: 10 * 1024 * 1024, // 10MB
  heartbeatInterval: 30000,
  rateLimit: {
    windowMs: 60000,
    maxRequests: 200,
  },
  auth: {
    enabled: process.env.AUTH_ENABLED === "true",
    apiKey: process.env.API_KEY || "",
  },
};

// Load config file if exists
const configPath = path.join(__dirname, "config.json");
if (fs.existsSync(configPath)) {
  try {
    const fileConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    // Priority: Command line args > config.json > Env > Default
    Object.assign(CONFIG, fileConfig);
    if (argsPort) CONFIG.port = parseInt(argsPort);
  } catch (e) {
    console.warn("Warning: Could not parse config.json:", e.message);
  }
}

// ============================================
// State
// ============================================

const clients = new Map(); // clientId -> { ws, type, metadata, registeredAt }
const commandHistory = []; // { id, command, params, fromClient, toClient, status, timestamp, duration }
const maxHistorySize = 500;
const rateLimitMap = new Map(); // clientId -> { count, resetAt }

// Server metrics
const metrics = {
  startedAt: Date.now(),
  totalConnections: 0,
  totalCommands: 0,
  totalErrors: 0,
  commandsByType: {},
  avgResponseTime: 0,
  responseTimes: [],
};

// ============================================
// HTTP Server
// ============================================

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  switch (url.pathname) {
    case "/":
      serveDashboard(req, res);
      break;
    case "/api/status":
      serveJSON(res, getServerStatus());
      break;
    case "/api/clients":
      serveJSON(res, getClientList());
      break;
    case "/api/metrics":
      serveJSON(res, getMetrics());
      break;
    case "/api/history":
      serveJSON(res, getCommandHistory(url.searchParams));
      break;
    case "/api/health":
      serveJSON(res, { status: "ok", uptime: Date.now() - metrics.startedAt });
      break;
    default:
      res.writeHead(404);
      res.end("Not Found");
  }
});

function serveJSON(res, data) {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data, null, 2));
}

function serveDashboard(req, res) {
  const dashboardPath = path.join(__dirname, "dashboard.html");
  if (fs.existsSync(dashboardPath)) {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(fs.readFileSync(dashboardPath));
  } else {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<h1>Copilot Browser / Copilot Browser-vscode - Relay Server</h1><p>Dashboard not found.</p>");
  }
}

// ============================================
// API Helpers
// ============================================

function getServerStatus() {
  const vscodeClients = [];
  const browserClients = [];

  for (const [id, client] of clients) {
    const info = {
      id,
      type: client.type,
      registeredAt: client.registeredAt,
      metadata: client.metadata,
    };
    if (client.type === "vscode") vscodeClients.push(info);
    else if (client.type === "browser") browserClients.push(info);
  }

  return {
    uptime: Date.now() - metrics.startedAt,
    clients: {
      vscode: vscodeClients,
      browser: browserClients,
      total: clients.size,
    },
    metrics: getMetrics(),
  };
}

function getClientList() {
  const list = [];
  for (const [id, client] of clients) {
    list.push({
      id,
      type: client.type,
      registeredAt: client.registeredAt,
      uptime: Date.now() - client.registeredAt,
      metadata: client.metadata,
    });
  }
  return { clients: list };
}

function getMetrics() {
  return {
    ...metrics,
    uptime: Date.now() - metrics.startedAt,
    activeConnections: clients.size,
    historySize: commandHistory.length,
  };
}

function getCommandHistory(params) {
  let history = [...commandHistory];
  const limit = parseInt(params?.get("limit") || "50");
  const command = params?.get("command");
  const status = params?.get("status");

  if (command) {
    history = history.filter((h) => h.command === command);
  }
  if (status) {
    history = history.filter((h) => h.status === status);
  }

  return {
    history: history.slice(-limit),
    total: commandHistory.length,
    filtered: history.length,
  };
}

// ============================================
// WebSocket Server
// ============================================

const wss = new WebSocket.Server({
  server,
  maxPayload: CONFIG.maxPayloadSize,
  verifyClient: (info, callback) => {
    // API Key auth check on upgrade
    if (CONFIG.auth.enabled && CONFIG.auth.apiKey) {
      const authHeader = info.req.headers["authorization"];
      const urlKey = new URL(
        info.req.url,
        `http://${info.req.headers.host}`
      ).searchParams.get("apiKey");
      const key = authHeader?.replace("Bearer ", "") || urlKey;

      if (key !== CONFIG.auth.apiKey) {
        callback(false, 401, "Unauthorized");
        return;
      }
    }
    callback(true);
  },
});

wss.on("connection", (ws, req) => {
  const clientId = crypto.randomUUID();
  metrics.totalConnections++;

  console.log(`[${new Date().toISOString()}] Client connected: ${clientId}`);

  // Send client ID
  ws.send(
    JSON.stringify({
      type: "connection",
      clientId,
      serverVersion: "2.0.0",
    })
  );

  // Handle messages
  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleMessage(clientId, ws, message);
    } catch (error) {
      console.error(`Error parsing message from ${clientId}:`, error.message);
      ws.send(
        JSON.stringify({
          type: "error",
          error: "Invalid JSON",
        })
      );
    }
  });

  // Handle disconnect
  ws.on("close", () => {
    const client = clients.get(clientId);
    console.log(
      `[${new Date().toISOString()}] Client disconnected: ${clientId} (${client?.type || "unknown"})`
    );
    clients.delete(clientId);
    broadcastStatus();
  });

  // Handle errors
  ws.on("error", (error) => {
    console.error(`WebSocket error for ${clientId}:`, error.message);
    metrics.totalErrors++;
  });
});

// ============================================
// Message Handling
// ============================================

function handleMessage(clientId, ws, message) {
  // Rate limiting
  if (!checkRateLimit(clientId)) {
    ws.send(
      JSON.stringify({
        type: "error",
        error: "Rate limit exceeded",
      })
    );
    return;
  }

  switch (message.type) {
    case "register":
      handleRegister(clientId, ws, message);
      break;

    case "command":
      handleCommand(clientId, message);
      break;

    case "response":
      handleResponse(clientId, message);
      break;

    case "event":
      handleEvent(clientId, message);
      break;

    case "ping":
      ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
      break;

    default:
      console.warn(`Unknown message type from ${clientId}: ${message.type}`);
  }
}

function handleRegister(clientId, ws, message) {
  const client = {
    ws,
    type: message.clientType,
    metadata: message.metadata || {},
    registeredAt: Date.now(),
  };

  clients.set(clientId, client);

  console.log(
    `[${new Date().toISOString()}] Registered: ${clientId} as ${message.clientType}`
  );

  ws.send(
    JSON.stringify({
      type: "registered",
      clientType: message.clientType,
      clientId,
    })
  );

  broadcastStatus();
}

function handleCommand(fromClientId, message) {
  const { id, command, params } = message;
  metrics.totalCommands++;
  metrics.commandsByType[command] =
    (metrics.commandsByType[command] || 0) + 1;

  // Record in history
  const historyEntry = {
    id,
    command,
    params: JSON.stringify(params || {}).substring(0, 500),
    fromClient: fromClientId,
    toClient: null,
    status: "pending",
    timestamp: Date.now(),
    duration: null,
  };
  commandHistory.push(historyEntry);
  if (commandHistory.length > maxHistorySize) commandHistory.shift();

  // Find a browser client to route to
  let targetClient = null;
  for (const [cid, client] of clients) {
    if (client.type === "browser" && client.ws.readyState === WebSocket.OPEN) {
      targetClient = { id: cid, ...client };
      break;
    }
  }

  if (!targetClient) {
    // No browser client connected
    const fromClient = clients.get(fromClientId);
    if (fromClient && fromClient.ws.readyState === WebSocket.OPEN) {
      fromClient.ws.send(
        JSON.stringify({
          type: "response",
          id,
          success: false,
          error: {
            code: "NO_BROWSER",
            message:
              "No browser client connected. Open Chrome with the extension loaded.",
          },
        })
      );
    }
    historyEntry.status = "error";
    historyEntry.duration = Date.now() - historyEntry.timestamp;
    return;
  }

  historyEntry.toClient = targetClient.id;

  // Forward command to browser
  targetClient.ws.send(
    JSON.stringify({
      type: "command",
      id,
      command,
      params,
      fromClient: fromClientId,
    })
  );

  console.log(
    `[${new Date().toISOString()}] Routed: ${command} (${fromClientId} → ${targetClient.id})`
  );
}

function handleResponse(fromClientId, message) {
  const { id, success, data, error } = message;

  // Update history
  const historyEntry = commandHistory.find((h) => h.id === id);
  if (historyEntry) {
    historyEntry.status = success ? "success" : "error";
    historyEntry.duration = Date.now() - historyEntry.timestamp;

    // Track response times
    metrics.responseTimes.push(historyEntry.duration);
    if (metrics.responseTimes.length > 100) metrics.responseTimes.shift();
    metrics.avgResponseTime = Math.round(
      metrics.responseTimes.reduce((a, b) => a + b, 0) /
      metrics.responseTimes.length
    );
  }

  // Route response back to VS Code client
  for (const [cid, client] of clients) {
    if (client.type === "vscode" && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(
        JSON.stringify({
          type: "response",
          id,
          success,
          data,
          error,
          timestamp: Date.now(),
        })
      );
    }
  }
}

function handleEvent(fromClientId, message) {
  // Forward events from browser to all VS Code clients
  for (const [cid, client] of clients) {
    if (client.type === "vscode" && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }
}

// ============================================
// Rate Limiting
// ============================================

function checkRateLimit(clientId) {
  const now = Date.now();
  let entry = rateLimitMap.get(clientId);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + CONFIG.rateLimit.windowMs };
    rateLimitMap.set(clientId, entry);
  }

  entry.count++;
  return entry.count <= CONFIG.rateLimit.maxRequests;
}

// ============================================
// Status Broadcasting
// ============================================

function broadcastStatus() {
  const status = {
    type: "status",
    clients: {
      vscode: [...clients.entries()]
        .filter(([, c]) => c.type === "vscode")
        .map(([id]) => id),
      browser: [...clients.entries()]
        .filter(([, c]) => c.type === "browser")
        .map(([id]) => id),
    },
    timestamp: Date.now(),
  };

  for (const [, client] of clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(status));
    }
  }
}

// ============================================
// Heartbeat
// ============================================

const heartbeatInterval = setInterval(() => {
  for (const [clientId, client] of clients) {
    if (client.ws.readyState !== WebSocket.OPEN) {
      clients.delete(clientId);
      continue;
    }
    client.ws.ping();
  }
}, CONFIG.heartbeatInterval);

// ============================================
// Browser Launcher
// ============================================

const launchBrowser = process.argv.includes("--launch-browser");
const platform =
  process.argv
    .find((a) => a.startsWith("--platform="))
    ?.split("=")[1] || "desktop";

if (launchBrowser) {
  const { PlatformLauncher } = require("./launcher");

  server.on("listening", async () => {
    console.log("Launching browser...");
    try {
      await PlatformLauncher.launch({
        platform,
        serverUrl: `ws://localhost:${CONFIG.port}`,
      });
      console.log("Browser launched successfully");
    } catch (error) {
      console.error("Failed to launch browser:", error.message);
    }
  });
}

// ============================================
// Graceful Shutdown
// ============================================

function shutdown() {
  console.log("\nShutting down relay server...");
  clearInterval(heartbeatInterval);

  // Close all client connections
  for (const [, client] of clients) {
    client.ws.close(1001, "Server shutting down");
  }

  wss.close(() => {
    server.close(() => {
      console.log("Server stopped.");
      process.exit(0);
    });
  });

  // Force exit after 5 seconds
  setTimeout(() => process.exit(1), 5000);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// ============================================
// Start Server
// ============================================

server.listen(CONFIG.port, CONFIG.host, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║   Copilot Browser / Copilot Browser-vscode — Relay Server v2.0  ║
╠══════════════════════════════════════════════╣
║  WebSocket: ws://${CONFIG.host}:${CONFIG.port}                 ║
║  Dashboard: http://localhost:${CONFIG.port}              ║
║  API:       http://localhost:${CONFIG.port}/api/status    ║
║  Auth:      ${CONFIG.auth.enabled ? "Enabled ✓" : "Disabled (open)"}                       ║
╚══════════════════════════════════════════════╝
  `);
});
