// Copilot Helper - API for GitHub Copilot to interact with Browser Agent
// Usage: const agent = require('./copilot-helper'); await agent.navigate('https://example.com');

const vscode = require("vscode");

class BrowserAgent {
  constructor() {
    this.outputChannel = null;
    this._api = null;
  }

  /**
   * Get the extension API (lazy initialization)
   */
  _getAPI() {
    if (this._api) return this._api;

    const ext = vscode.extensions.getExtension(
      "browser-copilot-agent.browser-copilot-agent"
    );
    if (!ext) {
      throw new Error(
        "Browser Copilot Agent extension not found. Install it first."
      );
    }
    if (!ext.isActive) {
      throw new Error(
        "Browser Copilot Agent not active. Run 'Browser Agent: Connect' first."
      );
    }

    this._api = ext.exports.getAPI();
    return this._api;
  }

  /**
   * Initialize output channel for logging
   */
  _log(message) {
    if (!this.outputChannel) {
      this.outputChannel = vscode.window.createOutputChannel(
        "Browser Agent - Copilot"
      );
    }
    this.outputChannel.appendLine(
      `[${new Date().toISOString()}] ${message}`
    );
  }

  /**
   * Send a command to the browser
   */
  async _send(command, params = {}) {
    const api = this._getAPI();
    if (!api.isConnected()) {
      this._log("Not connected, attempting to connect...");
      await api.connect();
    }
    this._log(`→ ${command}: ${JSON.stringify(params).substring(0, 200)}`);
    const result = await api.sendCommand(command, params);
    this._log(`✓ ${command} completed`);
    return result;
  }

  // ========== Navigation ==========

  async navigate(url) {
    return this._send("navigate", { url });
  }

  // ========== Element Interaction ==========

  async click(selector) {
    return this._send("click", { selector });
  }

  async type(selector, text, clear = true) {
    return this._send("type", { selector, text, clear });
  }

  async hover(selector) {
    return this._send("hover", { selector });
  }

  async scroll(selectorOrPosition, smooth = true) {
    if (typeof selectorOrPosition === "string") {
      return this._send("scroll", { selector: selectorOrPosition, smooth });
    }
    return this._send("scroll", { position: selectorOrPosition, smooth });
  }

  async submit(selector) {
    return this._send("submit", { selector });
  }

  async highlight(selector, duration = 2000) {
    return this._send("highlight", { selector, duration });
  }

  // ========== Smart Selectors ==========

  async findByText(text, options = {}) {
    return this._send("findByText", { text, ...options });
  }

  async findByRole(role, options = {}) {
    return this._send("findByRole", { role, ...options });
  }

  async findByLabel(label) {
    return this._send("findByLabel", { label });
  }

  async findByPlaceholder(placeholder) {
    return this._send("findByPlaceholder", { placeholder });
  }

  async clickByText(text) {
    return this._send("findByText", { text, click: true });
  }

  async clickByRole(role, name) {
    return this._send("findByRole", { role, name, click: true });
  }

  // ========== Wait Commands ==========

  async waitForSelector(selector, timeout = 10000) {
    return this._send("waitForSelector", { selector, timeout });
  }

  async waitForText(text, timeout = 10000) {
    return this._send("waitForText", { text, timeout });
  }

  // ========== Data Retrieval ==========

  async getConsole(limit = 50) {
    return this._send("get_console", { limit });
  }

  async getDOM(selector) {
    return this._send("get_dom", { selector });
  }

  async getElement(selector) {
    return this._send("get_element", { selector });
  }

  async screenshot(format = "png") {
    return this._send("get_screenshot", { format });
  }

  async getPerformance() {
    return this._send("get_performance", {});
  }

  async getCookies(url) {
    return this._send("get_cookies", { url });
  }

  async getStorage(type = "local") {
    return this._send("get_storage", { type });
  }

  async getNetwork(limit = 50, filter) {
    return this._send("get_network", { limit, filter });
  }

  // ========== Page Intelligence ==========

  async summarizePage() {
    return this._send("summarizePage", {});
  }

  async getAccessibility() {
    return this._send("getAccessibility", {});
  }

  async visualSnapshot(selector) {
    return this._send("visual_snapshot", { selector });
  }

