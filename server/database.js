const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'alerts.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Error opening DB:", err);
    } else {
        // Safe concurrent initialization
        db.run(`CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_ip TEXT,
            error_code TEXT,
            severity TEXT,
            message TEXT NOT NULL,
            resolved BOOLEAN DEFAULT 0,
            response_message TEXT,
            lamport_clock INTEGER,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                console.error("Error creating table:", err.message);
            } else {
                console.log("Alerts table ready (Cluster-Safe Schema).");
            }
        });
    }
});

module.exports = db;
