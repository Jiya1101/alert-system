const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'metrics.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Error opening metrics DB:", err);
    } else {
        // Drop existing table to neatly recreate
        db.run('DROP TABLE IF EXISTS events', () => {
            db.run(`CREATE TABLE events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                alert_id INTEGER,
                event_type TEXT,
                server_ip TEXT,
                error_code TEXT,
                severity TEXT,
                lamport_clock INTEGER,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )`, () => {
                console.log("Analytics events table ready (CQRS).");
            });
        });
    }
});
module.exports = db;
