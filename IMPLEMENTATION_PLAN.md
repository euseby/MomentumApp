# Oasis — Implementation Plan (for the coding agent)

> Read this whole file before touching code. Then work **phase by phase** (section 5). After each phase: run tests, commit, and give a 5-line summary of what changed and what is left. Do not start the next phase until told to, unless the user says "continue".

## 0. How to work

- **Inspect the repo first** (backend structure, frontend framework, package managers, existing tests). Do not assume; adapt this plan to what is really there.
- Keep the existing visual identity (dark UI, green accent, cyan labels, island hero). Do not redesign. Extend it.
- **UI copy is in Romanian. Code, comments, commit messages and docs are in English.**
- If something is ambiguous, pick the simplest option, and record the choice in `DECISIONS.md` (one line each). Only ask the user if you are truly blocked.
- Never commit secrets. Keys live in `.env`; keep `.env.example` updated.

## 1. Product context

**Oasis** is a gamified savings app for people in Romania. The user builds a virtual island. They import a bank statement; the app finds a recurring spending habit (e.g. coffee), proposes *reducing* it (not eliminating it), and the saved amount is "invested" (simulated) into a Romanian instrument. Good decisions earn **credits**, which buy island items and "bananas" to nudge friends into saving too.

This is for a hackathon (Stripe challenge: *Rethinking Financial Futures*, Romania). Jury weights: Challenge fit & differentiation 20%, UX 25%, Technical implementation 25%, Delivery & pitch 20%, Business mentoring 10%. The demo must make clear:
1. who it serves and what problem it solves,
2. how the core experience works end to end,
3. why it is relevant in Romania,
4. which assumptions, data sources, regulatory considerations and limitations apply.

**Everything is a simulation. No real money moves and nothing is really invested.** Make this visible in the UI ("Simulare") and in the Assumptions page.

## 2. Hard rules

1. **Numbers are computed in code, never by the LLM.** The LLM only writes text (title, story, tone) and picks a reward from a catalog.
2. **Privacy by design.** The LLM receives only aggregated data (category totals, one habit object). Never the raw statement, IBANs, or names of private persons. The raw uploaded file is processed in memory and not stored.
3. **Credits cannot be bought with money.** Stripe (test mode) may only top up the *simulated savings balance*, never credits.
4. **Banana mechanic is friends-only, opt-in, and cosmetic.** No financial penalty, rate-limited, and the receiver can mute a sender. See 4.5.
5. **No hardcoded fake missions on LLM failure.** Return a clear error (existing behavior and tests). The only allowed fallback is the explicit cache described in 8.
6. **Auth and database are being built by a teammate.** Code against a repository interface (section 3). Do not build auth.
7. Keep tests green. Add tests for every new domain rule.

## 3. Architecture

Existing: Node + Express (CommonJS) backend with `POST /api/momentum`, `POST /api/oasis`, tests with `node:test`; a Lovable-generated frontend.

Refactor the backend into modules, keeping exports used by tests (or update the tests):

```
backend/
  server.js                  # createApp(), wiring only
  src/
    routes/                  # one file per area
    services/                # statements, insights, quests, projection, wallet, shop, friends, llm
    repo/
      index.js               # exports the active repository
      interface.md           # the contract (below)
      memory.js              # in-memory adapter, used until the real DB lands
    rules/
      categories.json        # merchant regex -> category
      destinations.json      # simulated instruments (rates, taxes, sources)
      shop.json              # catalog (items, prices, type)
      assumptions.json       # inflation, retirement age, reduction %, etc.
  samples/                   # sample statement CSVs
```

### Repository interface (the teammate implements an adapter for the real DB)

All methods async, all scoped by `userId`:

- `getUser(userId)`, `getUserByHandle(handle)`
- `saveStatement(userId, meta)`, `saveTransactions(userId, statementId, txs[])`, `listTransactions(userId, {since})`, `deleteAllUserData(userId)`
- `createQuest`, `getQuest`, `updateQuest`, `latestQuest(userId)`
- `addLedgerEntry(entry)` (idempotent via `idempotencyKey`), `getBalance(userId, currency)`
- `addInvestment`, `listInvestments`
- `addInventoryItem`, `listInventory`, `placeItem(userId, itemId, plotId)`
- `listFriends`, `addFriend`
- `createChallenge`, `listChallenges(userId, {direction})`, `updateChallenge`
- `getMute`, `setMute`

