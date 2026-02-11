# 📱 Copilot Browser - Mobile & Cross-Platform Guide

This guide explains how to use Copilot Browser with isolated browser instances on **Desktop (Windows/Linux/Mac)**, **Android**, and **iOS**.

## 📦 VS Code Extension (One-Click)

The easiest way to use Copilot Browser is via the VS Code Extension.

1.  Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
2.  Run **"Browser Agent: Launch Isolated Browser"**.
3.  This will:
    -   Start the **embedded** Relay Server (no external Node.js required!).
    -   Launch a secure, isolated Chrome instance.
    -   Connect everything automatically.

**Note:** This works out-of-the-box. You do NOT need to install Node.js or run any terminal commands.

---

## 🚀 Quick Start

To launch an isolated browser session (clean cookies/history) instead of connecting to your existing browser:

```bash
# Auto-detect platform (default: Desktop)
node autonomous-agent.js

# Specific Platform
node autonomous-agent.js --platform=linux
node autonomous-agent.js --platform=android
node autonomous-agent.js --platform=ios
```

---

## 🐧 Linux / Desktop (Isolated Mode)

**Prerequisites:**
- Google Chrome, Chromium, or Brave installed.
- `pip install puppeteer-core` (handled by `npm install`)

**How it works:**
The agent launches a temporary Chrome instance with a fresh user profile.
- 🧹 **Clean Slate**: No cookies, history, or extensions from your main profile.
- 🛡️ **Isolation**: Everything is deleted when the agent stops (temp folder).
- 🧩 **Extension**: Automatically loads the local `browser-extension` build.

---

## 🤖 Android Setup

**Prerequisites:**
1. **Android Device** connected via USB.
2. **USB Debugging** enabled (Developer Options).
3. **Chrome for Android** installed on the device.
4. **ADB** (Android Debug Bridge) installed and in your PATH.

**Setup Steps:**

1. Verify device connection:
   ```bash
   adb devices
   # Should show: "List of devices attached... <serial> device"
   ```

2. Run the agent:
   ```bash
   node autonomous-agent.js --platform=android
   ```

**How it works:**
The agent uses ADB to:
- Launch Chrome on your phone (`adb shell am start ...`).
- Forward the remote debugging port (`9222`) to your computer.
- Connect to the browser remotely to inject automation scripts.

---

## 🍎 iOS Setup (Mac Only)

**Prerequisites:**
1. **Xcode** installed.
2. **iOS Simulator** (included with Xcode).
3. **ios-webkit-debug-proxy** (for real devices, optional for Simulator).

**Setup Steps (Simulator):**

1. Open a Simulator:
   ```bash
   open -a Simulator
   ```

2. Run the agent:
   ```bash
   node autonomous-agent.js --platform=ios
   ```

**How it works:**
The agent uses `simctl` to launch Safari and connects to the Web Inspector protocol to control the browser.

---

## ⚠️ Troubleshooting

**"Chrome executable not found" (Linux/Desktop):**
Ensure Chrome is in your standard path (`/usr/bin/google-chrome`) or set `CHROME_PATH` env variable.

**"No Android device connected":**
Check your USB cable and ensure "File Transfer" mode is NOT selected (use "Charging" or "PTP" sometimes helps), and accept the debugging prompt on the phone screen.

**"Connection Refused" (Mobile):**
Ensure the Relay Server (`relay-server`) is running. The agent tries to start it automatically, but you can run it manually:
```bash
cd relay-server && npm start
```
