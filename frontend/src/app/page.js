"use client";

import { useState } from "react";
import Appointments from "@/components/Appointments";

export default function Home() {
  const [instruction, setInstruction] = useState(
    "Investigate why appointments cannot be saved.",
  );
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState("");
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");

  async function handleInvestigate(event) {
    event.preventDefault();

    setRunning(true);
    setError("");
    setReport("");
    setEvents([]);

    try {
      const response = await fetch("/api/investigate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ instruction }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Investigation failed.");
      }

      setReport(data.report || "");
      setEvents(data.events || []);
    } catch (error) {
      setError(error.message || "Could not complete the investigation.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-900">
      <div className="mx-auto max-w-3xl space-y-8">
        <header>
          <p className="mb-2 text-sm font-semibold tracking-widest text-teal-700">
            APPOINTMENT SERVICE
          </p>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            AI Investigator
          </h1>

          <p className="mt-3 leading-relaxed text-slate-500">
            Describe the issue. The agent will inspect the service and report
            its findings.
          </p>
        </header>
        <Appointments />
        <form
          onSubmit={handleInvestigate}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <label htmlFor="instruction" className="block font-medium">
            What should the agent investigate?
          </label>

          <textarea
            id="instruction"
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            rows={4}
            maxLength={2000}
            required
            disabled={running}
            placeholder="Describe the problem you want to investigate..."
            className="w-full resize-y rounded-xl border border-slate-300 bg-slate-50 p-4 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:opacity-60"
          />

          <button
            type="submit"
            disabled={running || !instruction.trim()}
            className="rounded-xl bg-teal-600 px-5 py-3 font-semibold text-white transition hover:bg-teal-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running ? "Investigating..." : "Investigate"}
          </button>

          {running && (
            <p role="status" className="text-sm text-slate-500">
              Checking the service and gathering evidence…
            </p>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"
            >
              {error}
            </p>
          )}
        </form>

        {report && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold">Investigation report</h2>

            <div className="whitespace-pre-wrap break-words leading-relaxed text-slate-700">
              {report}
            </div>
          </section>
        )}

        {events.length > 0 && (
          <section>
            <h2 className="mb-4 text-xl font-semibold">Tool activity</h2>

            <div className="space-y-3">
              {events.map((event, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <p className="break-words font-medium">
                    {event.type === "tool_called" ? "🔧" : "✅"} {event.tool}
                    <span className="ml-2 text-sm font-normal text-slate-500">
                      {event.type === "tool_called" ? "called" : "returned"}
                    </span>
                  </p>

                  {event.output !== undefined && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm font-medium text-teal-700">
                        View result
                      </summary>

                      <pre className="mt-3 max-h-80 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
                        {JSON.stringify(event.output, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
