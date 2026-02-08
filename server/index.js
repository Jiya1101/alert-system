const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/client", express.static("../client"));
app.use("/dashboard", express.static("../dashboard"));



const server = http.createServer(app);
const io = new Server(server);

let alerts = [];


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


server.listen(3000, () => {
    console.log("Server running at http://localhost:3000");
});
