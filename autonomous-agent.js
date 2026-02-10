#!/usr/bin/env node

// TRULY AUTONOMOUS COPILOT AGENT WITH SMART CACHING
// Caches everything EXCEPT screenshots for fast access

const { CopilotAgent } = require("./smart-agent");
const { ExtensionDetector } = require("./extension-detector");
const { PlatformLauncher } = require("./platform-launcher");
const fs = require("fs");
const path = require("path");

// Smart Cache Manager
class CacheManager {
  constructor(cacheDir) {
    this.cacheDir = cacheDir;
    this.cachePath = path.join(cacheDir, "cache.json");
    this.cache = this.loadCache();
  }

  loadCache() {
    try {
      if (fs.existsSync(this.cachePath)) {
        const data = fs.readFileSync(this.cachePath, "utf8");
        return JSON.parse(data);
      }
    } catch (error) {
      console.log("   ⚠️  Failed to load cache, starting fresh");
    }
    return {
      pages: {},
      dom: {},
      console: {},
      extracted: {},
      performance: {},
      metadata: {
        lastUpdate: Date.now(),
        totalPages: 0,
        totalExtractions: 0,
      },
    };
  }

  saveCache() {
    try {
      fs.writeFileSync(this.cachePath, JSON.stringify(this.cache, null, 2));
      return true;
    } catch (error) {
      console.error("   ❌ Failed to save cache:", error.message);
      return false;
    }
  }

  // Cache page data
  cachePage(url, data) {
    this.cache.pages[url] = {
      ...data,
      timestamp: Date.now(),
    };
    this.cache.metadata.totalPages = Object.keys(this.cache.pages).length;
    this.cache.metadata.lastUpdate = Date.now();
    this.saveCache();
  }

  // Cache DOM content
  cacheDOM(url, domData) {
    this.cache.dom[url] = {
      text: domData.text,
      elementCount: domData.elementCount,
      timestamp: Date.now(),
    };
    this.saveCache();
  }

  // Cache console logs
  cacheConsole(url, logs) {
    this.cache.console[url] = {
      logs: logs.map((log) => ({
        level: log.level,
        message: log.message,
        timestamp: log.timestamp,
      })),
      errorCount: logs.filter((l) => l.level === "error").length,
      warnCount: logs.filter((l) => l.level === "warn").length,
      timestamp: Date.now(),
    };
    this.saveCache();
  }

  // Cache extracted data
  cacheExtracted(url, name, data) {
    if (!this.cache.extracted[url]) {
      this.cache.extracted[url] = {};
    }
    this.cache.extracted[url][name] = {
      data,
      timestamp: Date.now(),
    };
    this.cache.metadata.totalExtractions++;
    this.saveCache();
  }

  // Cache performance metrics
  cachePerformance(url, metrics) {
    this.cache.performance[url] = {
      ...metrics,
      timestamp: Date.now(),
    };
    this.saveCache();
  }

  // Get cached data for URL
  getCached(url) {
    return {
      page: this.cache.pages[url],
      dom: this.cache.dom[url],
      console: this.cache.console[url],
      extracted: this.cache.extracted[url],
      performance: this.cache.performance[url],
    };
  }

  // Check if we have recent data (< 5 minutes old)
  hasRecentData(url, maxAge = 5 * 60 * 1000) {
    const cached = this.getCached(url);
    if (!cached.page) return false;
    return Date.now() - cached.page.timestamp < maxAge;
  }

  // Get cache statistics
  getStats() {
    return {
      pages: Object.keys(this.cache.pages).length,
      domEntries: Object.keys(this.cache.dom).length,
      consoleEntries: Object.keys(this.cache.console).length,
      extractedSites: Object.keys(this.cache.extracted).length,
      performanceEntries: Object.keys(this.cache.performance).length,
      lastUpdate: this.cache.metadata.lastUpdate,
      totalExtractions: this.cache.metadata.totalExtractions,
    };
  }

  // Clear old cache entries (older than 1 hour)
  clearOld(maxAge = 60 * 60 * 1000) {
    const now = Date.now();
    let cleared = 0;

    ["pages", "dom", "console", "extracted", "performance"].forEach((key) => {
      Object.keys(this.cache[key]).forEach((url) => {
        const data = this.cache[key][url];
        if (data.timestamp && now - data.timestamp > maxAge) {
          delete this.cache[key][url];
          cleared++;
        }
      });
    });

    if (cleared > 0) {
      console.log(`   🧹 Cleared ${cleared} old cache entries`);
      this.saveCache();
    }

    return cleared;
  }
}

