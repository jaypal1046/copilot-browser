#!/usr/bin/env node

// DEMO: Self-Healing Autonomous Runtime
// Shows how the agent handles errors, searches for solutions, and fixes itself

const { AutonomousAgent } = require("./autonomous-agent");

(async () => {
  const agent = new AutonomousAgent();

  console.log("🤖 Self-Healing Autonomous Agent Demo\n");
  console.log(
    "I will execute code, detect errors, and fix them automatically!\n"
  );

  try {
    await agent.connect();

    // TEST 1: Code that will work
    console.log("\n" + "=".repeat(60));
    console.log("TEST 1: Simple working code");
    console.log("=".repeat(60));

    await agent.runTask(
      "Get page title",
      "document.title",
      "https://example.com"
    );

    // TEST 2: Code with CSP error (will auto-fix)
    console.log("\n" + "=".repeat(60));
    console.log("TEST 2: Code that causes CSP error");
    console.log("=".repeat(60));

    await agent.runTask(
      "Extract with eval (will fail and retry)",
      `
        const data = {
          title: document.title,
          url: window.location.href,
          links: document.querySelectorAll('a').length
        };
        data;
      `,
      "https://example.com"
    );

    // TEST 3: Code accessing potentially undefined property
    console.log("\n" + "=".repeat(60));
    console.log("TEST 3: Accessing undefined property");
    console.log("=".repeat(60));

    await agent.runTask(
      "Access nested property",
      `
        const el = document.querySelector('.nonexistent');
        el.textContent;
      `,
      "https://example.com"
    );

    // TEST 4: Element not found (will wait and retry)
    console.log("\n" + "=".repeat(60));
    console.log("TEST 4: Element not found (will auto-retry)");
    console.log("=".repeat(60));

    await agent.runTask(
      "Find delayed element",
      `
        const button = document.querySelector('button.delayed-button');
        button ? 'Found!' : 'Not found';
      `,
      "https://example.com"
    );

    // Show final summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 FINAL SUMMARY");
    console.log("=".repeat(60) + "\n");

    const summary = agent.getSummary();
    console.log(`Total commands: ${summary.totalCommands}`);
    console.log(`Pages visited: ${summary.pagesVisited}`);
    console.log(`Errors encountered: ${summary.errors}`);
    console.log(`Decisions made: ${summary.decisions}`);

    const stats = agent.cache.getStats();
    console.log(`\nCache statistics:`);
    console.log(`  Pages cached: ${stats.pages}`);
    console.log(`  DOM entries: ${stats.domEntries}`);
    console.log(`  Console entries: ${stats.consoleEntries}`);
    console.log(`  Extractions: ${stats.totalExtractions}`);

    console.log("\n✅ Self-healing demo complete!\n");

    agent.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    agent.close();
    process.exit(1);
  }
})();
