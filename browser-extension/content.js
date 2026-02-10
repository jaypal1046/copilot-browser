// Content Script for Browser Copilot Agent
// Runs in the context of web pages to execute commands

console.log("Browser Copilot Agent content script loaded");

// Intercept console logs
const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  info: console.info.bind(console),
  debug: console.debug.bind(console),
};

function interceptConsole() {
  ["log", "warn", "error", "info", "debug"].forEach((level) => {
    console[level] = function (...args) {
      // Call original
      originalConsole[level](...args);

      // Send to background
      chrome.runtime
        .sendMessage({
          type: "console",
          data: {
            level,
            message: args
              .map((arg) => {
                try {
                  return typeof arg === "object"
                    ? JSON.stringify(arg)
                    : String(arg);
                } catch {
                  return String(arg);
                }
              })
              .join(" "),
            timestamp: Date.now(),
            url: window.location.href,
          },
        })
        .catch(() => { });
    };
  });
}

interceptConsole();

// ============================================
// Element Highlight Overlay
// ============================================
let highlightOverlay = null;

function createHighlightOverlay() {
  if (highlightOverlay) return highlightOverlay;
  highlightOverlay = document.createElement("div");
  highlightOverlay.id = "__copilot_highlight__";
  highlightOverlay.style.cssText = `
    position: fixed; pointer-events: none; z-index: 2147483647;
    border: 2px solid #4A90FF; background: rgba(74, 144, 255, 0.12);
    border-radius: 3px; transition: all 0.15s ease;
    box-shadow: 0 0 0 1px rgba(74, 144, 255, 0.3);
    display: none;
  `;
  document.documentElement.appendChild(highlightOverlay);
  return highlightOverlay;
}

function highlightElement(element, duration = 2000) {
  const overlay = createHighlightOverlay();
  const rect = element.getBoundingClientRect();
  overlay.style.top = rect.top + "px";
  overlay.style.left = rect.left + "px";
  overlay.style.width = rect.width + "px";
  overlay.style.height = rect.height + "px";
  overlay.style.display = "block";

  if (duration > 0) {
    setTimeout(() => {
      overlay.style.display = "none";
    }, duration);
  }
}

// ============================================
// Smart Element Finding Utilities
// ============================================

function findByText(text, tag = "*") {
  const elements = document.querySelectorAll(tag);
  for (const el of elements) {
    const directText = Array.from(el.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent.trim())
      .join(" ");
    if (directText && directText.toLowerCase().includes(text.toLowerCase())) {
      return el;
    }
  }
  // Fallback: any element containing text
  for (const el of elements) {
    if (
      el.textContent &&
      el.textContent.trim().toLowerCase().includes(text.toLowerCase())
    ) {
      // Prefer the deepest match
      const children = el.querySelectorAll("*");
      for (const child of children) {
        const ct = Array.from(child.childNodes)
          .filter((n) => n.nodeType === Node.TEXT_NODE)
          .map((n) => n.textContent.trim())
          .join(" ");
        if (ct && ct.toLowerCase().includes(text.toLowerCase())) {
          return child;
        }
      }
      return el;
    }
  }
  return null;
}

function findByRole(role, options = {}) {
  const selector = `[role="${role}"]`;
  let elements = Array.from(document.querySelectorAll(selector));

  // Also include implicit roles
  const implicitRoleMap = {
    button: "button, input[type='button'], input[type='submit'], input[type='reset']",
    link: "a[href]",
    textbox: "input[type='text'], input[type='email'], input[type='password'], input[type='search'], input[type='tel'], input[type='url'], textarea",
    checkbox: "input[type='checkbox']",
    radio: "input[type='radio']",
    heading: "h1, h2, h3, h4, h5, h6",
    list: "ul, ol",
    listitem: "li",
    img: "img[alt]",
    navigation: "nav",
    main: "main",
    form: "form",
    table: "table",
    row: "tr",
    cell: "td, th",
  };

  if (implicitRoleMap[role]) {
    const implicit = Array.from(
      document.querySelectorAll(implicitRoleMap[role])
    );
    elements = [...new Set([...elements, ...implicit])];
  }

  // Filter by name if provided
  if (options.name) {
    elements = elements.filter((el) => {
      const label =
        el.getAttribute("aria-label") ||
        el.textContent?.trim() ||
        el.getAttribute("title") ||
        el.getAttribute("placeholder") ||
        "";
      return label.toLowerCase().includes(options.name.toLowerCase());
    });
  }

  return elements;
}

