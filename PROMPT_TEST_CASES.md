# Quick Test Checklist

## 1. Main comparison

> Compare ACME and GLBX across revenue growth, margins, and free cash flow. Use a table and finish with a bold conclusion.

Check: progress appears, tools run in parallel, answer text streams in incrementally, `ACME` resolves correctly, and the completed table renders with borders.

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

## 6. Chat controls

Check that long answers scroll into view, keyboard focus is visible, and **New chat** clears the transcript and focuses the composer.

## Automated checks

```bash
npm run typecheck
npm test
```

