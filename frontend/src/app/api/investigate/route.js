import { investigate } from "@/lib/agent";

export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const instruction = body?.instruction;

  if (
    typeof instruction !== "string" ||
    !instruction.trim() ||
    instruction.length > 2000
  ) {
    return Response.json(
      { error: "Provide an instruction between 1 and 2000 characters." },
      { status: 400 },
    );
  }

  try {
    const result = await investigate(instruction.trim());

    return Response.json(result);
  } catch (error) {
    // Log only diagnostic metadata, never the API key.
    console.error("Investigation failed:", {
      name: error.name,
      status: error.status,
    });

    const rateLimited = error.status === 429;

    return Response.json(
      {
        error: rateLimited
          ? "Groq's rate limit was reached. Wait a moment and retry."
          : "Investigation failed. Check the API key, model access, and server terminal.",
      },
      { status: rateLimited ? 429 : 500 },
    );
  }
}