class AutonomousAgent extends CopilotAgent {
  constructor(options = {}) {
    super();
    this.serverUrl = options.serverUrl || 'http://localhost:3000';
    this.ws = null;
    this.connected = false;
    this.clientId = null;
    this.messageHandlers = new Map();
    this.pendingRequests = new Map();
    this.taskHistory = [];
    this.memory = new Map();

    // Enhanced configuration
    this.config = {
      requestTimeout: options.requestTimeout || 30000,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      reconnectInterval: options.reconnectInterval || 5000,
      maxReconnectAttempts: options.maxReconnectAttempts || 5,
      heartbeatInterval: options.heartbeatInterval || 30000,
      ...options
    };

    this.reconnectAttempts = 0;
    this.isReconnecting = false;
    this.heartbeatTimer = null;

    this.memory = {
      currentUrl: null,
      lastPageData: null,
      consoleLogs: [],
      errors: [],
      decisions: [],
      tasks: [],
    };

    // Initialize cache
    const cacheDir = path.join(__dirname, "agent-data");
    this.cache = new CacheManager(cacheDir);

    // Initialize extension detector
    this.detector = new ExtensionDetector();
    this.extensionInfo = null;

    // Platform Launcher Instance
    this.launcherInstance = null;

    console.log("💾 Cache initialized");
  }

  // Enhanced connection with retry logic
  async connect(retryCount = 0) {
    try {
      // Check if server is reachable first
      await this.checkServerHealth();

      return new Promise((resolve, reject) => {
        const wsUrl = this.serverUrl.replace('http', 'ws');
        this.ws = new WebSocket(wsUrl);

        const timeout = setTimeout(() => {
          if (!this.connected) {
            this.ws.close();
            reject(new Error('Connection timeout'));
          }
        }, 10000);

        this.ws.on('open', () => {
          clearTimeout(timeout);
          console.log('✅ Connected to relay server');
          this.setupMessageHandlers();
          this.startHeartbeat();
          this.reconnectAttempts = 0;
          this.isReconnecting = false;
        });

        this.ws.on('message', (data) => {
          try {
            const message = JSON.parse(data);
            this.handleMessage(message);
          } catch (error) {
            console.error('❌ Failed to parse message:', error.message);
          }
        });

        this.ws.on('close', () => {
          this.handleDisconnection();
        });

        this.ws.on('error', (error) => {
          console.error('❌ WebSocket error:', error.message);
          if (!this.connected) {
            clearTimeout(timeout);
            reject(error);
          }
        });
      });
    } catch (error) {
      if (retryCount < this.config.maxRetries) {
        const delay = this.config.retryDelay * Math.pow(2, retryCount);
        console.log(`⏳ Retrying connection in ${delay}ms... (${retryCount + 1}/${this.config.maxRetries})`);
        await this.sleep(delay);
        return this.connect(retryCount + 1);
      }
      throw new Error(`Failed to connect after ${this.config.maxRetries} attempts: ${error.message}`);
    }
  }

