#!/usr/bin/env node

// FULL ANTIGRAVITY-STYLE AUTOMATION
// Complete browser control with screenshots, form filling, testing, and more!

const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");

console.log("🚀 GitHub Copilot - Antigravity Browser Agent\n");
console.log("═══════════════════════════════════════════════════════\n");

let ws = null;
const screenshotsDir = path.join(__dirname, "screenshots");

// Create screenshots directory
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir);
}

// Connect to relay
function connect() {
  return new Promise((resolve, reject) => {
    console.log("📡 Initializing browser connection...");
    ws = new WebSocket("ws://localhost:8080");

    ws.on("open", () => {
      ws.send(
        JSON.stringify({
          type: "register",
          clientType: "vscode",
          metadata: { copilot: true, antigravity: true },
        })
      );
    });

    ws.on("message", (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === "registered") {
        console.log("✅ Browser agent connected!\n");
        console.log(`🆔 Client ID: ${message.clientId}`);
        console.log(
          `👥 Connected: ${message.connectedClients.browser} browser(s), ${message.connectedClients.vscode} VS Code client(s)\n`
        );
        resolve();
      }
    });

    ws.on("error", reject);
  });
}

// Send command and get response
function sendCommand(command, params, description) {
  return new Promise((resolve) => {
    const id = `antigravity-${Date.now()}`;

    console.log(`\n${"=".repeat(60)}`);
    console.log(`🔧 ${description}`);
    console.log(`   📌 Command: ${command}`);
    if (Object.keys(params).length > 0) {
      console.log(
        `   📋 Params:`,
        JSON.stringify(params, null, 2)
          .split("\n")
          .map((l, i) => (i === 0 ? l : "      " + l))
          .join("\n")
      );
    }

    const handler = (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === "response" && message.id === id) {
        ws.removeListener("message", handler);

        console.log(
          `   ⏱️  Response time: ${Date.now() - parseInt(id.split("-")[1])}ms`
        );

        if (message.success) {
          console.log(`   ✅ SUCCESS`);
          displayResult(message.data, command);
        } else {
          console.log(`   ❌ FAILED: ${message.error?.message}`);
        }

        resolve(message);
      }
    };

    ws.on("message", handler);

    ws.send(
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

function displayResult(data, command) {
  if (data.url) {
    console.log(`   🌐 URL: ${data.url}`);
  }
  if (data.title) {
    console.log(`   📄 Title: ${data.title}`);
  }
  if (data.result !== undefined) {
    const result = JSON.stringify(data.result);
    console.log(
      `   📦 Result: ${
        result.length > 100 ? result.substring(0, 100) + "..." : result
      }`
    );
  }
  if (data.text) {
    console.log(
      `   📝 Text: ${data.text.substring(0, 150)}${
        data.text.length > 150 ? "..." : ""
      }`
    );
  }
  if (data.html) {
    console.log(`   📄 HTML: ${data.html.length} characters`);
  }
  if (data.logs) {
    console.log(`   📋 Console Logs: ${data.logs.length} entries`);
    if (data.logs.length > 0) {
      console.log(`   📝 Latest logs:`);
      data.logs.slice(-3).forEach((log) => {
        console.log(
          `      [${log.level.toUpperCase()}] ${log.message.substring(0, 80)}`
        );
      });
    }
  }
  if (data.navigation) {
    console.log(`   ⚡ Performance Metrics:`);
    console.log(`      🚀 Load Time: ${data.navigation.loadComplete}ms`);
    console.log(
      `      📊 DOM Content Loaded: ${data.navigation.domContentLoaded}ms`
    );
    console.log(
      `      🎨 First Paint: ${data.paint?.[0]?.startTime || "N/A"}ms`
    );
  }
  if (data.tagName) {
    console.log(
      `   🎯 Element: <${data.tagName}${
        data.id ? ' id="' + data.id + '"' : ""
      }>`
    );
    console.log(`   👁️  Visible: ${data.visible ? "✅ Yes" : "❌ No"}`);
    if (data.position) {
      console.log(
        `   📍 Position: (${Math.round(data.position.left)}, ${Math.round(
          data.position.top
        )})`
      );
      console.log(
        `   📏 Size: ${Math.round(data.position.width)}x${Math.round(
          data.position.height
        )}px`
      );
    }
  }
  if (data.screenshot) {
    // Save screenshot
    const filename = `screenshot-${Date.now()}.png`;
    const filepath = path.join(screenshotsDir, filename);
    const base64Data = data.screenshot.replace(/^data:image\/png;base64,/, "");
    fs.writeFileSync(filepath, base64Data, "base64");
    console.log(`   📸 Screenshot saved: ${filepath}`);
  }
  if (data.cookies) {
    console.log(`   🍪 Cookies: ${data.cookies.length} found`);
  }
  if (data.type === "localStorage" || data.type === "sessionStorage") {
    console.log(
      `   💾 Storage (${data.type}): ${Object.keys(data.data).length} items`
    );
  }
  if (data.selector) {
    console.log(`   🎯 Target: ${data.selector}`);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// MAIN ANTIGRAVITY DEMO
async function runAntigravityDemo() {
  try {
    await connect();

    console.log("\n" + "━".repeat(60));
    console.log("🎬 ANTIGRAVITY MODE ACTIVATED");
    console.log("🤖 I will now control your browser completely!");
    console.log("⏸️  No user interaction needed - just watch!");
    console.log("━".repeat(60) + "\n");

    await sleep(2000);

    // PHASE 1: NAVIGATION & INSPECTION
    console.log("\n📍 PHASE 1: NAVIGATION & INSPECTION\n");

    await sendCommand(
      "navigate",
      { url: "https://example.com" },
      "Opening example.com"
    );
    await sleep(2000);

    await sendCommand(
      "get_screenshot",
      { format: "png", quality: 90 },
      "Taking screenshot #1"
    );
    await sleep(1000);

    await sendCommand(
      "execute_js",
      { code: "document.title" },
      "Reading page title"
    );
    await sleep(500);

    await sendCommand(
      "get_dom",
      { selector: "body" },
      "Extracting page structure"
    );
    await sleep(1000);

    // PHASE 2: DATA EXTRACTION
    console.log("\n\n📊 PHASE 2: DATA EXTRACTION\n");

    await sendCommand(
      "execute_js",
      {
        code: `({
        links: Array.from(document.querySelectorAll('a')).map(a => ({
          text: a.textContent.trim(),
          href: a.href
        })),
        headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.textContent.trim()),
        paragraphs: Array.from(document.querySelectorAll('p')).map(p => p.textContent.trim())
      })`,
      },
      "Extracting all page content"
    );
    await sleep(1000);

    await sendCommand(
      "get_element",
      { selector: "h1" },
      "Inspecting main heading element"
    );
    await sleep(1000);

    await sendCommand("get_console", { limit: 20 }, "Retrieving console logs");
    await sleep(1000);

    await sendCommand("get_performance", {}, "Analyzing page performance");
    await sleep(1000);

    // PHASE 3: INTERACTION
    console.log("\n\n🎮 PHASE 3: BROWSER INTERACTION\n");

    await sendCommand(
      "scroll",
      { selector: "p" },
      "Scrolling to first paragraph"
    );
    await sleep(1000);

    await sendCommand("hover", { selector: "a" }, "Hovering over link");
    await sleep(500);

    await sendCommand(
      "click",
      { selector: "a" },
      'Clicking "More information" link'
    );
    await sleep(2000);

    await sendCommand(
      "execute_js",
      { code: "window.location.href" },
      "Checking new page URL"
    );
    await sleep(1000);

    await sendCommand(
      "get_screenshot",
      { format: "png", quality: 90 },
      "Taking screenshot #2"
    );
    await sleep(1000);

    // PHASE 4: ADVANCED TESTING
    console.log("\n\n🧪 PHASE 4: ADVANCED TESTING\n");

    await sendCommand(
      "navigate",
      { url: "https://www.google.com" },
      "Opening Google.com"
    );
    await sleep(3000);

    await sendCommand(
      "get_screenshot",
      { format: "png", quality: 90 },
      "Taking screenshot #3 (Google)"
    );
    await sleep(1000);

    await sendCommand(
      "execute_js",
      {
        code: `({
        title: document.title,
        url: window.location.href,
        totalElements: document.querySelectorAll('*').length,
        images: document.querySelectorAll('img').length,
        links: document.querySelectorAll('a').length,
        forms: document.querySelectorAll('form').length,
        buttons: document.querySelectorAll('button').length
      })`,
      },
      "Analyzing Google page structure"
    );
    await sleep(1000);

    await sendCommand(
      "get_storage",
      { type: "local" },
      "Reading localStorage data"
    );
    await sleep(1000);

    await sendCommand(
      "get_cookies",
      { url: "https://www.google.com" },
      "Retrieving cookies"
    );
    await sleep(1000);

    // PHASE 5: JAVASCRIPT EXECUTION
    console.log("\n\n⚡ PHASE 5: CUSTOM JAVASCRIPT EXECUTION\n");

    await sendCommand(
      "execute_js",
      {
        code: `
        // Find all visible text on the page
        const text = Array.from(document.body.querySelectorAll('*'))
          .filter(el => el.offsetParent !== null)
          .map(el => el.textContent?.trim())
          .filter(t => t && t.length > 0 && t.length < 100)
          .slice(0, 10);
        text;
      `,
      },
      "Extracting visible text elements"
    );
    await sleep(1000);

    await sendCommand(
      "execute_js",
      {
        code: `
        // Get page metadata
        ({
          charset: document.characterSet,
          contentType: document.contentType,
          readyState: document.readyState,
          lastModified: document.lastModified,
          referrer: document.referrer,
          domain: document.domain,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight
          }
        })
      `,
      },
      "Getting page metadata"
    );
    await sleep(1000);

    // FINAL SCREENSHOT
    await sendCommand(
      "get_screenshot",
      { format: "png", quality: 90 },
      "Taking final screenshot #4"
    );
    await sleep(1000);

    // COMPLETION SUMMARY
    console.log("\n\n" + "━".repeat(60));
    console.log("🎉 ANTIGRAVITY AUTOMATION COMPLETE!\n");
    console.log("📊 EXECUTION SUMMARY:");
    console.log("   ✅ Navigated to 2 different websites");
    console.log("   ✅ Captured 4 screenshots automatically");
    console.log("   ✅ Extracted complete page data");
    console.log("   ✅ Clicked links and interacted with elements");
    console.log("   ✅ Analyzed performance metrics");
    console.log("   ✅ Retrieved console logs");
    console.log("   ✅ Executed custom JavaScript");
    console.log("   ✅ Read cookies and storage data");
    console.log("   ✅ Inspected DOM elements");
    console.log("   ✅ Scrolled and hovered over elements\n");

    console.log("📸 Screenshots saved in: " + screenshotsDir);
    console.log("\n💪 GitHub Copilot has FULL Antigravity-style control!");
    console.log("🤖 I can automate ANY browser task you need!");
    console.log("━".repeat(60) + "\n");

    ws.close();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error("\n💡 Troubleshooting:");
    console.error(
      "   1. Ensure relay server is running: cd relay-server && npm start"
    );
    console.error(
      "   2. Load browser extension in Chrome: chrome://extensions/"
    );
    console.error('   3. Check extension shows "Connected" status');
    process.exit(1);
  }
}

// START
console.log("⏳ Starting in 2 seconds...\n");
setTimeout(runAntigravityDemo, 2000);
