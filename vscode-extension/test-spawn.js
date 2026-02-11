const { spawn } = require('child_process');
const fs = require('fs');

console.log("PATH:", process.env.PATH);

try {
    const child = spawn('node', ['-v']);

    child.stdout.on('data', (d) => console.log('STDOUT:', d.toString()));
    child.stderr.on('data', (d) => console.log('STDERR:', d.toString()));
    child.on('error', (err) => console.error('ERROR:', err));
    child.on('close', (code) => console.log('EXIT:', code));
} catch (e) {
    console.error("EXCEPTION:", e);
}