  // Check server health before connecting
  async checkServerHealth() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.serverUrl}/health`, {
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Server unhealthy: ${response.status}`);
      }
      return true;
    } catch (error) {
      throw new Error(`Server not reachable: ${error.message}`);
    }
  }

  // Auto-reconnection
  async handleDisconnection() {
    console.log('⚠️  Disconnected from relay server');
    this.connected = false;
    this.stopHeartbeat();

    if (!this.isReconnecting && this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.isReconnecting = true;
      this.reconnectAttempts++;

      console.log(`🔄 Attempting to reconnect... (${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`);

      await this.sleep(this.config.reconnectInterval);

      try {
        await this.connect();
      } catch (error) {
        console.error('❌ Reconnection failed:', error.message);
        this.handleDisconnection();
      }
    } else if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached. Please restart manually.');
    }
  }

  // Heartbeat to keep connection alive
  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.connected && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'ping',
          timestamp: Date.now()
        }));
      }
    }, this.config.heartbeatInterval);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // Auto-detect and connect to extension
  async connect() {
    console.log("\n🔍 Starting Browser Copilot Agent...\n");

    // Parse CLI args for platform
    const args = process.argv.slice(2);
    let platform = null;
    args.forEach(arg => {
      if (arg.startsWith('--platform=')) {
        platform = arg.split('=')[1];
      }
    });

    try {
      // Try to launch isolated browser first
      console.log("🚀 Attempting to launch isolated browser...");
      this.launcherInstance = await PlatformLauncher.launch({ platform });

      // Wait for extension to come online and register
      console.log("⏳ Waiting for browser to connect...");
      await new Promise(resolve => setTimeout(resolve, 3000));

    } catch (error) {
      console.log(`⚠️  Could not launch isolated browser: ${error.message}`);
      console.log("   Falling back to manual extension detection...");

      // Fallback to manual detection
      const detection = await this.detector.detect();
      if (!detection.available) {
        throw new Error("Extension not available. Please install manually.");
      }
    }

    let isServerRunning = false;
    try {
      await this.checkServerHealth();
      isServerRunning = true;
    } catch (e) {
      isServerRunning = false;
    }

    if (!isServerRunning) {
      console.log("⚠️  Relay server not running. Starting it...\n");
      // ... (existing server start logic)
      // Try to start relay server
      const { spawn } = require("child_process");
      const serverProcess = spawn("node", ["index.js"], {
        cwd: path.join(__dirname, "relay-server"),
        detached: true,
        stdio: "ignore",
      });

      serverProcess.unref();

      console.log("⏳ Waiting for server to start...");

      // Wait for server to be ready
      for (let i = 0; i < 10; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        try {
          if (await this.checkServerHealth()) {
            console.log("✅ Server started!\n");
            break;
          }
        } catch (e) { }
      }
    }

    // Connect to extension
    return await super.connect();
  }

  // Navigate with caching
  async navigate(url) {
    console.log(`\n🌐 Opening: ${url}`);

    // Check cache first
    if (this.cache.hasRecentData(url)) {
      console.log(`   💾 Using cached data (fresh)`);
      const cached = this.cache.getCached(url);
      this.memory.currentUrl = url;
      this.memory.lastPageData = cached.dom;
      this.memory.consoleLogs = cached.console?.logs || [];
      return { success: true, cached: true };
    }

    const result = await this.execute("navigate", { url });

    if (result.success) {
      this.memory.currentUrl = url;

      // Cache page data (NOT screenshots!)
      this.cache.cachePage(url, {
        url: result.data.url,
        title: result.data.title,
        status: result.data.status,
      });

      this.sessionData.pages[url] = {
        url: result.data.url,
        title: result.data.title,
        visitedAt: Date.now(),
      };
      console.log(`   ✓ ${result.data.title}`);
      console.log(`   💾 Cached page data`);
    }

    return result;
  }

  // Read and cache DOM data
  async readDOM(selector = "body") {
    console.log(`\n🔍 Reading DOM: ${selector}`);

    const url = this.memory.currentUrl;

    // Check cache
    const cached = this.cache.getCached(url);
    if (cached.dom && Date.now() - cached.dom.timestamp < 60000) {
      console.log(
        `   💾 Using cached DOM (${cached.dom.elementCount} elements)`
      );
      this.memory.lastPageData = cached.dom;
      return cached.dom;
    }

    const result = await this.execute("get_dom", { selector });

    if (result.success) {
      const domData = {
        text: result.data.text,
        html: result.data.html,
        elementCount: result.data.html.match(/<[^>]+>/g)?.length || 0,
        timestamp: Date.now(),
      };

      this.memory.lastPageData = domData;

      // Cache DOM data (text content, not full HTML to save space)
      this.cache.cacheDOM(url, domData);

      console.log(`   ✓ Found ${domData.elementCount} elements`);
      console.log(`   ✓ Text length: ${domData.text.length} chars`);
      console.log(`   💾 Cached DOM data`);

      return domData;
    }
    return null;
  }

  // Read and cache console logs
  async readConsoleLogs() {
    console.log(`\n📋 Reading console logs...`);

    const url = this.memory.currentUrl;

    // Check cache
    const cached = this.cache.getCached(url);
    if (cached.console && Date.now() - cached.console.timestamp < 30000) {
      console.log(
        `   💾 Using cached console (${cached.console.logs.length} logs)`
      );
      this.memory.consoleLogs = cached.console.logs;
      return {
        logs: cached.console.logs,
        errors: cached.console.logs.filter((l) => l.level === "error"),
      };
    }

    const logs = await this.getConsole();

    this.memory.consoleLogs = logs;

    // Analyze for errors
    const errors = logs.filter(
      (log) => log.level === "error" || log.level === "warn"
    );
    this.memory.errors = errors;

    // Cache console logs
    this.cache.cacheConsole(url, logs);

    console.log(`   ✓ Total logs: ${logs.length}`);
    console.log(`   ✓ Errors/Warnings: ${errors.length}`);
    console.log(`   💾 Cached console data`);

    if (errors.length > 0) {
      console.log(`   ⚠️  Found issues:`);
      errors.forEach((err) => {
        console.log(
          `      [${err.level.toUpperCase()}] ${err.message.substring(0, 80)}`
        );
      });
    }

    return { logs, errors };
  }

  // Extract and cache page data
  async extractAndRead(name, script) {
    console.log(`\n📊 Extracting: ${name}`);

    const url = this.memory.currentUrl;

    // Check cache
    const cached = this.cache.getCached(url);
    if (
      cached.extracted &&
      cached.extracted[name] &&
      Date.now() - cached.extracted[name].timestamp < 120000
    ) {
      console.log(`   💾 Using cached extraction`);
      this.memory[name] = cached.extracted[name].data;
      console.log(`\n📖 Cached data:`);
      console.log(JSON.stringify(cached.extracted[name].data, null, 2));
      return cached.extracted[name].data;
    }

    const data = await this.extract(name, script);

    // IMPORTANT: Actually read and store the data!
    const extracted = this.sessionData.extractedData[name];

    if (extracted) {
      console.log(`\n📖 Reading extracted data:`);
      console.log(JSON.stringify(extracted.result, null, 2));

      // Store in memory for decision making
      this.memory[name] = extracted.result;

      // Cache extracted data
      this.cache.cacheExtracted(url, name, extracted.result);
      console.log(`   💾 Cached extraction: ${name}`);
    }

    return data;
  }

  // Get performance and cache it
  async getPerformance() {
    console.log(`\n⚡ Reading performance metrics...`);

    const url = this.memory.currentUrl;

    const result = await this.execute("get_performance");

    if (result.success) {
      const metrics = result.data;

      // Cache performance data
      this.cache.cachePerformance(url, metrics);

      console.log(`   ✓ Load time: ${metrics.loadTime}ms`);
      console.log(`   💾 Cached performance data`);

      return metrics;
    }

    return null;
  }

  // Make intelligent decisions based on collected data
  async analyze() {
    console.log(`\n🧠 ANALYZING COLLECTED DATA...\n`);

    const analysis = {
      timestamp: Date.now(),
      findings: [],
      recommendations: [],
    };

    // Analyze page data
    if (this.memory.lastPageData) {
      const { text, elementCount } = this.memory.lastPageData;

      if (elementCount < 10) {
        analysis.findings.push(
          "⚠️  Very few elements on page - might be loading issue"
        );
        analysis.recommendations.push("Wait longer or check network");
      }

      if (text.length < 100) {
        analysis.findings.push("⚠️  Very little text content - empty page?");
      } else {
        analysis.findings.push(`✅ Page has ${text.length} chars of content`);
      }
    }

    // Analyze console logs
    if (this.memory.errors.length > 0) {
      analysis.findings.push(
        `⚠️  Found ${this.memory.errors.length} errors in console`
      );
      analysis.recommendations.push(
        "Investigate console errors before proceeding"
      );
    } else if (this.memory.consoleLogs.length > 0) {
      analysis.findings.push(
        `✅ No console errors (${this.memory.consoleLogs.length} logs total)`
      );
    }

    // Analyze extracted data
    if (this.memory["page-content"]) {
      const content = this.memory["page-content"];

      if (content.headings) {
        analysis.findings.push(`✅ Found ${content.headings.length} headings`);
      }

      if (content.links) {
        analysis.findings.push(`✅ Found ${content.links.length} links`);

        // Check for broken links (empty href)
        const brokenLinks = content.links.filter(
          (l) => !l.href || l.href === "#"
        );
        if (brokenLinks.length > 0) {
          analysis.findings.push(
            `⚠️  Found ${brokenLinks.length} potentially broken links`
          );
        }
      }

      if (content.images) {
        analysis.findings.push(`✅ Found ${content.images.length} images`);
      }
    }

    // Print analysis
    console.log(`📊 FINDINGS:`);
    analysis.findings.forEach((f) => console.log(`   ${f}`));

    if (analysis.recommendations.length > 0) {
      console.log(`\n💡 RECOMMENDATIONS:`);
      analysis.recommendations.forEach((r) => console.log(`   ${r}`));
    }

    // Store decision
    this.memory.decisions.push(analysis);

    return analysis;
  }

  // Make decision: should I click a link?
  async decideNextAction() {
    console.log(`\n🤔 DECIDING NEXT ACTION...\n`);

    const content = this.memory["page-content"];

    if (!content || !content.links || content.links.length === 0) {
      console.log(`   ⛔ No links found - cannot proceed`);
      return null;
    }

    // Find interesting links (not empty, not just #)
    const validLinks = content.links.filter(
      (l) =>
        l.href &&
        l.href !== "#" &&
        !l.href.startsWith("javascript:") &&
        l.text.length > 0
    );

    if (validLinks.length === 0) {
      console.log(`   ⛔ No valid links to click`);
      return null;
    }

    // Choose first valid link
    const chosen = validLinks[0];
    console.log(`   ✅ DECISION: Click link "${chosen.text}"`);
    console.log(`   🔗 URL: ${chosen.href}`);

    return chosen;
  }

  // Execute autonomous task with caching
  async executeTask(url, taskName) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`🤖 AUTONOMOUS TASK: ${taskName}`);
    console.log(`${"=".repeat(60)}\n`);

    // Clean old cache before starting
    this.cache.clearOld();

    const task = {
      name: taskName,
      url,
      startTime: Date.now(),
      steps: [],
      cached: false,
    };

    // STEP 1: Navigate (check cache first)
    task.steps.push("Navigate to URL");
    const navResult = await this.navigate(url);
    task.cached = navResult.cached || false;

    if (!task.cached) {
      await this.screenshot(`${taskName}-initial`);
    } else {
      console.log(`   ⚡ Skipped screenshot (using cache)`);
    }

    // STEP 2: Read the page (cached if recent)
    task.steps.push("Read DOM content");
    const domData = await this.readDOM();

    // STEP 3: Check console (cached if recent)
    task.steps.push("Check console logs");
    const { errors } = await this.readConsoleLogs();

    // STEP 4: Get performance (cached)
    task.steps.push("Get performance metrics");
    await this.getPerformance();

    // STEP 5: Extract structured data (cached if recent)
    task.steps.push("Extract page data");
    await this.extractAndRead(
      "page-content",
      `
      ({
        title: document.title,
        headings: Array.from(document.querySelectorAll('h1,h2,h3')).map(h => h.textContent.trim()),
        links: Array.from(document.querySelectorAll('a')).map(a => ({
          text: a.textContent.trim(),
          href: a.href
        })),
        paragraphs: Array.from(document.querySelectorAll('p')).map(p => p.textContent.trim()),
        images: Array.from(document.querySelectorAll('img')).map(img => img.src),
        forms: Array.from(document.querySelectorAll('form')).length,
        buttons: Array.from(document.querySelectorAll('button')).length
      })
    `
    );

    // STEP 6: Analyze everything
    task.steps.push("Analyze collected data");
    const analysis = await this.analyze();

    // STEP 7: Make decision
    task.steps.push("Decide next action");
    const nextAction = await this.decideNextAction();

    // STEP 8: Execute decision
    if (nextAction && !task.cached) {
      task.steps.push(`Click link: ${nextAction.text}`);
      await this.click("a");
      await this.screenshot(`${taskName}-after-click`);

      // Read new page
      await this.readDOM();
      await this.readConsoleLogs();
    }

    task.endTime = Date.now();
    task.duration = task.endTime - task.startTime;
    task.analysis = analysis;

    this.memory.tasks.push(task);

    // Save session (lightweight, no screenshots)
    const sessionPath = this.saveSession(taskName);

    // Save memory separately
    const memoryPath = path.join(
      __dirname,
      "agent-data",
      `memory-${Date.now()}.json`
    );
    fs.writeFileSync(memoryPath, JSON.stringify(this.memory, null, 2));

    // Show cache stats
    const stats = this.cache.getStats();

    console.log(`\n${"=".repeat(60)}`);
    console.log(`✅ TASK COMPLETE: ${taskName}`);
    console.log(`⏱️  Duration: ${task.duration}ms`);
    console.log(`📝 Steps executed: ${task.steps.length}`);
    console.log(`💾 Session: ${sessionPath}`);
    console.log(`🧠 Memory: ${memoryPath}`);
    console.log(`\n📊 CACHE STATS:`);
    console.log(`   Pages cached: ${stats.pages}`);
    console.log(`   DOM entries: ${stats.domEntries}`);
    console.log(`   Console entries: ${stats.consoleEntries}`);
    console.log(`   Extracted data: ${stats.extractedSites}`);
    console.log(`   Performance entries: ${stats.performanceEntries}`);
    console.log(`   Total extractions: ${stats.totalExtractions}`);
    console.log(`${"=".repeat(60)}\n`);

    return task;
  }

  // Get summary of what I learned
  getSummary() {
    return {
      totalCommands: this.sessionData.commands.length,
      pagesVisited: Object.keys(this.sessionData.pages).length,
      screenshotsTaken: this.sessionData.screenshots.length,
      consoleLogs: this.memory.consoleLogs.length,
      errors: this.memory.errors.length,
      decisions: this.memory.decisions.length,
      extractedData: Object.keys(this.sessionData.extractedData).length,
      memory: this.memory,
    };
  }

  // Execute user code and handle errors autonomously
  async executeUserCode(code, maxRetries = 3) {
    console.log(`\n💻 EXECUTING USER CODE...\n`);
    console.log(`Code:\n${code}\n`);

    let attempt = 0;
    let lastError = null;

    while (attempt < maxRetries) {
      attempt++;
      console.log(`\n🔄 Attempt ${attempt}/${maxRetries}`);

      try {
        // Execute the code
        const result = await this.execute("execute_js", { code });

        if (result.success && !result.data?.error) {
          console.log(`\n✅ SUCCESS!`);
          console.log(`Result:`, JSON.stringify(result.data, null, 2));

          // Cache successful execution
          this.cache.cacheExtracted(
            this.memory.currentUrl,
            "user-code-result",
            {
              code,
              result: result.data,
              success: true,
            }
          );

          return { success: true, result: result.data, attempts: attempt };
        }

        // Code executed but returned an error
        lastError = result.data?.error || result.error;
        console.log(`\n❌ ERROR DETECTED:`);
        console.log(JSON.stringify(lastError, null, 2));
      } catch (error) {
        lastError = { message: error.message, stack: error.stack };
        console.log(`\n❌ EXCEPTION:`, error.message);
      }

      // Read console logs to find more clues
      console.log(`\n📋 Checking console for clues...`);
      const { logs, errors } = await this.readConsoleLogs();

      if (errors.length > 0) {
        console.log(`\n🔍 Found ${errors.length} console errors:`);
        errors.forEach((err) => {
          console.log(`   [${err.level}] ${err.message}`);
        });
      }

      // Analyze the error and search for solution
      if (attempt < maxRetries) {
        const solution = await this.findSolution(lastError, errors);

        if (solution.foundSolution) {
          console.log(`\n💡 SOLUTION FOUND: ${solution.description}`);

          if (solution.fixedCode) {
            console.log(`\n🔧 Applying fix...`);
            code = solution.fixedCode;
            continue; // Retry with fixed code
          }

          if (solution.action) {
            console.log(`\n🔧 Performing action: ${solution.action}`);
            await this.performAction(solution.action, solution.params);
            continue; // Retry
          }
        } else {
          console.log(`\n🤔 No automatic solution found, searching Google...`);
          const googleSolution = await this.searchGoogleForSolution(lastError);

          if (googleSolution) {
            console.log(`\n💡 Found solution on Google!`);
            code = googleSolution.fixedCode || code;
            continue;
          }
        }
      }
    }

    console.log(`\n❌ FAILED after ${maxRetries} attempts`);
    return {
      success: false,
      error: lastError,
      attempts: maxRetries,
    };
  }

  // Analyze error and find solution from my knowledge
  async findSolution(error, consoleErrors) {
    console.log(`\n🧠 ANALYZING ERROR...`);

    const errorMessage = error?.message || JSON.stringify(error);
    const errorStack = error?.stack || "";

    // Common error patterns and solutions
    const knownSolutions = [
      {
        pattern: /Content Security Policy|CSP|unsafe-eval/i,
        description: "CSP violation - need to inject script instead of eval",
        fixStrategy: "wrap_in_function",
        fixedCode: (code) => {
          return `(function() { ${code} })()`;
        },
      },
      {
        pattern:
          /Cannot read property.*of undefined|undefined is not an object/i,
        description: "Accessing undefined property - add null checks",
        fixStrategy: "add_null_checks",
        fixedCode: (code) => {
          // Add optional chaining
          return code.replace(/(\w+)\.(\w+)/g, "$1?.$2");
        },
      },
      {
        pattern: /element not found|querySelector.*null/i,
        description: "Element not found - need to wait for DOM",
        action: "wait",
        params: { time: 2000 },
      },
      {
        pattern: /fetch.*failed|network error/i,
        description: "Network error - need to check connection",
        action: "reload",
      },
      {
        pattern: /timeout|timed out/i,
        description: "Operation timed out - increase wait time",
        action: "wait",
        params: { time: 5000 },
      },
    ];

    // Check if error matches known patterns
    for (const solution of knownSolutions) {
      if (
        solution.pattern.test(errorMessage) ||
        solution.pattern.test(errorStack)
      ) {
        console.log(`   ✓ Matched pattern: ${solution.pattern}`);

        if (solution.fixedCode) {
          return {
            foundSolution: true,
            description: solution.description,
            fixedCode: solution.fixedCode(error.code || ""),
          };
        }

        if (solution.action) {
          return {
            foundSolution: true,
            description: solution.description,
            action: solution.action,
            params: solution.params,
          };
        }
      }
    }

    return { foundSolution: false };
  }

  // Search Google for solution
  async searchGoogleForSolution(error) {
    console.log(`\n🔍 Searching Google for solution...`);

    const errorMessage = error?.message || JSON.stringify(error);
    const searchQuery = `javascript ${errorMessage.substring(0, 100)}`;

    try {
      // Navigate to Google
      await this.navigate(
        `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`
      );
      await this.screenshot("google-search");

      // Extract search results
      await this.extractAndRead(
        "search-results",
        `
        Array.from(document.querySelectorAll('h3')).slice(0, 5).map(h3 => {
          const link = h3.closest('a');
          return {
            title: h3.textContent,
            url: link ? link.href : null,
            snippet: h3.closest('div')?.textContent || ''
          };
        })
      `
      );

      const results = this.memory["search-results"];

      if (results && results.length > 0) {
        console.log(`\n📖 Found ${results.length} results:`);
        results.forEach((r, i) => {
          console.log(`   ${i + 1}. ${r.title}`);
        });

        // Visit first StackOverflow or MDN result
        const goodResult = results.find(
          (r) =>
            r.url &&
            (r.url.includes("stackoverflow.com") ||
              r.url.includes("developer.mozilla.org"))
        );

        if (goodResult) {
          console.log(`\n📖 Opening: ${goodResult.title}`);
          await this.navigate(goodResult.url);
          await this.screenshot("solution-page");

          // Extract code snippets from the page
          await this.extractAndRead(
            "code-snippets",
            `
            Array.from(document.querySelectorAll('code, pre')).map(el => el.textContent.trim())
          `
          );

          const snippets = this.memory["code-snippets"];

          if (snippets && snippets.length > 0) {
            console.log(`\n💡 Found ${snippets.length} code snippets!`);

            // Return first relevant snippet as potential fix
            return {
              foundSolution: true,
              source: goodResult.url,
              fixedCode: snippets[0],
            };
          }
        }
      }
    } catch (error) {
      console.log(`   ❌ Google search failed:`, error.message);
    }

    return null;
  }

  // Perform corrective action
  async performAction(action, params = {}) {
    console.log(`\n🔧 Performing action: ${action}`);

    switch (action) {
      case "wait":
        console.log(`   ⏳ Waiting ${params.time}ms...`);
        await new Promise((resolve) => setTimeout(resolve, params.time));
        break;

      case "reload":
        console.log(`   🔄 Reloading page...`);
        await this.execute("reload");
        await new Promise((resolve) => setTimeout(resolve, 2000));
        break;

      case "scroll":
        console.log(`   📜 Scrolling...`);
        await this.execute("scroll", { y: params.y || 500 });
        break;

      default:
        console.log(`   ⚠️  Unknown action: ${action}`);
    }
  }

  // Run autonomous task with self-healing
  async runTask(description, code, url = null) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`🤖 AUTONOMOUS TASK: ${description}`);
    console.log(`${"=".repeat(60)}\n`);

    const task = {
      description,
      code,
      url,
      startTime: Date.now(),
      steps: [],
    };

    try {
      // Step 1: Navigate if URL provided
      if (url) {
        task.steps.push(`Navigate to ${url}`);
        await this.navigate(url);
        await this.screenshot("task-start");
      }

      // Step 2: Execute user code with self-healing
      task.steps.push("Execute code with auto-retry");
      const result = await this.executeUserCode(code);

      task.result = result;
      task.success = result.success;

      // Step 3: Analyze results
      task.steps.push("Analyze results");
      const analysis = await this.analyze();
      task.analysis = analysis;
    } catch (error) {
      task.success = false;
      task.error = error.message;
      console.log(`\n❌ Task failed:`, error.message);
    }

    task.endTime = Date.now();
    task.duration = task.endTime - task.startTime;

    // Save task results
    const taskPath = path.join(
      __dirname,
      "agent-data",
      `task-${Date.now()}.json`
    );
    fs.writeFileSync(taskPath, JSON.stringify(task, null, 2));

    console.log(`\n${"=".repeat(60)}`);
    console.log(
      `${task.success ? "✅" : "❌"} TASK ${task.success ? "COMPLETE" : "FAILED"
      }: ${description}`
    );
    console.log(`⏱️  Duration: ${task.duration}ms`);
    console.log(`📝 Steps: ${task.steps.length}`);
    console.log(`💾 Saved: ${taskPath}`);
    console.log(`${"=".repeat(60)}\n`);

    return task;
  }

  // Enhanced sendCommand with retries and timeout
  async sendCommand(command, params = {}, retryCount = 0) {
    if (!this.connected) {
      throw new Error('Not connected to relay server');
    }

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const message = {
      type: 'command',
      id: messageId,
      command,
      params,
      timestamp: Date.now()
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(messageId);

        if (retryCount < this.config.maxRetries) {
          console.log(`⏳ Retrying command ${command}... (${retryCount + 1}/${this.config.maxRetries})`);
          this.sendCommand(command, params, retryCount + 1)
            .then(resolve)
            .catch(reject);
        } else {
          reject(new Error(`Command timeout: ${command} (after ${this.config.maxRetries} retries)`));
        }
      }, this.config.requestTimeout);

      this.pendingRequests.set(messageId, {
        resolve: (response) => {
          clearTimeout(timeout);
          this.pendingRequests.delete(messageId);
          resolve(response);
        },
        reject: (error) => {
          clearTimeout(timeout);
          this.pendingRequests.delete(messageId);
          reject(error);
        },
        timestamp: Date.now()
      });

      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(messageId);
        reject(new Error(`Failed to send command: ${error.message}`));
      }
    });
  }

  // Graceful disconnect
  async disconnect() {
    this.stopHeartbeat();

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
      await this.sleep(500);
    }

    this.connected = false;
    this.reconnectAttempts = this.config.maxReconnectAttempts; // Prevent auto-reconnect
    console.log('✅ Disconnected gracefully');
  }
}

