const express = require("express");
const mqtt = require("mqtt");
const mysql = require("mysql2/promise");
const cors = require("cors");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public")); // index.html di folder public

// 🔗 MySQL
const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "iot_db"
});

// Pastikan table sudah ada:
// CREATE TABLE sensor_data (
//   id INT AUTO_INCREMENT PRIMARY KEY,
//   suhu FLOAT,
//   humid FLOAT,
//   lux INT,
//   timestamp DATETIME
// );

// 🔗 MQTT
const MQTT_BROKER = "mqtt://broker.hivemq.com";
const MQTT_TOPIC = "amanda/iot/data";

const client = mqtt.connect(MQTT_BROKER);

client.on("connect", () => {
  console.log("MQTT connected");
  client.subscribe(MQTT_TOPIC);
});

client.on("message", async (topic, message) => {
  if (topic.toString() === MQTT_TOPIC) {
    try {
      const data = JSON.parse(message.toString());

      // konversi timestamp ke format MySQL DATETIME
      const ts = new Date(data.timestamp);
      const mysqlTs = ts.toISOString().slice(0, 19).replace("T", " ");

      console.log("Incoming MQTT:", data);

      await db.query(
        "INSERT INTO data_sensor (suhu, humid, kecerahan, timestamp) VALUES (?, ?, ?, ?)",
        [data.suhu, data.humidity, data.kecerahan, mysqlTs]
      );
      console.log("Data saved:", data);
    } catch (err) {
      console.error("DB insert error:", err);
    }
  }
});

// API endpoint untuk dashboard
app.get("/data", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM data_sensor ORDER BY timestamp DESC LIMIT 50");
    if (!rows || rows.length === 0) return res.json({ data: [], summary: {} });

    const suhuArr = rows.map(r => r.suhu);
    const summary = {
      suhu_max: Math.max(...suhuArr),
      suhu_min: Math.min(...suhuArr),
      suhu_avg: (suhuArr.reduce((a,b)=>a+b,0)/suhuArr.length).toFixed(2)
    };

    res.json({ data: rows.reverse(), summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
