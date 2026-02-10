#!/usr/bin/env node

/**
 * CROSS-PLATFORM INTEGRATION TEST
 * Tests extension detection and connection on your actual system
 */

const { ExtensionDetector } = require("./extension-detector");
const { ServerManager } = require("./start-server");
const os = require("os");

class PlatformTester {
  constructor() {
    this.platform = os.platform();
    this.results = {
      platform: this.platform,
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
      tests: [],
    };
  }

  // Test result helper
  addTest(name, passed, message, details = {}) {
    const result = {
      name,
      passed,
      message,
      ...details,
    };
    this.results.tests.push(result);

    const icon = passed ? "✅" : "❌";
    console.log(`${icon} ${name}: ${message}`);
    if (Object.keys(details).length > 0) {
      console.log(`   Details:`, JSON.stringify(details, null, 2));
    }
  }

  // Test 1: Platform Detection
  async testPlatformDetection() {
    console.log("\n📋 Test 1: Platform Detection\n");

    const platforms = ["darwin", "win32", "linux"];
    const platformNames = {
      darwin: "macOS",
      win32: "Windows",
      linux: "Linux",
    };

    const detected = platformNames[this.platform] || "Unknown";
    const isSupported = platforms.includes(this.platform);

    this.addTest(
      "Platform Detection",
      isSupported,
      isSupported
        ? `Detected ${detected} - Supported ✓`
        : `Detected ${detected} - Not supported`,
      { platform: this.platform, supported: isSupported }
    );
  }

  // Test 2: Node.js Version
  async testNodeVersion() {
    console.log("\n📋 Test 2: Node.js Version\n");

    const version = process.versions.node;
    const major = parseInt(version.split(".")[0]);
    const hasFetch = typeof fetch !== "undefined";

    const isCompatible = major >= 18 && hasFetch;

    this.addTest(
      "Node.js Version",
      isCompatible,
      isCompatible
        ? `Node ${version} with fetch support ✓`
        : `Node ${version} - Need v18+ with fetch`,
      { version, major, hasFetch }
    );
  }

  // Test 3: Extension Detection
  async testExtensionDetection() {
    console.log("\n📋 Test 3: Extension Detection\n");

    try {
      const detector = new ExtensionDetector();
      const result = await detector.detect();

      this.addTest(
        "Extension Scan",
        true,
        `Scanned browser profiles successfully`,
        {
          extensionsFound: result.extensions.length,
          browsersRunning: result.browsers.length,
          available: result.available,
        }
      );

      if (result.extensions.length > 0) {
        this.addTest(
          "Extension Found",
          true,
          `Found ${result.extensions.length} extension(s)`,
          {
            extensions: result.extensions.map((e) => ({
              browser: e.browser,
              profile: e.profile,
              version: e.version,
            })),
          }
        );
      } else {
        this.addTest(
          "Extension Found",
          false,
          "No extensions found - needs installation",
          { hint: "Run node start-server.js --help for instructions" }
        );
      }

      if (result.browsers.length > 0) {
        this.addTest(
          "Running Browsers",
          true,
          `Found ${result.browsers.length} running browser(s)`,
          { browsers: result.browsers }
        );
      } else {
        this.addTest(
          "Running Browsers",
          false,
          "No browsers currently running",
          { hint: "Start Chrome/Edge/Brave to use the extension" }
        );
      }

      return result;
    } catch (error) {
      this.addTest(
        "Extension Detection",
        false,
        `Detection failed: ${error.message}`,
        { error: error.message }
      );
      return null;
    }
  }

