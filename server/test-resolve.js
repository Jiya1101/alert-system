const { io } = require("socket.io-client");

const socket = io("http://localhost:3000");

socket.on("connect", () => {
    console.log("Connected as test client");
    
    // Simulate resolving alert ID 1
    const alertId = 1;
    const responseMsg = "Simulated manual fix by test client!";
    
    console.log(`Sending RESOLVE_ALERT for ID: ${alertId}`);
    socket.emit("RESOLVE_ALERT", { id: alertId, response: responseMsg });
});

socket.on("ALERT_RESOLVED", (data) => {
    console.log("Received ALERT_RESOLVED broadcast:", data);
    process.exit(0);
});

setTimeout(() => {
    console.log("Timeout waiting for resolution broadcast");
    process.exit(1);
}, 3000);
