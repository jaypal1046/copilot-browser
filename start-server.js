#!/usr/bin/env node

/**
 * CROSS-PLATFORM RELAY SERVER STARTER
 * Automatically starts relay server on macOS, Windows, and Linux
 */

const { spawn } = require("child_process");
const path = require("path");
const os = require("os");
const fs = require("fs");

class ServerManager {
  constructor() {
    this.platform = os.platform();
    this.serverProcess = null;
    this.serverPath = path.join(__dirname, "relay-server");
  }

  // Check if server is already running
  async isServerRunning(port = 3000) {
    try {
      const response = await fetch(`http://localhost:${port}/status`);
      return response.ok;
    } catch {
      return false;
    }
  }

  // Start server based on platform
  async startServer() {
    console.log(`\n🚀 Starting Relay Server on ${this.platform}...\n`);

    // Check if already running
    if (await this.isServerRunning()) {
      console.log("✅ Server already running on http://localhost:3000\n");
      return true;
    }

    // Check if server exists
    const serverFile = path.join(this.serverPath, "index.js");
    if (!fs.existsSync(serverFile)) {
      console.error("❌ Relay server not found at:", serverFile);
      return false;
    }

    // Platform-specific spawn configuration
    const spawnOptions = {
      cwd: this.serverPath,
      stdio: ["ignore", "pipe", "pipe"],
      detached: this.platform !== "win32", // Detach on Unix-like systems
    };

    // Windows needs shell
    if (this.platform === "win32") {
      spawnOptions.shell = true;
    }

    try {
      // Start the server
      this.serverProcess = spawn("node", ["index.js"], spawnOptions);

      // Handle output
      this.serverProcess.stdout.on("data", (data) => {
        console.log(`   ${data.toString().trim()}`);
      });

      this.serverProcess.stderr.on("data", (data) => {
        console.error(`   ⚠️  ${data.toString().trim()}`);
      });

      this.serverProcess.on("error", (error) => {
        console.error(`   ❌ Failed to start server:`, error.message);
      });

      // On Unix-like systems, detach the process
      if (this.platform !== "win32" && this.serverProcess.pid) {
        this.serverProcess.unref();
      }

      // Wait for server to be ready
      console.log("   ⏳ Waiting for server to start...");

      for (let i = 0; i < 20; i++) {
        await new Promise((resolve) => setTimeout(resolve, 500));

        if (await this.isServerRunning()) {
          console.log("   ✅ Server started successfully!\n");
          console.log(`   🌐 Server running at: http://localhost:3000`);
          console.log(`   📡 WebSocket at: ws://localhost:3000\n`);
          return true;
        }
      }

      console.error("   ❌ Server failed to start within 10 seconds\n");
      return false;
    } catch (error) {
      console.error(`   ❌ Error starting server:`, error.message);
      return false;
    }
  }

  // Stop server
  stopServer() {
    if (this.serverProcess) {
      console.log("\n🛑 Stopping relay server...");

      if (this.platform === "win32") {
        // Windows: use taskkill
        spawn("taskkill", ["/pid", this.serverProcess.pid, "/f", "/t"]);
      } else {
        // Unix: send SIGTERM
        this.serverProcess.kill("SIGTERM");
      }

      this.serverProcess = null;
      console.log("✅ Server stopped\n");
    }
  }

  // Get platform-specific installation instructions
  getInstallInstructions() {
    const instructions = {
      darwin: {
        title: "🍎 macOS Installation",
        browsers: [
          "Google Chrome: ~/Library/Application Support/Google/Chrome",
          "Microsoft Edge: ~/Library/Application Support/Microsoft Edge",
          "Brave: ~/Library/Application Support/BraveSoftware/Brave-Browser",
        ],
        commands: [
          "cd ~/browser-copilot-integration",
          "node start-server.js",
          "Open Chrome → chrome://extensions",
          'Enable "Developer mode" → Load unpacked',
          "Select: browser-extension folder",
        ],
      },
      win32: {
        title: "🪟 Windows Installation",
        browsers: [
          "Google Chrome: %LOCALAPPDATA%\\Google\\Chrome\\User Data",
          "Microsoft Edge: %LOCALAPPDATA%\\Microsoft\\Edge\\User Data",
          "Brave: %LOCALAPPDATA%\\BraveSoftware\\Brave-Browser\\User Data",
        ],
        commands: [
          "cd C:\\Users\\YourName\\browser-copilot-integration",
          "node start-server.js",
          "Open Chrome → chrome://extensions",
          'Enable "Developer mode" → Load unpacked',
          "Select: browser-extension folder",
        ],
      },
      linux: {
        title: "🐧 Linux Installation",
        browsers: [
          "Google Chrome: ~/.config/google-chrome",
          "Chromium: ~/.config/chromium",
          "Microsoft Edge: ~/.config/microsoft-edge",
          "Brave: ~/.config/BraveSoftware/Brave-Browser",
        ],
        commands: [
          "cd ~/browser-copilot-integration",
          "node start-server.js",
          "Open Chrome/Chromium → chrome://extensions",
          'Enable "Developer mode" → Load unpacked',
          "Select: browser-extension folder",
        ],
      },
    };

    return instructions[this.platform] || instructions.linux;
  }

  // Display help
  showHelp() {
    const instructions = this.getInstallInstructions();

    console.log(`\n${"=".repeat(60)}`);
    console.log(instructions.title);
    console.log(`${"=".repeat(60)}\n`);

    console.log("📂 Browser Profile Locations:");
    instructions.browsers.forEach((b) => console.log(`   • ${b}`));

    console.log("\n📝 Setup Commands:");
    instructions.commands.forEach((cmd, i) =>
      console.log(`   ${i + 1}. ${cmd}`)
    );

    console.log(`\n${"=".repeat(60)}\n`);
  }
}

// Export
module.exports = { ServerManager };

// CLI usage
if (require.main === module) {
  (async () => {
    const manager = new ServerManager();

    const args = process.argv.slice(2);

    if (args.includes("--help") || args.includes("-h")) {
      manager.showHelp();
      process.exit(0);
    }

    if (args.includes("--stop")) {
      manager.stopServer();
      process.exit(0);
    }

    // Start server
    const started = await manager.startServer();

    if (started) {
      console.log("💡 Tip: Press Ctrl+C to stop the server\n");
      console.log(
        "📖 For installation help, run: node start-server.js --help\n"
      );

      // Keep process alive on Windows
      if (manager.platform === "win32") {
        process.stdin.resume();
      }
    } else {
      console.log("\n💡 Run with --help for platform-specific instructions\n");
      process.exit(1);
    }
  })();
}
