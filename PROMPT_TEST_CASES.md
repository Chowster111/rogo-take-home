# Quick Test Checklist

## 1. Main comparison

> Compare ACME and GLBX across revenue growth, margins, and free cash flow. Use a table and finish with a bold conclusion.

Check: progress appears, tools run in parallel, `ACME` resolves correctly, and the table renders with borders.

## 2. Ambiguity and follow-ups

1. `Compare Acme and Globex.`
2. `Now compare its margins with Initech.`
3. `Summarize the difference in three bullets.`

Check: Acme ambiguity is acknowledged, follow-up context works, and bullets render correctly.

## 3. Documents and failure recovery

1. `What are Umbrella Health's three biggest risks? Name the supporting documents.`
2. `Search filings using exactly these seven keywords: revenue margin competition regulation customer supply inflation.`

Check: document progress appears, sources are named, and the seven-term failure is retried or explained.

## 4. Missing data

> Compare ACME and GLBX, then give me their current share prices and valuation multiples.

Check: supported analysis is provided, but unavailable market data is not invented.

## 5. Edit and Stop

- Ask `Compare ACME and GLBX.`, click **Edit**, change `GLBX` to `ITCH`, and resend. The old branch should be removed.
- Ask `Which company grew fastest? Compare all companies.`, then click **Stop**. Research should stop without an error bubble.

## Automated checks

```bash
npm run typecheck
npm test
```
# Quick Manual Test Checklist

Watch the browser and server logs while running these tests.

## 1. Comparison, progress, and Markdown

> Compare ACME and GLBX across revenue growth, margins, and free cash flow. Use a table and finish with a bold conclusion.

Check that:

- `ACME` resolves to Acme Corp.
- Progress messages appear.
- Multiple tools start in parallel in the server logs.
- The table has visible borders and the bold conclusion renders correctly.

## 2. Ambiguous names

> Compare Acme and Globex.

Check that the answer acknowledges Acme Corp and Acme Robotics rather than silently mixing their data.

## 3. Conversation follow-ups

Ask these in order:

1. `How is Initech's subscription transition going?`
2. `How does its gross-margin trend compare with Globex?`
3. `Summarize the difference in three bullets.`

Check that “its” still means Initech and the final bullets use both companies.

## 4. Documents and tool-failure recovery

First ask:

> What are the three biggest risks Umbrella Health identifies? Name the supporting documents or periods.

Then ask:

> Search filings using exactly these seven keywords: revenue margin competition regulation customer supply inflation.

Check that document-search progress appears, sources are identified, and the seven-term failure is retried or clearly explained.

## 5. Missing data and unsupported capabilities

> Compare ACME and GLBX, then give me their current share prices and valuation multiples.

Check that the operating comparison is answered, but unavailable market data is not invented.

Then ask:

> What was Wayne Enterprises' FY2025 revenue?

Check that it is identified as outside the coverage universe.

## 6. Edit and Stop

### Edit

1. Ask `Compare ACME and GLBX.`
2. Wait for the answer and click **Edit**.
3. Change `GLBX` to `ITCH` and resend.

Check that the old prompt and answer are removed and the edited prompt starts a clean branch.

### Stop

1. Ask `Which company in the coverage universe grew fastest? Compare all companies.`
2. Click **Stop** while progress is visible.

Check that research stops, no error bubble appears, and the composer becomes available again.