// Export
module.exports = { AutonomousAgent };

// CLI usage
if (require.main === module) {
  (async () => {
    const agent = new AutonomousAgent();

    console.log("🤖 Autonomous Copilot Agent with Smart Caching\n");
    console.log("I cache everything EXCEPT screenshots for fast access!\n");

    try {
      await agent.connect();

      // Execute autonomous task
      await agent.executeTask("https://example.com", "cached-test");

      // Run again to see cache in action
      console.log("\n🔄 Running AGAIN to demonstrate caching...\n");
      await agent.executeTask("https://example.com", "cached-test-2");

      // Show what I learned
      console.log("\n📚 WHAT I LEARNED:\n");
      const summary = agent.getSummary();
      console.log(`Total commands executed: ${summary.totalCommands}`);
      console.log(`Pages visited: ${summary.pagesVisited}`);
      console.log(`Screenshots taken: ${summary.screenshotsTaken}`);
      console.log(`Console logs analyzed: ${summary.consoleLogs}`);
      console.log(`Errors found: ${summary.errors}`);
      console.log(`Decisions made: ${summary.decisions}`);
      console.log(`Data types extracted: ${summary.extractedData}`);

      console.log("\n✅ All data cached and accessible!");

      agent.close();
      process.exit(0);
    } catch (error) {
      console.error("❌ Error:", error.message);
      agent.close();
      process.exit(1);
    }
  })();
}