### Current user

One function `getCurrentUser(req)`. Until real auth exists it reads header `x-demo-user` (default `demo-ioana`). The teammate replaces only this function.

### Data model (for the DB teammate; mirror it in the memory adapter)

| Table | Key fields |
|---|---|
| users | id, display_name, handle, invite_code |
| statements | id, user_id, source (`csv`/`pdf`/`demo`), tx_count, imported_at |
| transactions | id, user_id, statement_id, date, merchant_norm, category, amount_ron (expenses negative, income positive) |
| quests | id, user_id, habit_json, llm_json, weekly_saving_ron, reward_id, status (`offered`/`accepted`/`expired`), created_at |
| investments | id, user_id, destination_id, amount_ron, source (`quest`/`challenge`/`topup`), created_at |
| ledger_entries | id, user_id, currency (`CREDITS`/`RON_SIM`), amount (signed), kind, ref_type, ref_id, idempotency_key (unique), created_at |
| inventory | id, user_id, item_id, placed_plot (nullable), acquired_at |
| friendships | user_id, friend_id, status |
| challenges | id, from_user, to_user, kind (`banana`), status (`pending`/`cleaned`/`expired`), blocked_plot, min_invest_ron, expires_at, created_at, cleaned_at |
| mutes | user_id, muted_user_id |

**Balances are always the SUM of ledger entries.** Never store a mutable balance. Spending must be validated inside one transaction and can never take a balance below 0.

## 4. Domain rules (all in code)

### 4.1 Simulated balance and credits

- Each demo user starts with `RON_SIM = 5000`.
- **Accepting a quest** with weekly saving `S` RON: debit `RON_SIM` by `S`, create an investment in the chosen destination, credit `CREDITS` by `round(S)` (1 simulated RON = 1 credit, configurable), and grant the quest's reward item for free (the story payoff: e.g. "Cafenea & Pisicuță" appears on the island).
- Streak: consecutive accepted quests add a small bonus (`+5` credits per streak step, max `+25`). Keep it simple and tested.
- Credits are only earned by moving simulated money into an investment, so the simulated balance naturally limits farming.

### 4.2 Destinations and projection (the "Romania" part)

`rules/destinations.json` holds the simulated instruments. Every entry has `grossAnnual`, `taxRule`, `source` and `asOf`. Seed with these, and mark every value with a `"verify": true` flag so it is visible in the Assumptions page:

- **Fidelis (simulat):** state retail bond, ~7.5% gross for RON issues (Aug 2026), interest tax-exempt. Source: Ministry of Finance / BVB.
- **Depozit bancar (simulat):** placeholder rate (set `0.05`, clearly marked as placeholder to verify against a bank rate sheet), interest taxed 16% in 2026.
- **Pilon III (simulat):** ~6.1% average annual return over 18 years (APAPR), contribution deduction cap €400/year unchanged since 2009. Simplified model: gross 6.1%, 10% tax on gains at payout. Show the deduction benefit as a separate line (`min(annual contribution, cap) × 10%` income tax saved). Mark as simplified.

Projection (monthly contributions until 65):

```
monthly = weeklySaving * 52 / 12
i = (1 + netAnnualRate)^(1/12) - 1         // netAnnualRate = gross after interest tax where applicable
n = (65 - age) * 12
FV = monthly * (((1 + i)^n - 1) / i)       // if i == 0 → monthly * n
realFV = FV / (1 + inflation)^(65 - age)   // inflation from assumptions.json (default 0.046, APAPR 18y average)
```

Return nominal, real, total contributed, and a yearly series for the chart. Always label as "estimare orientativă, nu garantată".

### 4.3 Habit detection (deterministic)

From the last 28 days of expense transactions, group by category. A **habit** is a *discretionary* category (coffee, food delivery, ride-hailing, subscriptions) with at least 4 occurrences. Rank by total cost. Output:

```json
{ "category": "cafea", "count": 6, "total": 120, "avgPrice": 20,
  "periodDays": 7, "suggestedReductionPct": 0.33, "suggestedCount": 4,
  "weeklySaving": 40 }
```

Reduce, never eliminate. `suggestedReductionPct` comes from `assumptions.json`. Round to whole items.

