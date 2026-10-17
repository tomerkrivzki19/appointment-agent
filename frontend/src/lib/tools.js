const SERVICE_URL = process.env.APPOINTMENT_SERVICE_URL;

async function requestService(path) {
  const startedAt = Date.now();

  try {
    const response = await fetch(`${SERVICE_URL}${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    const body = await response.json();

    return {
      reachable: true,
      ok: response.ok,
      statusCode: response.status,
      durationMs: Date.now() - startedAt,
      body,
    };
  } catch (error) {
    return {
      reachable: false,
      ok: false,
      durationMs: Date.now() - startedAt,
      error:
        error.name === "TimeoutError"
          ? "Request timed out after 8 seconds."
          : "Could not connect to the appointment service.",
    };
  }
}

export async function checkServiceHealth() {
  const health = await requestService("/health");

  // Also measure a real application endpoint.
  const appointments = await requestService("/appointments");

  return {
    health,
    appointments: {
      reachable: appointments.reachable,
      ok: appointments.ok,
      statusCode: appointments.statusCode,
      durationMs: appointments.durationMs,
      error: appointments.error ?? appointments.body?.error,
    },
  };
}

export async function getRecentLogs() {
  return requestService("/logs");
}

export async function checkDependencies() {
  return requestService("/dependencies");
}
