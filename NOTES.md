# Notes

## What I changed

- Removed the unconditional editor-model pass and made the research agent produce the final response directly, reducing one model call per request.
- Tightened the agent prompt, iteration limit, and output-token budget to improve grounding and bound worst-case cost and latency.
- Parallelized independent tool calls while preserving result order and isolating individual tool failures.
- Preserved conversation history so follow-up questions retain context.
- Streamed tool progress to the UI so analysts see what the agent is doing during longer requests.
- Added request-size limits, runtime input validation, and safe client-facing API errors.
- Added flexible company lookup by normalized name, unique partial name, or ticker.
- Made model and tool dependencies injectable and added deterministic tests for completion, concurrency, failures, iteration limits, and tool resolution.

## Verification

- `npm run typecheck`
- `npm test` — 12 tests passing

## Deliberately deferred

- Conversation history is sent in full; a production version should cap or summarize long conversations to control context growth.
- I did not add retries, cancellation, or per-call timeouts because the provided tools are local and deterministic.
- I kept answer rendering as plain text rather than adding Markdown or structured citation UI.