### 4.4 Shop and credits

`rules/shop.json` is the single catalog. Each item: `id, name, type (building|decoration|character|action), priceCredits, sprite`. Seed: `banana` (40, action), `palmier` (15), `pisica` (25), `cafenea` (60), `casa-plaja` (80). Buying debits credits via the ledger (idempotent), and adds to inventory. Buildings/decorations/characters are placed on a free plot.

### 4.5 Banana challenge (friend nudge)

1. Sender spends 40 credits on a banana and picks a friend. Server creates a `pending` challenge for the friend with `min_invest_ron` (default 20, configurable) and `expires_at` (default 24h; allow a short TTL in demo mode).
2. The receiver's island shows a banana peel **blocking one plot** until cleaned. This is the only consequence.
3. The receiver cleans it by making a simulated investment of at least `min_invest_ron` (via a quest or a quick-invest modal where they choose a destination). The challenge becomes `cleaned`; **both** users get `+10` credits (cooperative, not punitive).
4. If it expires, the banana disappears. No penalty.
5. Safety: friends only, max 3 bananas sent per day per user, one active banana per receiver at a time, receiver can mute a sender. Frame all copy as playful.

### 4.6 Bank statement import

- Accept **CSV first** (reliable). PDF is best effort via a text-extraction lib, regex for date + amount; if confidence is low, show a friendly message and offer the sample statement.
- Max 5 MB, validate type, keep the file in memory only (e.g. multer memory storage).
- CSV parsing: auto-detect delimiter (`,` or `;`), decimal comma, date formats (`DD.MM.YYYY`, `DD/MM/YYYY`, ISO), header synonyms in RO/EN (`Data`, `Date`, `Descriere`, `Detalii tranzacție`, `Suma`, `Debit`, `Credit`, `Amount`, `Beneficiar`, `Merchant`). Support both signed amounts and separate debit/credit columns.
- Normalize merchants: uppercase, strip card-payment prefixes (`PLATA POS`, `CUMPARARE POS`, terminal ids, digits, city suffixes). If a description looks like a transfer to a private person, set category `transfer` and drop the name.
- Categorize with `rules/categories.json` regexes (coffee: Starbucks, 5 to go…; food delivery: Tazz, Glovo, Wolt, Bolt Food; ride-hailing: Uber, Bolt; groceries: Kaufland, Lidl, Carrefour, Mega Image, Profi, Auchan; subscriptions: Netflix, Spotify, HBO, YouTube; income: salariu…). Unknown merchants → `altele`. Optional: one batched LLM call to categorize the top unknown merchants (cap it, make it skippable).
- Persist only normalized transactions (merchant, category, amount, date). No IBAN, no raw descriptions.
- Provide `DELETE /api/me/data` ("Șterge datele mele") and a "Folosește extras demo" button that loads `samples/*.csv`.
- Future path (for the pitch, do not build): PSD2 account-information (open banking).

## 5. Phases

### Phase 0 — Foundation (do this first, then stop)
- Refactor into the structure in section 3. Keep `/api/momentum` and `/api/oasis` working; tests still pass.
- Repository interface + memory adapter + `getCurrentUser` stub.
- Ledger service with idempotency and non-negative guard, with tests.
- Seed two demo users (Ioana, Radu) who are friends, each with `RON_SIM = 5000`.
- A dev-only user switcher in the frontend (header `x-demo-user`) so we can demo both sides of the banana flow in one browser.
- `.env.example`, `DECISIONS.md`.

**Done when:** `npm test` passes, `GET /api/wallet` returns balances for both demo users.

### Phase 1 — Statement import → insights → real quest (P0)
- `POST /api/statements/import` (multipart) and `POST /api/statements/demo`.
- Parser, normalizer, categorizer, habit detection (4.3) with tests using at least 2 different CSV layouts (comma + dot decimals, and semicolon + comma decimals).
- `GET /api/insights`: category breakdown (last 28 days), income vs spend, detected habit.
- `POST /api/quests/generate`: build the habit in code, call the LLM for text only (section 8), merge with computed numbers, store the quest.
- Frontend: **Upload screen** (drag & drop + "Folosește extras demo"), **Insights panel** (donut or bars by category, the highlighted habit), and the existing quest card now fed by real data.