  // Test 4: Server Connection
  async testServerConnection() {
    console.log("\n📋 Test 4: Relay Server Connection\n");

    try {
      const response = await fetch("http://localhost:3000/status", {
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();
        this.addTest(
          "Server Connection",
          true,
          "Server is running and responding",
          {
            status: data.status,
            agents: data.agents || 0,
            uptime: data.uptime || "N/A",
          }
        );
        return true;
      } else {
        this.addTest(
          "Server Connection",
          false,
          `Server responded with status ${response.status}`,
          { statusCode: response.status }
        );
        return false;
      }
    } catch (error) {
      this.addTest("Server Connection", false, "Server not running", {
        error: error.message,
        hint: "Run: node start-server.js",
      });
      return false;
    }
  }

  // Test 5: Server Manager
  async testServerManager() {
    console.log("\n📋 Test 5: Server Manager\n");

    try {
      const manager = new ServerManager();

      this.addTest(
        "Server Manager Init",
        true,
        "ServerManager initialized successfully",
        { platform: manager.platform }
      );

      // Test instructions
      const instructions = manager.getInstallInstructions();
      this.addTest(
        "Platform Instructions",
        instructions !== null,
        "Platform-specific instructions available",
        {
          title: instructions.title,
          browserCount: instructions.browsers.length,
          commandCount: instructions.commands.length,
        }
      );
    } catch (error) {
      this.addTest("Server Manager", false, `Failed: ${error.message}`, {
        error: error.message,
      });
    }
  }

  // Test 6: File Permissions
  async testFilePermissions() {
    console.log("\n📋 Test 6: File Permissions\n");

    const fs = require("fs");
    const path = require("path");

    const files = [
      "extension-detector.js",
      "start-server.js",
      "autonomous-agent.js",
      "relay-server/index.js",
      "browser-extension/manifest.json",
    ];

    let allReadable = true;
    const results = {};

    for (const file of files) {
      const filePath = path.join(__dirname, file);
      try {
        fs.accessSync(filePath, fs.constants.R_OK);
        results[file] = "readable";
      } catch {
        results[file] = "not accessible";
        allReadable = false;
      }
    }

    this.addTest(
      "File Permissions",
      allReadable,
      allReadable
        ? "All required files are accessible"
        : "Some files are not accessible",
      results
    );
  }

  // Generate Report
  generateReport() {
    console.log("\n" + "=".repeat(70));
    console.log("📊 TEST SUMMARY");
    console.log("=".repeat(70) + "\n");

    const passed = this.results.tests.filter((t) => t.passed).length;
    const total = this.results.tests.length;
    const percentage = ((passed / total) * 100).toFixed(1);

    console.log(`Platform: ${this.results.platform}`);
    console.log(`Node.js: ${this.results.nodeVersion}`);
    console.log(`Tests Passed: ${passed}/${total} (${percentage}%)\n`);

    // Show failed tests
    const failed = this.results.tests.filter((t) => !t.passed);
    if (failed.length > 0) {
      console.log("❌ Failed Tests:");
      failed.forEach((test) => {
        console.log(`   • ${test.name}: ${test.message}`);
        if (test.hint) {
          console.log(`     💡 ${test.hint}`);
        }
      });
      console.log("");
    }

    // Overall status
    if (passed === total) {
      console.log("🎉 All tests passed! System is ready to use.\n");
    } else if (passed >= total * 0.7) {
      console.log("⚠️  Most tests passed. Review failures above.\n");
    } else {
      console.log("❌ Multiple tests failed. See details above.\n");
    }

    console.log("=".repeat(70) + "\n");

    // Save report
    const fs = require("fs");
    const reportPath = `test-report-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    console.log(`📄 Full report saved to: ${reportPath}\n`);
  }

  // Run all tests
  async runAll() {
    console.log("\n🧪 CROSS-PLATFORM INTEGRATION TEST\n");
    console.log(`Running on: ${this.platform}`);
    console.log(`Node.js: ${process.version}`);
    console.log(`Date: ${new Date().toLocaleString()}\n`);
    console.log("=".repeat(70));

    await this.testPlatformDetection();
    await this.testNodeVersion();
    await this.testFilePermissions();
    await this.testServerManager();
    await this.testServerConnection();
    await this.testExtensionDetection();

    this.generateReport();

    return this.results;
  }
}

// Run tests
if (require.main === module) {
  (async () => {
    const tester = new PlatformTester();
    const results = await tester.runAll();

    // Exit code based on results
    const passed = results.tests.filter((t) => t.passed).length;
    const total = results.tests.length;

    process.exit(passed === total ? 0 : 1);
  })();
}

module.exports = { PlatformTester };