function findByLabel(labelText) {
  // Find by associated label
  const labels = document.querySelectorAll("label");
  for (const label of labels) {
    if (
      label.textContent
        .trim()
        .toLowerCase()
        .includes(labelText.toLowerCase())
    ) {
      const forId = label.getAttribute("for");
      if (forId) {
        const target = document.getElementById(forId);
        if (target) return target;
      }
      // Label wrapping input
      const input = label.querySelector("input, textarea, select");
      if (input) return input;
    }
  }

  // Find by aria-label
  const ariaElements = document.querySelectorAll(
    `[aria-label*="${labelText}" i]`
  );
  if (ariaElements.length > 0) return ariaElements[0];

  // Find by placeholder
  const placeholderEl = document.querySelector(
    `[placeholder*="${labelText}" i]`
  );
  if (placeholderEl) return placeholderEl;

  return null;
}

function findByPlaceholder(placeholder) {
  return document.querySelector(`[placeholder*="${placeholder}" i]`);
}

// ============================================
// Wait Utilities
// ============================================

function waitForSelector(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(selector);
    if (existing) {
      resolve({
        success: true,
        found: true,
        selector,
        tagName: existing.tagName,
      });
      return;
    }

    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        clearTimeout(timer);
        resolve({
          success: true,
          found: true,
          selector,
          tagName: el.tagName,
        });
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    const timer = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for selector: ${selector}`));
    }, timeout);
  });
}

function waitForText(text, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const check = () => {
      const el = findByText(text);
      if (el) return el;
      return null;
    };

    const found = check();
    if (found) {
      resolve({
        success: true,
        found: true,
        text,
        tagName: found.tagName,
      });
      return;
    }

    const observer = new MutationObserver(() => {
      const el = check();
      if (el) {
        observer.disconnect();
        clearTimeout(timer);
        resolve({
          success: true,
          found: true,
          text,
          tagName: el.tagName,
        });
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    const timer = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for text: "${text}"`));
    }, timeout);
  });
}

// ============================================
// Page Summarization
// ============================================

function summarizePage() {
  const headings = Array.from(document.querySelectorAll("h1, h2, h3")).map(
    (h) => ({
      level: parseInt(h.tagName[1]),
      text: h.textContent?.trim().substring(0, 200),
    })
  );

  const links = Array.from(document.querySelectorAll("a[href]"))
    .slice(0, 50)
    .map((a) => ({
      text: a.textContent?.trim().substring(0, 100),
      href: a.href,
    }))
    .filter((l) => l.text);

  const forms = Array.from(document.querySelectorAll("form")).map((f) => ({
    id: f.id,
    action: f.action,
    method: f.method,
    inputs: Array.from(
      f.querySelectorAll("input, textarea, select")
    ).map((i) => ({
      type: i.type || i.tagName.toLowerCase(),
      name: i.name,
      id: i.id,
      placeholder: i.placeholder,
      label:
        i.getAttribute("aria-label") ||
        document.querySelector(`label[for="${i.id}"]`)?.textContent?.trim() ||
        "",
    })),
  }));

  const images = Array.from(document.querySelectorAll("img"))
    .slice(0, 30)
    .map((img) => ({
      alt: img.alt,
      src: img.src?.substring(0, 200),
      width: img.naturalWidth,
      height: img.naturalHeight,
    }));

  const buttons = Array.from(
    document.querySelectorAll(
      'button, input[type="button"], input[type="submit"], [role="button"]'
    )
  ).map((b) => ({
    text: b.textContent?.trim().substring(0, 100) || b.value,
    id: b.id,
    type: b.type,
    disabled: b.disabled,
  }));

  const meta = {};
  document.querySelectorAll("meta").forEach((m) => {
    const name = m.getAttribute("name") || m.getAttribute("property");
    if (name) meta[name] = m.content;
  });

  // Get main text content (first ~2000 chars)
  const mainContent =
    document.querySelector("main, article, [role='main']") || document.body;
  const textContent = mainContent.textContent
    ?.replace(/\s+/g, " ")
    .trim()
    .substring(0, 2000);

  return {
    title: document.title,
    url: window.location.href,
    meta,
    headings,
    links: links.slice(0, 30),
    forms,
    buttons,
    images: images.slice(0, 20),
    textPreview: textContent,
    stats: {
      totalLinks: document.querySelectorAll("a[href]").length,
      totalImages: document.querySelectorAll("img").length,
      totalForms: document.querySelectorAll("form").length,
      totalButtons: buttons.length,
      totalInputs: document.querySelectorAll("input, textarea, select").length,
    },
  };
}

