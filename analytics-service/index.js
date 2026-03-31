const express = require("express");
const cors = require("cors");
const db = require("./database");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// Serve static dashboard
app.use(express.static(path.join(__dirname, 'public')));

// Microservice Webhook Receiver
app.post("/webhook/event", (req, res) => {
    const { alert_id, event_type, server_ip, error_code, severity, lamport_clock } = req.body;
    
    db.run(`INSERT INTO events (alert_id, event_type, server_ip, error_code, severity, lamport_clock) VALUES (?, ?, ?, ?, ?, ?)`,
    [alert_id, event_type, server_ip || 'N/A', error_code || 'N/A', severity || 'Info', lamport_clock], function(err) {
        if (err) {
            console.error(err);
            return res.status(500).send("Database error");
        }
        console.log(`WEBHOOK RECEIVED: [${event_type}] for Alert ID ${alert_id} at Logical Time ${lamport_clock}`);
        res.status(200).send("Event recorded");
    });
});

// Analytics Aggregation API
app.get("/api/metrics", (req, res) => {
    const metrics = {
        total_created: 0,
        total_resolved: 0,
        severity_counts: { Critical: 0, Warning: 0, Info: 0 },
        top_servers: {}
    };

    db.all(`SELECT * FROM events`, [], (err, rows) => {
        if (err) return res.status(500).send("Error");

        rows.forEach(row => {
            if (row.event_type === 'ALERT_CREATED') {
                metrics.total_created++;
                
                if(metrics.severity_counts[row.severity] !== undefined) {
                    metrics.severity_counts[row.severity]++;
                }
                
                metrics.top_servers[row.server_ip] = (metrics.top_servers[row.server_ip] || 0) + 1;
            } else if (row.event_type === 'ALERT_RESOLVED') {
                metrics.total_resolved++;
            }
        });
        
        res.json(metrics);
    });
});

const PORT = 4000;
app.listen(PORT, () => {
    console.log(`Analytics Microservice gracefully running on Port ${PORT}`);
});
