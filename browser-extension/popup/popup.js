// Popup script for Copilot Browser - Enhanced v2.0

document.addEventListener("DOMContentLoaded", async () => {
  // DOM elements
  const statusCard = document.getElementById("status-card");
  const statusDot = document.getElementById("status-dot");
  const statusPulse = document.getElementById("status-pulse");
  const statusText = document.getElementById("status-text");
  const statusDetail = document.getElementById("status-detail");
  const clientIdElement = document.getElementById("client-id");
  const latencyElement = document.getElementById("latency");
  const connectBtn = document.getElementById("connect-btn");
  const disconnectBtn = document.getElementById("disconnect-btn");
  const logContainer = document.getElementById("log-container");
  const clearLogBtn = document.getElementById("clear-log");

  // Stats elements
  const statCommands = document.getElementById("stat-commands");
  const statSuccess = document.getElementById("stat-success");
  const statNetwork = document.getElementById("stat-network");
  const statConsole = document.getElementById("stat-console");

  // Quick action buttons
  const btnScreenshot = document.getElementById("btn-screenshot");
  const btnSummarize = document.getElementById("btn-summarize");
  const btnAccessibility = document.getElementById("btn-accessibility");
  const btnConsole = document.getElementById("btn-console");

  let latencyPingStart = 0;

  // =========== Status Updates ===========
  async function updateStatus() {
    try {
      const status = await chrome.runtime.sendMessage({ action: "getStatus" });

      if (status.connected) {
        statusCard.className = "status-card connected";
        statusDot.className = "status-dot connected";
        statusPulse.className = "status-dot-pulse active";
        statusText.textContent = "Connected";
        statusDetail.textContent = "Relay server active";
        clientIdElement.textContent = status.clientId
          ? status.clientId.substring(0, 12) + "…"
          : "—";
        clientIdElement.title = status.clientId || "";
        connectBtn.disabled = true;
        disconnectBtn.disabled = false;

        // Update stats
        if (status.stats) {
          statCommands.textContent = formatNumber(status.stats.total || 0);
          statSuccess.textContent = formatNumber(status.stats.success || 0);
        }
        statNetwork.textContent = formatNumber(status.networkCount || 0);
        statConsole.textContent = formatNumber(status.consoleCount || 0);

        // Measure latency
        measureLatency();
      } else {
        statusCard.className = "status-card disconnected";
        statusDot.className = "status-dot";
        statusPulse.className = "status-dot-pulse";
        statusText.textContent = "Disconnected";
        statusDetail.textContent = "Click Connect to start";
        clientIdElement.textContent = "—";
        latencyElement.textContent = "—";
        connectBtn.disabled = false;
        disconnectBtn.disabled = true;
      }
    } catch (error) {
      // Extension context may be invalidated
      statusText.textContent = "Error";
      statusDetail.textContent = error.message.substring(0, 40);
    }
  }

  function measureLatency() {
    latencyPingStart = performance.now();
    chrome.runtime
      .sendMessage({ action: "getStatus" })
      .then(() => {
        const latency = Math.round(performance.now() - latencyPingStart);
        latencyElement.textContent = `${latency}ms`;
        latencyElement.style.color =
          latency < 50
            ? "var(--accent-green)"
            : latency < 150
              ? "var(--accent-amber)"
              : "var(--accent-red)";
      })
      .catch(() => { });
  }

  function formatNumber(num) {
    if (num >= 1000) return (num / 1000).toFixed(1) + "k";
    return num.toString();
  }

  // =========== Connection ===========
  connectBtn.addEventListener("click", async () => {
    addLog("Connecting to relay server...", "info");
    connectBtn.disabled = true;
    try {
      const response = await chrome.runtime.sendMessage({ action: "connect" });
      if (response.success) {
        addLog("Connection initiated", "success");
        setTimeout(updateStatus, 500);
      }
    } catch (error) {
      addLog(`Connection error: ${error.message}`, "error");
      connectBtn.disabled = false;
    }
  });

  disconnectBtn.addEventListener("click", async () => {
    addLog("Disconnecting...", "info");
    try {
      const response = await chrome.runtime.sendMessage({ action: "disconnect" });
      if (response.success) {
        addLog("Disconnected", "info");
        setTimeout(updateStatus, 500);
      }
    } catch (error) {
      addLog(`Error: ${error.message}`, "error");
    }
  });

  // =========== Quick Actions ===========
  btnScreenshot.addEventListener("click", () => {
    addLog("Screenshot requested via VS Code", "info");
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
          if (dataUrl) {
            addLog("✓ Screenshot captured", "success");
            // Open in new tab
            chrome.tabs.create({ url: dataUrl });
          } else {
            addLog("✗ Screenshot failed", "error");
          }
        });
      }
    });
  });

  btnSummarize.addEventListener("click", async () => {
    addLog("Summarizing page...", "info");
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const result = await chrome.tabs.sendMessage(tab.id, {
        type: "execute",
        command: "summarizePage",
        params: {},
      });
      if (result && result.title) {
        addLog(`✓ ${result.title}`, "success");
        addLog(`  ${result.stats.totalLinks} links, ${result.stats.totalForms} forms, ${result.stats.totalButtons} buttons`, "info");
      }
    } catch (error) {
      addLog(`✗ ${error.message}`, "error");
    }
  });

  btnAccessibility.addEventListener("click", async () => {
    addLog("Running accessibility audit...", "info");
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const result = await chrome.tabs.sendMessage(tab.id, {
        type: "execute",
        command: "getAccessibility",
        params: {},
      });
      if (result && result.issueCount) {
        const total = result.issueCount.errors + result.issueCount.warnings;
        if (total === 0) {
          addLog("✓ No accessibility issues found!", "success");
        } else {
          addLog(`⚠ ${result.issueCount.errors} errors, ${result.issueCount.warnings} warnings`, "error");
          result.issues.forEach((issue) => {
            addLog(`  [${issue.rule}] ${issue.message}`, issue.severity === "error" ? "error" : "info");
          });
        }
      }
    } catch (error) {
      addLog(`✗ ${error.message}`, "error");
    }
  });

  btnConsole.addEventListener("click", async () => {
    addLog("Fetching console logs...", "info");
    try {
      const status = await chrome.runtime.sendMessage({ action: "getStatus" });
      addLog(`Console buffer: ${status.consoleCount || 0} entries`, "info");
      addLog("View full logs in VS Code output panel", "info");
    } catch (error) {
      addLog(`✗ ${error.message}`, "error");
    }
  });

  // =========== Activity Log ===========
  clearLogBtn.addEventListener("click", () => {
    logContainer.innerHTML = '<div class="log-empty">No activity yet</div>';
  });

  function addLog(message, level = "info") {
    // Remove empty message
    const empty = logContainer.querySelector(".log-empty");
    if (empty) empty.remove();

    const entry = document.createElement("div");
    entry.className = `log-entry ${level}`;
    const time = new Date().toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    entry.textContent = `[${time}] ${message}`;
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;

    // Keep only last 30 entries
    while (logContainer.children.length > 30) {
      logContainer.removeChild(logContainer.firstChild);
    }
  }

  // =========== Init ===========
  updateStatus();
  setInterval(updateStatus, 2000);
  addLog("Popup opened", "info");
});
