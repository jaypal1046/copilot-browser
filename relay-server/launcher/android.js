/**
 * Android Browser Launcher
 * Uses ADB to launch Chrome on Android device
 */
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class AndroidLauncher {
    constructor(options = {}) {
        this.options = options;
        this.port = options.port || 9222;
    }

    async launch() {
        console.log('📱 Connecting to Android device...');

        try {
            // 1. Check for devices
            const { stdout: devices } = await execPromise('adb devices');
            if (!devices.includes('\tdevice')) {
                throw new Error('No Android device connected. Please connect via USB and enable Debugging.');
            }

            // 2. Setup Port Forwarding for DevTools Protocol
            console.log(`   Forwarding port ${this.port}...`);
            await execPromise(`adb forward tcp:${this.port} localabstract:chrome_devtools_remote`);

            // 3. Launch Chrome
            console.log('   Launching Chrome...');
            // Component name for Chrome Stable. Canary/Beta would be different.
            await execPromise('adb shell am start -n com.android.chrome/com.google.android.apps.chrome.Main -d "about:blank"');

            console.log('✅ Android Chrome launched and ready for control');

            return {
                type: 'android',
                port: this.port
            };

        } catch (error) {
            console.error('❌ Failed to launch Android Chrome:', error.message);
            throw error;
        }
    }
}

module.exports = { AndroidLauncher };
