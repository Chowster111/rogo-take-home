# Notes

## What I changed

- Removed the unconditional editor-model pass and made the research agent produce the final response directly, reducing one model call per request.
- Tightened the agent prompt, iteration limit, and output-token budget to improve grounding and bound worst-case cost and latency.
- Parallelized independent tool calls while preserving result order and isolating individual tool failures.
- Preserved recent conversation history for follow-ups while capping model context and request growth.
- Streamed tool progress to the UI so analysts see what the agent is doing during longer requests.
- Rendered assistant responses as safe GitHub-flavored Markdown with readable tables.
- Added request-size limits, runtime input validation, and safe client-facing API errors.
- Added flexible company lookup by normalized name, unique partial name, or ticker.
- Made model and tool dependencies injectable and added deterministic tests for completion, concurrency, failures, iteration limits, and tool resolution.

## Verification

- `npm run typecheck`
- `npm test` — 15 tests passing

## Deliberately deferred

- I did not add custom retries, request cancellation, or shorter timeouts. The research tools are local and deterministic, while the Anthropic SDK already provides retry and timeout defaults; end-to-end cancellation would require additional plumbing across the UI, server, agent loop, and SDK.
- I did not add a structured citation UI because the fictional source documents have titles and dates but no external URLs. Answers identify supporting periods and document titles in text; adding citation cards would require a larger structured-source response contract rather than fragile Markdown parsing.
