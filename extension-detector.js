#!/usr/bin/env node

// EXTENSION AUTO-DETECTOR
// Detects if Browser Copilot Extension is installed in any browser

const fs = require("fs");
const path = require("path");
const os = require("os");
const { exec } = require("child_process");
const util = require("util");

const execPromise = util.promisify(exec);

class ExtensionDetector {
  constructor() {
    this.detectedExtensions = [];
    this.detectedBrowsers = [];
  }

  // Get all possible browser profile locations
  getBrowserPaths() {
    const homeDir = os.homedir();
    const platform = os.platform();

    const paths = {
      chrome: [],
      edge: [],
      brave: [],
      vivaldi: [],
      opera: [],
      firefox: [], // Added Firefox support
    };

    if (platform === "darwin") {
      // macOS
      paths.chrome = [
        path.join(homeDir, "Library/Application Support/Google/Chrome"),
        path.join(homeDir, "Library/Application Support/Google/Chrome Canary"),
        path.join(homeDir, "Library/Application Support/Google/Chrome Beta"),
        path.join(homeDir, "Library/Application Support/Google/Chrome Dev"),
      ];
      paths.edge = [
        path.join(homeDir, "Library/Application Support/Microsoft Edge"),
        path.join(homeDir, "Library/Application Support/Microsoft Edge Beta"),
        path.join(homeDir, "Library/Application Support/Microsoft Edge Dev"),
        path.join(homeDir, "Library/Application Support/Microsoft Edge Canary"),
      ];
      paths.brave = [
        path.join(
          homeDir,
          "Library/Application Support/BraveSoftware/Brave-Browser"
        ),
        path.join(
          homeDir,
          "Library/Application Support/BraveSoftware/Brave-Browser-Beta"
        ),
        path.join(
          homeDir,
          "Library/Application Support/BraveSoftware/Brave-Browser-Nightly"
        ),
      ];
      paths.vivaldi = [
        path.join(homeDir, "Library/Application Support/Vivaldi"),
        path.join(homeDir, "Library/Application Support/Vivaldi Snapshot"),
      ];
      paths.opera = [
        path.join(
          homeDir,
          "Library/Application Support/com.operasoftware.Opera"
        ),
        path.join(
          homeDir,
          "Library/Application Support/com.operasoftware.OperaNext"
        ),
        path.join(
          homeDir,
          "Library/Application Support/com.operasoftware.OperaDeveloper"
        ),
      ];
    } else if (platform === "win32") {
      // Windows
      const localAppData =
        process.env.LOCALAPPDATA || path.join(homeDir, "AppData", "Local");
      const appData =
        process.env.APPDATA || path.join(homeDir, "AppData", "Roaming");

      paths.chrome = [
        path.join(localAppData, "Google", "Chrome", "User Data"),
        path.join(localAppData, "Google", "Chrome SxS", "User Data"),
        path.join(localAppData, "Google", "Chrome Beta", "User Data"),
        path.join(localAppData, "Google", "Chrome Dev", "User Data"),
        path.join(localAppData, "Chromium", "User Data"),
      ];
      paths.edge = [
        path.join(localAppData, "Microsoft", "Edge", "User Data"),
        path.join(localAppData, "Microsoft", "Edge Beta", "User Data"),
        path.join(localAppData, "Microsoft", "Edge Dev", "User Data"),
        path.join(localAppData, "Microsoft", "Edge SxS", "User Data"),
      ];
      paths.brave = [
        path.join(localAppData, "BraveSoftware", "Brave-Browser", "User Data"),
        path.join(
          localAppData,
          "BraveSoftware",
          "Brave-Browser-Beta",
          "User Data"
        ),
        path.join(
          localAppData,
          "BraveSoftware",
          "Brave-Browser-Nightly",
          "User Data"
        ),
      ];
      paths.vivaldi = [
        path.join(localAppData, "Vivaldi", "User Data"),
        path.join(localAppData, "Vivaldi Snapshot", "User Data"),
      ];
      paths.opera = [
        path.join(appData, "Opera Software", "Opera Stable"),
        path.join(appData, "Opera Software", "Opera Next"),
        path.join(appData, "Opera Software", "Opera Developer"),
        path.join(appData, "Opera Software", "Opera GX Stable"),
      ];
    } else {
      // Linux (including Ubuntu, Debian, Fedora, Arch, etc.)
      paths.chrome = [
        path.join(homeDir, ".config", "google-chrome"),
        path.join(homeDir, ".config", "chromium"),
        path.join(homeDir, ".config", "google-chrome-beta"),
        path.join(homeDir, ".config", "google-chrome-unstable"),
        path.join(homeDir, "snap", "chromium", "common", "chromium"), // Snap package
        path.join(
          homeDir,
          ".var",
          "app",
          "com.google.Chrome",
          "config",
          "google-chrome"
        ), // Flatpak
      ];
      paths.edge = [
        path.join(homeDir, ".config", "microsoft-edge"),
        path.join(homeDir, ".config", "microsoft-edge-beta"),
        path.join(homeDir, ".config", "microsoft-edge-dev"),
        path.join(
          homeDir,
          ".var",
          "app",
          "com.microsoft.Edge",
          "config",
          "microsoft-edge"
        ), // Flatpak
      ];
      paths.brave = [
        path.join(homeDir, ".config", "BraveSoftware", "Brave-Browser"),
        path.join(homeDir, ".config", "BraveSoftware", "Brave-Browser-Beta"),
        path.join(homeDir, ".config", "BraveSoftware", "Brave-Browser-Nightly"),
        path.join(
          homeDir,
          ".var",
          "app",
          "com.brave.Browser",
          "config",
          "BraveSoftware",
          "Brave-Browser"
        ), // Flatpak
      ];
      paths.vivaldi = [
        path.join(homeDir, ".config", "vivaldi"),
        path.join(homeDir, ".config", "vivaldi-snapshot"),
      ];
      paths.opera = [
        path.join(homeDir, ".config", "opera"),
        path.join(homeDir, ".config", "opera-beta"),
        path.join(homeDir, ".config", "opera-developer"),
      ];
    }

    return paths;
  }

