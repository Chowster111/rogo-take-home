import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import {
  runAgent,
  type AgentDependencies,
  type AgentEvent,
  type ConversationMessage,
} from "./agent.ts";

const conversation = [{ role: "user" as const, content: "Research Acme." }];

function message(content: Anthropic.ContentBlock[]): Anthropic.Message {
  return { content } as Anthropic.Message;
}

function text(text: string): Anthropic.TextBlock {
  return { type: "text", text } as Anthropic.TextBlock;
}

function toolUse(
  id: string,
  name: string,
  input: Record<string, unknown> = {},
): Anthropic.ToolUseBlock {
  return { type: "tool_use", id, name, input, caller: { type: "direct" } };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("runAgent", () => {
  it("returns a direct text response", async () => {
    const dependencies: AgentDependencies = {
      createMessage: async () => message([text("Acme is growing.")]),
      executeTool: async () => {
        throw new Error("tool should not be called");
      },
    };

    const result = await runAgent(conversation, () => {}, { dependencies });

    expect(result).toEqual({ answer: "Acme is growing.", iterations: 1 });
  });

  it("limits model context to the most recent conversation messages", async () => {
    const longConversation: ConversationMessage[] = Array.from(
      { length: 13 },
      (_, index) => ({
        role: index % 2 === 0 ? "user" : "assistant",
        content: `message-${index}`,
      }),
    );
    let observedMessages: Anthropic.MessageParam[] = [];
    const dependencies: AgentDependencies = {
      createMessage: async (params) => {
        observedMessages = params.messages.map((message) => ({ ...message }));
        return message([text("Recent context used.")]);
      },
      executeTool: async () => {
        throw new Error("tool should not be called");
      },
    };

    await runAgent(longConversation, () => {}, { dependencies });

    expect(observedMessages).toHaveLength(9);
    expect(observedMessages[0].role).toBe("user");
    expect(observedMessages.map(({ content }) => content)).toEqual(
      Array.from({ length: 9 }, (_, index) => `message-${index + 4}`),
    );
  });

  it("starts independent tool calls in parallel and preserves result order", async () => {
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    const started: string[] = [];
    let observedToolResults: Anthropic.MessageParam["content"] | undefined;
    let modelCall = 0;

    const dependencies: AgentDependencies = {
      createMessage: async (params) => {
        modelCall++;
        if (modelCall === 1) {
          return message([
            toolUse("first-id", "firstTool"),
            toolUse("second-id", "secondTool"),
          ]);
        }

        observedToolResults = params.messages.at(-1)?.content;
        return message([text("Finished.")]);
      },
      executeTool: async (name) => {
        started.push(name);
        return name === "firstTool" ? first.promise : second.promise;
      },
    };

    const resultPromise = runAgent(conversation, () => {}, { dependencies });

    await vi.waitFor(() => {
      expect(started).toEqual(["firstTool", "secondTool"]);
    });
    second.resolve({ company: "Globex" });
    first.resolve({ company: "Acme" });

    const result = await resultPromise;

    expect(result.answer).toBe("Finished.");
    expect(observedToolResults).toEqual([
      {
        type: "tool_result",
        tool_use_id: "first-id",
        content: '{"company":"Acme"}',
      },
      {
        type: "tool_result",
        tool_use_id: "second-id",
        content: '{"company":"Globex"}',
      },
    ]);
  });

  it("keeps successful tool results when another tool fails", async () => {
    const events: AgentEvent[] = [];
    let observedToolResults: Anthropic.MessageParam["content"] | undefined;
    let modelCall = 0;

    const dependencies: AgentDependencies = {
      createMessage: async (params) => {
        modelCall++;
        if (modelCall === 1) {
          return message([
            toolUse("success-id", "successfulTool"),
            toolUse("failure-id", "failingTool"),
          ]);
        }

        observedToolResults = params.messages.at(-1)?.content;
        return message([text("Used the available result.")]);
      },
      executeTool: async (name) => {
        if (name === "failingTool") throw new Error("source unavailable");
        return { revenue: 100 };
      },
    };

    const result = await runAgent(conversation, (event) => events.push(event), {
      dependencies,
    });

    expect(result.answer).toBe("Used the available result.");
    expect(observedToolResults).toEqual([
      {
        type: "tool_result",
        tool_use_id: "success-id",
        content: '{"revenue":100}',
      },
      {
        type: "tool_result",
        tool_use_id: "failure-id",
        content: "failingTool returned: source unavailable",
        is_error: true,
      },
    ]);
    expect(events).toContainEqual({
      type: "tool_failed",
      name: "failingTool",
      message: "source unavailable",
    });
  });

  it("passes cancellation to an in-flight model request", async () => {
    const controller = new AbortController();
    let receivedSignal: AbortSignal | undefined;
    const dependencies: AgentDependencies = {
      createMessage: async (_params, signal) => {
        receivedSignal = signal;
        return new Promise<Anthropic.Message>((_resolve, reject) => {
          signal?.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        });
      },
      executeTool: async () => {
        throw new Error("tool should not be called");
      },
    };

    const result = runAgent(conversation, () => {}, {
      dependencies,
      signal: controller.signal,
    });
    const rejection = expect(result).rejects.toMatchObject({ name: "AbortError" });

    await vi.waitFor(() => expect(receivedSignal).toBe(controller.signal));
    controller.abort();

    await rejection;
  });

  it("returns the fallback after reaching the iteration limit", async () => {
    let modelCalls = 0;
    const dependencies: AgentDependencies = {
      createMessage: async () => {
        modelCalls++;
        return message([toolUse(`tool-${modelCalls}`, "loopingTool")]);
      },
      executeTool: async () => ({ found: true }),
    };

    const result = await runAgent(conversation, () => {}, { dependencies });

    expect(modelCalls).toBe(8);
    expect(result).toEqual({
      answer:
        "I looked at a number of sources but ran out of research steps before I could pull the answer together. Try asking a narrower question.",
      iterations: 8,
    });
  });
});
