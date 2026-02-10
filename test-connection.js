#!/usr/bin/env node

// Quick Connection Test Script
// Tests if all three components can communicate

const WebSocket = require("ws");

console.log("🧪 Testing Browser-Copilot Integration...\n");

// Test 1: Connect to relay server
console.log("Test 1: Connecting to relay server...");
const ws = new WebSocket("ws://localhost:8080");

ws.on("open", () => {
  console.log("✅ Connected to relay server on localhost:8080\n");

  // Register as test client
  ws.send(
    JSON.stringify({
      type: "register",
      clientType: "vscode",
      metadata: { test: true },
    })
  );

  // Test 2: Send a ping
  setTimeout(() => {
    console.log("Test 2: Sending ping command...");
    ws.send(
      JSON.stringify({
        type: "command",
        id: "test-1",
        command: "get_console",
        params: { limit: 10 },
        timestamp: Date.now(),
      })
    );
  }, 1000);

  // Test 3: Wait for response
  setTimeout(() => {
    console.log("\nTest 3: Waiting for browser response...");
    console.log("(If browser extension is connected, it should respond)\n");
  }, 2000);

  // Close after 5 seconds
  setTimeout(() => {
    console.log("📊 Test Summary:");
    console.log("✅ Relay Server: Working");
    console.log("✅ WebSocket Connection: Working");
    console.log("⏳ Browser Extension: Check if response received above");
    console.log("\nIf you see a response message, all systems are GO! 🚀\n");
    ws.close();
    process.exit(0);
  }, 5000);
});

ws.on("message", (data) => {
  const message = JSON.parse(data.toString());
  console.log("📨 Received:", message.type);

  if (message.type === "registered") {
    console.log(`✅ Registered with Client ID: ${message.clientId}`);
    console.log(
      `✅ Connected clients - Browser: ${message.connectedClients.browser}, VS Code: ${message.connectedClients.vscode}\n`
    );
  }

  if (message.type === "response") {
    console.log("✅ Browser responded to command!");
    console.log(`   Command ID: ${message.id}`);
    console.log(`   Success: ${message.success}`);
    if (message.data) {
      console.log(
        `   Data: ${JSON.stringify(message.data).substring(0, 100)}...`
      );
    }
  }

  if (message.type === "status") {
    console.log(`📊 Server Status - Total clients: ${message.clients.total}`);
  }
});

ws.on("error", (error) => {
  console.error("❌ Connection error:", error.message);
  console.error("\n💡 Make sure relay server is running: npm start");
  process.exit(1);
});

ws.on("close", () => {
  console.log("Connection closed.");
});
