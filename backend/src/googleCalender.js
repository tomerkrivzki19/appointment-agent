import "dotenv/config";
import { Router } from "express";
import { randomBytes } from "node:crypto";
import { google } from "googleapis";

import dotenv from "dotenv";
import { mkdirSync, writeFileSync, renameSync } from "node:fs";
import path from "node:path";

export const googleAuthRouter = Router();

const tokenDirectory = path.resolve(process.env.GOOGLE_TOKEN_DIR || "./data");

const tokenFile = path.join(tokenDirectory, ".env.google");

dotenv.config({ path: tokenFile, quiet: true });

let connectedClient = null;

if (process.env.GOOGLE_REFRESH_TOKEN) {
  connectedClient = createClient();

  connectedClient.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });
}

function saveRefreshToken(refreshToken) {
  mkdirSync(tokenDirectory, {
    recursive: true,
    mode: 0o700,
  });

  const temporaryFile = `${tokenFile}.tmp`;

  writeFileSync(
    temporaryFile,
    `GOOGLE_REFRESH_TOKEN=${JSON.stringify(refreshToken)}\n`,
    { mode: 0o600 },
  );

  renameSync(temporaryFile, tokenFile);
}

function createClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
}

export function getCalendarClient() {
  if (!connectedClient) {
    throw new Error("Google Calendar is not connected.");
  }

  return google.calendar({
    version: "v3",
    auth: connectedClient,
  });
}

// Start the authorization flow.
googleAuthRouter.get("/google", (req, res, next) => {
  const state = randomBytes(32).toString("hex");

  req.session.googleOAuth = {
    state,
    createdAt: Date.now(),
  };

  const client = createClient();

  const url = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar.events"],
    state,
  });

  req.session.save((error) => {
    if (error) return next(error);

    res.redirect(url);
  });
});

// Google sends the browser back here.
googleAuthRouter.get("/google/callback", async (req, res) => {
  res.set("Cache-Control", "no-store");
  res.set("Referrer-Policy", "no-referrer");

  const pending = req.session.googleOAuth;
  delete req.session.googleOAuth;

  if (
    !pending ||
    typeof req.query.state !== "string" ||
    req.query.state !== pending.state ||
    Date.now() - pending.createdAt > 10 * 60 * 1000
  ) {
    return res
      .status(400)
      .send(
        "Invalid or expired authorization request. Start again at /auth/google.",
      );
  }

  if (req.query.error) {
    return res
      .status(400)
      .send(
        "Google authorization was not completed. Start again at /auth/google.",
      );
  }

  if (typeof req.query.code !== "string") {
    return res.status(400).send("Missing authorization code.");
  }

  try {
    const client = createClient();

    const { tokens } = await client.getToken(req.query.code);

    client.setCredentials(tokens);

    // Verify access without returning personal event details.
    const calendar = google.calendar({
      version: "v3",
      auth: client,
    });

    await calendar.events.list({
      calendarId: process.env.GOOGLE_CALENDAR_ID || "primary",
      maxResults: 1,
      timeMin: new Date().toISOString(),
      singleEvents: true,
      fields: "kind",
    });

    if (!tokens.refresh_token) {
      throw new Error("No refresh token returned. Reconnect with consent.");
    }

    saveRefreshToken(tokens.refresh_token);
    connectedClient = client;

    return res.redirect("/auth/google/status");
  } catch (error) {
    console.error("Google authorization failed:", {
      status: error.response?.status,
      code: error.code,
    });

    return res
      .status(502)
      .send(
        "Could not connect to Google Calendar. Check your credentials, permissions, and Calendar API setup.",
      );
  }
});

googleAuthRouter.get("/google/status", (req, res) => {
  res.set("Cache-Control", "no-store");

  res.json({
    connected: Boolean(connectedClient),
    calendar: process.env.GOOGLE_CALENDAR_ID || "primary",
  });
});

export async function checkGoogleCalendarConnection() {
  if (!connectedClient) {
    return {
      status: "unavailable",
      code: "NOT_CONNECTED",
      message: "Google Calendar authorization is required.",
    };
  }

  const startedAt = Date.now();

  try {
    const calendar = getCalendarClient();

    await calendar.events.list(
      {
        calendarId: process.env.GOOGLE_CALENDAR_ID || "primary",
        maxResults: 1,
        timeMin: new Date().toISOString(),
        singleEvents: true,
        fields: "kind",
      },
      {
        timeout: 5000,
        retry: false,
      },
    );

    return {
      status: "available",
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    const upstreamStatus = error.response?.status;

    return {
      status: "unavailable",
      code:
        upstreamStatus === 401
          ? "AUTHENTICATION_FAILED"
          : upstreamStatus === 403
            ? "ACCESS_DENIED"
            : "GOOGLE_API_REQUEST_FAILED",
      upstreamStatus,
      durationMs: Date.now() - startedAt,
    };
  }
}
