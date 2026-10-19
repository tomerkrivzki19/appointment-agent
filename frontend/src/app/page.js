"use client";

import { useState } from "react";
import Appointments from "@/components/Appointments";
import ReactMarkdown from "react-markdown";

const suggestions = [
  "Check whether the appointment service is healthy.",
  "Investigate why appointment booking is failing.",
  "Investigate slow appointment responses.",
];

const toolNames = {
  check_service_health: "Service health",
  check_dependencies: "Dependency check",
  get_recent_logs: "Application logs",
};

export default function Home() {
  const [instruction, setInstruction] = useState(suggestions[0]);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState("");
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");

  async function handleInvestigate(event) {
    event.preventDefault();
    if (running) return;

    setRunning(true);
    setError("");
    setReport("");
    setEvents([]);

    try {
      const response = await fetch("/api/investigate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  const completedTools = events.filter(
    (event) => event.type === "tool_returned",
  ).length;

  return (
    <main className="workspace">
      <nav className="topbar" aria-label="Main navigation">
        <a href="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            a
          </span>
          Appointment<span className="brand-light">Ops</span>
        </a>

        <span className="topbar-label">SERVICE INVESTIGATION WORKSPACE</span>

        <a
          className="button button-secondary button-small"
          href="https://calendar.google.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open Google Calendar ↗
        </a>
      </nav>

      <div className="dashboard">
        <header className="page-heading">
          <div>
            <p className="eyebrow">YOUR OPERATIONS, IN FOCUS</p>
            <h1>
              Book confidently.
              <br />
              Investigate clearly.
            </h1>
            <p className="page-description">
              Manage appointments and understand what happens when something
              goes wrong.
            </p>
          </div>

          <div className="heading-note">
            <span className="note-icon" aria-hidden="true">
              ↗
            </span>
            <div>
              <strong>From booking to evidence</strong>
              <p>One workspace for appointments and diagnostics.</p>
            </div>
          </div>
        </header>

        <div className="workspace-grid">
          <aside className="booking-column" aria-label="Appointment booking">
            <Appointments />
          </aside>

          <div className="investigation-column">
            <section className="panel">
              <div className="panel-heading">
                <div className="section-icon purple" aria-hidden="true">
                  ✦
                </div>
                <div>
                  <p className="eyebrow">AI ASSISTANT</p>
                  <h2>Investigate the service</h2>
                </div>
              </div>

              <p className="section-description">
                Describe an issue. The agent checks the service, inspects
                dependencies, and gathers evidence.
              </p>

              <form onSubmit={handleInvestigate}>
                <label className="field-label" htmlFor="instruction">
                  What would you like to investigate?
                </label>

                <textarea
                  id="instruction"
                  value={instruction}
                  onChange={(event) => setInstruction(event.target.value)}
                  rows={4}
                  maxLength={2000}
                  required
                  disabled={running}
                  placeholder="Describe the issue..."
                  className="field investigation-input"
                />

                <div className="suggestions">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="suggestion"
                      onClick={() => setInstruction(suggestion)}
                      disabled={running}
                    >
                      {
                        ["Health check", "Booking issue", "Slow responses"][
                          index
                        ]
                      }
                    </button>
                  ))}
                </div>

                <div className="form-footer">
                  <span className="muted small">
                    Read-only diagnosis. No appointments changed.
                  </span>

                  <button
                    type="submit"
                    disabled={running || !instruction.trim()}
                    className="button button-primary"
                  >
                    {running ? (
                      <>
                        <span className="spinner" aria-hidden="true" />
                        Investigating
                      </>
                    ) : (
                      <>
                        Run investigation <span aria-hidden="true">↗</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {error && (
                <p role="alert" className="notice error">
                  {error}
                </p>
              )}
            </section>

            <section className="panel report-panel" aria-busy={running}>
              <div className="report-heading">
                <div>
                  <p className="eyebrow">FINDINGS & EVIDENCE</p>
                  <h2>Investigation report</h2>
                </div>

                <span className={`badge ${report ? "badge-teal" : ""}`}>
                  {running
                    ? "In progress"
                    : report
                      ? "Report ready"
                      : "Awaiting investigation"}
                </span>
              </div>

              {running ? (
                <div className="empty-state" role="status">
                  <span className="loading-orbit" aria-hidden="true">
                    <span className="spinner" />
                  </span>
                  <h3>Gathering the evidence</h3>
                  <p>
                    The agent is running diagnostic tools. Findings and tool
                    activity appear when it finishes.
                  </p>
                </div>
              ) : report ? (
                <div className="report-content">
                  <ReactMarkdown
                    components={{
                      a: ({ href, children }) => (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {report}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="empty-state">
                  <span className="empty-icon" aria-hidden="true">
                    ⌕
                  </span>
                  <h3>A clearer picture starts here</h3>
                  <p>
                    Run an investigation to see the problem, supporting
                    evidence, and recommended next step.
                  </p>
                </div>
              )}
            </section>

            {events.length > 0 && (
              <section className="panel">
                <div className="report-heading">
                  <div>
                    <p className="eyebrow">BEHIND THE REPORT</p>
                    <h2>Diagnostic activity</h2>
                  </div>

                  <span className="badge">{completedTools} tool responses</span>
                </div>

                <div className="activity-list">
                  {events.map((event, index) => {
                    const returned = event.type === "tool_returned";

                    return (
                      <div className="activity-item" key={index}>
                        <span
                          className={`activity-dot ${returned ? "returned" : ""}`}
                          aria-hidden="true"
                        />

                        <div className="activity-body">
                          <div className="activity-title">
                            <strong>
                              {toolNames[event.tool] || event.tool}
                            </strong>
                            <span className="muted small">
                              {returned
                                ? "Response received"
                                : "Tool requested"}
                            </span>
                          </div>

                          {event.output !== undefined && (
                            <details className="tool-details">
                              <summary>Inspect tool response</summary>
                              <pre>{JSON.stringify(event.output, null, 2)}</pre>
                            </details>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        </div>

        <footer className="page-footer">
          <span>AppointmentOps</span>
          <span>Appointments · Diagnostics · Evidence</span>
        </footer>
      </div>
    </main>
  );
}
