const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const socketIo = require("socket.io");
const ioClient = require("socket.io-client");
const fs = require("fs");
const soap = require("soap");
const db = require("./database");

let system_lamport_clock = 0; // Logical Time Tracker

const PORT = parseInt(process.env.PORT) || 3000;

let isLeader = false;
let clusterNodes = [];
let leaderPort = null;

const coordinator = ioClient("http://localhost:5000");

coordinator.on("connect", () => {
    console.log(`[Node ${PORT}] Connected to Coordinator`);
    coordinator.emit("REGISTER", PORT);
});

coordinator.on("CLUSTER_UPDATE", (nodes) => {
    clusterNodes = nodes;
    
    // Bully Algorithm: Highest Port configures Leadership
    const maxPort = Math.max(...nodes);
    leaderPort = maxPort;
    
    if (PORT === maxPort) {
        if (!isLeader) {
            isLeader = true;
            console.log(`[Node ${PORT}] 👑 I am the new LEADER (Bully Algorithm Won!)`);
        }
    } else {
        if (isLeader) {
            isLeader = false;
            console.log(`[Node ${PORT}] Lost leadership to Node ${maxPort}`);
        }
    }
    
    io.emit("CLUSTER_STATE", { nodes: clusterNodes, leader: leaderPort, current_port: PORT });
});

function sendWebhook(event_type, alert_id, server_ip, error_code, severity, clock) {
    const data = JSON.stringify({ event_type, alert_id, server_ip, error_code, severity, lamport_clock: clock });
    const req = http.request({
        hostname: 'localhost',
        port: 4000,
        path: '/webhook/event',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => {});
    req.on('error', (e) => console.error(`Webhook error: ${e.message}`));
    req.write(data);
    req.end();
}

const app = express();

app.use(cors());
app.use(express.json());
app.use("/client", express.static("../client"));
app.use("/dashboard", express.static("../dashboard"));



const server = http.createServer(app);
const io = new Server(server);
let onlineClients = 0;

let delivered = {};

// send alert
app.post("/alert", (req, res) => {
    const { message, server_ip, error_code, severity } = req.body;

    system_lamport_clock++;
    const current_clock = system_lamport_clock;

    // Database Transaction & Concurrency Control
    db.run("BEGIN TRANSACTION", (err) => {
        if (err) return res.status(500).json({error: "Transaction start failed"});

        db.run(`INSERT INTO alerts (message, server_ip, error_code, severity, lamport_clock) VALUES (?, ?, ?, ?, ?)`, 
        [message, server_ip || 'N/A', error_code || 'N/A', severity || 'Info', current_clock], function(err) {
            if (err) {
                console.error("Database error inserting alert:", err);
                db.run("ROLLBACK");
                return res.status(500).json({error: "Database error"});
            }
            
            const alert = {
                id: this.lastID,
                message: message,
                server_ip: server_ip || 'N/A',
                error_code: error_code || 'N/A',
                severity: severity || 'Info',
                lamport_clock: current_clock,
                timestamp: new Date()
            };

            db.run("COMMIT", (err) => {
                if (err) {
                    db.run("ROLLBACK");
                    return res.status(500).json({error: "Transaction commit failed"});
                }
                sendWebhook('ALERT_CREATED', alert.id, alert.server_ip, alert.error_code, alert.severity, current_clock);

                console.log("ALERT SENT:", alert);
                io.emit("ALERT", alert);
                res.json(alert);
            });
        });
    });
});

// get alerts logically ordered
app.get("/alerts", (req, res) => {
    // ORDER BY Logical Time instead of Datetime
    db.all(`SELECT * FROM alerts ORDER BY lamport_clock DESC, id DESC`, [], (err, rows) => {
        if (err) {
            console.error("Database error querying alerts:", err);
            return res.status(500).json({error: "Database error"});
        }

        const result = rows.map(a => ({
            ...a,
            delivered: delivered[a.id] || 0
        }));

        res.json(result);
    });
});



io.on("connection", (socket) => {
  console.log("Dashboard/Client connected");
  
  // Immediately send the cluster state to new clients
  socket.emit("CLUSTER_STATE", { nodes: clusterNodes, leader: leaderPort, current_port: PORT });

  onlineClients++;
  console.log("Client connected. Online:", onlineClients);

  io.emit("ONLINE_COUNT", onlineClients);

  socket.on("disconnect", () => {
    onlineClients--;
    console.log("Client disconnected. Online:", onlineClients);
    io.emit("ONLINE_COUNT", onlineClients);
  });

  socket.on("ACK", (id) => {
    delivered[id] = (delivered[id] || 0) + 1;
    console.log("Delivered:", id, delivered[id]);
  });

  socket.on("RESOLVE_ALERT", (data) => {
    system_lamport_clock++;
    const current_clock = system_lamport_clock;

    db.run("BEGIN TRANSACTION", () => {
        db.run(`UPDATE alerts SET resolved = 1, response_message = ?, lamport_clock = ? WHERE id = ?`, [data.response, current_clock, data.id], function(err) {
            if (err) {
                db.run("ROLLBACK");
                return console.error("Update failed", err);
            }
            db.run("COMMIT", (commitErr) => {
                if(commitErr) return db.run("ROLLBACK");
                console.log("ALERT RESOLVED:", data.id, data.response);
                sendWebhook('ALERT_RESOLVED', data.id, null, null, null, current_clock);
                data.lamport_clock = current_clock;
                io.emit("ALERT_RESOLVED", data);
            });
        });
    });
  });

});





const alertService = {
    AlertService: {
        AlertPort: {
            TriggerAlert: function(args, cb) {
                const { message, server_ip, error_code, severity } = args;
                
                system_lamport_clock++;
                const current_clock = system_lamport_clock;

                db.run("BEGIN TRANSACTION", (tErr) => {
                    if (tErr) return cb({ Fault: { Code: { Value: "soap:Server" }, Reason: { Text: "Transaction start failed" } } });
                    
                    db.run(`INSERT INTO alerts (message, server_ip, error_code, severity, lamport_clock) VALUES (?, ?, ?, ?, ?)`, 
                    [message, server_ip || 'N/A', error_code || 'N/A', severity || 'Info', current_clock], function(err) {
                        if (err) {
                            console.error("SOAP DB Error:", err);
                            db.run("ROLLBACK");
                            return cb({ Fault: { Code: { Value: "soap:Server" }, Reason: { Text: "Error saving alert" } } });
                        }

                        const alertId = this.lastID;
                        const alert = { 
                            id: alertId, 
                            message: message,
                            server_ip: server_ip || 'N/A',
                            error_code: error_code || 'N/A',
                            severity: severity || 'Info',
                            lamport_clock: current_clock,
                            timestamp: new Date() 
                        };
                        
                        db.run("COMMIT", (cErr) => {
                            if(cErr) return db.run("ROLLBACK");
                            sendWebhook('ALERT_CREATED', alertId, alert.server_ip, alert.error_code, alert.severity, current_clock);
                            console.log("SOAP ALERT SENT:", alert);
                            io.emit("ALERT", alert);
                            cb(null, { id: alertId, status: "Success" });
                        });
                    });
                });
            }
        }
    }
};

server.listen(PORT, () => {
    console.log("Server running on port", PORT);
    
    // Read WSDL
    const xml = fs.readFileSync("alertService.wsdl", "utf8");
    
    // Expose SOAP service logic
    soap.listen(server, '/wsdl', alertService, xml);
    console.log("SOAP Service running at http://localhost:" + PORT + "/wsdl?wsdl");
});