  // Find extension manifest in browser profiles
  async findExtensionInProfile(browserPath, browserName) {
    const found = [];

    try {
      if (!fs.existsSync(browserPath)) {
        return found;
      }

      // Check all profiles (Default, Profile 1, Profile 2, etc.)
      const profiles = fs
        .readdirSync(browserPath)
        .filter((dir) => dir === "Default" || dir.startsWith("Profile"));

      for (const profile of profiles) {
        const extensionsPath = path.join(browserPath, profile, "Extensions");

        if (!fs.existsSync(extensionsPath)) continue;

        // List all extensions
        const extensions = fs.readdirSync(extensionsPath);

        for (const extId of extensions) {
          const extPath = path.join(extensionsPath, extId);

          // Check each version folder
          const versions = fs.readdirSync(extPath);

          for (const version of versions) {
            const manifestPath = path.join(extPath, version, "manifest.json");

            if (fs.existsSync(manifestPath)) {
              const manifest = JSON.parse(
                fs.readFileSync(manifestPath, "utf8")
              );

              // Check if this is our Browser Copilot Extension
              if (
                manifest.name?.includes("Browser Copilot") ||
                manifest.description?.includes("Browser Copilot") ||
                manifest.permissions?.includes("webNavigation")
              ) {
                found.push({
                  browser: browserName,
                  profile,
                  extensionId: extId,
                  version: manifest.version,
                  name: manifest.name,
                  path: path.join(extPath, version),
                  manifestPath,
                });
              }
            }
          }
        }
      }
    } catch (error) {
      // Silently skip inaccessible paths
    }

    return found;
  }

  // Check if extension is currently running (connected to relay server)
  async checkExtensionRunning(port = 3000) {
    try {
      const response = await fetch(`http://localhost:${port}/status`);
      if (response.ok) {
        const data = await response.json();
        return {
          running: true,
          ...data,
        };
      }
    } catch (error) {
      return { running: false };
    }
  }

  // Detect which browser is currently running
  async detectRunningBrowsers() {
    const platform = os.platform();
    const running = [];

    try {
      if (platform === "darwin") {
        // macOS - use ps command
        const { stdout } = await execPromise(
          'ps aux | grep -E "(Chrome|Edge|Brave|Vivaldi|Opera)" | grep -v grep'
        );

        if (stdout.includes("Google Chrome")) running.push("chrome");
        if (stdout.includes("Microsoft Edge")) running.push("edge");
        if (stdout.includes("Brave")) running.push("brave");
        if (stdout.includes("Vivaldi")) running.push("vivaldi");
        if (stdout.includes("Opera")) running.push("opera");
      } else if (platform === "win32") {
        // Windows - use tasklist
        const { stdout } = await execPromise("tasklist");

        if (stdout.includes("chrome.exe")) running.push("chrome");
        if (stdout.includes("msedge.exe")) running.push("edge");
        if (stdout.includes("brave.exe")) running.push("brave");
        if (stdout.includes("vivaldi.exe")) running.push("vivaldi");
        if (stdout.includes("opera.exe")) running.push("opera");
      } else {
        // Linux - use ps
        const { stdout } = await execPromise(
          'ps aux | grep -E "(chrome|chromium|edge|brave|vivaldi|opera)" | grep -v grep'
        );

        if (stdout.includes("chrome") || stdout.includes("chromium"))
          running.push("chrome");
        if (stdout.includes("edge")) running.push("edge");
        if (stdout.includes("brave")) running.push("brave");
        if (stdout.includes("vivaldi")) running.push("vivaldi");
        if (stdout.includes("opera")) running.push("opera");
      }
    } catch (error) {
      // Silently fail
    }

    return running;
  }

