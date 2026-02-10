// Test Script for Browser Copilot Integration
// Run this to verify the system works end-to-end

const { getBrowserAgent } = require("./copilot-helper");

async function runTests() {
  console.log("🧪 Starting Browser Copilot Integration Tests...\n");

  const browser = getBrowserAgent();

  try {
    // Test 1: Navigate to a page
    console.log("Test 1: Navigation");
    await browser.navigate("https://example.com");
    console.log("✓ Navigation successful\n");

    // Wait a bit for page to load
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Test 2: Get page title
    console.log("Test 2: Execute JavaScript");
    const title = await browser.executeJS("document.title");
    console.log(`✓ Page title: ${title}\n`);

    // Test 3: Get DOM
    console.log("Test 3: Get DOM Structure");
    const dom = await browser.getDOM("h1");
    console.log(`✓ Found heading: ${dom.text}\n`);

    // Test 4: Get console logs
    console.log("Test 4: Get Console Logs");
    const logs = await browser.getConsole();
    console.log(`✓ Retrieved ${logs.length} console logs\n`);

    // Test 5: Get performance
    console.log("Test 5: Get Performance Metrics");
    const perf = await browser.getPerformance();
    console.log(`✓ Load time: ${perf.navigation?.loadComplete || "N/A"}ms\n`);

    // Test 6: Find element by text
    console.log("Test 6: Find Element");
    const element = await browser.findElement("Example");
    console.log(`✓ Found element: ${element?.tag}\n`);

    // Test 7: Click element
    console.log("Test 7: Click Element");
    await browser.click("a");
    console.log("✓ Clicked link\n");

    console.log("🎉 All tests passed!");
    console.log("\n📊 Test Summary:");
    console.log("- Navigation: ✓");
    console.log("- JavaScript Execution: ✓");
    console.log("- DOM Extraction: ✓");
    console.log("- Console Logs: ✓");
    console.log("- Performance Metrics: ✓");
    console.log("- Element Finding: ✓");
    console.log("- Click Interaction: ✓");

    return { success: true, message: "All tests passed!" };
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    browser.log("Test failed", error);
    return { success: false, error: error.message };
  }
}

// Export for use
module.exports = { runTests };
