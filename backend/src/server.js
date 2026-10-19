import "dotenv/config";
import express from "express";
import { randomUUID } from "node:crypto";
import { log, getRecentLogs } from "./logger.js";

import session from "express-session";
import {
  googleAuthRouter,
  getCalendarClient,
  checkGoogleCalendarConnection,
} from "./googleCalender.js";

const app = express();
const PORT = Number(process.env.PORT || 4000);
const SCENARIO = process.env.SCENARIO || "healthy";

console.log("Loaded scenario:", SCENARIO);
console.log("Running from:", process.cwd());

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

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET is missing.");
}

app.use(
  session({
    name: "appointment.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false, // Local HTTP development.
      maxAge: 30 * 60 * 1000,
    },
  }),
);

app.use("/auth", googleAuthRouter);

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

async function checkCalendar() {
  if (SCENARIO === "calendar_down") {
    const startedAt = Date.now();

    await delay(1500);

    log("error", "Calendar provider request timed out", {
      dependency: "calendar",
      code: "ETIMEDOUT",
      durationMs: Date.now() - startedAt,
    });

    return {
      status: "unavailable",
      code: "ETIMEDOUT",
      durationMs: Date.now() - startedAt,
    };
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

app.get("/dependencies", async (req, res) => {
  const storage = checkStorage();

  // Preserve the simulated failure for the class demo.
  let calendar = await checkCalendar();

  // If simulation passes, verify the real Google connection.
  if (calendar.status === "available") {
    calendar = await checkGoogleCalendarConnection();

    if (calendar.status !== "available") {
      log("error", "Google Calendar dependency check failed", {
        dependency: "calendar",
        code: calendar.code,
        upstreamStatus: calendar.upstreamStatus,
      });
    }
  }

  const healthy =
    storage.status === "available" && calendar.status === "available";

  return res.status(healthy ? 200 : 503).json({
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

app.post("/appointments", async (req, res) => {
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

  const start = new Date(startsAt);

  if (Number.isNaN(start.getTime()) || start.getTime() <= Date.now()) {
    return res.status(400).json({
      error: "The appointment must have a valid future date.",
    });
  }

  if ((await checkCalendar()).status !== "available") {
    return res.status(503).json({
      error: "Calendar provider is unavailable.",
    });
  }

  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const normalizedTime = start.toISOString();

  // Prevent overlapping bookings created in this running app.
  const overlaps = appointments.some((appointment) => {
    const existingStart = new Date(appointment.startsAt).getTime();
    const existingEnd = existingStart + 30 * 60 * 1000;

    return start.getTime() < existingEnd && end.getTime() > existingStart;
  });

  if (overlaps) {
    return res.status(409).json({
      error: "This time overlaps an existing appointment.",
    });
  }

  let calendar;

  try {
    calendar = getCalendarClient();
  } catch {
    log("error", "Google Calendar is not connected", {
      dependency: "calendar",
      code: "NOT_CONNECTED",
    });

    return res.status(503).json({
      error:
        "Connect Google Calendar at http://localhost:4000/auth/google first.",
    });
  }

  try {
    const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";

    // Check existing Google Calendar events before creating a booking.
    const existing = await calendar.events.list(
      {
        calendarId,
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        singleEvents: true,
        fields: "items(status,transparency),nextPageToken",
        maxResults: 2500,
      },
      { timeout: 5000 },
    );

    const busy = existing.data.items?.some(
      (event) =>
        event.status !== "cancelled" && event.transparency !== "transparent",
    );

    if (busy || existing.data.nextPageToken) {
      return res.status(409).json({
        error: "Your Google Calendar is busy during this time.",
      });
    }

    const appointmentId = randomUUID();

    const result = await calendar.events.insert(
      {
        calendarId,
        requestBody: {
          // A stable ID helps prevent duplicate inserts on automatic retries.
          id: appointmentId.replaceAll("-", ""),
          summary: `Appointment: ${name.trim()}`,
          description: "Created through the Appointment Agent demo.",
          start: {
            dateTime: start.toISOString(),
            timeZone: "Asia/Jerusalem",
          },
          end: {
            dateTime: end.toISOString(),
            timeZone: "Asia/Jerusalem",
          },
        },
      },
      { timeout: 5000 },
    );

    const appointment = {
      id: appointmentId,
      name: name.trim(),
      startsAt: normalizedTime,
      endsAt: end.toISOString(),
      googleEventId: result.data.id,
      calendarLink: result.data.htmlLink,
      createdAt: new Date().toISOString(),
    };

    appointments.push(appointment);

    log("info", "Appointment created in Google Calendar", {
      appointmentId: appointment.id,
    });

    return res.status(201).json({ appointment });
  } catch (error) {
    const status = error.response?.status;
    const timedOut =
      error.code === "ETIMEDOUT" || error.code === "ECONNABORTED";

    log("error", "Google Calendar booking request failed", {
      dependency: "calendar",
      code: timedOut ? "ETIMEDOUT" : "GOOGLE_API_ERROR",
      upstreamStatus: status,
    });

    return res.status(502).json({
      error: timedOut
        ? "Google Calendar timed out. Check your calendar before retrying; the event may have been created."
        : "Google Calendar could not complete the booking. Check your calendar before retrying.",
    });
  }
});

app.listen(PORT, () => {
  log("info", "Appointment service started", { port: PORT });
});