**Done when:** uploading `samples/extras-demo.csv` produces the "6 cafele, 120 RON → 4 cafele, 40 RON/săptămână" quest, with every number matching the data.

### Phase 2 — Accept → simulated investment → island → future (P0)
- `POST /api/quests/:id/accept {destinationId}`: ledger entries, investment, credits, reward item (4.1).
- Island: keep the current background image. Draw buildings as **transparent sprites positioned absolutely in percentages over the 4 empty plots**. Put plot coordinates in `src/lib/plots.ts` (id, x%, y%, scale, zIndex by y). Placeholder sprites first (SVG/emoji), real PNGs get swapped in later. Animate arrival (scale-in + small bounce + optional sound).
- **"Viitorul tău la 65 de ani" screen**: pick destination (Fidelis / Depozit / Pilon III), show chart + nominal and real values + a one-line "why" per destination. Data from `GET /api/projection`.
- Wallet bar shows RON simulat, investit, credite, streak.

**Done when:** accept quest → balance drops, credits rise, the reward appears on a plot with animation, projection screen shows the three destinations with different net results.

### Phase 3 — Shop, friends, banana (P1)
- `GET /api/shop`, `POST /api/shop/buy`, placing items on free plots (tap plot → choose owned item).
- Friends list (seeded + add by invite code/handle), inbox via **polling every 10s** (no websockets).
- `POST /api/friends/banana`, `GET /api/inbox`, `POST /api/challenges/:id/clean` (4.5). Banana sprite on the blocked plot; toast when you are hit; clean flow with destination chooser.
- Tests: spend validation, rate limit, one-active-banana rule, mute, both-sides credit on cleaning, expiry.

**Done when:** in the demo, Ioana buys and throws a banana at Radu; Radu sees it, cleans it by investing, both get credits.

### Phase 4 — Stripe test mode (P2, time-box ~45 min; skip if it fights back)
- `npm i stripe`. Secret key `STRIPE_SECRET_KEY` (`sk_test_…`) server-side only.
- `POST /api/stripe/checkout`: Checkout Session, `mode: 'payment'`, currency `ron`, one line item "Alimentare portofel Oasis (simulat)" with amounts 50/100/200 RON. `success_url` returns to the app with `?session_id={CHECKOUT_SESSION_ID}`.
- `GET /api/stripe/confirm?session_id=…`: retrieve the session server-side; if `payment_status === 'paid'` and not yet processed, add `RON_SIM` via the ledger using the session id as idempotency key. (Webhook optional via Stripe CLI; confirm-on-return is enough for the demo.)
- Show a banner: "Mod test Stripe — nu se debitează bani reali" and the test card hint (4242 4242 4242 4242).
- If no key is configured, hide the button. Fallback: a mock checkout modal clearly labeled as simulation.

### Phase 5 — Trust, polish, demo resilience (P0 before the pitch)
- **Assumptions page** ("Ipoteze, surse, limite"): data sources with `asOf` dates and the `verify` flags from `destinations.json`; "simulare, nu consultanță financiară" (regulated activity is under ASF); GDPR note (minimization, no raw storage, delete button); PSD2 as the real-world data path; what is hardcoded vs computed.
- README top: one-line pitch, screenshot/GIF, demo link, pitch video link, and a section mirroring the 4 "demonstration should make clear" points.
- Empty/loading/error states for every screen; mobile layout check.
- `scripts/compare-models.js`: run the same habit through 2–3 Featherless models and print results, to pick the one with the best Romanian.

## 6. API contract (summary)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/me`, `/api/wallet` | balances from ledger |
| POST | `/api/statements/import`, `/api/statements/demo` | multipart / none |
| GET | `/api/insights` | breakdown + habit |
| POST | `/api/quests/generate` | LLM text + computed numbers |
| POST | `/api/quests/:id/accept` | `{ destinationId }` |
| GET | `/api/projection` | `?weeklySaving&age&destinationId` |
| GET / POST | `/api/shop`, `/api/shop/buy` | `{ itemId }` |
| POST | `/api/inventory/place` | `{ itemId, plotId }` |
| GET / POST | `/api/friends`, `/api/friends/add` | |
| POST | `/api/friends/banana` | `{ toUserId }` |
| GET | `/api/inbox` | pending challenges |
| POST | `/api/challenges/:id/clean` | `{ destinationId, amountRon }` |
| POST | `/api/stripe/checkout`, GET `/api/stripe/confirm` | Phase 4 |
| DELETE | `/api/me/data` | wipe user data |