// ============================================
// Accessibility Snapshot
// ============================================

function getAccessibilitySnapshot() {
  const issues = [];
  const tree = [];

  // Images without alt
  document.querySelectorAll("img").forEach((img) => {
    if (!img.alt && !img.getAttribute("aria-label")) {
      issues.push({
        severity: "error",
        rule: "img-alt",
        message: `Image missing alt text`,
        selector: getUniqueSelector(img),
      });
    }
  });

  // Form inputs without labels
  document
    .querySelectorAll("input, textarea, select")
    .forEach((input) => {
      if (input.type === "hidden") return;
      const hasLabel =
        input.id && document.querySelector(`label[for="${input.id}"]`);
      const hasAriaLabel = input.getAttribute("aria-label");
      const hasAriaLabelledBy = input.getAttribute("aria-labelledby");
      const wrappedInLabel = input.closest("label");

      if (!hasLabel && !hasAriaLabel && !hasAriaLabelledBy && !wrappedInLabel) {
        issues.push({
          severity: "error",
          rule: "input-label",
          message: `Input (${input.type || "text"}) missing label`,
          selector: getUniqueSelector(input),
        });
      }
    });

  // Missing lang attribute
  if (!document.documentElement.getAttribute("lang")) {
    issues.push({
      severity: "warning",
      rule: "html-lang",
      message: "HTML element missing lang attribute",
      selector: "html",
    });
  }

  // Empty buttons/links
  document.querySelectorAll("button, a[href]").forEach((el) => {
    const text =
      el.textContent?.trim() ||
      el.getAttribute("aria-label") ||
      el.getAttribute("title");
    if (!text) {
      issues.push({
        severity: "warning",
        rule: "empty-interactive",
        message: `${el.tagName.toLowerCase()} has no accessible text`,
        selector: getUniqueSelector(el),
      });
    }
  });

  // Heading hierarchy
  const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6"));
  let prevLevel = 0;
  headings.forEach((h) => {
    const level = parseInt(h.tagName[1]);
    if (level > prevLevel + 1 && prevLevel > 0) {
      issues.push({
        severity: "warning",
        rule: "heading-order",
        message: `Heading h${level} skips level (previous was h${prevLevel})`,
        selector: getUniqueSelector(h),
      });
    }
    prevLevel = level;
  });

  // Color contrast (basic check for text on common backgrounds)
  // Low contrast text
  document.querySelectorAll("p, span, a, li, td, th, label").forEach((el) => {
    const style = window.getComputedStyle(el);
    const color = style.color;
    const bg = style.backgroundColor;
    if (color && bg && color === bg) {
      issues.push({
        severity: "error",
        rule: "color-contrast",
        message: "Text color matches background",
        selector: getUniqueSelector(el),
      });
    }
  });

  // ARIA roles summary
  const ariaRoles = {};
  document.querySelectorAll("[role]").forEach((el) => {
    const role = el.getAttribute("role");
    ariaRoles[role] = (ariaRoles[role] || 0) + 1;
  });

  // Landmark regions
  const landmarks = {
    nav: document.querySelectorAll("nav, [role='navigation']").length,
    main: document.querySelectorAll("main, [role='main']").length,
    banner: document.querySelectorAll("header, [role='banner']").length,
    contentinfo: document.querySelectorAll("footer, [role='contentinfo']")
      .length,
    complementary: document.querySelectorAll("aside, [role='complementary']")
      .length,
    search: document.querySelectorAll("[role='search']").length,
  };

  return {
    issues,
    issueCount: {
      errors: issues.filter((i) => i.severity === "error").length,
      warnings: issues.filter((i) => i.severity === "warning").length,
    },
    ariaRoles,
    landmarks,
    headingStructure: headings.map((h) => ({
      level: parseInt(h.tagName[1]),
      text: h.textContent?.trim().substring(0, 100),
    })),
    tabOrder: document.querySelectorAll("[tabindex]").length,
  };
}

