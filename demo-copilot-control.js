#!/usr/bin/env node

// Live Demo: GitHub Copilot controlling your browser!

const WebSocket = require("ws");

console.log("🤖 GitHub Copilot taking control of your browser...\n");

const ws = new WebSocket("ws://localhost:8080");

ws.on("open", () => {
  // Register as VS Code
  ws.send(
    JSON.stringify({
      type: "register",
      clientType: "vscode",
      metadata: { copilot: true },
    })
  );

  setTimeout(() => runDemo(), 1500);
});

async function runDemo() {
  console.log("📋 Running automated browser tests:\n");

  // Test 1: Navigate to example.com
  console.log("1️⃣  Navigating to example.com...");
  sendCommand("navigate", { url: "https://example.com" });

  setTimeout(() => {
    // Test 2: Get page title
    console.log("2️⃣  Getting page title...");
    sendCommand("execute_js", { code: "document.title" });
  }, 3000);

  setTimeout(() => {
    // Test 3: Get page heading
    console.log("3️⃣  Getting main heading...");
    sendCommand("get_dom", { selector: "h1" });
  }, 5000);

  setTimeout(() => {
    // Test 4: Click a link
    console.log('4️⃣  Clicking "More information" link...');
    sendCommand("click", { selector: "a" });
  }, 7000);

  setTimeout(() => {
    // Test 5: Get performance metrics
    console.log("5️⃣  Analyzing page performance...");
    sendCommand("get_performance", {});
  }, 9000);

  setTimeout(() => {
    console.log(
      "\n✅ Demo complete! GitHub Copilot successfully controlled your browser!\n"
    );
    ws.close();
    process.exit(0);
  }, 12000);
}

function sendCommand(command, params) {
  ws.send(
    JSON.stringify({
      type: "command",
      id: `demo-${Date.now()}`,
      command,
      params,
      timestamp: Date.now(),
    })
  );
}

ws.on("message", (data) => {
  const message = JSON.parse(data.toString());

  if (message.type === "response" && message.success) {
    console.log("   ✅ Response received:");

    if (message.data.url) {
      console.log(`      URL: ${message.data.url}`);
      console.log(`      Title: ${message.data.title}`);
    }

    if (message.data.result !== undefined) {
      console.log(`      Result: ${message.data.result}`);
    }

    if (message.data.html) {
      console.log(`      HTML: ${message.data.html.substring(0, 80)}...`);
    }

    if (message.data.text) {
      console.log(`      Text: ${message.data.text}`);
    }

    if (message.data.navigation) {
      console.log(`      Load time: ${message.data.navigation.loadComplete}ms`);
      console.log(
        `      DOM Content Loaded: ${message.data.navigation.domContentLoaded}ms`
      );
    }

    console.log("");
  }
});

ws.on("error", (error) => {
  console.error("❌ Error:", error.message);
  process.exit(1);
});
