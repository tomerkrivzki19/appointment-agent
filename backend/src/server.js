import "dotenv/config";
import express from "express";

const app = express();
const PORT = Number(process.env.PORT || 4000);

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "appointment-service",
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

app.listen(PORT, () => {
  console.log(`Appointment service running at http://localhost:${PORT}`);
});
