const { spawn } = require('child_process');

console.log("🚀 Starting Alert System Cluster...\n");

// 1. Start Coordinator (Port 5000, for Bully Leader Election)
spawn('node', ['coordinator.js'], { stdio: 'inherit' });

// 2. Give coordinator a second to bind, then start 3 Node servers
setTimeout(() => {
    [3000, 3001, 3002].forEach(port => {
        const env = Object.assign({}, process.env, { PORT: port });
        spawn('node', ['index.js'], { env, stdio: 'inherit' });
    });
}, 1000);
