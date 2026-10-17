import "dotenv/config";
import express from "express";
import { randomUUID } from "node:crypto";
import { log, getRecentLogs } from "./logger.js";

const app = express();
const PORT = Number(process.env.PORT || 4000);
const SCENARIO = process.env.SCENARIO || "healthy";

const allowedScenarios = [
  "healthy",
  "storage_down",
  "calendar_down",
  "slow_response",
];

if (!allowedScenarios.includes(SCENARIO)) {
  throw new Error("Invalid SCENARIO configuration.");
}

const appointments = [];

app.use(express.json());

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

// Simulated dependency checks.
// These expose observed status, never the SCENARIO value.
function checkStorage() {
  if (SCENARIO === "storage_down") {
    log("error", "Appointment storage connection failed", {
      dependency: "storage",
      code: "ECONNREFUSED",
    });

    return { status: "unavailable", code: "ECONNREFUSED" };
  }

  return { status: "available" };
}

function checkCalendar() {
  if (SCENARIO === "calendar_down") {
    log("error", "Calendar provider request timed out", {
      dependency: "calendar",
      code: "ETIMEDOUT",
    });

    return { status: "unavailable", code: "ETIMEDOUT" };
  }

  return { status: "available" };
}

// Records request duration, including slow appointment requests.
app.use((req, res, next) => {
  const startedAt = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;

    // Keep diagnostic requests out of the application logs.
    if (!req.path.startsWith("/appointments")) return;

    log(durationMs >= 2000 ? "warn" : "info", "Request completed", {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs,
    });
  });

  next();
});

// Apply latency only to appointment routes.
app.use("/appointments", async (req, res, next) => {
  if (SCENARIO === "slow_response") {
    await delay(5000);
  }

  next();
});

// Process health: the server itself is running.
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "appointment-service",
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

app.get("/logs", (req, res) => {
  res.json({ logs: getRecentLogs() });
});

app.get("/dependencies", (req, res) => {
  const storage = checkStorage();
  const calendar = checkCalendar();

  const healthy =
    storage.status === "available" && calendar.status === "available";

  res.status(healthy ? 200 : 503).json({
    storage,
    calendar,
  });
});

app.get("/appointments", (req, res) => {
  if (checkStorage().status !== "available") {
    return res.status(503).json({
      error: "Appointment storage is unavailable.",
    });
  }

  res.json({ appointments });
});

app.post("/appointments", (req, res) => {
  const { name, startsAt } = req.body ?? {};

  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({
      error: "A name is required.",
    });
  }

  if (typeof startsAt !== "string" || !/(Z|[+-]\d{2}:\d{2})$/.test(startsAt)) {
    return res.status(400).json({
      error: "Provide startsAt with a timezone.",
    });
  }

  const date = new Date(startsAt);

  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
    return res.status(400).json({
      error: "The appointment must have a valid future date.",
    });
  }

  if (checkStorage().status !== "available") {
    return res.status(503).json({
      error: "Appointment storage is unavailable.",
    });
  }

  const normalizedTime = date.toISOString();

  const alreadyBooked = appointments.some(
    (appointment) => appointment.startsAt === normalizedTime,
  );

  if (alreadyBooked) {
    return res.status(409).json({
      error: "This time slot is already booked.",
    });
  }

  if (checkCalendar().status !== "available") {
    return res.status(503).json({
      error: "Calendar provider is unavailable.",
    });
  }

  const appointment = {
    id: randomUUID(),
    name: name.trim(),
    startsAt: normalizedTime,
    createdAt: new Date().toISOString(),
  };

  appointments.push(appointment);

  log("info", "Appointment created", {
    appointmentId: appointment.id,
  });

  return res.status(201).json({ appointment });
});

app.listen(PORT, () => {
  log("info", "Appointment service started", { port: PORT });
});
