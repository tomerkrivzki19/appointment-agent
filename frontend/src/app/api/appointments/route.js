const SERVICE_URL = process.env.APPOINTMENT_SERVICE_URL;

async function forwardRequest(method, body) {
  try {
    const response = await fetch(`${SERVICE_URL}/appointments`, {
      method,
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      ...(body !== undefined && {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    });

    const data = await response.json();

    return Response.json(data, { status: response.status });
  } catch {
    return Response.json(
      { error: "The appointment service is unreachable or timed out." },
      { status: 502 },
    );
  }
}

export async function GET() {
  return forwardRequest("GET");
}

export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  return forwardRequest("POST", body);
}