function getUniqueSelector(element) {
  if (element.id) return `#${element.id}`;
  if (element.className && typeof element.className === "string") {
    const classes = element.className
      .trim()
      .split(/\s+/)
      .filter((c) => c)
      .slice(0, 2)
      .join(".");
    if (classes) {
      const selector = `${element.tagName.toLowerCase()}.${classes}`;
      if (document.querySelectorAll(selector).length === 1) return selector;
    }
  }
  // Fallback: tag + nth-child
  const parent = element.parentElement;
  if (parent) {
    const siblings = Array.from(parent.children);
    const index = siblings.indexOf(element) + 1;
    return `${getUniqueSelector(parent)} > ${element.tagName.toLowerCase()}:nth-child(${index})`;
  }
  return element.tagName.toLowerCase();
}

// ============================================
// Drag and Drop
// ============================================

async function dragAndDrop(params) {
  const { sourceSelector, targetSelector } = params;
  const source = document.querySelector(sourceSelector);
  const target = document.querySelector(targetSelector);

  if (!source) throw new Error(`Source element not found: ${sourceSelector}`);
  if (!target) throw new Error(`Target element not found: ${targetSelector}`);

  const sourceRect = source.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();

  const sourceCenterX = sourceRect.left + sourceRect.width / 2;
  const sourceCenterY = sourceRect.top + sourceRect.height / 2;
  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;

  // Dispatch drag events
  source.dispatchEvent(
    new MouseEvent("mousedown", {
      clientX: sourceCenterX,
      clientY: sourceCenterY,
      bubbles: true,
    })
  );

  await new Promise((r) => setTimeout(r, 50));

  const dragStartEvent = new DragEvent("dragstart", {
    clientX: sourceCenterX,
    clientY: sourceCenterY,
    bubbles: true,
    cancelable: true,
    dataTransfer: new DataTransfer(),
  });
  source.dispatchEvent(dragStartEvent);

  await new Promise((r) => setTimeout(r, 50));

  target.dispatchEvent(
    new DragEvent("dragover", {
      clientX: targetCenterX,
      clientY: targetCenterY,
      bubbles: true,
      cancelable: true,
      dataTransfer: new DataTransfer(),
    })
  );

  target.dispatchEvent(
    new DragEvent("drop", {
      clientX: targetCenterX,
      clientY: targetCenterY,
      bubbles: true,
      cancelable: true,
      dataTransfer: new DataTransfer(),
    })
  );

  source.dispatchEvent(new DragEvent("dragend", { bubbles: true }));

  return {
    success: true,
    source: sourceSelector,
    target: targetSelector,
  };
}

// ============================================
// Select / Dropdown
// ============================================

