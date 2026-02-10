#!/usr/bin/env node

// SMART COPILOT AGENT - Like Antigravity
// Stores data, injects scripts, learns from previous runs

const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");

// Storage for all collected data
const DATA_DIR = path.join(__dirname, "agent-data");
const SCRIPTS_DIR = path.join(__dirname, "agent-scripts");
const SCREENSHOTS_DIR = path.join(__dirname, "screenshots");

// Create directories
[DATA_DIR, SCRIPTS_DIR, SCREENSHOTS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
});

class CopilotAgent {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.clientId = null;
    this.sessionData = {
      startTime: Date.now(),
      commands: [],
      pages: {},
      screenshots: [],
      extractedData: {},
    };
  }

  // Connect to browser
  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket("ws://localhost:8080");

      this.ws.on("open", () => {
        this.ws.send(
          JSON.stringify({
            type: "register",
            clientType: "vscode",
            metadata: { copilot: true, smart: true },
          })
        );
      });

      this.ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "registered") {
          this.connected = true;
          this.clientId = msg.clientId;
          console.log(`✅ Connected (ID: ${this.clientId})`);
          resolve();
        }
      });

      this.ws.on("error", reject);
    });
  }

  // Send command and get response
  async execute(command, params = {}) {
    return new Promise((resolve) => {
      const id = `cmd-${Date.now()}`;
      const startTime = Date.now();

      const handler = (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "response" && msg.id === id) {
          this.ws.removeListener("message", handler);

          // Store command result
          this.sessionData.commands.push({
            command,
            params,
            result: msg.data,
            success: msg.success,
            timestamp: Date.now(),
            duration: Date.now() - startTime,
          });

          resolve(msg);
        }
      };

      this.ws.on("message", handler);

      this.ws.send(
        JSON.stringify({
          type: "command",
          id,
          command,
          params,
          timestamp: Date.now(),
        })
      );
    });
  }

  // Navigate and store page data
  async navigate(url) {
    console.log(`\n🌐 Opening: ${url}`);
    const result = await this.execute("navigate", { url });

    if (result.success) {
      this.sessionData.pages[url] = {
        url: result.data.url,
        title: result.data.title,
        visitedAt: Date.now(),
      };
      console.log(`   ✓ ${result.data.title}`);
    }

    return result;
  }

  // Inject and execute script
  async inject(scriptName, code) {
    console.log(`\n💉 Injecting: ${scriptName}`);

    // Save script for reuse
    fs.writeFileSync(path.join(SCRIPTS_DIR, `${scriptName}.js`), code);

    const result = await this.execute("execute_js", { code });

    if (result.success) {
      // Store extracted data
      this.sessionData.extractedData[scriptName] = {
        result: result.data.result,
        timestamp: Date.now(),
      };
      console.log(`   ✓ Executed and saved`);
    }

    return result.data?.result;
  }

  // Take screenshot and save
  async screenshot(label = "screenshot") {
    console.log(`\n📸 Screenshot: ${label}`);
    const result = await this.execute("get_screenshot", { format: "png" });

    if (result.success) {
      const filename = `${label}-${Date.now()}.png`;
      const filepath = path.join(SCREENSHOTS_DIR, filename);
      const base64Data = result.data.screenshot.replace(
        /^data:image\/png;base64,/,
        ""
      );
      fs.writeFileSync(filepath, base64Data, "base64");

      this.sessionData.screenshots.push({
        label,
        filename,
        filepath,
        timestamp: Date.now(),
      });

      console.log(`   ✓ Saved: ${filename}`);
    }

    return result;
  }

  // Extract data using injected script
  async extract(name, script) {
    console.log(`\n📊 Extracting: ${name}`);
    return await this.inject(name, script);
  }

  // Get console logs
  async getConsole() {
    console.log(`\n📋 Getting console logs...`);
    const result = await this.execute("get_console", { limit: 50 });
    if (result.success) {
      console.log(`   ✓ ${result.data.logs.length} logs`);
      return result.data.logs;
    }
    return [];
  }

  // Click element
  async click(selector) {
    console.log(`\n👆 Clicking: ${selector}`);
    const result = await this.execute("click", { selector });
    if (result.success) {
      console.log(`   ✓ Clicked`);
    }
    return result;
  }

  // Type into input
  async type(selector, text) {
    console.log(`\n⌨️  Typing into: ${selector}`);
    const result = await this.execute("type", { selector, text, clear: true });
    if (result.success) {
      console.log(`   ✓ Typed: ${text}`);
    }
    return result;
  }

  // Save session data
  saveSession(name = "session") {
    const filename = `${name}-${Date.now()}.json`;
    const filepath = path.join(DATA_DIR, filename);

    fs.writeFileSync(filepath, JSON.stringify(this.sessionData, null, 2));
    console.log(`\n💾 Session saved: ${filepath}`);

    return filepath;
  }

  // Load previous session
  loadSession(filepath) {
    if (fs.existsSync(filepath)) {
      this.sessionData = JSON.parse(fs.readFileSync(filepath, "utf8"));
      console.log(`\n📂 Session loaded: ${filepath}`);
      return true;
    }
    return false;
  }

  // Get all saved data
  getAllData() {
    return {
      session: this.sessionData,
      scripts: fs.readdirSync(SCRIPTS_DIR),
      screenshots: fs.readdirSync(SCREENSHOTS_DIR),
    };
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

// Export the agent
module.exports = { CopilotAgent };

// CLI usage
if (require.main === module) {
  (async () => {
    const agent = new CopilotAgent();

    console.log("🤖 Smart Copilot Agent\n");

    try {
      await agent.connect();

      // Example workflow
      await agent.navigate("https://example.com");
      await agent.screenshot("example-home");

      // Inject script to extract all data
      const pageData = await agent.extract(
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
          images: Array.from(document.querySelectorAll('img')).map(img => img.src)
        })
      `
      );

      console.log("\n📦 Extracted data:", JSON.stringify(pageData, null, 2));

      await agent.getConsole();
      await agent.click("a");
      await agent.screenshot("after-click");

      // Save everything
      agent.saveSession("example-test");

      console.log("\n✅ Done! All data saved.");

      agent.close();
      process.exit(0);
    } catch (error) {
      console.error("❌ Error:", error.message);
      agent.close();
      process.exit(1);
    }
  })();
}