  // Main detection method
  async detect() {
    console.log("🔍 Detecting Browser Copilot Extension...\n");

    // Step 1: Check if extension is running
    console.log("📡 Checking if extension is active...");
    const status = await this.checkExtensionRunning();

    if (status.running) {
      console.log("✅ Extension is ACTIVE and connected!");
      console.log(`   Server: http://localhost:3000`);
      console.log(`   Agents: ${status.agents || 0} connected\n`);
    } else {
      console.log("⚠️  Extension not active (relay server not responding)\n");
    }

    // Step 2: Detect running browsers
    console.log("🌐 Detecting running browsers...");
    this.detectedBrowsers = await this.detectRunningBrowsers();

    if (this.detectedBrowsers.length > 0) {
      console.log(
        `✅ Found ${this.detectedBrowsers.length} running browser(s):`
      );
      this.detectedBrowsers.forEach((b) => console.log(`   - ${b}`));
      console.log("");
    } else {
      console.log("⚠️  No browsers currently running\n");
    }

    // Step 3: Scan all browser profiles
    console.log("📂 Scanning browser profiles for extension...");
    const browserPaths = this.getBrowserPaths();

    for (const [browserName, paths] of Object.entries(browserPaths)) {
      for (const browserPath of paths) {
        const extensions = await this.findExtensionInProfile(
          browserPath,
          browserName
        );
        this.detectedExtensions.push(...extensions);
      }
    }

    // Step 4: Show results
    if (this.detectedExtensions.length > 0) {
      console.log(
        `\n✅ Found ${this.detectedExtensions.length} Browser Copilot Extension(s)!\n`
      );

      this.detectedExtensions.forEach((ext, i) => {
        console.log(`${i + 1}. ${ext.browser.toUpperCase()} - ${ext.profile}`);
        console.log(`   Name: ${ext.name}`);
        console.log(`   Version: ${ext.version}`);
        console.log(`   ID: ${ext.extensionId}`);
        console.log(`   Path: ${ext.path}`);
        console.log("");
      });
    } else {
      console.log("\n❌ No Browser Copilot Extension found in any browser\n");
      console.log("💡 To install:");
      console.log("   1. Open Chrome/Edge/Brave");
      console.log("   2. Go to chrome://extensions (or edge://extensions)");
      console.log('   3. Enable "Developer mode"');
      console.log('   4. Click "Load unpacked"');
      console.log(
        `   5. Select: ${path.join(__dirname, "browser-extension")}\n`
      );
    }

    return {
      running: status.running,
      extensions: this.detectedExtensions,
      browsers: this.detectedBrowsers,
      available: this.detectedExtensions.length > 0 || status.running,
    };
  }

  // Get best available extension
  getBest() {
    if (this.detectedExtensions.length === 0) {
      return null;
    }

    // Prefer extension in currently running browser
    const runningBrowserExt = this.detectedExtensions.find((ext) =>
      this.detectedBrowsers.includes(ext.browser)
    );

    if (runningBrowserExt) {
      return runningBrowserExt;
    }

    // Otherwise return first found
    return this.detectedExtensions[0];
  }
}

// Export
module.exports = { ExtensionDetector };

// CLI usage
if (require.main === module) {
  (async () => {
    const detector = new ExtensionDetector();
    const result = await detector.detect();

    if (result.available) {
      console.log("🎉 Browser Copilot Extension is available!\n");

      const best = detector.getBest();
      if (best) {
        console.log("🎯 Recommended:");
        console.log(`   Browser: ${best.browser}`);
        console.log(`   Profile: ${best.profile}`);
        console.log(`   Extension ID: ${best.extensionId}\n`);
      }

      if (result.running) {
        console.log("✅ You can start using the agent now!\n");
        console.log("   const agent = new AutonomousAgent();");
        console.log("   await agent.connect();\n");
      } else {
        console.log("⚠️  Please start the relay server:");
        console.log("   cd relay-server && npm start\n");
      }
    } else {
      console.log("❌ Extension not installed or not running\n");
      process.exit(1);
    }
  })();
}
