const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { PlatformLauncher } = require("./launcher");
const url = require("url");

// Load configuration
let config = {
  port: 8080,
  host: "localhost",
  logLevel: "info",
  maxRequestsPerMinute: 100,
  heartbeatInterval: 30000,
  messageTimeout: 60000
};

try {
  const configPath = path.join(__dirname, "config.json");
  if (fs.existsSync(configPath)) {
    const fileConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    config = { ...config, ...fileConfig };
  }
} catch (e) {
  // Ignore missing config, use defaults
}

// Message validator
class MessageValidator {
  static validate(message) {
    if (typeof message !== 'object' || message === null) {
      throw new Error('Message must be an object');
    }

    if (!message.type || typeof message.type !== 'string') {
      throw new Error('Message must have a string type field');
    }

    // Validate message size
    const size = JSON.stringify(message).length;
    if (size > 10 * 1024 * 1024) { // 10MB
      throw new Error('Message exceeds maximum size');
    }

    // Validate specific message types
    switch (message.type) {
      case 'register':
        if (!message.clientType || !['vscode', 'browser'].includes(message.clientType)) {
          throw new Error('Invalid clientType in register message');
        }
        break;
      case 'command':
        if (!message.command || typeof message.command !== 'string') {
          throw new Error('Command message must have a command field');
        }
        break;
      case 'response':
        if (!message.id) {
          throw new Error('Response message must have an id field');
        }
        break;
    }

    return true;
  }
}

// Rate limiter for preventing spam
class RateLimiter {
  constructor(maxRequests = 100, timeWindow = 60000) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow;
    this.requests = new Map(); // clientId -> [timestamps]
  }

  check(clientId) {
    const now = Date.now();
    const clientRequests = this.requests.get(clientId) || [];

    // Remove old timestamps
    const recentRequests = clientRequests.filter(
      timestamp => now - timestamp < this.timeWindow
    );

    if (recentRequests.length >= this.maxRequests) {
      return false;
    }

    recentRequests.push(now);
    this.requests.set(clientId, recentRequests);
    return true;
  }

  reset(clientId) {
    this.requests.delete(clientId);
  }
}

class RelayServer {
  constructor(config) {
    this.config = config;
    this.clients = new Map(); // clientId -> { ws, type, metadata }
    this.vscodeClients = new Map(); // clientId -> ws
    this.browserClients = new Map(); // clientId -> ws
    this.messageQueue = new Map(); // messageId -> { message, timestamp }
    this.rateLimiter = new RateLimiter(config.maxRequestsPerMinute || 100);
    this.metrics = {
      totalMessages: 0,
      totalErrors: 0,
      totalConnections: 0,
      uptime: Date.now(),
      messagesPerSecond: 0,
      lastMessageTime: Date.now()
    };

    // Create HTTP server first
    this.server = http.createServer((req, res) => {
      this.handleHttpRequest(req, res);
    });

    this.wss = new WebSocket.Server({
      server: this.server,
      maxPayload: 10 * 1024 * 1024, // 10MB max message size
    });

    this.setupServer();
    this.startHeartbeat();
    this.startCleanup();
    this.startMetricsCalculation();
    this.setupGracefulShutdown();

    // Start HTTP server
    this.server.listen(config.port, config.host, () => {
      this.log("info", `Relay server started on ${config.host}:${config.port}`);
      this.log("info", `WebSocket: ws://${config.host}:${config.port}`);
      this.log("info", `HTTP API: http://${config.host}:${config.port}`);
    });
  }

