import { useState } from "react";

interface Message {
  role: "user" | "assistant";
  text: string;
  isError?: boolean;
}

type StreamEvent =
  | { type: "progress"; message: string }
  | { type: "answer"; answer: string }
  | { type: "error"; message: string };

function parseStreamEvent(line: string): StreamEvent {
  const event = JSON.parse(line) as Partial<StreamEvent>;

  if (event.type === "progress" && typeof event.message === "string") {
    return { type: "progress", message: event.message };
  }
  if (event.type === "answer" && typeof event.answer === "string") {
    return { type: "answer", answer: event.answer };
  }
  if (event.type === "error" && typeof event.message === "string") {
    return { type: "error", message: event.message };
  }

  throw new Error("Received an invalid response from the server.");
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

  async function send(question: string) {
    if (!question.trim() || busy) return;

    const userMessage: Message = { role: "user", text: question.trim() };
    const conversation = [...messages.filter((message) => !message.isError), userMessage];

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setBusy(true);
    setProgress("Thinking…");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `Something went wrong: ${String(err)}`,
          isError: true,
        },
      ]);
    }

    setBusy(false);
  }

  return (
    <div className="app">
      <header>
        <h1>Rogo Research</h1>
        <p>Ask a question about a company in our coverage universe.</p>
      </header>

      <div className="transcript">
        {messages.length === 0 && (
          <div className="examples">
            {EXAMPLES.map((example) => (
              <button key={example} onClick={() => send(example)}>
                {example}
              </button>
            ))}
          </div>
        )}

        {messages.map((message, i) => (
          <div key={i} className={`bubble ${message.role}`}>
            {message.text}
          </div>
        ))}

        {busy && <div className="bubble assistant pending">{progress}</div>}
      </div>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a research question…"
          disabled={busy}
        />
        <button type="submit" disabled={busy}>
          Send
        </button>
      </form>
    </div>
  );
}