  async visualDiff(snapshot1, snapshot2) {
    const diffs = [];
    if (snapshot1.textHash !== snapshot2.textHash) {
      diffs.push({ type: "text_changed", detail: "Page text content changed" });
    }
    if (snapshot1.totalElements !== snapshot2.totalElements) {
      diffs.push({
        type: "element_count_changed",
        before: snapshot1.totalElements,
        after: snapshot2.totalElements,
      });
    }
    // Compare element types
    const allTags = new Set([
      ...Object.keys(snapshot1.elements || {}),
      ...Object.keys(snapshot2.elements || {}),
    ]);
    for (const tag of allTags) {
      const before = snapshot1.elements?.[tag] || 0;
      const after = snapshot2.elements?.[tag] || 0;
      if (before !== after) {
        diffs.push({ type: "element_diff", tag, before, after });
      }
    }
    // Compare headings
    const h1 = JSON.stringify(snapshot1.headings || []);
    const h2 = JSON.stringify(snapshot2.headings || []);
    if (h1 !== h2) {
      diffs.push({ type: "headings_changed" });
    }
    return {
      hasDifferences: diffs.length > 0,
      diffs,
      summary: `${diffs.length} difference(s) detected`,
    };
  }

  // ========== JavaScript Execution ==========

  async executeJS(code) {
    return this._send("execute_js", { code });
  }

  // ========== Tab Management ==========

  async listTabs() {
    return this._send("tab_list", {});
  }

  async openTab(url, active = true) {
    return this._send("tab_open", { url, active });
  }

  async closeTab(tabId) {
    return this._send("tab_close", { tabId });
  }

  async switchTab(tabId) {
    return this._send("tab_switch", { tabId });
  }

  async reloadTab(tabId, bypassCache = false) {
    return this._send("tab_reload", { tabId, bypassCache });
  }

  // ========== Keyboard & Mouse ==========

  async keyPress(key, selector, modifiers) {
    return this._send("keyPress", { key, selector, modifiers });
  }

  async keyCombo(keys, selector) {
    return this._send("keyCombo", { keys, selector });
  }

  async dragAndDrop(sourceSelector, targetSelector) {
    return this._send("dragAndDrop", { sourceSelector, targetSelector });
  }

  async selectOption(selector, options) {
    return this._send("selectOption", { selector, ...options });
  }

  // ========== iframe ==========

  async executeInIframe(iframeSelector, command, commandParams) {
    return this._send("executeInIframe", {
      iframeSelector,
      command,
      commandParams,
    });
  }

  // ========== Session Recording ==========

  async startRecording() {
    return this._send("start_recording", {});
  }

  async stopRecording() {
    return this._send("stop_recording", {});
  }

  async getRecording() {
    return this._send("get_recording", {});
  }

  // ========== Stats ==========

  async getStats() {
    return this._send("get_stats", {});
  }

  // ========== High-Level Helpers ==========

  /**
   * Fill a form by field label → value mapping
   * @example await agent.fillForm({ 'Email': 'test@example.com', 'Password': 'secret' })
   */
  async fillForm(fields) {
    const results = [];
    for (const [label, value] of Object.entries(fields)) {
      try {
        const found = await this.findByLabel(label);
        if (found) {
          await this.type(
            found.id ? `#${found.id}` : `[name="${found.name}"]`,
            value,
            true
          );
          results.push({ label, success: true });
        }
      } catch (error) {
        results.push({ label, success: false, error: error.message });
      }
    }
    return results;
  }

  /**
   * Test a page: navigate, wait for load, summarize, check accessibility
   * @example await agent.testPage('https://example.com')
   */
  async testPage(url) {
    this._log(`Testing page: ${url}`);

    const nav = await this.navigate(url);
    const summary = await this.summarizePage();
    const a11y = await this.getAccessibility();
    const perf = await this.getPerformance();

    return {
      navigation: nav,
      summary: {
        title: summary.title,
        links: summary.stats?.totalLinks,
        forms: summary.stats?.totalForms,
        buttons: summary.stats?.totalButtons,
      },
      accessibility: {
        errors: a11y.issueCount?.errors,
        warnings: a11y.issueCount?.warnings,
        issues: a11y.issues?.slice(0, 10),
      },
      performance: perf,
    };
  }

  /**
   * Record a flow: start recording, execute actions, stop and return steps
   * @example const flow = await agent.recordFlow(async (a) => { await a.navigate('...'); await a.click('...'); })
   */
  async recordFlow(fn) {
    await this.startRecording();
    try {
      await fn(this);
    } finally {
      await this.stopRecording();
    }
    return this.getRecording();
  }
}

module.exports = new BrowserAgent();
