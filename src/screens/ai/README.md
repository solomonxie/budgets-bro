# AI Analysis

```
AiAnalysisScreen.tsx
┌───────────────────────────────┐
│ No key yet: hint + link to      │──→ secureStore.getAiApiKey() (Settings'
│  Settings' OpenAI section       │    own OpenAI section owns entering it)
├───────────────────────────────┤
│ Analysis kind (Spending/         │──→ ../../ai/prompts.ts's ANALYSIS_KINDS
│  Variance/Forecast) segmented    │
├───────────────────────────────┤
│ Privacy Mode checkbox            │──→ ../../domain/aiAnalysis.ts's
│                                   │    redactForPrivacy() before sending
├───────────────────────────────┤
│ Run Analysis button              │──→ builds an AnalysisContext from
│                                   │    useAccounts/useCategories/useInsights
│                                   │    + budgetsRepo.assignedThisMonthByCategory,
│                                   │    then ../../ai/openaiClient.ts
├───────────────────────────────┤
│ Result text / error message      │──→ inline
└───────────────────────────────┘
```

Local budget data only leaves the device on "Run Analysis" — a single request straight to OpenAI with the user's own key, never proxied or stored by this app.

`domain/aiAnalysis.ts` (pure, unit-tested): shapes DB reads into `AnalysisContext`, formats it as a plain-text block for the prompt, and Privacy Mode's redaction (round to nearest $10, anonymize category names).

`ai/prompts.ts`: one instruction template per analysis kind, all sharing one system prompt.

`ai/openaiClient.ts`: a plain `fetch` call to Chat Completions (`gpt-4o-mini`) — no SDK, same choice as `sync/s3Provider.ts`'s hand-rolled SigV4 over the AWS SDK.
