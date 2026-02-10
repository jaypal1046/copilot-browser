// Popup script for Browser Copilot Agent

document.addEventListener("DOMContentLoaded", async () => {
  const statusIndicator = document.getElementById("status-indicator");
  const statusText = document.getElementById("status-text");
  const clientIdElement = document.getElementById("client-id");
  const connectBtn = document.getElementById("connect-btn");
  const disconnectBtn = document.getElementById("disconnect-btn");
  const logContainer = document.getElementById("log-container");

  // Get initial status
  updateStatus();

  // Update status every 2 seconds
  setInterval(updateStatus, 2000);

  // Connect button
  connectBtn.addEventListener("click", async () => {
    addLog("Connecting to relay server...");
    const response = await chrome.runtime.sendMessage({ action: "connect" });
    if (response.success) {
      addLog("Connection initiated");
      setTimeout(updateStatus, 500);
    }
  });

  // Disconnect button
  disconnectBtn.addEventListener("click", async () => {
    addLog("Disconnecting...");
    const response = await chrome.runtime.sendMessage({ action: "disconnect" });
    if (response.success) {
      addLog("Disconnected");
      setTimeout(updateStatus, 500);
    }
  });

  async function updateStatus() {
    const status = await chrome.runtime.sendMessage({ action: "getStatus" });

    if (status.connected) {
      statusIndicator.className = "status-indicator connected";
      statusText.textContent = "Connected";
      clientIdElement.textContent = status.clientId || "-";
      connectBtn.disabled = true;
      disconnectBtn.disabled = false;
    } else {
      statusIndicator.className = "status-indicator disconnected";
      statusText.textContent = "Disconnected";
      clientIdElement.textContent = "-";
      connectBtn.disabled = false;
      disconnectBtn.disabled = true;
    }
  }

  function addLog(message) {
    const entry = document.createElement("div");
    entry.className = "log-entry";
    const time = new Date().toLocaleTimeString();
    entry.textContent = `[${time}] ${message}`;
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;

    // Keep only last 20 entries
    while (logContainer.children.length > 20) {
      logContainer.removeChild(logContainer.firstChild);
    }
  }
});
