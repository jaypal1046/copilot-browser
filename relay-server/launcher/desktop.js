/**
 * Linux/Desktop Browser Launcher
 * Uses Puppeteer Core to launch isolated Chrome instance
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { execSync } = require('child_process');

// Path to your local extension build (relative to this file)
const EXTENSION_PATH = path.resolve(__dirname, '../../browser-extension');

class DesktopLauncher {
    constructor(options = {}) {
        this.options = options;
    }

    async launch() {
        console.log('🐧 Launching isolated Desktop Chrome...');

        // 1. Locate Chrome Executable
        const executablePath = this.findChromePath();
        if (!executablePath) {
            throw new Error('Chrome executable not found. Please install Google Chrome.');
        }

        console.log(`   Chrome found at: ${executablePath}`);

        // 2. Create Temp Profile (Isolation)
        const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-copilot-'));
        console.log(`   Profile: ${userDataDir}`);

        // 3. Launch
        try {
            const browser = await puppeteer.launch({
                executablePath,
                headless: false, // Essential for extension support
                defaultViewport: null, // Full window
                args: [
                    `--disable-extensions-except=${EXTENSION_PATH}`,
                    `--load-extension=${EXTENSION_PATH}`,
                    `--user-data-dir=${userDataDir}`,
                    '--no-first-run',
                    '--no-default-browser-check',
                    // Linux specific flags for stability
                    '--disable-gpu',
                    '--no-sandbox',
                    '--disable-setuid-sandbox'
                ]
            });

            console.log('✅ Isolated Chrome launched successfully');

            // Wait for extension to load
            await new Promise(resolve => setTimeout(resolve, 2000));

            return {
                type: 'desktop',
                browser,
                userDataDir
            };

        } catch (error) {
            console.error('❌ Failed to launch Desktop Chrome:', error.message);
            throw error;
        }
    }

    findChromePath() {
        const platform = os.platform();

        if (platform === 'win32') {
            const paths = [
                "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
                "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
                path.join(os.homedir(), "AppData\\Local\\Google\\Chrome\\Application\\chrome.exe")
            ];
            return paths.find(fs.existsSync);
        }
        else if (platform === 'darwin') {
            return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
        }
        else {
            // Linux
            const possiblePaths = [
                '/usr/bin/google-chrome',
                '/usr/bin/google-chrome-stable',
                '/usr/bin/chromium',
                '/usr/bin/chromium-browser',
                '/snap/bin/chromium'
            ];

            for (const p of possiblePaths) {
                if (fs.existsSync(p)) return p;
            }

            // Try `which` command as fallback
            try {
                return execSync('which google-chrome').toString().trim();
            } catch (e) {
                return null;
            }
        }
    }
}

module.exports = { DesktopLauncher };
