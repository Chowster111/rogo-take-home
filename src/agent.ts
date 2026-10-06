/**
 * The research agent: a tool-use loop over the mocked research tools.
 */

import Anthropic from "@anthropic-ai/sdk";
import { companies } from "./data.ts";
import { executeTool, toolSchemas } from "./tools.ts";

const MODEL = process.env.ROGO_MODEL ?? "claude-sonnet-5";
const MAX_ITERATIONS = 8;
const MAX_CONVERSATION_MESSAGES = 9;

let client: Anthropic | undefined;

const SYSTEM_PROMPT = `You are Rogo Research, an assistant that answers company questions for financial analysts.

Research efficiently:
- Use the tools to look up company profiles, financials, and source documents.
- Do not repeat a tool call unless a failure or new evidence makes it necessary.
- When tool evidence is insufficient, say what is missing rather than guessing.

Write the final response yourself:
- Lead with a direct, concise answer to the analyst's question.
- Support conclusions with specific retrieved figures, periods, or document titles.
- Clearly distinguish reported facts from your interpretation.
- Keep the response polished, brief, and easy to scan.

Our coverage universe:
${companies
  .map(
    (c) =>
      `- ${c.name} (${c.ticker}) — ${c.sector}, HQ ${c.hq}, ${c.employees} employees. ${c.description}`,
  )
  .join("\n")}
`;

export type AgentEvent =
  | { type: "iteration"; n: number }
  | { type: "tool_start"; name: string; input: unknown }
  | { type: "tool_end"; name: string; ms: number }
  | { type: "tool_failed"; name: string; message: string };

export interface AgentResult {
  answer: string;
  iterations: number;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AgentDependencies {
  createMessage: (
    params: Anthropic.MessageCreateParamsNonStreaming,
  ) => Promise<Anthropic.Message>;
  executeTool: typeof executeTool;
}

const defaultDependencies: AgentDependencies = {
  createMessage: (params) => {
    client ??= new Anthropic();
    return client.messages.create(params);
  },
  executeTool,
};

function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

function recentConversation(conversation: ConversationMessage[]) {
  const recent = conversation.slice(-MAX_CONVERSATION_MESSAGES);
  const firstUser = recent.findIndex((message) => message.role === "user");
  return firstUser > 0 ? recent.slice(firstUser) : recent;
}

export async function runAgent(
  conversation: ConversationMessage[],
  onEvent: (event: AgentEvent) => void,
  dependencies: AgentDependencies = defaultDependencies,
): Promise<AgentResult> {
  const messages: Anthropic.MessageParam[] = recentConversation(conversation).map(
    (message) => ({
      role: message.role,
      content: message.content,
    }),
  );

  let draft = "";
  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    onEvent({ type: "iteration", n: iterations });

    const response = await dependencies.createMessage({
      model: MODEL,
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      tools: toolSchemas,
      messages,
    });

    messages.push({ role: "assistant", content: response.content });

    const toolUses = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );

    if (toolUses.length === 0) {
      draft = textOf(response);
      break;
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUses.map(async (use) => {
        const startedAt = Date.now();
        onEvent({ type: "tool_start", name: use.name, input: use.input });

        let content: string;
        let isError = false;
        try {
          const output = await dependencies.executeTool(use.name, use.input);
          content = JSON.stringify(output);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          content = `${use.name} returned: ${message}`;
          isError = true;
          onEvent({ type: "tool_failed", name: use.name, message });
        }

        onEvent({ type: "tool_end", name: use.name, ms: Date.now() - startedAt });
        const result: Anthropic.ToolResultBlockParam = {
          type: "tool_result",
          tool_use_id: use.id,
          content,
        };
        if (isError) result.is_error = true;
        return result;
      }),
    );

    messages.push({ role: "user", content: toolResults });
  }

  if (!draft) {
    draft =
      "I looked at a number of sources but ran out of research steps before I could pull the answer together. Try asking a narrower question.";
  }

  return { answer: draft, iterations };
}
