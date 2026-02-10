// Copilot Helper Module
// This provides easy-to-use functions for GitHub Copilot to control the browser

const vscode = require("vscode");

/**
 * Browser Agent Helper for GitHub Copilot
 * Use these functions to control the browser programmatically
 */
class BrowserAgent {
  constructor() {
    this.outputChannel = vscode.window.createOutputChannel(
      "Copilot Browser Agent"
    );
  }

  /**
   * Log output that Copilot can see
   */
  log(message, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    const output = `[${timestamp}] ${message}`;
    this.outputChannel.appendLine(output);
    if (data) {
      this.outputChannel.appendLine(JSON.stringify(data, null, 2));
    }
    this.outputChannel.show();
    return output;
  }

  /**
   * Send a command to the browser and get the result
   */
  async executeCommand(command, params = {}) {
    this.log(`Executing: ${command}`, params);

    try {
      // Get the extension
      const ext = vscode.extensions.getExtension(
        "browser-copilot.browser-copilot-agent"
      );
      if (!ext) {
        throw new Error("Browser Agent extension not found");
      }

      // Activate if not active
      if (!ext.isActive) {
        await ext.activate();
      }

      const api = ext.exports;

      // Check connection
      const status = api.getConnectionStatus();
      if (!status.isConnected) {
        throw new Error(
          "Not connected to browser. Run: Browser Agent: Connect"
        );
      }

      // Execute command
      const result = await api.sendCommand(command, params);

      this.log(`✓ Success: ${command}`, result.data);
      return result;
    } catch (error) {
      this.log(`✗ Error: ${error.message}`);
      throw error;
    }
  }

  // Navigation methods
  async navigate(url) {
    return await this.executeCommand("navigate", { url });
  }

  async refresh() {
    return await this.executeCommand("navigate", { url: "location.reload()" });
  }

  // Interaction methods
  async click(selector) {
    return await this.executeCommand("click", { selector });
  }

  async type(selector, text, clear = true) {
    return await this.executeCommand("type", { selector, text, clear });
  }

  async hover(selector) {
    return await this.executeCommand("hover", { selector });
  }

  async scroll(selector) {
    return await this.executeCommand("scroll", { selector });
  }

  async submit(selector) {
    return await this.executeCommand("submit", { selector });
  }

  // Data extraction methods
  async getConsole(level = null, limit = 50) {
    const result = await this.executeCommand("get_console", { level, limit });
    return result.data.logs;
  }

  async getDOM(selector = null) {
    const result = await this.executeCommand("get_dom", { selector });
    return result.data;
  }

  async getElement(selector) {
    const result = await this.executeCommand("get_element", { selector });
    return result.data;
  }

  async getPerformance() {
    const result = await this.executeCommand("get_performance", {});
    return result.data;
  }

  async getCookies(url = null) {
    const result = await this.executeCommand("get_cookies", { url });
    return result.data.cookies;
  }

  async getStorage(type = "local") {
    const result = await this.executeCommand("get_storage", { type });
    return result.data;
  }

  async screenshot() {
    const result = await this.executeCommand("get_screenshot", {
      format: "png",
    });
    return result.data.screenshot;
  }

  // JavaScript execution
  async executeJS(code) {
    const result = await this.executeCommand("execute_js", { code });
    return result.data.result;
  }

  // High-level helpers
  async fillForm(formData) {
    this.log("Filling form", formData);
    for (const [selector, value] of Object.entries(formData)) {
      await this.type(selector, value);
    }
  }

  async testPage(url) {
    this.log(`Testing page: ${url}`);
    await this.navigate(url);

    const logs = await this.getConsole("error");
    const perf = await this.getPerformance();

    return {
      errors: logs.filter((l) => l.level === "error"),
      performance: perf,
      summary: `Found ${logs.length} errors, Load time: ${perf.navigation?.loadComplete}ms`,
    };
  }

  async findElement(text) {
    const code = `
      const elements = Array.from(document.querySelectorAll('*'));
      const found = elements.find(el => el.textContent.includes('${text}'));
      return found ? {
        tag: found.tagName,
        id: found.id,
        class: found.className,
        text: found.textContent.substring(0, 100)
      } : null;
    `;
    return await this.executeJS(code);
  }
}

// Export singleton instance
let browserAgent = null;

function getBrowserAgent() {
  if (!browserAgent) {
    browserAgent = new BrowserAgent();
  }
  return browserAgent;
}

module.exports = {
  BrowserAgent,
  getBrowserAgent,
};