async function selectOption(params) {
  const { selector, value, text, index } = params;
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Element not found: ${selector}`);
  if (element.tagName !== "SELECT")
    throw new Error(`Element is not a select: ${selector}`);

  let option;
  if (value !== undefined) {
    option = Array.from(element.options).find((o) => o.value === value);
  } else if (text !== undefined) {
    option = Array.from(element.options).find((o) =>
      o.textContent.trim().toLowerCase().includes(text.toLowerCase())
    );
  } else if (index !== undefined) {
    option = element.options[index];
  }

  if (!option) throw new Error("Option not found");

  element.value = option.value;
  element.dispatchEvent(new Event("change", { bubbles: true }));
  element.dispatchEvent(new Event("input", { bubbles: true }));

  return {
    success: true,
    selector,
    selectedValue: option.value,
    selectedText: option.textContent.trim(),
  };
}

// ============================================
// Keyboard Events
// ============================================

async function keyPress(params) {
  const { key, selector, modifiers = {} } = params;
  const target = selector ? document.querySelector(selector) : document.body;
  if (!target) throw new Error(`Element not found: ${selector}`);

  target.focus();

  const eventInit = {
    key,
    code: key.length === 1 ? `Key${key.toUpperCase()}` : key,
    bubbles: true,
    cancelable: true,
    ctrlKey: modifiers.ctrl || false,
    shiftKey: modifiers.shift || false,
    altKey: modifiers.alt || false,
    metaKey: modifiers.meta || false,
  };

  target.dispatchEvent(new KeyboardEvent("keydown", eventInit));
  target.dispatchEvent(new KeyboardEvent("keypress", eventInit));
  target.dispatchEvent(new KeyboardEvent("keyup", eventInit));

  return {
    success: true,
    key,
    modifiers,
    target: selector || "body",
  };
}

async function keyCombo(params) {
  const { keys, selector } = params; // e.g. ["Control", "a"] or ["Control", "Shift", "i"]
  const target = selector ? document.querySelector(selector) : document.body;
  if (!target) throw new Error(`Element not found: ${selector}`);

  target.focus();

  const modifiers = {
    ctrlKey: keys.includes("Control"),
    shiftKey: keys.includes("Shift"),
    altKey: keys.includes("Alt"),
    metaKey: keys.includes("Meta"),
  };

  const mainKey = keys.find(
    (k) => !["Control", "Shift", "Alt", "Meta"].includes(k)
  );

  if (mainKey) {
    const eventInit = {
      key: mainKey,
      code: mainKey.length === 1 ? `Key${mainKey.toUpperCase()}` : mainKey,
      bubbles: true,
      cancelable: true,
      ...modifiers,
    };

    target.dispatchEvent(new KeyboardEvent("keydown", eventInit));
    target.dispatchEvent(new KeyboardEvent("keypress", eventInit));
    target.dispatchEvent(new KeyboardEvent("keyup", eventInit));
  }

  return {
    success: true,
    keys,
    target: selector || "body",
  };
}

// ============================================
// iframe Support
// ============================================

async function executeInIframe(params) {
  const { iframeSelector, command, commandParams } = params;
  const iframe = document.querySelector(iframeSelector);
  if (!iframe) throw new Error(`iframe not found: ${iframeSelector}`);
  if (iframe.tagName !== "IFRAME")
    throw new Error(`Element is not an iframe: ${iframeSelector}`);

  try {
    const iframeDoc =
      iframe.contentDocument || iframe.contentWindow.document;

    // Execute simple commands in iframe context
    switch (command) {
      case "click": {
        const el = iframeDoc.querySelector(commandParams.selector);
        if (!el)
          throw new Error(
            `Element not found in iframe: ${commandParams.selector}`
          );
        el.click();
        return { success: true, command, selector: commandParams.selector };
      }
      case "type": {
        const el = iframeDoc.querySelector(commandParams.selector);
        if (!el)
          throw new Error(
            `Element not found in iframe: ${commandParams.selector}`
          );
        el.focus();
        if (commandParams.clear) el.value = "";
        el.value += commandParams.text;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return {
          success: true,
          command,
          selector: commandParams.selector,
          value: el.value,
        };
      }
      case "getDOM": {
        const sel = commandParams.selector;
        const el = sel ? iframeDoc.querySelector(sel) : iframeDoc.body;
        return {
          html: el
            ? el.outerHTML.substring(0, 10000)
            : iframeDoc.body.outerHTML.substring(0, 50000),
          title: iframeDoc.title,
        };
      }
      default:
        throw new Error(`Command "${command}" not supported in iframe context`);
    }
  } catch (error) {
    if (
      error.message.includes("cross-origin") ||
      error.name === "SecurityError"
    ) {
      throw new Error(
        `Cannot access cross-origin iframe: ${iframeSelector}`
      );
    }
    throw error;
  }
}

// ============================================
// Listen for commands from background script
// ============================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "execute") {
    executeCommand(message.command, message.params)
      .then((result) => sendResponse(result))
      .catch((error) =>
        sendResponse({
          success: false,
          error: {
            message: error.message,
            stack: error.stack,
          },
        })
      );
    return true; // Keep channel open for async response
  }

  if (message.type === "keepalive") {
    sendResponse({ alive: true });
    return true;
  }
});

// Execute command in page context
async function executeCommand(command, params) {
  switch (command) {
    // Original commands
    case "click":
      return await clickElement(params);
    case "type":
      return await typeText(params);
    case "scroll":
      return await scrollTo(params);
    case "hover":
      return await hoverElement(params);
    case "submit":
      return await submitForm(params);
    case "getDOM":
      return await getDOM(params);
    case "getElement":
      return await getElementInfo(params);
    case "getPerformance":
      return await getPerformanceMetrics();
    case "getStorage":
      return await getStorageData(params);
    case "executeJS":
      return await executeJavaScript(params);

    // NEW: Smart selectors
    case "findByText":
      return await handleFindByText(params);
    case "findByRole":
      return await handleFindByRole(params);
    case "findByLabel":
      return await handleFindByLabel(params);
    case "findByPlaceholder":
      return await handleFindByPlaceholder(params);

    // NEW: Wait commands
    case "waitForSelector":
      return await waitForSelector(params.selector, params.timeout);
    case "waitForText":
      return await waitForText(params.text, params.timeout);

    // NEW: Page intelligence
    case "summarizePage":
      return summarizePage();
    case "getAccessibility":
      return getAccessibilitySnapshot();

    // NEW: Keyboard & mouse
    case "keyPress":
      return await keyPress(params);
    case "keyCombo":
      return await keyCombo(params);
    case "dragAndDrop":
      return await dragAndDrop(params);

    // NEW: Select/dropdown
    case "selectOption":
      return await selectOption(params);

    // NEW: iframe support
    case "executeInIframe":
      return await executeInIframe(params);

    // NEW: Element highlight
    case "highlight":
      return await handleHighlight(params);

    // NEW: Visual diff
    case "visual_snapshot":
      return await takeVisualSnapshot(params);

    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

// ============================================
// Smart selector handlers
// ============================================

async function handleFindByText(params) {
  const { text, tag, click: shouldClick } = params;
  const element = findByText(text, tag);
  if (!element)
    throw new Error(`No element found containing text: "${text}"`);

  highlightElement(element);

  if (shouldClick) {
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    await new Promise((r) => setTimeout(r, 100));
    element.click();
  }

  return {
    success: true,
    text,
    tagName: element.tagName,
    id: element.id,
    className: element.className,
    elementText: element.textContent?.trim().substring(0, 200),
    clicked: !!shouldClick,
  };
}

async function handleFindByRole(params) {
  const { role, name, index = 0, click: shouldClick } = params;
  const elements = findByRole(role, { name });

  if (elements.length === 0)
    throw new Error(`No elements found with role: "${role}"`);

  const element = elements[index] || elements[0];
  highlightElement(element);

  if (shouldClick) {
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    await new Promise((r) => setTimeout(r, 100));
    element.click();
  }

  return {
    success: true,
    role,
    totalFound: elements.length,
    selectedIndex: index,
    tagName: element.tagName,
    text: element.textContent?.trim().substring(0, 200),
    clicked: !!shouldClick,
  };
}

async function handleFindByLabel(params) {
  const { label, click: shouldClick } = params;
  const element = findByLabel(label);
  if (!element)
    throw new Error(`No element found with label: "${label}"`);

  highlightElement(element);

  if (shouldClick) {
    element.focus();
  }

  return {
    success: true,
    label,
    tagName: element.tagName,
    type: element.type,
    id: element.id,
    name: element.name,
    value: element.value,
  };
}

async function handleFindByPlaceholder(params) {
  const { placeholder, click: shouldClick } = params;
  const element = findByPlaceholder(placeholder);
  if (!element)
    throw new Error(
      `No element found with placeholder: "${placeholder}"`
    );

  highlightElement(element);

  if (shouldClick) {
    element.focus();
  }

  return {
    success: true,
    placeholder,
    tagName: element.tagName,
    type: element.type,
    id: element.id,
    name: element.name,
  };
}

async function handleHighlight(params) {
  const { selector, duration = 2000 } = params;
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Element not found: ${selector}`);

  highlightElement(element, duration);

  return {
    success: true,
    selector,
    tagName: element.tagName,
    duration,
  };
}

