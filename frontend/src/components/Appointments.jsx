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

      setAppointments(data.appointments);
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

      setSuccess("Appointment booked! Click Refresh to update the list.");
      setName("");
      setStartsAt("");
      setLoaded(false);
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100";

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold">Appointments</h2>
        <p className="mt-1 text-sm text-slate-500">
          Book an appointment or check whether the service works.
        </p>
      </div>

      <form onSubmit={bookAppointment} className="space-y-4">
        <div>
          <label
            htmlFor="booking-name"
            className="mb-2 block text-sm font-medium"
          >
            Name
          </label>

          <input
            id="booking-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            disabled={busy}
            placeholder="Your name"
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="booking-time"
            className="mb-2 block text-sm font-medium"
          >
            Date and time
          </label>

          <input
            id="booking-time"
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            required
            disabled={busy}
            className={inputClass}
          />

          <p className="mt-2 text-xs text-slate-500">
            Uses your device’s local timezone.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={busy || !name.trim() || !startsAt}
            className="rounded-xl bg-teal-600 px-4 py-3 font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            Book appointment
          </button>

          <button
            type="button"
            onClick={loadAppointments}
            disabled={busy}
            className="rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Refresh appointments
          </button>
        </div>
      </form>

      {busy && (
        <p role="status" className="text-sm text-slate-500">
          Waiting for the appointment service…
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}

      {success && (
        <p role="status" className="rounded-xl bg-teal-50 p-3 text-teal-800">
          {success}
        </p>
      )}

      {loaded && (
        <div className="space-y-3 border-t border-slate-200 pt-4">
          {appointments.length === 0 ? (
            <p className="text-sm text-slate-500">
              No appointments booked yet.
            </p>
          ) : (
            appointments.map((appointment) => (
              <div
                key={appointment.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <p className="font-medium">{appointment.name}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {new Date(appointment.startsAt).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