Consistent error shape: `{ "error": "mesaj în română" }` with proper status codes.

## 7. Frontend notes

- Detect the existing stack (likely React + Vite + TS + Tailwind + shadcn) and reuse it. Use the existing data-fetching approach (TanStack Query if present).
- Create: `src/lib/api.ts`, `src/lib/plots.ts`, components `IslandScene`, `QuestCard`, `StatementUpload`, `InsightsPanel`, `WalletBar`, `ProjectionChart`, `Shop`, `FriendsPanel`, `BananaInbox`, and an `AssumptionsPage`.
- Island sprites: sort by y for correct overlap; keep sprite files in `public/sprites/` named by catalog id so swapping art needs no code change.
- Every money number shows a "Simulare" cue somewhere on the screen.
- Accessibility basics: contrast on the dark theme, focus states, labels on icon buttons, readable Romanian text sizes.

## 8. LLM integration (Featherless, OpenAI-compatible)

- Keep the OpenAI client pointed at `https://api.featherless.ai/v1`; model name from env.
- The existing code passes `extra_body: { chat_template_kwargs: ... }`. That is a Python-SDK convention; in the Node SDK the body is sent as written, so the server likely ignores it. Check the Featherless docs for how to disable "thinking" for the chosen model and send it as a **top-level** field if supported. Keep stripping `<think>…</think>` and the robust JSON extractor.
- **Input to the LLM:** only the habit object + the reward catalog (ids and names). **Output (JSON only):** `questTitle`, `analysisMessage`, `proposalMessage`, `rewardId` (must be an id from the catalog).
- **Guards:** validate the schema; retry once on invalid JSON; verify that `analysisMessage` contains the real total and count from the habit — if not, replace it with a deterministic template built in code. All amounts shown to the user come from code.
- **Resilience for the live demo:** env flag `LLM_CACHE=true` stores the last good response per habit hash in `.cache/llm.json`; if the provider fails and a cached entry exists, return it with `source: "cache"`. If there is no cache, return the normal 502 error. Never fabricate a mission.
- Respond in friendly Romanian, short sentences, no financial-advice wording ("ți-ar putea ieși", not "trebuie să").

## 9. Testing

- Parser: two CSV layouts, signed vs debit/credit columns, bad rows skipped, empty file error.
- Categorizer and habit detection: the sample file must give exactly 6 coffees / 120 RON / suggested 4 / 40 RON per week.
- Projection: zero-rate case equals `monthly × n`; one hand-computed positive-rate case; real value < nominal.
- Ledger: idempotency, never negative, balance equals the sum of entries.
- Banana: all rules in 4.5. Quest accept: balances, credits, reward, streak.
- Keep the existing API tests passing; use the injectable LLM client pattern already in `createApp`.

## 10. Demo script the app must support flawlessly (3 minutes)

1. **Problem (20s):** Ioana, 24, 4,000 RON/month, wants to save but options and taxes are confusing.
2. **Import (30s):** upload the statement → insights show 6 coffees = 120 RON in a week.
3. **Quest (30s):** the Game Master proposes 4 coffees → saves 40 RON/week; the story and reward come from the LLM, the numbers from code.
4. **Accept (30s):** choose Fidelis → balance drops, credits rise, the café + cat appears on the island with an animation.
5. **Future (30s):** "Viitorul tău la 65 de ani": three destinations compared after Romanian tax; real vs nominal value.
6. **Social (30s):** Ioana spends 40 credits on a banana, throws it at Radu (switch user), Radu cleans it by investing, both earn credits.
7. **Trust (10s):** Assumptions page: simulation, sources, ASF/GDPR/PSD2, what is next.

## 11. Definition of done

- [ ] All demo steps above work from a fresh start, with the sample file.
- [ ] No number shown to the user comes from the LLM.
- [ ] No secrets committed; `.env.example` is current.
- [ ] Tests pass; new domain rules are covered.
- [ ] Assumptions page filled, `verify` flags reviewed by a human against official sources.
- [ ] README has pitch, screenshots, demo and video links, and the four "make clear" points.
- [ ] Mobile and empty/error states checked.
