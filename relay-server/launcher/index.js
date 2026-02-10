/**
 * Platform Launcher Factory
 * Handles browser launching for different platforms (Windows, Linux, macOS, Android, iOS)
 */

const os = require('os');
const { DesktopLauncher } = require('./desktop');
const { AndroidLauncher } = require('./android');
const { IOSLauncher } = require('./ios');

class PlatformLauncher {
    static async launch(options = {}) {
        const platform = options.platform || this.detectPlatform();

        console.log(`🚀 Initializing launcher for platform: ${platform}`);

        let launcher;

        switch (platform) {
            case 'android':
                launcher = new AndroidLauncher(options);
                break;
            case 'ios':
                launcher = new IOSLauncher(options);
                break;
            case 'linux':
            case 'darwin':
            case 'win32':
                launcher = new DesktopLauncher(options);
                break;
            default:
                throw new Error(`Unsupported platform: ${platform}`);
        }

        return await launcher.launch();
    }

    static detectPlatform() {
        // Check if running on mobile device (not possible from Node, but we can check args)
        // For now, default to the OS we are running on
        return os.platform();
    }
}

module.exports = { PlatformLauncher };
