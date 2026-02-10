const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const fs = require("fs");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/client", express.static("../client"));
app.use("/dashboard", express.static("../dashboard"));



const server = http.createServer(app);
const io = new Server(server);

let alerts = [];

// load alerts from file
function loadAlerts() {

  if (!fs.existsSync("alerts.json")) {
    fs.writeFileSync("alerts.json", "[]");
  }

  alerts = JSON.parse(fs.readFileSync("alerts.json"));
}


// save alerts to file
function saveAlerts() {
  fs.writeFileSync("alerts.json", JSON.stringify(alerts));
}

// load at startup
loadAlerts();

// send alert
app.post("/alert", (req, res) => {

    const alert = {
        id: Date.now(),
        message: req.body.message
    };

    alerts.push(alert);

    io.emit("ALERT", alert);

    res.json(alert);
});


// get alerts
app.get("/alerts", (req, res) => {
    res.json(alerts);
});


io.on("connection", () => {
    console.log("Client connected");
});


const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
