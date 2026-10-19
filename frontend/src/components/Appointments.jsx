"use client";

import { useState } from "react";

export default function Appointments() {
  const [name, setName] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [appointments, setAppointments] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadAppointments() {
    if (busy) return;

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/appointments", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load appointments.");
      }

      setAppointments(data.appointments || []);
      setLoaded(true);
    } catch (error) {
      setError(error.message);
      setLoaded(false);
    } finally {
      setBusy(false);
    }
  }

  async function bookAppointment(event) {
    event.preventDefault();
    if (busy) return;

    const date = new Date(startsAt);

    if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
      setError("Choose a valid future date and time.");
      setSuccess("");
      return;
    }

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          startsAt: date.toISOString(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not book appointment.");
      }

      setSuccess("Appointment booked. Refresh the list to view it.");
      setName("");
      setStartsAt("");
      setLoaded(false);
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="booking-stack">
      <section className="panel">
        <div className="panel-heading">
          <div className="section-icon teal" aria-hidden="true">
            ▦
          </div>
          <div>
            <p className="eyebrow">MAKE TIME</p>
            <h2>New appointment</h2>
          </div>
        </div>

        <p className="section-description">
          Choose a time. Your booking is added to Google Calendar.
        </p>

        <form onSubmit={bookAppointment} className="booking-form">
          <div>
            <label htmlFor="booking-name" className="field-label">
              Appointment name
            </label>

            <input
              id="booking-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              disabled={busy}
              placeholder="e.g. Project presentation"
              className="field"
            />
          </div>

          <div>
            <label htmlFor="booking-time" className="field-label">
              Date & time
            </label>

            <input
              id="booking-time"
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              required
              disabled={busy}
              className="field"
            />
          </div>

          <div className="booking-meta">
            <span>30-minute appointment</span>
            <span>Device local time</span>
          </div>

          <button
            type="submit"
            disabled={busy || !name.trim() || !startsAt}
            className="button button-primary button-full"
          >
            {busy ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Please wait
              </>
            ) : (
              <>
                Book appointment <span aria-hidden="true">↗</span>
              </>
            )}
          </button>
        </form>

        {busy && (
          <p role="status" className="muted small feedback">
            Waiting for the appointment service…
          </p>
        )}

        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="notice success">
            {success}
          </p>
        )}
      </section>

      <section className="panel">
        <div className="report-heading">
          <div>
            <p className="eyebrow">YOUR BOOKINGS</p>
            <h2>Appointment list</h2>
          </div>

          <button
            type="button"
            onClick={loadAppointments}
            disabled={busy}
            className="button button-secondary button-small"
          >
            Refresh
          </button>
        </div>

        {!loaded ? (
          <div className="list-placeholder">
            <p>View bookings from this running service.</p>
            <span className="muted small">
              Click Refresh to load appointments.
            </span>
          </div>
        ) : appointments.length === 0 ? (
          <div className="list-placeholder">
            <p>Your schedule has room.</p>
            <span className="muted small">
              Create your first appointment above.
            </span>
          </div>
        ) : (
          <div className="appointment-list">
            {[...appointments]
              .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
              .map((appointment) => {
                const date = new Date(appointment.startsAt);

                return (
                  <article className="appointment-item" key={appointment.id}>
                    <div className="date-tile">
                      <span>
                        {date.toLocaleDateString(undefined, { month: "short" })}
                      </span>
                      <strong>{date.getDate()}</strong>
                    </div>

                    <div className="appointment-info">
                      <h3>{appointment.name}</h3>
                      <p>
                        {date.toLocaleDateString(undefined, {
                          weekday: "short",
                          year: "numeric",
                        })}
                        {" · "}
                        {date.toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>

                      {appointment.calendarLink && (
                        <a
                          href={appointment.calendarLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-link"
                        >
                          View in Calendar ↗
                        </a>
                      )}
                    </div>
                  </article>
                );
              })}
          </div>
        )}

        <p className="list-footnote">
          Local booking history resets when the backend restarts. Google
          Calendar events remain saved.
        </p>
      </section>
    </div>
  );
}