  // HTTP endpoint handler
  handleHttpRequest(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Health check endpoint
    if (pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        uptime: Math.floor((Date.now() - this.metrics.uptime) / 1000),
        timestamp: Date.now()
      }));
      return;
    }

    // Status endpoint
    if (pathname === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'running',
        clients: {
          total: this.clients.size,
          vscode: this.vscodeClients.size,
          browser: this.browserClients.size
        },
        uptime: Math.floor((Date.now() - this.metrics.uptime) / 1000),
        timestamp: Date.now()
      }));
      return;
    }

    // Metrics endpoint
    if (pathname === '/metrics') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ...this.metrics,
        uptimeSeconds: Math.floor((Date.now() - this.metrics.uptime) / 1000),
        clients: this.getStats(),
        memoryUsage: process.memoryUsage()
      }));
      return;
    }

    // Dashboard
    if (pathname === '/') {
      const dashboardPath = path.join(__dirname, 'dashboard.html');
      if (fs.existsSync(dashboardPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        fs.createReadStream(dashboardPath).pipe(res);
        return;
      }
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  setupServer() {
    this.wss.on("connection", (ws, req) => {
      const clientId = uuidv4();
      const clientIp = req.socket.remoteAddress;

      this.metrics.totalConnections++;
      this.log(
        "info",
        `New connection from ${clientIp}, assigned ID: ${clientId}`
      );

      // Initialize client
      const client = {
        ws,
        id: clientId,
        type: null, // 'vscode' or 'browser'
        metadata: {},
        connectedAt: Date.now(),
        lastPing: Date.now(),
        isAlive: true,
      };

      this.clients.set(clientId, client);

      // Send connection acknowledgment
      this.sendToClient(ws, {
        type: "connection",
        clientId,
        timestamp: Date.now(),
        message: "Connected to relay server",
      });

      // Setup message handler
      ws.on("message", (data) => {
        this.handleMessage(clientId, data);
      });

      // Setup pong handler
      ws.on("pong", () => {
        if (this.clients.has(clientId)) {
          this.clients.get(clientId).isAlive = true;
          this.clients.get(clientId).lastPing = Date.now();
        }
      });

      // Setup close handler
      ws.on("close", () => {
        this.handleDisconnect(clientId);
      });

      // Setup error handler
      ws.on("error", (error) => {
        this.log(
          "error",
          `WebSocket error for client ${clientId}: ${error.message}`
        );
      });
    });

    this.wss.on("error", (error) => {
      this.log("error", `Server error: ${error.message}`);
      this.metrics.totalErrors++;
    });
  }

  handleMessage(clientId, data) {
    try {
      // Rate limiting check
      if (!this.rateLimiter.check(clientId)) {
        this.sendError(clientId, "RATE_LIMIT_EXCEEDED", "Too many requests");
        return;
      }

      const message = JSON.parse(data.toString());

      // Validate message
      MessageValidator.validate(message);

      const client = this.clients.get(clientId);

      if (!client) {
        this.log("warn", `Message from unknown client: ${clientId}`);
        return;
      }

      this.metrics.totalMessages++;
      this.metrics.lastMessageTime = Date.now();

      this.log(
        "debug",
        `Message from ${clientId} (${client.type}): ${message.type}`
      );

      // Validate message structure
      if (!message.type) {
        throw new Error("Message must have a type field");
      }

      // Handle different message types
      switch (message.type) {
        case "register":
          this.handleRegistration(clientId, message);
          break;

        case "command":
          this.routeCommand(clientId, message);
          break;

        case "response":
          this.routeResponse(clientId, message);
          break;

        case "event":
          this.routeEvent(clientId, message);
          break;

        case "ping":
          this.handlePing(clientId, message);
          break;

        default:
          this.log("warn", `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      this.metrics.totalErrors++;
      this.log(
        "error",
        `Error handling message from ${clientId}: ${error.message}`
      );
      this.sendError(clientId, "INVALID_MESSAGE", error.message);
    }
  }

  handleRegistration(clientId, message) {
    const client = this.clients.get(clientId);
    const clientType = message.clientType; // 'vscode' or 'browser'

    if (!["vscode", "browser"].includes(clientType)) {
      this.sendError(
        clientId,
        "INVALID_CLIENT_TYPE",
        'Client type must be "vscode" or "browser"'
      );
      return;
    }

    client.type = clientType;
    client.metadata = message.metadata || {};

    // Store in type-specific maps
    if (clientType === "vscode") {
      this.vscodeClients.set(clientId, client.ws);
    } else {
      this.browserClients.set(clientId, client.ws);
    }

    this.log("info", `Client ${clientId} registered as ${clientType}`);

    // Send registration confirmation
    this.sendToClient(client.ws, {
      type: "registered",
      clientId,
      clientType,
      timestamp: Date.now(),
      connectedClients: {
        vscode: this.vscodeClients.size,
        browser: this.browserClients.size,
      },
    });

    // Notify other clients
    this.broadcastStatus();
  }

  routeCommand(fromClientId, message) {
    // Commands go from VS Code to Browser
    const fromClient = this.clients.get(fromClientId);

    if (fromClient.type !== "vscode") {
      this.sendError(
        fromClientId,
        "INVALID_SENDER",
        "Only VS Code can send commands"
      );
      return;
    }

    // Add routing metadata
    message.from = fromClientId;
    message.routedAt = Date.now();

    // Store in queue for tracking
    if (message.id) {
      this.messageQueue.set(message.id, {
        message,
        timestamp: Date.now(),
        from: fromClientId,
      });
    }

    // Route to all browser clients (or specific one if targetId specified)
    const targetId = message.targetId;
    let routedCount = 0;

    if (targetId && this.browserClients.has(targetId)) {
      this.sendToClient(this.browserClients.get(targetId), message);
      routedCount = 1;
    } else {
      // Broadcast to all browser clients
      this.browserClients.forEach((ws, clientId) => {
        this.sendToClient(ws, message);
        routedCount++;
      });
    }

    if (routedCount === 0) {
      this.sendError(
        fromClientId,
        "NO_BROWSER_CONNECTED",
        "No browser clients connected"
      );
    }

    this.log(
      "debug",
      `Routed command ${message.command} to ${routedCount} browser client(s)`
    );
  }

  routeResponse(fromClientId, message) {
    // Responses go from Browser to VS Code
    const fromClient = this.clients.get(fromClientId);

    if (fromClient.type !== "browser") {
      this.sendError(
        fromClientId,
        "INVALID_SENDER",
        "Only browser can send responses"
      );
      return;
    }

    // Add routing metadata
    message.from = fromClientId;
    message.routedAt = Date.now();

    // Remove from message queue
    if (message.id) {
      this.messageQueue.delete(message.id);
    }

    // Route to all VS Code clients (or specific one if the message has a target)
    const originalMessage = message.id
      ? this.messageQueue.get(message.id)
      : null;
    const targetId = originalMessage ? originalMessage.from : null;

    let routedCount = 0;

    if (targetId && this.vscodeClients.has(targetId)) {
      this.sendToClient(this.vscodeClients.get(targetId), message);
      routedCount = 1;
    } else {
      // Broadcast to all VS Code clients
      this.vscodeClients.forEach((ws) => {
        this.sendToClient(ws, message);
        routedCount++;
      });
    }

    this.log("debug", `Routed response to ${routedCount} VS Code client(s)`);
  }

  routeEvent(fromClientId, message) {
    // Events go from Browser to VS Code
    const fromClient = this.clients.get(fromClientId);

    if (fromClient.type !== "browser") {
      return;
    }

    message.from = fromClientId;
    message.routedAt = Date.now();

    // Broadcast events to all VS Code clients
    this.vscodeClients.forEach((ws) => {
      this.sendToClient(ws, message);
    });
  }

  handlePing(clientId, message) {
    const client = this.clients.get(clientId);
    client.lastPing = Date.now();

    this.sendToClient(client.ws, {
      type: "pong",
      timestamp: Date.now(),
      originalTimestamp: message.timestamp,
    });
  }

  handleDisconnect(clientId) {
    const client = this.clients.get(clientId);

    if (!client) return;

    this.log("info", `Client ${clientId} (${client.type}) disconnected`);

    // Remove from maps
    this.clients.delete(clientId);

    if (client.type === "vscode") {
      this.vscodeClients.delete(clientId);
    } else if (client.type === "browser") {
      this.browserClients.delete(clientId);
    }

    // Notify other clients
    this.broadcastStatus();
  }

  startHeartbeat() {
    setInterval(() => {
      this.clients.forEach((client, clientId) => {
        if (!client.isAlive) {
          this.log("warn", `Client ${clientId} failed heartbeat, terminating`);
          client.ws.terminate();
          this.handleDisconnect(clientId);
          return;
        }

        client.isAlive = false;
        client.ws.ping();
      });
    }, this.config.heartbeatInterval);
  }

  startCleanup() {
    // Clean up old messages from queue
    setInterval(() => {
      const now = Date.now();
      const timeout = this.config.messageTimeout;

      this.messageQueue.forEach((item, messageId) => {
        if (now - item.timestamp > timeout) {
          this.log("debug", `Cleaning up timed-out message: ${messageId}`);
          this.messageQueue.delete(messageId);
        }
      });
    }, 60000); // Every minute
  }

  setupGracefulShutdown() {
    const shutdown = () => {
      console.log("\n🛑 Shutting down relay server gracefully...");

      // Notify all clients
      this.clients.forEach((client) => {
        this.sendToClient(client.ws, {
          type: "server_shutdown",
          message: "Server is shutting down",
          timestamp: Date.now()
        });
      });

      // Close all connections
      this.wss.close(() => {
        console.log("✅ All connections closed");
        process.exit(0);
      });

      // Force shutdown after 5 seconds
      setTimeout(() => {
        console.log("⚠️  Forcing shutdown");
        process.exit(1);
      }, 5000);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  }

  broadcastStatus() {
    const status = {
      type: "status",
      timestamp: Date.now(),
      clients: {
        vscode: this.vscodeClients.size,
        browser: this.browserClients.size,
        total: this.clients.size,
      },
    };

    this.clients.forEach((client) => {
      this.sendToClient(client.ws, status);
    });
  }

  sendToClient(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  sendError(clientId, code, message) {
    const client = this.clients.get(clientId);
    if (client) {
      this.sendToClient(client.ws, {
        type: "error",
        error: {
          code,
          message,
          timestamp: Date.now(),
        },
      });
    }
  }

  log(level, message) {
    const levels = ["error", "warn", "info", "debug"];
    const configLevel = levels.indexOf(this.config.logLevel);
    const messageLevel = levels.indexOf(level);

    if (messageLevel <= configLevel) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
    }
  }

  getStats() {
    return {
      totalClients: this.clients.size,
      vscodeClients: this.vscodeClients.size,
      browserClients: this.browserClients.size,
      queuedMessages: this.messageQueue.size,
      uptime: process.uptime(),
    };
  }

  getMetrics() {
    return {
      ...this.metrics,
      uptimeSeconds: Math.floor((Date.now() - this.metrics.uptime) / 1000),
      clients: this.getStats()
    };
  }

  // Calculate messages per second
  startMetricsCalculation() {
    let lastMessageCount = 0;

    setInterval(() => {
      const currentCount = this.metrics.totalMessages;
      this.metrics.messagesPerSecond = currentCount - lastMessageCount;
      lastMessageCount = currentCount;
    }, 1000);
  }
}

// Export Start Function
function startServer(options = {}) {
  // Merge options with config
  const finalConfig = { ...config, ...options };

  const server = new RelayServer(finalConfig);

  if (options.launchBrowser) {
    console.log('🚀 Auto-launching browser...');
    setTimeout(async () => {
      try {
        const { PlatformLauncher } = require("./launcher");
        await PlatformLauncher.launch({ platform: options.platform });
      } catch (error) {
        console.error('❌ Failed to launch browser:', error.message);
      }
    }, 1000);
  }

  return server;
}

// Auto-start if run directly
if (require.main === module) {
  const isLaunchBrowser = process.argv.includes('--launch-browser');
  let platform = null;
  const platformArg = process.argv.find(arg => arg.startsWith('--platform='));
  if (platformArg) {
    platform = platformArg.split('=')[1];
  }

  const server = startServer({
    launchBrowser: isLaunchBrowser,
    platform: platform
  });

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\nShutting down relay server...");
    server.wss.close(() => {
      console.log("Relay server stopped");
      process.exit(0);
    });
  });
}

module.exports = { RelayServer, startServer };