// ============================================
// Original command implementations
// ============================================

async function clickElement(params) {
  const { selector } = params;
  const element = document.querySelector(selector);

  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }

  // Check if element is visible
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    throw new Error(`Element is not visible: ${selector}`);
  }

  // Scroll into view if needed
  element.scrollIntoView({ behavior: "smooth", block: "center" });

  // Wait a bit for scroll
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Highlight before click
  highlightElement(element, 500);

  // Create and dispatch click events
  element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  element.click();

  return {
    success: true,
    selector,
    tagName: element.tagName,
    text: element.textContent?.trim().substring(0, 100),
  };
}

async function typeText(params) {
  const { selector, text, clear = false } = params;
  const element = document.querySelector(selector);

  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }

  if (
    !["INPUT", "TEXTAREA"].includes(element.tagName) &&
    !element.isContentEditable
  ) {
    throw new Error(
      `Element is not an input, textarea, or contentEditable: ${selector}`
    );
  }

  // Focus element
  element.focus();
  highlightElement(element, 1000);

  // Clear if requested
  if (clear) {
    if (element.isContentEditable) {
      element.textContent = "";
    } else {
      element.value = "";
    }
  }

  // Type character by character
  for (const char of text) {
    if (element.isContentEditable) {
      element.textContent += char;
    } else {
      element.value += char;
    }

    // Dispatch input event
    element.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        cancelable: true,
        data: char,
      })
    );

    // Small delay to simulate typing
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  // Dispatch change event
  element.dispatchEvent(new Event("change", { bubbles: true }));

  return {
    success: true,
    selector,
    value: element.isContentEditable
      ? element.textContent
      : element.value,
    length: text.length,
  };
}

