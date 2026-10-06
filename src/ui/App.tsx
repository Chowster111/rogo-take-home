import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  role: "user" | "assistant";
  text: string;
  isError?: boolean;
}

type StreamEvent =
  | { type: "progress"; message: string }
  | { type: "answer_start" }
  | { type: "answer_delta"; text: string }
  | { type: "answer_reset" }
  | { type: "answer"; answer: string }
  | { type: "error"; message: string };

const MAX_CONTEXT_MESSAGES = 9;

export function MarkdownMessage({ text }: { text: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>;
}

function parseStreamEvent(line: string): StreamEvent {
  const event = JSON.parse(line) as Partial<StreamEvent>;

  if (event.type === "progress" && typeof event.message === "string") {
    return { type: "progress", message: event.message };
  }
  if (event.type === "answer_start") {
    return { type: "answer_start" };
  }
  if (event.type === "answer_delta" && typeof event.text === "string") {
    return { type: "answer_delta", text: event.text };
  }
  if (event.type === "answer_reset") {
    return { type: "answer_reset" };
  }
  if (event.type === "answer" && typeof event.answer === "string") {
    return { type: "answer", answer: event.answer };
  }
  if (event.type === "error" && typeof event.message === "string") {
    return { type: "error", message: event.message };
  }

  throw new Error("Received an invalid response from the server.");
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

const EXAMPLES = [
  "Compare Acme and Globex and tell me which one appears to be growing faster.",
  "What are the biggest risks Umbrella Health flags in its filings?",
  "How is Initech's subscription transition going?",
  "Which company in the universe is growing fastest?",
];

export function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("Thinking…");
  const [streamingAnswer, setStreamingAnswer] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({
      behavior: messages.length > 1 ? "smooth" : "auto",
      block: "end",
    });
  }, [messages, progress, streamingAnswer, busy]);

  let latestUserIndex = -1;
  messages.forEach((message, index) => {
    if (message.role === "user") latestUserIndex = index;
  });

  function editPrompt(index: number) {
    const message = messages[index];
    if (busy || !message || message.role !== "user") return;

    setMessages((previous) => previous.slice(0, index));
    setInput(message.text);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function stopResearch() {
    abortControllerRef.current?.abort();
  }

  function startNewChat() {
    if (busy) return;
    setMessages([]);
    setInput("");
    setProgress("Thinking…");
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  async function send(question: string) {
    if (!question.trim() || busy) return;

    const userMessage: Message = { role: "user", text: question.trim() };
    const recentMessages = messages
      .filter((message) => !message.isError)
      .slice(-(MAX_CONTEXT_MESSAGES - 1));
    const conversation = [...recentMessages, userMessage];

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setBusy(true);
    setProgress("Thinking…");
    setStreamingAnswer(null);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: conversation.map(({ role, text }) => ({
            role,
            content: text,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed with status ${res.status}`);
      }

      if (!res.body) {
        throw new Error("The server did not return a response stream.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer: string | undefined;

      const handleLine = (line: string) => {
        if (!line.trim()) return;

        const event = parseStreamEvent(line);
        if (event.type === "progress") setProgress(event.message);
        if (event.type === "answer_start") setStreamingAnswer("");
        if (event.type === "answer_delta") {
          setStreamingAnswer((current) => (current ?? "") + event.text);
        }
        if (event.type === "answer_reset") setStreamingAnswer(null);
        if (event.type === "answer") answer = event.answer;
        if (event.type === "error") throw new Error(event.message);
      };

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        lines.forEach(handleLine);

        if (done) break;
      }

      handleLine(buffer);
      const finalAnswer = answer;
      if (finalAnswer === undefined) {
        throw new Error("The server response ended before returning an answer.");
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: finalAnswer },
      ]);
      setStreamingAnswer(null);
    } catch (err) {
      if (!isAbortError(err)) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: `Something went wrong: ${String(err)}`,
            isError: true,
          },
        ]);
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setStreamingAnswer(null);
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <header>
        <div>
          <h1>Rogo Research</h1>
          <p>Ask a question about a company in our coverage universe.</p>
        </div>
        {!busy && messages.length > 0 && (
          <button type="button" className="new-chat" onClick={startNewChat}>
            New chat
          </button>
        )}
      </header>

      <div
        className="transcript"
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-busy={busy}
      >
        {messages.length === 0 && (
          <div className="examples">
            {EXAMPLES.map((example) => (
              <button key={example} onClick={() => send(example)}>
                {example}
              </button>
            ))}
          </div>
        )}

        {messages.map((message, index) => (
          <div key={index} className={`message-row ${message.role}`}>
            <div className={`bubble ${message.role}`}>
              {message.role === "assistant" ? (
                <MarkdownMessage text={message.text} />
              ) : (
                message.text
              )}
            </div>
            {!busy && message.role === "user" && index === latestUserIndex && (
              <button
                type="button"
                className="edit-prompt"
                aria-label={`Edit prompt: ${message.text}`}
                onClick={() => editPrompt(index)}
              >
                Edit
              </button>
            )}
          </div>
        ))}

        {busy && streamingAnswer !== null && (
          <div className="bubble assistant streaming-answer" aria-hidden="true">
            <MarkdownMessage text={streamingAnswer} />
          </div>
        )}
        {busy && streamingAnswer === null && (
          <div className="bubble assistant pending" role="status">
            <span className="progress-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span>{progress}</span>
          </div>
        )}
        <div ref={transcriptEndRef} className="transcript-end" aria-hidden="true" />
      </div>

      <form
        className="composer"
        aria-label="Research question"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a research question…"
          aria-label="Ask a research question"
          disabled={busy}
        />
        {busy ? (
          <button
            type="button"
            className="stop"
            aria-label="Stop research"
            onClick={stopResearch}
          >
            Stop
          </button>
        ) : (
          <button type="submit">Send</button>
        )}
      </form>
    </div>
  );
}
