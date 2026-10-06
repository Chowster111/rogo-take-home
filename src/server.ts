import "dotenv/config";
import express from "express";
import type { ErrorRequestHandler } from "express";
import { runAgent, type ConversationMessage } from "./agent.ts";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    "\nANTHROPIC_API_KEY is not set.\nCopy .env.example to .env and add your key, then run `npm run dev` again.\n",
  );
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: "16kb" }));

const INTERNAL_ERROR_MESSAGE =
  "Unable to complete the research request right now. Please try again.";

function isConversationMessage(value: unknown): value is ConversationMessage {
  if (typeof value !== "object" || value === null) return false;

  const message = value as Record<string, unknown>;
  return (
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string" &&
    message.content.trim().length > 0
  );
}

app.post("/api/chat", async (req, res) => {
  const conversation = req.body?.messages;
  if (
    !Array.isArray(conversation) ||
    conversation.length === 0 ||
    !conversation.every(isConversationMessage) ||
    conversation.at(-1)?.role !== "user"
  ) {
    res
      .status(400)
      .json({ error: "A conversation ending with a user message is required." });
    return;
  }

  const latestMessage = conversation.at(-1)!;
  console.log(`\n[chat] ${latestMessage.content}`);

  try {
    const result = await runAgent(conversation, (event) => {
      switch (event.type) {
        case "iteration":
          console.log(`[agent] iteration ${event.n}`);
          break;
        case "tool_start":
          console.log(`[tool]  → ${event.name} ${JSON.stringify(event.input)}`);
          break;
        case "tool_end":
          console.log(`[tool]  ← ${event.name} (${event.ms}ms)`);
          break;
        case "tool_failed":
          console.log(`[tool]  ! ${event.name}: ${event.message}`);
          break;
      }
    });

    res.json({ answer: result.answer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: INTERNAL_ERROR_MESSAGE });
  }
});

const handleJsonError: ErrorRequestHandler = (err, _req, res, _next) => {
  const httpError = err as Error & { status?: number; type?: string };

  if (httpError.type === "entity.too.large") {
    res.status(413).json({ error: "Request body is too large." });
    return;
  }

  if (httpError.type === "entity.parse.failed" || httpError.status === 400) {
    res.status(400).json({ error: "Request body must contain valid JSON." });
    return;
  }

  console.error(err);
  res.status(500).json({ error: INTERNAL_ERROR_MESSAGE });
};

app.use(handleJsonError);

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  console.log(`Agent server listening on http://localhost:${port}`);
});