async function scrollTo(params) {
  const { selector, position, smooth = true } = params;

  if (selector) {
    const element = document.querySelector(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    element.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
      block: "center",
    });

    return {
      success: true,
      selector,
      position: element.getBoundingClientRect(),
    };
  } else if (position) {
    window.scrollTo({
      top: position.top || 0,
      left: position.left || 0,
      behavior: smooth ? "smooth" : "auto",
    });

    return {
      success: true,
      scrollY: window.scrollY,
      scrollX: window.scrollX,
    };
  }

  throw new Error("Either selector or position must be provided");
}

async function hoverElement(params) {
  const { selector } = params;
  const element = document.querySelector(selector);

  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }

  highlightElement(element, 1500);

  // Dispatch mouse events
  element.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  element.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));

  return {
    success: true,
    selector,
    tagName: element.tagName,
  };
}

async function submitForm(params) {
  const { selector } = params;
  const element = document.querySelector(selector);

  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }

  // Find form
  let form = element;
  if (element.tagName !== "FORM") {
    form = element.closest("form");
  }

  if (!form) {
    throw new Error("Form not found");
  }

  // Submit form
  form.submit();

  return {
    success: true,
    selector,
    action: form.action,
    method: form.method,
  };
}

async function getDOM(params) {
  const { selector } = params;

  if (selector) {
    const element = document.querySelector(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }
    return {
      html: element.outerHTML.substring(0, 10000), // Limit size
      text: element.textContent?.trim().substring(0, 5000),
    };
  }

  return {
    html: document.documentElement.outerHTML.substring(0, 50000), // Limit size
    title: document.title,
    url: window.location.href,
  };
}

async function getElementInfo(params) {
  const { selector } = params;
  const element = document.querySelector(selector);

  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }

  const rect = element.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(element);

  // Get attributes
  const attributes = {};
  for (const attr of element.attributes) {
    attributes[attr.name] = attr.value;
  }

  highlightElement(element);

  return {
    tagName: element.tagName,
    id: element.id,
    className: element.className,
    attributes,
    text: element.textContent?.trim().substring(0, 500),
    position: {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    },
    visible:
      rect.width > 0 && rect.height > 0 && computedStyle.display !== "none",
    styles: {
      display: computedStyle.display,
      visibility: computedStyle.visibility,
      opacity: computedStyle.opacity,
      position: computedStyle.position,
      zIndex: computedStyle.zIndex,
    },
  };
}

async function getPerformanceMetrics() {
  const navigation = performance.getEntriesByType("navigation")[0];
  const paint = performance.getEntriesByType("paint");

  // Get resource timing
  const resources = performance
    .getEntriesByType("resource")
    .slice(-50)
    .map((r) => ({
      name: r.name,
      duration: r.duration,
      size: r.transferSize,
      type: r.initiatorType,
    }));

  // Memory info (if available)
  const memory = performance.memory
    ? {
      usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
    }
    : null;

  return {
    navigation: navigation
      ? {
        domContentLoaded:
          navigation.domContentLoadedEventEnd -
          navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        domInteractive: navigation.domInteractive,
        responseTime: navigation.responseEnd - navigation.responseStart,
      }
      : null,
    paint: paint.map((p) => ({
      name: p.name,
      startTime: p.startTime,
    })),
    resources,
    memory,
    timestamp: Date.now(),
  };
}

