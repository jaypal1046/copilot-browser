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
        .catch(() => {});
    };
  });
}

interceptConsole();

// Listen for commands from background script
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
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

// Command implementations

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

  if (!["INPUT", "TEXTAREA"].includes(element.tagName)) {
    throw new Error(`Element is not an input or textarea: ${selector}`);
  }

  // Focus element
  element.focus();

  // Clear if requested
  if (clear) {
    element.value = "";
  }

  // Type character by character
  for (const char of text) {
    element.value += char;

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
    value: element.value,
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
    const AsyncFunction = async function () {}.constructor;
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

// Monitor DOM mutations (optional)
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
        .catch(() => {});
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

console.log("Browser Copilot Agent ready");
