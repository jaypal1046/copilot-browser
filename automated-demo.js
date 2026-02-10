#!/usr/bin/env node

// Full Automated Browser Control Demo
// GitHub Copilot takes FULL control - no user interaction needed!

const WebSocket = require("ws");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("🤖 GitHub Copilot Browser Automation System\n");
console.log("═══════════════════════════════════════════════\n");

let ws = null;
let commandQueue = [];
let processing = false;

// Connect to relay
function connect() {
  return new Promise((resolve, reject) => {
    console.log("📡 Connecting to browser...");
    ws = new WebSocket("ws://localhost:8080");

    ws.on("open", () => {
      ws.send(
        JSON.stringify({
          type: "register",
          clientType: "vscode",
          metadata: { copilot: true, automated: true },
        })
      );
    });

    ws.on("message", (data) => {
      const message = JSON.parse(data.toString());

      if (message.type === "registered") {
        console.log("✅ Connected to browser!\n");
        resolve();
      }

      if (message.type === "response") {
        handleResponse(message);
      }
    });

    ws.on("error", reject);
  });
}

// Send command and wait for response
function sendCommand(command, params, description) {
  return new Promise((resolve) => {
    const id = `cmd-${Date.now()}`;

    console.log(`\n🔧 ${description}`);
    console.log(`   Command: ${command}`);

    const handler = (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === "response" && message.id === id) {
        ws.removeListener("message", handler);

        if (message.success) {
          console.log(`   ✅ Success!`);
          displayResult(message.data);
        } else {
          console.log(`   ❌ Failed: ${message.error?.message}`);
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

function handleResponse(message) {
  // Handle async responses
}

function displayResult(data) {
  if (data.url) {
    console.log(`   📍 URL: ${data.url}`);
  }
  if (data.title) {
    console.log(`   📄 Title: ${data.title}`);
  }
  if (data.result !== undefined) {
    console.log(`   📦 Result: ${JSON.stringify(data.result)}`);
  }
  if (data.text) {
    console.log(`   📝 Text: ${data.text.substring(0, 100)}...`);
  }
  if (data.logs) {
    console.log(`   📋 Console logs: ${data.logs.length} entries`);
    data.logs.slice(0, 3).forEach((log) => {
      console.log(`      [${log.level}] ${log.message.substring(0, 60)}`);
    });
  }
  if (data.navigation) {
    console.log(`   ⚡ Performance:`);
    console.log(`      Load: ${data.navigation.loadComplete}ms`);
    console.log(`      DOM: ${data.navigation.domContentLoaded}ms`);
  }
  if (data.tagName) {
    console.log(`   🎯 Element: <${data.tagName}>`);
    console.log(`   👁️  Visible: ${data.visible}`);
  }
}

// Sleep function
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Main automation flow
async function runAutomation() {
  try {
    await connect();

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    console.log("🎬 STARTING AUTOMATED BROWSER CONTROL\n");
    console.log("⏸️  Sit back and watch - I'm in control now!\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    await sleep(1000);

    // Step 1: Navigate to example.com
    await sendCommand(
      "navigate",
      { url: "https://example.com" },
      "Step 1: Opening example.com in browser"
    );
    await sleep(2000);

    // Step 2: Get page title
    await sendCommand(
      "execute_js",
      { code: "document.title" },
      "Step 2: Reading page title"
    );
    await sleep(1000);

    // Step 3: Get main heading
    await sendCommand(
      "get_dom",
      { selector: "h1" },
      "Step 3: Extracting main heading"
    );
    await sleep(1000);

    // Step 4: Get all paragraphs
    await sendCommand(
      "execute_js",
      {
        code: 'Array.from(document.querySelectorAll("p")).map(p => p.textContent)',
      },
      "Step 4: Getting all paragraphs"
    );
    await sleep(1000);

    // Step 5: Get all links
    await sendCommand(
      "execute_js",
      {
        code: 'Array.from(document.querySelectorAll("a")).map(a => ({text: a.textContent, href: a.href}))',
      },
      "Step 5: Extracting all links"
    );
    await sleep(1000);

    // Step 6: Check element visibility
    await sendCommand(
      "get_element",
      { selector: "h1" },
      "Step 6: Checking if heading is visible"
    );
    await sleep(1000);

    // Step 7: Get console logs
    await sendCommand(
      "get_console",
      { limit: 10 },
      "Step 7: Retrieving console logs"
    );
    await sleep(1000);

    // Step 8: Get performance metrics
    await sendCommand(
      "get_performance",
      {},
      "Step 8: Analyzing page performance"
    );
    await sleep(1000);

    // Step 9: Click the link
    await sendCommand(
      "click",
      { selector: "a" },
      'Step 9: Clicking "More information" link'
    );
    await sleep(2000);

    // Step 10: Get new page info
    await sendCommand(
      "execute_js",
      { code: "window.location.href" },
      "Step 10: Checking new page URL"
    );
    await sleep(1000);

    // Step 11: Navigate to Google
    await sendCommand(
      "navigate",
      { url: "https://www.google.com" },
      "Step 11: Opening Google.com"
    );
    await sleep(3000);

    // Step 12: Get page title
    await sendCommand(
      "execute_js",
      { code: "document.title" },
      "Step 12: Reading Google page title"
    );
    await sleep(1000);

    // Step 13: Count elements
    await sendCommand(
      "execute_js",
      { code: 'document.querySelectorAll("*").length' },
      "Step 13: Counting total DOM elements"
    );
    await sleep(1000);

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    console.log("🎉 AUTOMATION COMPLETE!\n");
    console.log("📊 Summary:");
    console.log("   ✅ Navigated to 2 websites");
    console.log("   ✅ Extracted data from pages");
    console.log("   ✅ Clicked links automatically");
    console.log("   ✅ Analyzed performance");
    console.log("   ✅ Retrieved console logs");
    console.log("   ✅ Counted DOM elements\n");
    console.log("💪 GitHub Copilot has FULL browser control!\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    ws.close();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error("\n💡 Make sure:");
    console.error("   1. Relay server is running (npm start)");
    console.error("   2. Browser extension is loaded and connected");
    process.exit(1);
  }
}

// Start
runAutomation();
