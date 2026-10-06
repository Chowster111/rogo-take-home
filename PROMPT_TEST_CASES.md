# Prompt Test Cases

Use these cases for manual end-to-end testing. Watch both the browser and server logs while each prompt runs.

## 1. Company comparison

**Prompt**

> Compare ACME and GLBX across revenue growth, margins, operating income, and free cash flow. Present the figures in a Markdown table, clearly distinguish facts from your interpretation, and finish with a bold conclusion about which company is growing faster.

**Validates**

- Uppercase ticker resolution
- Parallel financial and profile tool calls
- Live progress messages
- Markdown tables and bold text
- Evidence-grounded conclusions

**Expected**

- ACME resolves to Acme Corp rather than Acme Robotics.
- Multiple tool calls start before earlier calls finish.
- The UI shows progress such as “Loading financials…”.
- The final answer contains a bordered table and a supported conclusion.

## 2. Ambiguous company name

**Prompt**

> Compare Acme and Globex.

**Validates**

- Ambiguous-name handling
- Transparent assumptions
- Flexible partial-name resolution

**Expected**

- The answer acknowledges that “Acme” could mean Acme Corp or Acme Robotics.
- It either asks for clarification or explicitly states and justifies its interpretation.
- It does not silently mix data from the two Acme companies.

## 3. Lowercase tickers

**Prompt**

> Is itch growing faster than glbx? Compare their FY2021–FY2025 revenue growth and gross-margin trends.

**Validates**

- Case-insensitive ticker fallback
- Financial comparison
- Period-specific grounding

**Expected**

- `itch` resolves to Initech and `glbx` resolves to Globex.
- The answer uses retrieved figures and identifies the comparison period.

## 4. Follow-up context

Run these prompts in the same conversation.

**Prompt 1**

> How is Initech's subscription transition going?

**Prompt 2**

> How does its gross-margin trend compare with Globex?

**Prompt 3**

> Summarize the most important difference in three bullets.

**Validates**

- Conversation-history preservation
- Pronoun and company-reference resolution
- Recent-context reuse
- Markdown lists

**Expected**

- “Its” continues to refer to Initech.
- The third answer reflects both companies without requiring their names again.
- The bullet list renders correctly.

## 5. Filing research

**Prompt**

> What are the three biggest risks Umbrella Health identifies in its filings? Separate reported facts from your interpretation and name the supporting document titles or periods.

**Validates**

- Document search
- Source attribution
- Fact-versus-interpretation guidance
- Search progress streaming

**Expected**

- The UI shows “Searching documents…”.
- Claims are tied to retrieved filing titles or periods.
- The answer acknowledges missing evidence rather than inventing details.

## 6. Broad universe comparison

**Prompt**

> Which company in the coverage universe grew revenue fastest from FY2021 to FY2025? Compare every company in one table and explain any important data-quality caveats.

**Validates**

- Multiple parallel tool calls
- Broad research and stopping behavior
- Tool-result ordering
- Markdown table overflow

**Expected**

- All covered companies are considered.
- The table remains usable on a narrow screen with horizontal scrolling.
- The agent reaches a final answer without exhausting eight iterations.

## 7. Tool-failure recovery

**Prompt**

> Search the filings using exactly these seven keywords: revenue margin competition regulation customer supply inflation. Summarize what you find.

**Validates**

- Document-search term limit
- `is_error` tool-result signaling
- Recovery after one tool failure
- User-facing failure progress

**Expected**

- The initial seven-term search fails.
- The agent retries with six or fewer useful terms, or clearly explains the limitation.
- A tool failure does not prevent a final response.

## 8. Unknown company

**Prompt**

> What was Wayne Enterprises' FY2025 revenue, margin, and free cash flow?

**Validates**

- Coverage-boundary handling
- Unknown-company errors
- Hallucination resistance

**Expected**

- The agent states that the company is outside the coverage universe.
- It does not invent financial figures.

## 9. Unsupported capability request

**Prompt**

> Compare ACME and GLBX, then tell me their current share prices, valuation multiples, and which stock is cheaper.

**Validates**

- Unsupported-capability guardrail
- Separation of available and unavailable analysis

**Expected**

- The agent may provide the supported operating comparison.
- It clearly states that current market prices and valuation multiples are unavailable.
- It does not fabricate values or offer to retrieve unavailable market data.

## 10. Recent-history cap

Run at least six user/assistant exchanges in one conversation, changing companies several times. Finish with:

> Based only on our most recent comparison, which company had the stronger margin trend?

**Validates**

- Nine-message context cap
- Full transcript remains visible
- Recent context remains useful after older context is trimmed

**Expected**

- The UI still displays the complete transcript.
- The answer uses the recent comparison rather than unrelated early messages.
- Request size and model context do not grow without bound.

## Regression checks

After manual testing, run:

```bash
npm run typecheck
npm test
```

Expected result: typecheck succeeds and all tests pass.
