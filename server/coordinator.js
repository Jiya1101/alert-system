const io = require("socket.io")(5000, {
    cors: { origin: "*" }
});

let activeNodes = {}; // socket.id -> { port }

io.on("connection", (socket) => {
    console.log(`[Coordinator] New connection: ${socket.id}`);

    socket.on("REGISTER", (port) => {
        activeNodes[socket.id] = { port };
        console.log(`[Coordinator] Node Registered on Port ${port}`);
        
        // Broadcast the active nodes array to everyone
        io.emit("CLUSTER_UPDATE", Object.values(activeNodes).map(n => n.port));
    });

    socket.on("disconnect", () => {
        if (activeNodes[socket.id]) {
            console.log(`[Coordinator] Node Port ${activeNodes[socket.id].port} disconnected`);
            delete activeNodes[socket.id];
            
            // Broadcast new cluster state
            io.emit("CLUSTER_UPDATE", Object.values(activeNodes).map(n => n.port));
        }
    });
});

console.log("[Coordinator] Discovery Service running on Port 5000");
