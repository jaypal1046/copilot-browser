const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('📦 Building Copilot Browser Integration Suite...');

// Paths
const rootDir = path.resolve(__dirname, '..');
const vscodeDir = path.join(rootDir, 'vscode-extension');
const chromeDir = path.join(rootDir, 'browser-extension');
const distDir = path.join(rootDir, 'dist');
const relayServerDir = path.join(vscodeDir, 'relay-server');

// Clean and Ensure dist dir exists
if (fs.existsSync(distDir)) {
    console.log('Cleaning dist directory...');
    fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

try {
    // ---------------------------------------------------------
    // 1. Build VS Code Extension
    // ---------------------------------------------------------
    console.log('\n----------------------------------------');
    console.log('🔨 Building VS Code Extension...');

    // 1. Pack Relay Server (TGZ Strategy)
    // This avoids symlink issues and ensures simple bundling by vsce
    console.log('Packing relay-server...');
    // Clean old tgz files
    const oldTgz = fs.readdirSync(relayServerDir).filter(f => f.endsWith('.tgz'));
    oldTgz.forEach(f => fs.unlinkSync(path.join(relayServerDir, f)));

    execSync('npm pack', { cwd: relayServerDir, stdio: 'inherit' });

    // Find generated tgz
    const tgzFiles = fs.readdirSync(relayServerDir).filter(f => f.endsWith('.tgz'));
    if (tgzFiles.length === 0) throw new Error('No .tgz generated for relay-server');
    const tgzPath = path.join(relayServerDir, tgzFiles[0]);
    console.log(`Packed relay-server to: ${tgzPath}`);

    // 2. Install tgz in vscode-extension
    // We backup package.json to restore later (keep source clean)
    const pkgJsonPath = path.join(vscodeDir, 'package.json');
    const pkgJsonBackup = fs.readFileSync(pkgJsonPath);

    try {
        console.log('Installing relay-server tarball...');
        execSync(`npm install "${tgzPath}"`, { cwd: vscodeDir, stdio: 'inherit' });

        // 3. Clean stale VSIX files
        const oldFiles = fs.readdirSync(vscodeDir);
        oldFiles.forEach(f => {
            if (f.endsWith('.vsix')) fs.unlinkSync(path.join(vscodeDir, f));
        });

        // 4. Package (vsce) - Output directly to dist
        console.log('Packaging extension (vsce)...');
        execSync(`npx -y @vscode/vsce package --out "${distDir}"`, { cwd: vscodeDir, stdio: 'inherit' });

    } finally {
        // 5. Cleanup / Restore package.json
        console.log('Restoring package.json...');
        fs.writeFileSync(pkgJsonPath, pkgJsonBackup);
        // Also delete the tgz file
        if (fs.existsSync(tgzPath)) fs.unlinkSync(tgzPath);
        // And remove node_modules/relay-server? No need, next npm install will fix it.
        // Actually, restore package-lock.json? 
        try { execSync('git checkout package-lock.json', { cwd: vscodeDir, stdio: 'ignore' }); } catch (e) { }
    }

    // Verify
    const distFilesVsix = fs.readdirSync(distDir).filter(f => f.endsWith('.vsix'));
    if (distFilesVsix.length > 0) {
        console.log(`✅ VS Code Extension built in dist/: ${distFilesVsix[0]}`);
    } else {
        throw new Error('VSIX file not found in dist/ after build');
    }

    // ---------------------------------------------------------
    // 2. Package Chrome Extension
    // ---------------------------------------------------------
    console.log('\n----------------------------------------');
    console.log('🔨 Packaging Chrome Extension...');

    const outputZip = path.join(distDir, 'Copilot Browser.zip');

    console.log(`Zipping ${chromeDir} to ${outputZip}...`);

    // Use PowerShell Compress-Archive
    const cmd = `powershell -Command "Compress-Archive -Path '${chromeDir}\\*' -DestinationPath '${outputZip}' -Force"`;
    execSync(cmd, { stdio: 'inherit' });

    if (fs.existsSync(outputZip)) {
        console.log(`✅ Chrome Extension packaged: ${outputZip}`);
        const stats = fs.statSync(outputZip);
        console.log(`   Size: ${(stats.size / 1024).toFixed(2)} KB`);
    } else {
        throw new Error('Zip file was not created');
    }

    // ---------------------------------------------------------
    // Summary
    // ---------------------------------------------------------
    console.log('\n----------------------------------------');
    console.log('🎉 Build Complete!');
    console.log('Output Artifacts in dist/:');

    const distFiles = fs.readdirSync(distDir);
    distFiles.forEach((f, i) => console.log(`${i + 1}. ${f}`));

    console.log('\n----------------------------------------');

} catch (e) {
    console.error('\n❌ Build Failed:', e.message);
    process.exit(1);
}
