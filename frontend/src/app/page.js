"use client";

import { useState } from "react";
import Appointments from "@/components/Appointments";
import ReactMarkdown from "react-markdown";

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
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-5">
              <div
                aria-hidden="true"
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-xl"
              >
                📋
              </div>

              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Investigation report
                </h2>
                <p className="text-sm text-slate-500">
                  Findings based on diagnostic checks and recent logs
                </p>
              </div>
            </div>

            <div className="px-6 py-6 sm:px-8">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => (
                    <h3 className="mb-4 mt-6 text-xl font-bold text-slate-900 first:mt-0">
                      {children}
                    </h3>
                  ),
                  h2: ({ children }) => (
                    <h3 className="mb-3 mt-6 text-lg font-semibold text-slate-900 first:mt-0">
                      {children}
                    </h3>
                  ),
                  h3: ({ children }) => (
                    <h4 className="mb-3 mt-5 font-semibold text-slate-900 first:mt-0">
                      {children}
                    </h4>
                  ),
                  p: ({ children }) => (
                    <p className="mb-4 break-words text-sm leading-7 text-slate-600 last:mb-0">
                      {children}
                    </p>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold text-slate-900">
                      {children}
                    </strong>
                  ),
                  ul: ({ children }) => (
                    <ul className="mb-5 list-disc space-y-2 pl-5 text-sm leading-7 text-slate-600 marker:text-teal-600">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="mb-5 list-decimal space-y-2 pl-5 text-sm leading-7 text-slate-600 marker:font-semibold marker:text-teal-700">
                      {children}
                    </ol>
                  ),
                  code: ({ children }) => (
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-teal-800">
                      {children}
                    </code>
                  ),
                  pre: ({ children }) => (
                    <pre className="mb-5 overflow-x-auto rounded-xl bg-slate-100 p-4 text-sm">
                      {children}
                    </pre>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="mb-5 rounded-r-xl border-l-4 border-teal-500 bg-teal-50 px-4 py-3">
                      {children}
                    </blockquote>
                  ),
                  hr: () => <hr className="my-6 border-slate-200" />,
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-700 underline underline-offset-4"
                    >
                      {children}
                    </a>
                  ),
                }}
              >
                {report}
              </ReactMarkdown>
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
