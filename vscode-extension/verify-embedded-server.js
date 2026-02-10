const { startServer } = require('../relay-server/index.js');
const path = require('path');
const fs = require('fs');

console.log("🧪 Verifying Embedded Server Start...");

try {
    const server = startServer({
        launchBrowser: true,
        platform: 'win32', // Simulate windows
        port: 8081 // Use different port to avoid conflict if other is running
    });

    console.log("✅ Server function returned instance successfully.");

    // Wait a bit to see logs
    setTimeout(() => {
        console.log("✅ Verification complete. Shutting down.");
        if (server.wss) server.wss.close();
        if (server.server) server.server.close();
        process.exit(0);
    }, 5000);

} catch (e) {
    console.error("❌ Failed to start server:", e);
    process.exit(1);
}