async function getStorageData(params) {
  const { type = "local" } = params;

  if (type === "local") {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      data[key] = localStorage.getItem(key);
    }
    return { type: "localStorage", data };
  } else if (type === "session") {
    const data = {};
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      data[key] = sessionStorage.getItem(key);
    }
    return { type: "sessionStorage", data };
  }

  throw new Error('Invalid storage type. Use "local" or "session"');
}

async function executeJavaScript(params) {
  const { code } = params;

  try {
    // Use Function constructor instead of eval to avoid CSP issues
    // Wrap code in async function for better compatibility
    const AsyncFunction = async function () { }.constructor;
    const fn = new AsyncFunction("return (" + code + ")");

    // Execute code in page context with timeout
    const result = await Promise.race([
      fn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Execution timeout")), 5000)
      ),
    ]);

    // Try to serialize result
    let serialized;
    try {
      serialized = JSON.parse(JSON.stringify(result));
    } catch {
      serialized = String(result);
    }

    return {
      success: true,
      result: serialized,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        message: error.message,
        stack: error.stack,
      },
    };
  }
}

// ============================================
// Monitor DOM mutations
// ============================================
let mutationObserver = null;

function startMutationObserver() {
  if (mutationObserver) return;

  mutationObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      chrome.runtime
        .sendMessage({
          type: "event",
          eventType: "mutation",
          data: {
            type: mutation.type,
            target: mutation.target.tagName,
            addedNodes: mutation.addedNodes.length,
            removedNodes: mutation.removedNodes.length,
          },
        })
        .catch(() => { });
    });
  });

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
  });
}

// Start observer when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startMutationObserver);
} else {
  startMutationObserver();
}

console.log("Browser Copilot Agent ready — Enhanced v2.0");

// ============================================
// Visual Snapshot for Diff Comparison
// ============================================

async function takeVisualSnapshot(params) {
  const selector = params?.selector || "body";
  const root = document.querySelector(selector);
  if (!root) throw new Error(`Snapshot root not found: ${selector}`);

  // Capture structural snapshot
  const elements = {};
  const allEls = root.querySelectorAll("*");
  allEls.forEach((el) => {
    const tag = el.tagName.toLowerCase();
    elements[tag] = (elements[tag] || 0) + 1;
  });

  // Capture text content hash (simple for comparison)
  const textContent = root.innerText?.substring(0, 10000) || "";
  let hash = 0;
  for (let i = 0; i < textContent.length; i++) {
    const ch = textContent.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }

  // Capture form states
  const forms = [];
  root.querySelectorAll("form").forEach((form) => {
    const fields = [];
    form.querySelectorAll("input, textarea, select").forEach((input) => {
      fields.push({
        name: input.name || input.id,
        type: input.type || input.tagName.toLowerCase(),
        value: input.value,
        checked: input.checked,
        disabled: input.disabled,
      });
    });
    forms.push({
      id: form.id,
      action: form.action,
      fields,
    });
  });

  // Capture links
  const links = [];
  root.querySelectorAll("a[href]").forEach((a) => {
    links.push({
      text: a.textContent?.trim().substring(0, 80),
      href: a.href,
    });
  });

  // Capture interactive elements with positions
  const interactive = [];
  root.querySelectorAll("button, input, select, textarea, [role='button'], a[href]").forEach((el) => {
    const rect = el.getBoundingClientRect();
    interactive.push({
      tag: el.tagName.toLowerCase(),
      id: el.id,
      text: el.textContent?.trim().substring(0, 60),
      visible: rect.width > 0 && rect.height > 0,
      position: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
      },
    });
  });

  // Capture images
  const images = [];
  root.querySelectorAll("img").forEach((img) => {
    images.push({
      src: img.src,
      alt: img.alt,
      width: img.naturalWidth,
      height: img.naturalHeight,
      loaded: img.complete && img.naturalHeight > 0,
    });
  });

  return {
    url: window.location.href,
    title: document.title,
    timestamp: Date.now(),
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollY: window.scrollY,
    },
    elements,
    totalElements: allEls.length,
    textHash: hash,
    textLength: textContent.length,
    forms,
    links: links.slice(0, 50),
    interactive: interactive.slice(0, 100),
    images: images.slice(0, 50),
    headings: Array.from(root.querySelectorAll("h1,h2,h3,h4,h5,h6")).map((h) => ({
      level: parseInt(h.tagName[1]),
      text: h.textContent?.trim().substring(0, 100),
    })),
  };
}
