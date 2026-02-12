const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

async function build() {
    const distDir = path.join(__dirname, 'dist');

    // Clean dist
    if (fs.existsSync(distDir)) {
        fs.rmSync(distDir, { recursive: true, force: true });
    }
    fs.mkdirSync(distDir, { recursive: true });

    // Files to copy directly
    const filesToCopy = [
        'manifest.json',
        'popup/popup.html',
        'popup/popup.css',
        'options/options.html',
        'icons/icon16.svg',
        'icons/icon48.svg',
        'icons/icon128.svg'
    ];

    for (const file of filesToCopy) {
        const src = path.join(__dirname, file);
        const dest = path.join(distDir, file);
        const destDir = path.dirname(dest);
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        fs.copyFileSync(src, dest);
    }

    // Build JS bundles
    await esbuild.build({
        entryPoints: ['background.js', 'content.js', 'popup/popup.js'],
        bundle: true,
        minify: true,
        outdir: distDir,
        target: ['chrome100'],
    });

    console.log('Build complete: browser-extension/dist');
}

build().catch(err => {
    console.error(err);
    process.exit(1);
});
