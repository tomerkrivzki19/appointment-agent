import Groq from "groq-sdk";
import { checkServiceHealth, getRecentLogs, checkDependencies } from "./tools";

const toolFunctions = new Map([
  ["check_service_health", checkServiceHealth],
  ["get_recent_logs", getRecentLogs],
  ["check_dependencies", checkDependencies],
]);

const toolDescriptions = {
  check_service_health:
    "Check server health and measure appointment endpoint response time.",
  get_recent_logs: "Read recent application logs for errors and slow requests.",
  check_dependencies:
    "Check whether appointment storage and the calendar provider are available.",
};

const tools = [...toolFunctions.keys()].map((name) => ({
  type: "function",
  function: {
    name,
    description: toolDescriptions[name],
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
}));

export async function investigate(instruction) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is missing from .env.local.");
  }

  const key = process.env.GROQ_API_KEY;

  console.log("Groq key check:", {
    loaded: Boolean(key),
    startsWithGsk: key?.startsWith("gsk_"),
    hasOuterWhitespace: key ? key !== key.trim() : false,
  });

  const client = new Groq({
    apiKey: process.env.GROQ_API_KEY,
    timeout: 30000,
    maxRetries: 0,
  });

  const events = [];

  const messages = [
    {
      role: "system",
      content: `
Diagnostic reasoning rules:

- An HTTP status is a symptom, not a root cause.
- Correlate health, dependency results, and logs before concluding.
- Use the error codes and dependency names to explain the cause.

Interpret observed evidence:
- Storage unavailable + ECONNREFUSED:
  The appointment storage connection was refused.
- Calendar unavailable + ETIMEDOUT:
  The calendar provider request timed out.
- Calendar unavailable + NOT_CONNECTED:
  Google Calendar has not been authorized in this running service.
- AUTHENTICATION_FAILED:
  Google rejected authentication; reauthorization may be needed.
- ACCESS_DENIED:
  Google denied access. Check permissions and API configuration;
  the exact reason requires more evidence.
- Slow appointment requests with available dependencies:
  The appointment endpoint is slow. Do not invent a database,
  CPU, or network cause without supporting evidence.
- HTTP 409 with a calendar-busy message:
  Booking conflict, not a provider outage.

Always distinguish:
1. Observed symptom.
2. Supported cause.
3. What remains unknown.

Do not invent error codes or claim to know internal implementation.
Current checks take priority over older logs.
Before finishing a service investigation, call all three tools.
Read logs after health and dependency checks.
`,
    },
    {
      role: "user",
      content: instruction,
    },
  ];

  // Limit the investigation to avoid an endless tool-calling loop.
  for (let round = 0; round < 6; round++) {
    const response = await client.chat.completions.create({
      model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
      messages,
      tools,
      tool_choice: round === 0 ? "required" : "auto",
      parallel_tool_calls: false,
      max_completion_tokens: 1500,
    });

    const message = response.choices[0]?.message;

    if (!message) {
      throw new Error("The model returned no message.");
    }

    messages.push(message);

    if (!message.tool_calls?.length) {
      if (!message.content?.trim()) {
        throw new Error("The model returned an empty report.");
      }

      return {
        report: message.content,
        events,
      };
    }

    for (const call of message.tool_calls) {
      const name = call.function.name;

      events.push({
        type: "tool_called",
        tool: name,
      });

      let output;

      try {
        const execute = toolFunctions.get(name);

        if (!execute) {
          throw new Error("Unknown tool requested.");
        }

        const args = JSON.parse(call.function.arguments || "{}");

        if (
          !args ||
          Array.isArray(args) ||
          typeof args !== "object" ||
          Object.keys(args).length > 0
        ) {
          throw new Error("This tool accepts an empty object only.");
        }

        output = await execute();
      } catch {
        output = {
          error: "Tool execution failed or invalid arguments were supplied.",
        };
      }

      events.push({
        type: "tool_returned",
        tool: name,
        output,
      });

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(output),
      });
    }
  }

  throw new Error("Investigation reached its step limit. Please retry.");
}
