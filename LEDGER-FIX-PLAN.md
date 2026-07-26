# Ledger remediation — phase-by-phase plan with test cases

**Date:** 2026-07-24
**Sources:** `LEDGER-AUDIT-REPORT.md` (findings L1–L31, M1–M12, decisions D1–D17)
and `PAYROLL-DEDUCTIONS-DESIGN.md` (payroll accounting design).
**Status: PLAN ONLY — no code has been written.** Each phase needs explicit
approval before implementation, per CLAUDE.md §1.

---

## How to read this

Phases are ordered by **dependency**, not by severity — a fix placed later is
later because something else must land first, not because it matters less.

Each phase states: what changes · files touched · why it sits here · test cases.

**Test case notation.** `GIVEN` setup → `WHEN` action → `THEN` expected result.
Amounts are AED unless stated. Every ledger assertion checks **both** sides of
the pair, because a single-sided check is what let these defects survive.

**⚠ Read "Test authoring rules" below before writing any test.** The rules are
not style guidance — they were derived from dissecting why the pre-existing
suite, ~2,900 lines of it, could never have passed.

### Authorised actions during an approved phase *(agreed 2026-07-24)*

Once a phase is approved, the following proceed **without pausing to ask**:

- Applying that phase's migrations to a **local** database — `DATABASE_URL`
  resolving to `localhost` / `127.0.0.1` / `::1`. CLAUDE.md §6 permits this
  explicitly; only shared databases are the team's to apply.
- Running `npm test` and the phase's own tests.
- Re-seeding or rebuilding **local** fixture data.

The following **always** require explicit per-instance approval, regardless of
phase approval:

- Anything where `DATABASE_URL` resolves to a **non-local host** — the team
  applies migrations to UAT and production, we do not (CLAUDE.md §6).
- `npm run test:integration` (truncates real tables) and the **P11** rebuild.
- Any commit, push, or PR (CLAUDE.md §10).

This is the same local-versus-remote line the destructive-test gate already
enforces in code, stated once here so it is not re-litigated per phase.

**Testing reality check.** `jest.config.js` and ~2,900 lines of tests exist, but
jest and ts-jest are **not installed** and there is no `test` script — effective
coverage is zero (CLAUDE.md §9). Every test case below is therefore written to
be executable **manually through the UI or API**. If the team wants them
automated, installing the test runner is a prerequisite task and should be
scheduled as **Phase 0b**.

---

## Review findings — corrections applied 2026-07-24

The plan was reviewed against the full finding set and the code. **Eight gaps
were found, two of them design errors in the plan itself.** All are corrected
below and folded into the phases.

### ❌ G1 — The VAT split does not balance when there is a discount *(design error)*

`totalAmount = subtotal + taxAmount − discount`
([purchase.ts:1930](server/storage/purchase.ts:1930); sales invoices carry
`discount` and `discountPercentage` too). The split as originally written:

```
Dr  Accounts Receivable   totalAmount   = subtotal + tax − discount
    Cr  Sales Revenue                     subtotal
    Cr  VAT Payable                       tax
                                        ─────────────
                          out by exactly the DISCOUNT
```

**Correction — every discount must be posted explicitly.** Two options, and
this needs a decision before P5/P6 are built:

1. **Net the discount into revenue** — `Cr Sales Revenue = subtotal − discount`.
   Balances, no new account, but discounts given become invisible in the P&L.
2. **Post the discount to its own account** —
   `Dr Sales Discount (contra-revenue)` for the discount amount. Correct and
   visible, but **the chart has no Sales Discount account** — it would be a
   Phase 0 addition (e.g. `4160 Sales Discount`, and a purchase equivalent).

**✅ DECIDED 2026-07-24: option 1 — net into revenue** (Open Item 1; the
option-2 recommendation was considered and not taken). No 4160/5050 accounts.
`Cr Sales Revenue = subtotal − discount`; `Dr Purchase Expense = subtotal −
discount`. Discounts remain reportable from the **documents** (`discount` column
on each invoice) — they are simply not a GL line.

⚠ **✅ CONFIRMED 2026-07-24 — and it is a defect.** The team confirms VAT is
charged on the **discounted** subtotal per UAE law. The system computes it
pre-discount, so customers are overcharged VAT and output VAT is over-declared
to the FTA. This is a **compliance issue on the customer-facing tax invoice**,
not merely a posting error — now **Phase 4b**, which must precede P5 and P6.

With the tax base corrected, **both** G1 options balance:

```
subtotal 10,000 · discount 1,000 · VAT 5% on 9,000 = 450 · total 9,450

Option 2 (not chosen):
Dr  Accounts Receivable    9,450
Dr  Sales Discount         1,000
    Cr  Sales Revenue             10,000
    Cr  VAT Payable                  450
                          ─────────────
                          10,450 = 10,450  ✓

Option 1 (netted into revenue — ✅ DECIDED 2026-07-24):
Dr  Accounts Receivable    9,450
    Cr  Sales Revenue              9,000
    Cr  VAT Payable                  450
                          ─────────────
                           9,450 =  9,450  ✓
```

### ❌ G2 — A zero-VAT invoice would fail to post *(design error)*

`createGeneralLedgerEntry` rejects an entry where both debit and credit are zero
([ledger.ts:419](server/storage/ledger.ts:419)). An invoice with
`taxAmount = 0` would generate a zero-value VAT line and **the whole posting
would throw**.

**Correction:** the VAT line is written **only when tax ≠ 0**. Same for the
discount line under G1. Postings become variable-length — 2, 3 or 4 rows — so
every test must assert `ΣDr = ΣCr` rather than a fixed row count.

### ❌ G3 — Four findings were missing from the plan entirely

| Finding | Why it matters | Now in |
|---|---|---|
| **L14** — no transaction wrapping on any posting | **The plan makes this worse.** VAT turns 2-row postings into 3–4 rows and payroll becomes a 5-row posting; every extra row is another chance to fail partway and leave the ledger permanently one-sided | **new P1.7** |
| **L8** — `referenceType` collisions: `"payment"` shared by sales and purchase payment ids; `"manual"` used by payroll | Any future drill-down resolves the wrong record; and `clearPayrollPeriod` can match a genuine manual entry | **new P4.8** |
| **L12** — sub-cent rounding on per-project payroll splits | Each project's debit is rounded independently while the credit is rounded once — a multi-project consultant can be out by a cent, and `ΣDr = ΣCr` then fails | **new P3.2** |
| **L13** — two divergent sales approval paths | Both post GL and leave the invoice in **different** statuses; only one records `approvedById`. Any change to one status allowlist can open a double-post on the other | **new P5.7** |

### ⚠ G4 — Payroll has no real approval step

D7 assumes one. In fact `"approved"` is set by the **client** sending
`{status: "approved"}` to the generic `PUT /api/payroll/:id`
([payroll/index.tsx:234](client/src/pages/payroll/index.tsx:234), bulk at
[:267](client/src/pages/payroll/index.tsx:267)) — there is no dedicated
endpoint, no guard, and payroll storage only ever writes
`generated` / `pending` / `paid` itself.

**Consequences for P4:**
- The accrual must hook the **status transition to `approved`**, mirroring how
  the transition to `paid` is already detected
  ([payroll.ts:610](server/storage/payroll.ts:610)).
- Because the route accepts arbitrary `req.body`, a client can jump
  **`generated` → `paid`**, skipping `approved` entirely. The accrual would
  never post while the payment posting would — leaving `Dr Salary Payable`
  against nothing. **P4 must either post the accrual on the way to `paid` if it
  has not already posted, or reject the invalid transition.** New test **T4.15**.

### ⚠ G5 — `entryType` has no valid value for a general journal

The CHECK constraint permits only `payable` and `receivable`. A genuine journal —
say a PF payout, `Dr 2120 / Cr Cash/Bank` — is neither. P8 originally said
"send a value the constraint permits" without resolving which.

**Correction:** widen the constraint to include a journal value (e.g. `manual`)
as part of **Phase 0**, so P8 has something legitimate to post. Without this,
the journal form has no correct `entryType` to send.

### ⚠ G6 — L26 did not say which status wins

`partial` vs `partially_paid` are both written, by different paths. The plan said
"settle on one" without choosing. **Correction:** pick one value, migrate
existing rows, and update **every** filter that references either — including
`getReceivables` ([report.ts:126](server/storage/report.ts:126)),
`recalculateProjectCost`
([project-asset.ts:1092](server/storage/project-asset.ts:1092)) and the invoice
list filters. Treat the migration as part of P5, not an afterthought.

### ⚠ G7 — No back-out plan per phase

Every phase changes live UAT behaviour. **Correction:** each phase must state its
revert path before implementation starts. Phases P0 and P2 involve migrations,
so those need a **down migration written at the same time**, not retrofitted.

### ⚠ G8 — Test gaps

Added below: partial payments settling to zero · foreign-currency credit notes ·
zero-VAT and discounted invoices (G1/G2) · payroll status skipping · concurrent
posting while L14 is unfixed.

Also corrected: **T11.11** asserted a rebuild run twice produces an "identical
ledger" — ids and timestamps necessarily differ. It now asserts identical
**postings** (account, amount, side, reference), not identical rows.

### Noted, no change

**P7 + P11 interaction.** A rebuild regenerates from documents, so a deleted
document's reversal pair is not regenerated either. The net ledger effect is
correct — those entries simply cease to exist — but the deletion history is
silently dropped. Acceptable given D15 wipes UAT anyway; stated so it is not a
surprise.

---

## Second review round — 2026-07-24

Six further gaps, two of them significant.

### ❌ H1 — Credit notes need the VAT split too *(design error)*

`credit_notes` carries `subtotal` and `taxAmount`
([sales.ts:588](server/storage/sales.ts:588)); so does
`purchase_credit_notes`. A credit note reverses a sale, so it must reverse the
**VAT as well** — otherwise output VAT stays overstated after a customer is
credited, and the VAT return is wrong in the opposite direction to **P4b**.

The plan specified only `Dr Sales Returns / Cr AR`. **Corrected** — on a
1,000 credit note with 5% VAT (net 952.38, VAT 47.62):

```
Dr  Sales Returns and Allowances    952.38
Dr  VAT/GST Payable                  47.62      ← reverses output VAT
    Cr  Accounts Receivable                    1,000.00
```

Purchase credit notes mirror it: `Dr AP` / `Cr Purchase Expense` /
`Cr VAT Recoverable`. Folded into **P5.1** and **P6.1**; new tests **T5.20**,
**T6.14**.

### ❌ H2 — The GL edit path cannot handle variable-length postings *(design error)*

`updateSalesInvoiceGLEntries` performs exactly **two fixed `UPDATE`s**, matched
by account name ([sales.ts:1925](server/storage/sales.ts:1925),
[1946](server/storage/sales.ts:1946)); `updatePurchaseInvoiceGLEntries` does the
same. With VAT and discount lines the posting becomes **2, 3 or 4 rows**, and an
edit can change which rows should exist — e.g. a discount removed, or a customer
switched to zero-rated. A fixed pair of `UPDATE`s **cannot delete a VAT row that
should no longer exist**, so a stale line would be left behind and the entry
would no longer balance.

**Corrected: edits reverse and re-post rather than update in place.** This also
aligns with **D3**, which already chose reversal over editing for manual
entries, and it preserves the audit trail of what the invoice previously said.
Folded into **P5.2** and **P6.2**; new tests **T5.21**, **T6.15**.

### ⚠ H3 — VAT rounding rule is unspecified

VAT is computed **per line** and each line is rounded, so the sum of line taxes
can differ by a cent from 5% of the invoice total. `Dr AR` would then not equal
`Cr Revenue + Cr VAT`. Same class of problem as **L12**.

**Correction:** state a single rule — the VAT posted equals the **sum of the
rounded line taxes**, and the AR debit is derived as
`revenue + VAT − discount` from those same rounded figures, so the entry
balances by construction rather than by luck. New test **T4b.11**.

### ⚠ H4 — Consumer regression is untested

The dashboard consumes financial figures, and P5/P6/P9 change how receivables,
payables and revenue are derived. The plan has **no test that the dashboard
still works**. Added as **T9.9** and **T12.11** — not a deep audit of the
consumer layer (explicitly out of scope), just a regression guard that it
renders and its totals agree with the reports.

### ⚠ H5 — Balance sheet equity has nothing to derive from

**T12.6** asserts `Assets = Liabilities + Equity`. But there is **no period
close** (**M11**, deferred), so `Retained Earnings` (3100) and
`Current Year Earnings` (3200) are never posted. The balance sheet must
therefore compute current-year earnings **on the fly** from revenue and expense
accounts, or it will never balance. Stated in **P12** so it is designed in, not
discovered.

### ⚠ H6 — VAT on foreign-currency invoices uses the document rate

The FTA requires VAT to be reported in AED at the **published rate on the date
of supply**. The system converts using the invoice's own `exchangeRate`, which
may differ. Out of scope for this programme, but it means the VAT return figure
could be marginally off on foreign-currency sales. **Flagged for the team**, not
scheduled.

---

## Test authoring rules — derived from the P0b post-mortem

Repairing the legacy suite in **P0b** exposed *how* tests written from reading
code go wrong. Every T-case in this plan was authored the same way — by reading
the code and reasoning about intent — so the same failure modes apply to them.
These rules are mandatory for every phase.

### What actually went wrong in the legacy suite

One test asserted `expect(db.from).toHaveBeenCalledWith(inventoryItems)` while
having replaced `db.select` with a bespoke stub whose `from` was a *local*
function. The real `db.from` was therefore never invoked. **That assertion could
not pass under any behaviour of the code.** The suite had never been executed,
so nothing revealed it.

Once the mock was repaired, one single test still needed four further
corrections — every one an assumption that read plausibly and was false:

| Assumed | Actual |
|---|---|
| `update` resolves to `undefined` | ends `.returning()`, reads `result[0]` |
| insert receives `timestamp` | schema defaults it; never passed |
| insert has no `createdBy` | it does, `null` |
| returns `date: Date` | returns an ISO **string** |
| absent projectId stays `undefined` | normalised to `null` |
| error wrapped "An unexpected error occurred…" | original error re-thrown verbatim |

Two further tests asserted a call sequence (`getProject`, `db.transaction`) that
the code **no longer contains at all**.

### The rules

**R1 — A test must be able to both pass and fail.** Before accepting a test,
confirm it fails when the behaviour is wrong *and* passes when it is right. An
assertion that can never fire is worse than no test: it reports safety that does
not exist. This is the `expect(db.from)` failure.

**R2 — Never assert against a collaborator whose call path the test has
replaced.** If a stub intercepts the chain, the real method is not called.
Either assert on the observable outcome, or leave the real path intact and
assert on it — not both.

**R3 — Verify current behaviour before writing an expected value.** Run the code
and observe. Never derive an expected field set, type or message from reading
alone. Every one of the six false assumptions above came from reading.

**R4 — Never assert a fixed row count on a variable-length posting.** VAT and
discount lines are conditional (**G2**), so a balanced entry may be 2, 3 or 4
rows. Assert `ΣDr = ΣCr`, plus the presence or absence of the *specific account
lines* under test.

**R5 — Assert error identity, not prose.** Match a stable substring or the error
type. Full message text drifts, and pinning it produces failures that look like
regressions but are not.

**R6 — Assert only the fields under test.** Use `objectContaining`. Pinning a
whole object shape breaks the moment an unrelated field is added — which is
exactly what `createdBy` did.

**R7 — Account for side effects on the failure path.** Error paths write an
`error_logs` row, so `expect(db.insert).not.toHaveBeenCalled()` is wrong. Assert
per-table: `not.toHaveBeenCalledWith(inventoryTransactions)`.

**R8 — Prefer outcome assertions over sequence assertions.** "AR moved by
−1,000" survives refactoring; "getProject was called first" does not, and its
failure teaches nothing about correctness.

### Test lifecycle — decided 2026-07-24

**Tests are written per phase, as each one lands.** Not deferred to a single
pass before merging.

The reasoning is specific to this subsystem rather than general test hygiene:
**a trial balance would not have caught L1.** The credit-note double-post was
`Dr Cash/Bank` against `Cr AR` — perfectly balanced, entirely wrong in which
account it hit. Every defect in this audit shares that property: it balances,
and aggregate checks pass straight over it. Only account-level assertions catch
them.

Fifteen phases touch overlapping code — P4, P5 and P6 all modify the same
posting primitives, and P7's reversals depend on the row shapes P5/P6 produce.
Without a net between phases, a P6 change can silently undo P5's fix and the
**P12** trial balance will not flag it. Writing the T-cases per phase is not
extra work — it is the same work already committed to before merge, ordered so
that it also protects the phases in between.

**Disposal policy**

| Keep | Remove |
|---|---|
| `server/test-db-mock.ts`, `jest.config.cjs`, `jest.integration.config.cjs`, the destructive-test gate — reusable plumbing | `server/storage.payroll.test.ts` — encodes behaviour **P2/P4 overturn**; delete rather than reconcile |
| The 7 repaired `storage.test.ts` tests — cover goods issue and project consumables, which no phase modifies | The destructive integration suites, unless rewritten to use transaction-with-rollback instead of `clearTables()` |

Each phase's tests are the merge gate for that phase. Before merging to `main`,
the accumulated suite **is** the pre-merge test pass — there is no separate
write-everything-at-the-end step.

### Mandatory per-phase pre-flight

Before writing that phase's tests:

1. **Characterise first.** Exercise the code path as it stands *today* and record
   actual outputs — field sets, types, null-vs-undefined, message text, and how
   many GL rows are written. This is the step whose absence caused every legacy
   failure.
2. **Write the characterisation down** next to the T-case as its GIVEN. If the
   observed behaviour contradicts what this plan assumes, **that is a finding** —
   report it before changing the expectation.
3. **Prove falsifiability** — see the test fail against unfixed code, then pass
   against fixed code. For a bug-fix T-case this is free: it *must* be red first.
4. Only then treat the T-case as satisfied.

⚠ **The T-cases in this plan state intent, not verified fact.** They are written
from the audit's reading of the code. Where a numeric expectation appears
(`PF = 550`, `Dr AR 9,450`), the arithmetic is verified but the *shape* — field
names, types, row counts — is not. Step 1 exists to catch that gap before it
becomes another suite that cannot pass.

---

## Dependency map

```
P0  Chart of accounts ──▶ P0c Verification fixture ──┐ (makes checks non-vacuous)
P1  Foundations (safe, no-op) ─────┤
                                   ├──▶ P4 Payroll GL ──┐
P2  Payroll calculation ───────────┤                    │
P3  L15 Salary Expense multiply ───┘                    │
                                                        ├──▶ P11 Rebuild ──▶ P12 Trial balance
P5  Sales GL ───────────────────────────────────────────┤
P6  Purchase GL ────────────────────────────────────────┤
P7  Deletes & reversals ────────────────────────────────┤
P8  Manual journal ─────────────────────────────────────┤
P9  Statements on documents ────────────────────────────┤
P10 FX double-conversion ───────────────────────────────┘
```

**Hard ordering constraints:**
- **P0 before everything** — postings reference accounts that must exist.
- **P0c before any verification claim** — without a fixture, T0.5, T12.1, T12.5
  and T11.8/9 pass against an empty ledger and prove nothing.
- **P3 before P4** — L15 multiplies the per-project Salary Expense rows that
  D7 makes project labour depend on. Fixing D7 first would build on corrupt data.
- **P2 before P4** — the GL posts amounts the calculation produces; correcting
  the posting of a wrong number is pointless.
- **P8 before P11** — the rebuild's un-regenerable remainder (manual journals)
  needs a working journal form to re-enter.
- **P11 before P12** — verify against a clean ledger, per D10 and D15.

---

# Phase 0 — Chart of accounts

**Decisions:** D4, D5, D16, §7c review. **Depends on:** nothing.

### Changes

| # | Change | Detail |
|---|---|---|
| 0.1 | **Add** `Cash/Bank` | code `1030`, asset / current_assets (**D4**) |
| 0.2 | **Add** `VAT Recoverable` | code `1130`, asset / current_assets — input VAT (**D5**) |
| 0.3 | **Remove** 4 template accounts | `1100-C`, `2000-S`, `4000-P`, `5000-P` — from **both** `0041` and the seed script |
| 0.4 | **Remove** backfilled sub-accounts | `1100-C-*`, `2000-S-*`, `4000-P-*`, `5000-P-*` created by `0041`'s `DO` blocks |
| 0.5 | **Deactivate** duplicates | `Customer Receivables` (1110), `Supplier Payables` (2010), `Cash and Cash Equivalents` (1000), `Petty Cash` (1010), `Bank Accounts` (1020) — set `is_active = false`, do not delete |
| 0.5b | **Deactivate sub-accounts of retired accounts** | Found on the local database during P0 verification: `1020-1 Bank Account 1` and `1020-2 Bank Account 2`, children of 1020, absent from the seed script — so created outside it. Left alone they stay selectable while their parent is retired, which becomes a mis-posting risk once the P8 journal form lets users pick accounts freely. Written against `parent_account_id`, not hardcoded codes, since UAT may hold sub-accounts the local database does not |
| 0.6 | **Correct** description | `2120 Provident Fund Contribution` — replace *"Withholding taxes to be remitted"* |
| 0.7 | **Add** `Accommodation` | code `6125`, expense / operating_expenses — **approved 2026-07-24** (Open Item 4). D16 maps the Accommodation reimbursement category here instead of folding into 6120 |
| 0.8 | ~~Discount accounts~~ **DROPPED** | G1 resolved 2026-07-24 as **net-into-revenue** (Open Item 1) — no 4160/5050. The discount nets into Sales Revenue / Purchase Expense |
| 0.9 | **Widen** `entry_type` CHECK *(G5)* | Permit a journal value (e.g. `manual`) alongside `payable`/`receivable`, so P8's journal form has a legitimate value to post |
| 0.10 | **Down migration** *(G7)* | Written at the same time, not retrofitted |
| 0.11 | **Drop the `0041` functions** | `DROP FUNCTION IF EXISTS create_project_accounts, create_customer_accounts, create_supplier_accounts` — never called from code, but any invocation would recreate the rejected per-entity sub-accounts. Completes the `0041` retirement. The dead `entity_type`/`entity_id` **columns stay** (dropping them would break the Drizzle schema mapping for `select *`) and are documented as unused |

### Files

- new `migrations/00NN_fix_chart_of_accounts.sql` — hand-written, number claimed
  at PR time after `git fetch` (CLAUDE.md §6)
- `scripts/seed-chart-of-accounts.ts` — mirror the same changes so re-seeding
  cannot reintroduce the templates

⚠ The seed opens with `TRUNCATE … RESTART IDENTITY CASCADE`
([:120](scripts/seed-chart-of-accounts.ts:120)). GL rows reference accounts by
**name**, so truncation does not orphan them — but the identity reset invalidates
any id-based reference (`parent_account_id`). The seed must only ever run as a
**full re-seed**, never a partial top-up, and outside **P11**'s guarded flow it
should not run against UAT at all.

### Critical constraint

**No account may be renamed.** GL rows reference accounts by name with no FK and
the P&L inner-joins on that name — a rename silently drops every affected row.
All changes here are add / remove / deactivate.

### Test cases

| ID | Test |
|---|---|
| **T0.1** | GIVEN the migration has run → WHEN querying `chart_of_accounts` → THEN `Cash/Bank` (1030) and `VAT Recoverable` (1130) exist, `is_active = true`, types `asset`/`current_assets` |
| **T0.2** | GIVEN the migration has run → WHEN querying for `account_code LIKE '%-C%'`, `'%-S'`, `'%-P%'` → THEN **zero rows** (templates and sub-accounts gone) |
| **T0.3** | GIVEN the migration has run → WHEN opening the GL account picker → THEN no account containing "Template" appears; 1110, 2010, 1000, 1010, 1020 do **not** appear; `Cash/Bank` **does** |
| **T0.4** | GIVEN existing GL rows with `account_name = 'Cash/Bank'` → WHEN the migration runs → THEN row count is **unchanged** (this is an add, not a rename) |
| **T0.5** | GIVEN the migration has run → WHEN `SELECT DISTINCT account_name FROM general_ledger_entries` is left-joined to `chart_of_accounts` → THEN **no unmatched names** — every posted account resolves |
| **T0.6** | GIVEN the seed script is re-run on a scratch DB → WHEN it completes → THEN no template accounts are created and 1030/1130 exist |
| **T0.7** | Regression — GIVEN P&L for a period with sales and purchases → WHEN run before and after the migration → THEN **identical totals** (no account referenced by existing rows was removed) |
| **T0.8** | GIVEN the migration has run → WHEN querying `pg_proc` for `create_project_accounts` / `create_customer_accounts` / `create_supplier_accounts` → THEN **none exists** |
| **T0.9** | *(0.5b)* GIVEN the migration has run → WHEN joining `chart_of_accounts` to itself on `parent_account_id` → THEN **no active account has a retired parent**. Caught `1020-1`/`1020-2` on first run |

### ✅ Verified on the local database, 2026-07-24

Applied to `aquanav_dev` and all checks run. Results:

| Test | Before | After |
|---|---|---|
| T0.1 new accounts | absent | 3 present, active, correct types |
| T0.2 templates | **4** | **0** |
| T0.3 duplicates | all active | 5 deactivated |
| T0.4 `Cash/Bank` GL rows | 1 | **1** — an add, not a rename |
| **T0.5 unresolved names** | **`Cash/Bank`, 1 row** | **0** |
| T0.8 `0041` functions | 0 | 0 |
| T0.9 orphaned actives | **2** (`1020-1`, `1020-2`) | **0** |
| Chart total / active | 101 / 101 | **100 / 93** |

P&L join unaffected — 14 expense rows and 1 revenue row before and after, since
`Cash/Bank` is an asset and excluded by the `account_type` filter. The migration
is **idempotent**: a second full run produced `INSERT 0`, `DELETE 0`, and only
re-applied the `UPDATE`s.

⚠ **Migration drift confirmed from the other direction (L20).** The local
database had **zero** CHECK constraints on `general_ledger_entries` — no
`entry_type`, `reference_type` or `status` constraint — although
`migrations/schema.ts` shows all three. That snapshot reflects **UAT, not
local**. Practical consequence: step **0.9** *tightened* local (added a
constraint that was absent) and will *widen* UAT (replace a two-value constraint
with three). Both correct, different effects — know this before applying to UAT.

---

# Phase 0b — Test infrastructure *(prerequisite, only if automating)*

**✅ DONE 2026-07-24** (Open Item 3). Outcome differed from the original scope in
one important way, recorded here because it shaped the test authoring rules
above.

**Delivered**
- `jest` 29.7 + `ts-jest` + `@types/jest` installed; ts-jest transforms to CJS
  (safe — `import.meta` appears only in `server/vite.ts`, never in a test's
  dependency graph).
- Replaced `jest.config.js`, which **could never load**: it used
  `module.exports` under `"type": "module"`, and had `moduleNameMapping` — a
  silent typo for `moduleNameMapper`, so `@shared/*` had never resolved.
- `server/test-db-mock.ts` — one shared Drizzle mock replacing two divergent
  inline stubs. Covers all 17 chained methods (the stubs had 9; `leftJoin`
  alone is used 99 times), makes `transaction` invoke its callback, and is
  **thenable with a result queue** so tests assert on real `db.*` methods
  instead of bespoke stubs that bypassed them.
- `storage.test.ts`: **7/7 passing.**

**⚠ Safety issue found and contained.** Both non-mocked suites truncate real
tables with unfiltered `DELETE`s — `storage.payroll.integration.test.ts` clears
`general_ledger_entries`, payroll, projects and employees in `beforeEach`;
`storage.goods_receipt.test.ts` clears inventory. Wiring those behind a plain
`npm test` would have been the same hazard class as **L18**, but reachable by
convention. They are now split out:

| Script | Runs | Database |
|---|---|---|
| `npm test` | mocked unit suites | **never touched** |
| `npm run test:integration` | destructive suites | gated |

The gate (`jest.integration.setup.cjs`) aborts unless `ALLOW_DESTRUCTIVE_TESTS=1`
**and** `DATABASE_URL` resolves to a local host — verified refusing on both
conditions, exit 1.

**Deferred by decision.** `storage.payroll.test.ts` (~12 tests) is excluded from
the default run. Its assertions encode behaviour **P2 and P4 deliberately
overturn** — 5% on gross, GL posting at generation, current `clearPayrollPeriod`
semantics. Reconciling them now would mean fixing mocks for code about to
change, then changing them again. **P2 and P4 write their payroll tests fresh
against the T-cases in this plan**, following the pre-flight above.

---

# Phase 0c — Verification fixture

**Depends on:** P0 (postings reference accounts that must exist).
**Blocks meaningful verification in:** P0 (T0.5), P5, P6, P11, P12.

### Why this phase exists

Several verification tests in this plan **can pass vacuously**. Against an empty
or thin ledger:

| Test | Passes trivially because |
|---|---|
| **T0.5** unmatched account names | no posted rows to check |
| **T12.1** ΣDr = ΣCr | zero equals zero |
| **T12.5** AR = Σ document outstanding | both sides are zero |
| **T11.8 / T11.9** rebuild verification | nothing to rebuild from |

A green check that cannot fail is the same false-safety problem that made the
legacy suite worthless (see the P0b post-mortem). This phase establishes a known
dataset so those checks have something to bite on.

### Important property

The fixture is **document-level**, and documents survive the **P11** ledger wipe
— only `general_ledger_entries` is cleared. That is what makes **T11.9**
meaningful: the rebuild regenerates postings *from these documents*, and the
result can be compared against expected values.

It follows that the fixture should be created **using the current, unfixed
code**. Its GL entries will be knowingly wrong — doubled AR credits, phantom
Cash/Bank debits, gross-vs-net payroll residue. That is the point: it is the
**before** state each fix is measured against, and it gives **T0.5** real posted
account names to validate.

### Content

Created against a local database, reproducibly, and documented so it can be
re-established:

| Document | Variants needed | Exercises |
|---|---|---|
| Sales invoice, approved | with VAT · zero-VAT (`vatTreatment ≠ standard`) · **with discount** · foreign currency | T5.1, T5.5, T5.13, T5.14, T4b.x |
| Invoice payment | partial · settling in full | T5.16, T10.x |
| Sales credit note, issued | against a paid and an unpaid invoice | **T5.2 (L1)**, T5.20 |
| Sales invoice, cancelled | approved then cancelled | T5.6, T5.7, T22a |
| Purchase invoice, approved | with VAT · with discount · with project-allocated lines | T6.1, T6.12, T6.13 |
| Supplier payment | partial | T6.8 |
| Purchase credit note, issued | — | **T6.2 (L5)**, T6.14 |
| Payroll run | **after P2 + P4 only** — see note | T4.x |

⚠ **Payroll is deliberately excluded until P2/P4.** Payroll has never been
generated in UAT (confirmed 2026-07-24) and the first run should happen on
corrected code. Generating one now, locally, purely as fixture data is
acceptable — but it must not be mistaken for the first real run.

⚠ **`seed:purchase` is broken** and deletes purchase data (CLAUDE.md §9). Do not
use it. The purchase fixture is created through the API or a purpose-written
script.

### Test cases

| ID | Test |
|---|---|
| **T0c.1** | GIVEN the fixture is established → WHEN counting GL rows → THEN **non-zero**, so T0.5/T12.1 are no longer vacuous |
| **T0c.2** | GIVEN the fixture → THEN at least one document of **each** variant above exists, verified by query, not by assumption |
| **T0c.3** | GIVEN the fixture → WHEN the L1 defect is measured → THEN AR shows the **doubled** credit-note movement and a phantom `Cash/Bank` debit. *Confirms the fixture reproduces the defect the fix must remove — if it does not, the fixture is not exercising L1* |
| **T0c.4** | GIVEN the fixture → WHEN it is re-established from scratch → THEN the same document set results (reproducible, not hand-assembled once) |
| **T0c.5** | GIVEN the fixture → THEN a record of expected post-fix values is captured **before** any fix lands, so P12 compares against a stated baseline rather than a remembered one |

### ✅ Established on the local database, 2026-07-24

Built by `scripts/seed-ledger-fixture.ts`, which drives the **real storage layer**
so postings are produced by the current, unfixed code. Idempotent — a second run
skips every step (**T0c.4** ✓). GL rows **32 → 42** (**T0c.1** ✓).

#### 🔴 The headline result — why a trial balance is not enough

```
total_dr    1,387,199.12
total_cr    1,387,199.12
difference          0.00     ← PERFECTLY BALANCED
```

…while **Accounts Receivable sits at −19,003.33**, a negative asset, and
`Cash/Bank` holds a debit for cash that never arrived.

**The ledger balances and is deeply wrong at the same time.** This is the
strongest possible argument for the per-phase testing decision: **P12's trial
balance would pass over every defect in this audit.** Only account-level
assertions catch them.

#### T0c.3 — L1 demonstrated and isolated

A credit note of **14,003.33** produced **two** AR credits:

| Row | Account | Cr | Verdict |
|---|---|---|---|
| `credit_note` | Accounts Receivable | 14,003.33 | correct |
| `payment` — *"Payment received for Invoice…"* | Accounts Receivable | 14,003.33 | **phantom** |
| `payment` | Cash/Bank **Dr** 14,003.33 | | **cash that never arrived** |

**AR credited 28,006.66 against a 14,003.33 credit note — overstated by exactly
100%.** The phantom row is even labelled *"Payment received"*.

Isolating it: correct AR would be `14,003.33 − 5,000 − 14,003.33 = −5,000.00`;
actual is **−19,003.33**; the difference is **−14,003.33**, precisely the L1
phantom. **T5.2** asserts this becomes −5,000.00.

#### L5 demonstrated

An **issued** purchase credit note worth 2,100.00 produced **zero** GL rows.
Accounts Payable still reads −11,003.33 instead of −8,903.33. **T6.2** asserts
the missing pair appears.

#### L2 demonstrated on pre-existing payroll

Payroll entry 11, fully paid: accrued `Cr Salary Payable 115,744.00` (gross),
paid `Dr 109,956.80` (net) → **5,787.20 stuck permanently**, exactly the 5%
deduction. **T4.4** asserts this clears to zero.

#### Baseline balances (Dr positive) — compare against these in P12

| Account | Balance | Expected change once fixed |
|---|---|---|
| Accounts Receivable | **−19,003.33** | → −5,000.00 (**L1**, T5.2) |
| Cash/Bank | −93,953.47 | → −107,956.80 (phantom debit removed, **L1**) |
| Accounts Payable | **−11,003.33** | → −8,903.33 (**L5**, T6.2) |
| Salary Payable | −1,103,272.20 | residue for entry 11 clears (**L2**, T4.4) |
| Purchase Expense | 14,003.33 | splits net + VAT Recoverable (**D5**, T6.1) |
| Sales Revenue | −14,003.33 | splits net + VAT Payable (**D5**, T5.1) |
| Sales Returns and Allowances | 14,003.33 | unchanged; gains a VAT line (**H1**, T5.20) |
| Salary Expense | 1,213,229.00 | unchanged in total; splits per project (**L15**, T3.2) |

⚠ **Known fixture artefact, not a defect.** The credit note is for the *full*
invoice value and a 5,000 payment was also recorded, so the invoice is
over-relieved by 5,000 even under correct behaviour. That is why the corrected
AR target is −5,000.00 rather than zero. Do not read the −5,000 as a bug.

#### Coverage gaps remaining

Present: approved sales invoice · invoice payments (2) · issued credit note ·
approved purchase invoice · supplier payment · issued purchase credit note ·
paid payroll.

**Still missing** — add before the phases that need them: a **discounted**
invoice and a **zero-VAT** invoice (**P4b**, T4b.1/T4b.5, T5.13/T5.14) · a
**foreign-currency** invoice (**P10**, T10.1/T10.2) · a **cancelled** invoice
(**P5**, T5.6/T5.7).

---

# Phase 1 — Foundations (no behaviour change)

**Findings:** L23, L18, L19, L25, L30. **Depends on:** nothing.
Grouped because none changes a ledger amount — they make later phases safe and
observable.

> **✅ PHASE COMPLETE 2026-07-26.** 1.1–1.6 were implemented earlier but never
> carried completion markers, so this phase read as untouched; each was
> re-verified against the code on 2026-07-26 — `rowCount` is gone from
> `server/storage/` (0 sites), `delete-projects-employees.ts` is deleted,
> `zero-project-financials.ts` carries a dry-run/confirmation guard, `tsconfig`
> includes `scripts/**/*`, the credit-note update path re-throws GL failures,
> and `createPurchaseInvoiceFromPO` is gone. **1.7 was the only genuinely
> outstanding item** and is now closed — see its row below.

### Changes

| # | Change | Detail |
|---|---|---|
| 1.1 | **L23** `rowCount` → `count` | All **18** sites in `server/storage/` (**D12**). `rowCount` is always `undefined` on postgres-js |
| 1.2 | **L18** delete script | Remove `scripts/delete-projects-employees.ts` (**D11**) — its `.where()` uses JS `!==`, not a SQL predicate |
| 1.3 | **L19** guard script | `scripts/zero-project-financials.ts`: add typed confirmation + `--dry-run` (**D11**) |
| 1.4 | **tsconfig** | Add `scripts/**/*` to `include` so this class of error is caught by `npm run check` (**D11**) |
| 1.5 | **L25** stop swallowing | `sales.ts:555` — re-throw GL failures on credit-note update, matching `createCreditNote` |
| 1.6 | **L30** delete dead code | Remove `createPurchaseInvoiceFromPO` + its `IStorage` declaration |
| 1.7 | **L14** transaction wrapping *(G3)* | **✅ DONE 2026-07-26.** ~~Do this before P4–P6~~ — the ordering was **not** followed: P4, P5 and P6 all shipped first, so the row-count increase landed before the safety net. Closed afterwards instead, in three parts. **(a)** `getProfitLossEntries` no longer opens a per-call `pg` Pool; it uses the shared postgres-js connection via the `sqlRaw` convention *(branch `fix/ledger-transactions`)*. **(b)** Sales credit note (3 rows, both entry paths) and sales payment (2 rows) wrapped; `createGeneralLedgerEntry` gained an optional `tx` argument so a set can post atomically **without losing its double-entry validation** *(branch `feature/sales-ledger-postings`)*. **(c)** Payroll — the last unwrapped module — all **8** sites across accrual, payment and reversal *(branch `fix/payroll-ledger-transactions`)*. ⚠ Passing `tx` **skips** the per-row `recalculateProjectCost`: that recalc reads over the shared connection and from inside an open transaction would persist a cost computed *without* the rows being written. Callers passing `tx` recalculate the affected projects **after** the commit — see `postPayrollAccrual`. Sales/purchase approval, edit, cancellation and credit-note postings were already wrapped as part of P5/P6. Verified by forced-failure tests on each: the whole set rolls back and the GL row count is unchanged |

⚠ **1.4 will surface pre-existing type errors.** `npm run check` already fails
(CLAUDE.md §12). Adding `scripts/` may add more. Decide whether to fix those in
scope or record them — do **not** let it silently expand this phase.

### Test cases

| ID | Test |
|---|---|
| **T1.1** | GIVEN a payroll period with GL entries → WHEN `clearPayrollPeriod` runs → THEN the returned `deletedGeneralLedgerEntries` equals the number actually deleted, **not 0** |
| **T1.2** | GIVEN an existing credit note → WHEN `DELETE /api/credit-notes/:id` → THEN the storage method returns `true` and the route does not 500 |
| **T1.3** | GIVEN a payroll deduction → WHEN deleted → THEN HTTP **200**, not 500, and payroll totals recalculate (previously returned false → spurious 500) |
| **T1.4** | GIVEN the repo → WHEN `ls scripts/delete-projects-employees.ts` → THEN not found |
| **T1.5** | GIVEN `npm run reset:revenue` → WHEN run without the confirmation token → THEN it aborts and changes nothing |
| **T1.6** | GIVEN `--dry-run` → WHEN run → THEN it reports the rows it *would* change and the GL row count is unchanged afterwards |
| **T1.7** | GIVEN a credit note transitioning draft→issued where GL posting fails (e.g. temporarily invalid account) → WHEN saved → THEN the request **fails** and the credit note does **not** silently show as issued |
| **T1.8** | GIVEN `npm run check` → WHEN run → THEN no *new* errors beyond the recorded pre-existing baseline |
| **T1.9** | *(L14)* GIVEN a sales invoice approval where the **second** GL insert is forced to fail → WHEN approved → THEN **neither** row persists and the invoice is not left approved with a one-sided ledger |
| **T1.10** | *(L14)* GIVEN two users approving different invoices simultaneously → WHEN both complete → THEN both post fully and the trial balance still balances |
| **T1.11** | GIVEN the P&L report → WHEN run 50 times in succession → THEN no connection exhaustion (per-call `Pool` removed) |

---

# Phase 2 — Payroll calculation

**Decisions:** D2, D16 · **Findings:** §1.6 working days, L26-adjacent.
**Depends on:** P0 (accounts must exist). **Must precede P4.**

### Changes

| # | Change | Detail |
|---|---|---|
| 2.1 | **Calendar days** | Replace working-day basis with calendar days in **three** places: divisor `payroll.ts:313`, numerator `payroll.ts:306`, stored `workingDays` `payroll.ts:331`. `calculateWorkingDays` / `getWorkingDaysInMonth` become dead — report, don't delete |
| 2.2 | **PF base = earnings** | **✅ DONE 2026-07-25.** `PF = 5% × (basicSalary + additions excluding reimbursements)`. Deductions do **not** reduce it (**D2**). Extracted `computePfAmount` + `pfEligibleAdditionsSum` ([payroll.ts](server/storage/payroll.ts)); generation routed through the same helper; the stale `TDS` comments/labels replaced. `tdsAmount` was already renamed to `pfAmount` in a prior pass |
| 2.3 | **PF recompute** | **✅ DONE 2026-07-25.** `updatePayrollEntryTotals` now recomputes PF from the current additions, updates the system PF deduction row in place, then sums deductions and net. Reimbursements excluded via `type`. A deduction-only change is a no-op (PF base unaffected). Tests T2.7–T2.12 rewritten to hit the real code; T2.11 proven red with the recompute disabled |
| 2.4 | **PF row protected** | **✅ DONE 2026-07-25.** Storage guards reject manual create/edit/delete of a `provident_fund` deduction (`code: "PF_PROTECTED"`); routes map it to **400**. Also blocks manual *creation* of a PF row (prevents a duplicate the recompute can't reconcile). Client hides the edit/delete controls on the PF row, showing "Auto-calculated". Tests T2.13a–d. Verified live: PUT/DELETE on the PF row → 400, row intact |
| 2.5 | **Type fields** | Add `type` to `payroll_deductions` and `payroll_additions` — constrained set, not free text. UI: text input → select |
| 2.6 | **Reimbursement category** | Add `category` to `reimbursements` + UI select (**D16**), mapped to a COA code |
| 2.7 | ~~**Payslip layout**~~ | **⏭️ SKIPPED — user decision 2026-07-25: retain the current payslip display.** Would have split reimbursements into their own REIMBURSEMENTS block after deductions across the ~7 render paths + Excel export. **Display-only — nothing depends on it:** PF already excludes reimbursements in the calc (2.2/2.3, and it did before too), and reimbursement GL routing (P4/D16) reads `type`, not the payslip layout. Consequence retained: reimbursements keep showing inside the **Earnings** block / Total Earnings, as today. Revisit if the client later wants them visually separated |

| 2.8 | **Drop the dead JSON columns** | **✅ DONE 2026-07-25.** Migration `0064_drop_dead_payroll_json_columns.sql` drops `payroll_entries.additions` and `.deductions` (all 25 UAT rows were `[]`/`[]`). Removed the `schema.ts` column defs, the `insertPayrollEntrySchema.extend()` and the single mapping in `generateMonthlyPayroll`. Applied to the local UAT copy; typecheck 674, 28 tests green |
| 2.9 | **Down migration** *(G7)* | **✅ DONE 2026-07-25.** `0063` and `0064` each carry a commented `ROLLBACK` section (the team applies migrations by hand, so rollback SQL is documented, not executed). `0062` likewise |

⚠ ~~**2.7 is the highest-risk item in this phase.**~~ **2.7 skipped (2026-07-25)** —
the payslip display is retained as-is, so the seven-render-path change and its
risk no longer apply.

### Test cases

**Calendar days (§1.6)** — July 2026: 31 calendar days, 23 weekdays. Consultant on 10,000.

| ID | Test |
|---|---|
| **T2.1** | GIVEN assignment covers the whole of July → WHEN payroll generated → THEN earnings = **10,000.00** (unchanged — this case was already correct) |
| **T2.2** | GIVEN assignment 1–15 July (15 calendar days) → WHEN generated → THEN earnings = **4,838.71** (`10,000 ÷ 31 × 15`), previously 4,782.61 |
| **T2.3** | GIVEN assignment 6–10 July (5 weekdays) → WHEN generated → THEN earnings = **1,612.90**, previously 2,173.91 — the 35% overpayment case |
| **T2.4** | GIVEN assignment 4–5 July (weekend only) → WHEN generated → THEN earnings = **645.16** and the employee **appears** in payroll; previously 0.00 and skipped entirely |
| **T2.5** | GIVEN a permanent employee → WHEN generated → THEN `basicSalary` = full monthly salary, unchanged, and `workingDays` = 31 |
| **T2.6** | GIVEN the payslip → WHEN printed → THEN the displayed day count matches the basis used for the money |

**PF base (D2)**

| ID | Test |
|---|---|
| **T2.7** | GIVEN basic 10,000, no additions, no deductions → THEN PF = **500.00** |
| **T2.8** | GIVEN basic 10,000 + overtime 1,000 → THEN PF = **550.00** (additions included) |
| **T2.9** | GIVEN basic 10,000 + advance recovery 2,000 → THEN PF = **500.00** — deduction does **not** reduce the base. *This is the D2 regression test* |
| **T2.10** | GIVEN basic 10,000 + travel reimbursement 500 → THEN PF = **500.00** — reimbursement excluded |
| **T2.11** | GIVEN generated payroll with PF 500 → WHEN a 2,000 bonus is added → THEN PF recomputes to **600.00** and `totalDeductions` reflects it |
| **T2.12** | GIVEN generated payroll with PF 500 → WHEN a 1,000 advance deduction is added → THEN PF stays **500.00** |
| **T2.13** | GIVEN the PF deduction row → WHEN a user tries to edit or delete it → THEN rejected |
| **T2.14** | GIVEN PF applies to all categories → WHEN payroll generated for permanent, consultant and contract → THEN **all three** have a PF row |

**Payslip (7 paths)** — ⏭️ **T2.15–T2.18 dropped with 2.7 (2026-07-25).** They
asserted the separate REIMBURSEMENTS block / per-path layout that is no longer
being built. The display is retained as-is.

| ID | Test |
|---|---|
| ~~**T2.15**~~ | ~~Total Earnings 11,000, PF 550, Total Deductions 2,550, Reimbursements 500, Net Pay 8,950~~ — dropped (2.7 skipped) |
| ~~**T2.16**~~ | ~~identical figures/layout across all 7 paths~~ — dropped (2.7 skipped) |
| ~~**T2.17**~~ | ~~reimbursement in the REIMBURSEMENTS block, not Earnings~~ — dropped (2.7 skipped) |
| ~~**T2.18**~~ | ~~Excel columns reconcile to the payslip~~ — dropped (2.7 skipped) |
| **T2.19** | *(2.8)* GIVEN the JSON columns are dropped → WHEN the payroll list, payslip and additions/deductions endpoints are exercised → THEN all serve correctly from the child tables — nothing read the dropped columns |

---

# Phase 3 — L15: Salary Expense multiplication

**Finding:** L15 (most severe in the report). **Depends on:** P1.
**Must precede P4** — D7 makes project labour depend on these rows.

> **✅ DONE 2026-07-25.** `updatePayrollEntryTotals` no longer writes the full
> total to every Salary Expense row. It reads the entry's per-project rows and
> rescales each to its share of the new total via `updateGeneralLedgerEntry`
> (3.1), with the rounding remainder on the largest row so ΣDr = ΣCr (3.2, new
> `splitAmountAcrossRows` helper). Single-row (permanent) case unchanged. The
> raw-SQL `UPDATE`s are gone. Tests T3.6/T3.7 + split cases and an end-to-end
> **T3.2** (3-project consultant → 6500/3900/2600, not 13000×3), proven red with
> the bug reintroduced. **L8/T3.5 deferred to P4.8** (referenceType namespacing);
> the split *source* stays the generation working-days ratio — P4.6 makes it
> real-time-from-assignments and feeds project cost.

### Change

`updatePayrollEntryTotals` ([payroll.ts:756](server/storage/payroll.ts:756))
raw-SQL `UPDATE` sets **every** matching Salary Expense row to the full total,
with no project filter. For a consultant on N projects this debits
`N × totalEarnings` against a single credit.

Rewrite to update **per project**, preserving the split — and route it through
`updateGeneralLedgerEntry` rather than raw SQL so validation applies.

**3.2 — L12 rounding *(G3)*.** Each project's debit is rounded independently
with `.toFixed(2)` while the single credit is rounded once, so a multi-project
consultant can be out by a cent and `ΣDr = ΣCr` fails. Allocate the rounding
remainder to one line (conventionally the largest) so the split always sums
exactly to the credit.

### Test cases

| ID | Test |
|---|---|
| **T3.1** | GIVEN a consultant on 3 projects, gross 10,000 split 5,000/3,000/2,000 → WHEN payroll generated → THEN 3 Salary Expense rows of exactly those amounts, one Salary Payable credit of 10,000, **ΣDr = ΣCr** |
| **T3.2** | *(The bug)* GIVEN the above → WHEN **any** addition or deduction is added → THEN the 3 rows still read 5,000/3,000/2,000 — **not** 10,000 each. Previously ΣDr became 30,000 vs 10,000 credit |
| **T3.3** | GIVEN the above → WHEN a 3,000 bonus is added to one project → THEN the split reflects it and ΣDr still equals ΣCr |
| **T3.4** | GIVEN a permanent employee (single row) → WHEN totals update → THEN behaviour unchanged |
| **T3.5** | GIVEN a manual journal line with `reference_type='manual'`, the same numeric `reference_id` and account `Salary Expense` → WHEN payroll totals update → THEN that row is **not** touched (namespace collision, L8) |
| **T3.6** | *(L12 rounding)* GIVEN gross 10,000 split across **3** projects by working days that do not divide evenly (e.g. 33.33% each) → WHEN posted → THEN the three debits sum to **exactly 10,000.00** and equal the Salary Payable credit to the cent |
| **T3.7** | GIVEN a 7-project split → THEN still exact — the remainder is absorbed, not dropped |

---

# Phase 4 — Payroll ledger postings

**Decisions:** D2, D7, D14, D16 · **Findings:** L2, L3, L24, L31.
**Depends on:** P0, P2, P3.

> **✅ DONE 2026-07-25 (code + jest; live approve/paid click still to be run).**
> Accrual moved to **approval** (`postPayrollAccrual`), generation posts no GL
> (4.1/D7). Split accrual: `Dr Salary Expense` per project (real-time split) /
> `Dr <category>` per reimbursement (D16, routed through Salary Payable — no
> separate reimbursement payable) / `Cr PF 2120` / `Cr Salary Payable` =
> gross−PF+reimbursements (4.2/4.3/D18). Payment reads the accrual credit back
> and pays exactly that → **Salary Payable clears to zero, L2 fixed** (4.11).
> Own `referenceType "payroll"`/`"payroll_reversal"` (4.8/L8). Transition guard
> handles generated→paid (4.9). `clearPayrollPeriod`/`clearAllPayrollEntries`
> **reverse** all payroll GL, no hard-delete (4.4/4.5/L3/L24).
> `recalculateProjectCost` sums the per-project Salary Expense rows, net of
> reversals — no status gate, no LIKE (4.6/L31). PF balance report +
> `/api/payroll/pf-balances` (4.7/D14). 4.10 already enforced —
> `approveReimbursement` auto-assigns the payroll period. Tests T4.3/4.5/4.9 +
> idempotency; the per-project split (ex-T3.2) is proven here. **No migration
> (referenceType is free text). UI: a PF-balances report page is a follow-up.**

### Changes

| # | Change | Detail |
|---|---|---|
| 4.1 | **Post at approval** | Move the accrual out of generation into approval (**D7**). Keep `transactionDate` = first of month worked |
| 4.2 | **Split the accrual** | `Dr Salary Expense` (gross, per project) / `Cr Provident Fund Contribution` (PF) / `Cr Salary Payable` (**gross − PF**, plus reimbursements). Advance recoveries get **no line of their own** — they stay inside the payable (**D18**). Fixes **L2** |
| 4.3 | **Reimbursement posting** | `Dr <category account>` with `projectId`, never Salary Expense (**D16**) |
| 4.4 | **L3** `clearPayrollPeriod` | Reverse **all** payroll GL including `payroll_payment` rows; post reversals, don't hard-delete |
| 4.5 | **L24** `clearAllPayrollEntries` | Same treatment — currently no GL handling at all |
| 4.6 | **L31** project labour | **Consultant split by real time worked (user decision 2026-07-25):** for a consultant, look at which projects they were assigned to during the payroll period and split the Salary Expense GL by the **actual time worked per project** in that window (the working-days basis generation already uses) — not a single fallback `projectId`. Then rewrite `recalculateProjectCost` to **sum the per-project Salary Expense rows** for the project, dropping the single-`projectId` + full-`totalAmount` approach, the `approved`/`paid` status gate and the `LIKE 'Reimbursement:%'` subtraction. Project cost and ledger then agree by construction. Permanent employees keep their single row/project |
| 4.7 | **PF balance report** | Per-employee PF balance from `entityId` (**D14**) |
| 4.8 | **L8** namespacing *(G3)* | Stop payroll using `referenceType: "manual"` — it collides with genuine journals and is what lets `clearPayrollPeriod` match them. Give payroll its own value; widen the CHECK constraint in P0 if needed |
| 4.9 | **Status transition guard** *(G4)* | Hook the accrual to the transition **into `approved`**, mirroring the existing `paid` detection at [payroll.ts:610](server/storage/payroll.ts:610). **Handle `generated` → `paid` directly**: either post the accrual first if it has not posted, or reject the transition. The route accepts arbitrary `req.body`, so this cannot be left to the UI |
| 4.10 | **Reimbursement routing enforced** *(team decision 2026-07-24)* | All reimbursements route through payroll — assumed and **enforced**: `payrollMonth`/`payrollYear` become **required at reimbursement approval**. Without this, a NULL-period reimbursement would silently never post GL (the only reimbursement posting rides payroll approval). If a direct-payment case ever emerges, it needs its own posting path — revisit then |
| 4.11 | **Payment posts gross − PF, not net** *(D18)* | The payment posting currently debits `Salary Payable` by `totalAmount`, which is the payslip **net**. It must debit the **same figure the accrual credited** — `totalAmount + non-PF deductions` — and credit `Cash/Bank` for that figure. This is an **amount** change, not just an account change; without it the accrual split in 4.2 leaves the residue intact and **L2 stays open**. Derive the figure once, in one helper, and use it on both sides so they cannot drift |

### Reference posting

Basic 10,000 · overtime 1,000 · advance recovery 2,000 · travel reimb 500 ·
PF 550 (5% × 11,000 — deductions do not reduce the base, **D2**):

**Accrual, on approval**
```
Dr  Salary Expense                    11,000     (split per project)
Dr  Travel and Entertainment (6120)      500     (projectId set)
    Cr  Provident Fund Contribution (2120)          550
    Cr  Salary Payable                           10,950     gross − PF + reimbursement
                                      ─────────────────
                                      11,500 =  11,500  ✓
```

**Payment**
```
Dr  Salary Payable      10,950
    Cr  Cash/Bank                  10,950     → Salary Payable = 0 ✓
```

Payslip net pay is **8,950**, which is what the employee receives. The 2,000
difference is the advance — paid out earlier with no GL record, recognised here
(**D18**). Expect bank reconciliation for that month to show the 2,000; it is the
correction landing, not a defect.

### Test cases

| ID | Test |
|---|---|
| **T4.1** | GIVEN payroll generated but **not** approved → WHEN querying GL → THEN **zero** rows for it (D7) |
| **T4.2** | GIVEN June payroll approved on 7 July → WHEN inspecting GL → THEN `transaction_date` = **2026-06-01**, `created_at` = 7 July |
| **T4.3** | GIVEN the reference case above → WHEN approved → THEN a line exists for each of `Salary Expense` 11,000 (Dr, split per project), `Travel and Entertainment` 500 (Dr), `Provident Fund Contribution` 550 (Cr), `Salary Payable` **10,950** (Cr); **no other account is posted**; **ΣDr = ΣCr = 11,500** *(R4: assert lines by account, not a row count)* |
| **T4.4** | *(L2 regression)* GIVEN payroll approved then marked paid → WHEN checking `Salary Payable` → THEN balance returns to **exactly zero**. Previously left a permanent residue equal to the deductions |
| **T4.5** | *(4.11)* GIVEN marked paid → THEN `Dr Salary Payable 10,950 / Cr Cash/Bank 10,950` — **gross − PF**, matching the accrual credit to the cent. Asserting the payslip net (8,950) here would be the bug |
| **T4.6** | GIVEN PF 550 accrued → WHEN payroll paid → THEN `Provident Fund Contribution` balance is **still 550** (liability persists until exit — D14) |
| **T4.7** | *(D18)* GIVEN an advance recovery of 2,000 → WHEN approved → THEN **no GL line is created for the recovery**; `Employee Advances` (1120) has **zero** rows; and `Salary Payable` is credited 10,950 — i.e. the recovery is **not** deducted from it |
| **T4.7b** | *(D18)* GIVEN the same entry marked paid → THEN `Cash/Bank` is credited 10,950, which exceeds the payslip net of 8,950 by **exactly 2,000** — the previously unrecorded advance entering the books |
| **T4.7c** | *(D18, superseded-option regression)* GIVEN the same entry → WHEN approved → THEN `Salary Expense` is **11,000**, the full earned amount. The rejected treatment posted 9,000 (earnings less recovery); assert the recovery does **not** touch expense |
| **T4.7d** | *(R1 falsifiability)* GIVEN an identical entry with **no** deductions other than PF → THEN `Salary Payable` credit **equals** the payslip net, and `Cash/Bank` equals the net. Guards against a fix that unconditionally inflates the payable rather than only carrying genuine recoveries |
| **T4.8** | GIVEN a travel reimbursement of 500 on project X → WHEN approved → THEN `Travel and Entertainment` debited 500 with `project_id = X`; `Salary Expense` does **not** include it |
| **T4.9** | *(L3 regression)* GIVEN an approved **and paid** payroll period → WHEN cleared → THEN accrual **and** payment entries are reversed; trial balance moves by **zero**. Previously left orphaned `Dr Salary Payable / Cr Cash/Bank` |
| **T4.10** | *(L24 regression)* GIVEN payroll across 3 periods → WHEN "clear all" → THEN **all** payroll GL is reversed. Previously none was |
| **T4.11** | *(L31)* GIVEN a consultant on 3 projects → WHEN project costs recalculate → THEN each project shows **its own share**; previously one project took 100% |
| **T4.12** | GIVEN payroll approved → WHEN project cost recalculates → THEN labour is included immediately (no status gate) |
| **T4.13** | GIVEN reimbursements exist → WHEN project cost recalculates → THEN counted **once** — no `LIKE` subtraction needed |
| **T4.14** | GIVEN 3 employees with PF → WHEN the PF balance report runs → THEN per-employee balances sum to the `2120` control balance |
| **T4.15** | *(G4)* GIVEN a payroll entry in `generated` → WHEN a client sends `{status:"paid"}` directly, skipping `approved` → THEN either the accrual posts first **or** the transition is rejected. **Never** `Dr Salary Payable` with no matching accrual |
| **T4.16** | *(G4)* GIVEN bulk approval of 20 entries → WHEN submitted → THEN all 20 accruals post and the trial balance still balances |
| **T4.17** | *(L8)* GIVEN a manual journal touching `Salary Expense` with a `reference_id` matching a payroll entry → WHEN that payroll period is cleared → THEN the manual journal row **survives untouched** |
| **T4.18** | GIVEN an employee with **zero** earnings for the month → WHEN payroll is approved → THEN no GL rows are created for them and no zero-amount entry is attempted |
| **T4.19** | *(4.10)* GIVEN a reimbursement approval without `payrollMonth`/`payrollYear` → WHEN submitted → THEN **rejected** with a clear message — no reimbursement can exist outside a payroll period, so none can silently skip GL |

---

# Phase 4b — VAT base correction (UAE law) ⚠ COMPLIANCE

**Confirmed by the team 2026-07-24: VAT is charged on the *discounted* subtotal,
per UAE VAT law.** The system computes it on the **pre-discount** amount.
**Depends on:** nothing. **Must precede P5 and P6** — there is no point posting a
correct split of a wrong tax figure.

### The defect

VAT is calculated **per line, on the gross line amount**
([sales/index.tsx](client/src/pages/sales/index.tsx)):

```js
taxAmount: item.quantity * item.unitPrice * (taxRate / 100)
```

The discount is applied separately at the **header**
(`discount = subtotal × discountPercentage`), and the total is assembled as
`subtotal + taxAmount − discount`
([purchase.ts:1930](server/storage/purchase.ts:1930)). The discount therefore
never reduces the tax base. The **server trusts the client's `taxAmount`** and
never revalidates it.

On a 10,000 invoice, 5% VAT, 10% discount:

| | Current | Correct |
|---|---|---|
| Taxable amount | 10,000 | **9,000** |
| VAT | **500** | **450** |
| Total | 9,500 | 9,450 |

**Consequences:** customers are overcharged VAT · the tax invoice issued to them
states the wrong VAT, which a UAE tax invoice must not · output VAT is
over-declared to the FTA, so the company pays more than it owes.

**This is arguably the highest-severity finding in the programme** — it is
customer-facing and regulatory, not internal. It is not yet live, so it must be
fixed before go-live.

### Changes

| # | Change | Detail |
|---|---|---|
| 4b.1 | **Apportion the discount across lines** | Spread the header discount pro-rata over line items, then compute each line's VAT on its **discounted** amount. Pro-rata rather than a single header calculation because `taxRate` is per item — mixed rates (standard 5% and zero-rated) must each be taxed on their own discounted share |
| 4b.2 | **Recompute totals** | `taxable = subtotal − discount`; `total = taxable + tax` |
| 4b.3 | **Server-side validation** | Reject an invoice whose `taxAmount` does not match a server recomputation. The server currently accepts whatever the client sends |
| 4b.4 | **Apply to every document type** | Sales invoices, quotations, proforma invoices, credit notes, purchase invoices, purchase orders — any document carrying both `taxAmount` and a discount |
| 4b.5 | **Zero-rated / exempt customers** | `customer.vatTreatment` already drives a 0% rate. Confirm the discount logic behaves when the rate is 0 (**G2** — no VAT line is posted at all) |
| 4b.6 | **Existing documents** | Invoices already recorded with a discount hold the wrong `taxAmount`. Since **D15** wipes and re-posts the ledger from those documents, the **documents must be recalculated first** or the rebuild faithfully re-posts the wrong VAT |
| 4b.7 | **Rounding rule** *(H3)* | VAT is computed and rounded **per line**, so the sum of line taxes can differ by a cent from 5% of the invoice total. Fix the rule: the VAT posted = **sum of the rounded line taxes**, and the AR debit is derived as `revenue + VAT − discount` from those same rounded figures — so the entry balances by construction, not by luck |
| 4b.8 | **Line-level discounts** | **Now in P4b scope (added 2026-07-25) — see *Scope expansion* below.** A discount **per line item** (percentage or fixed amount). The apportionment order: line discount applies first, then any header discount apportions over the already-line-discounted amounts. VAT is then charged per line on that discounted base |

### Test cases

| ID | Test |
|---|---|
| **T4b.1** | GIVEN subtotal 10,000, 5% VAT, 10% discount → WHEN saved → THEN `taxAmount` = **450.00**, `totalAmount` = **9,450.00** |
| **T4b.2** | GIVEN no discount → THEN VAT = 500.00 and the total is unchanged from today (regression guard) |
| **T4b.3** | GIVEN a **fixed-amount** discount of 1,000 rather than a percentage → THEN taxable = 9,000 and VAT = 450 |
| **T4b.4** | GIVEN mixed lines — one standard-rated 5,000, one zero-rated 5,000 — and a 10% discount → THEN the discount is apportioned 50/50 and VAT = 5% × 4,500 = **225.00**, not 250 |
| **T4b.5** | GIVEN a zero-rated customer (`vatTreatment ≠ standard`) with a discount → THEN VAT = 0 and **no VAT line is posted** (**G2**) |
| **T4b.6** | GIVEN a client that posts a hand-crafted wrong `taxAmount` → WHEN submitted → THEN **rejected** by server validation (4b.3) |
| **T4b.7** | GIVEN a 100% discount → THEN taxable = 0, VAT = 0, total = 0, and no zero-amount GL rows are attempted |
| **T4b.8** | GIVEN the printed tax invoice → THEN the VAT shown matches the recalculated figure |
| **T4b.9** | GIVEN a quotation converted to an invoice → THEN the VAT base is recomputed, not copied |
| **T4b.10** | GIVEN existing discounted invoices in UAT → WHEN recalculated (4b.6) → THEN each one's stored `taxAmount` and `totalAmount` change by the expected amount, and the change is reported before being applied |
| **T4b.11** | *(H3)* GIVEN 3 lines whose individually-rounded taxes sum to 0.01 off 5% of the total (e.g. three lines of 33.33 at 5%) → WHEN saved and posted → THEN document `taxAmount` = **sum of line taxes**, and the GL entry balances to the cent |

### Open question for the team

**✅ DECIDED 2026-07-24: recalculate with a report** (Open Item 2). Existing
discounted UAT documents are recalculated to the lawful VAT base, with a report
of every document whose `taxAmount`/`totalAmount` changed, before the P11
rebuild re-posts from them.

### Scope expansion — line-item discounts (added 2026-07-25)

Item 4b.8 was originally a *forward-compatibility* note. The team has since
brought that enhancement **into P4b scope**: line-item discounts are now built as
part of this phase, alongside the VAT-base correction (they share the same
apportionment engine).

**Decisions (confirmed by the user):**

- **Per line:** support **both** a percentage and a fixed amount (`discount` +
  `discountType` on each item).
- **Documents:** **all except purchase requests** — sales invoices, quotations,
  proforma, credit notes; purchase invoices, purchase orders.
- **Interaction:** line discount applies **first**; the header discount then
  apportions pro-rata over the already-line-discounted amounts; VAT is charged
  per line on the discounted base (UAE law, 4b.1/4b.2).

**Implementation:**

- **Shared engine** `shared/document-totals.ts` (`computeDocumentTotals`),
  importable by both client (Vite `@shared`) and server (tsx/esbuild). The server
  recomputes authoritatively and **overrides** the client's totals (4b.3).
  Covered by `server/document-totals.calc.test.ts` (T4b.1–T4b.11 + line/header
  combinations).
- **Schema/migration:** `discount` + `discount_type` added to
  `purchase_invoice_items` and `purchase_order_items`
  (`migrations/0065_add_line_item_discounts.sql`, applied locally). Sales line
  items live in the JSON `items` column, so no migration.
- **Storage helpers** `applySalesDocumentTotals` / `applyPurchaseDocumentTotals`
  run the engine on create/update for every in-scope document.

**Two corrections that emerged during implementation** (both regressions from the
new server-side recompute, since the server now overrides client totals):

- **Header-discount column semantics.** The header-discount column
  (`discount` on sales, `discountAmount` on purchase) must store **only the
  header** discount — its pre-P4b meaning — because the edit/duplicate/convert
  forms reload that column into the header-discount input. Storing the *combined*
  (header + line) total there made the discount **inflate on every edit**. The
  combined total shown on details views and printed documents is instead
  **derived** as `subtotal + taxAmount − totalAmount` (an exact identity given
  the engine's definitions — no rounding drift).
- **Edit-history diffs.** The invoice/order edit-history diff must compare the old
  row against the **persisted (recomputed)** row, not the raw client payload —
  otherwise it logs phantom changes (e.g. "Tax Amount 4.28 → 5.00") for the
  pre-recompute figures the client sent but the server never stored.

**Progress (updated 2026-07-25):**

- ✅ **Line-item discounts + VAT-on-discounted-base across every in-scope
  document** — verified end to end: shared engine + tests · sales invoices &
  quotations · proforma (PRF-003) · credit notes (CN-002) · purchase invoices,
  create/edit/duplicate (PI-005) · purchase orders (PO-004) · PO→invoice
  conversion routed through the engine (PI-007).
- ✅ **Supporting fixes:** header-discount storage fix (store header, derive the
  total for display) on both sales and purchase, across all details views and
  print generators · edit-history persisted-row diff (sales/purchase invoices,
  purchase orders) · purchase-invoice edit total overwrite · duplicate now
  carries line discounts · PO edit-load `taxRate` hardcode.
- ✅ **Recalculation tool** (4b.6 / T4b.10): `scripts/recalc-vat-discounts.ts`
  recomputes existing discounted documents through the engine — **dry-run report
  by default**, `--apply` to write. Safe to re-run (already-correct documents show
  no change). Verified against UAT-local data.
- ⏳ **Remaining:** the team reviews the dry-run report, then runs
  `scripts/recalc-vat-discounts.ts --apply` against UAT/production, **before** the
  P11 ledger rebuild re-posts from those documents. (Caution: `server/db.ts:4`
  logs `DATABASE_URL` on startup — scrub it from any shared console/log output.)

---

# Phase 5 — Sales ledger postings

**Decisions:** D1, D5 · **Findings:** L1, L11, L22a, L22b, L26.
**Depends on:** P0.

### Changes

| # | Change | Detail |
|---|---|---|
| 5.1 | **L1** credit-note double post | `createInvoicePayment` skips GL when `paymentType = 'credit_note'` (**D1**). Credit note keeps its own posting — **now including the VAT reversal** *(H1)*: `Dr Sales Returns` net / `Dr VAT Payable` tax / `Cr AR` gross. Applies to **both** entry paths — create-as-issued ([sales.ts:318](server/storage/sales.ts:318)) and draft→issued update ([sales.ts:499](server/storage/sales.ts:499)) |
| 5.2 | **D5** VAT split | `Dr AR` total / `Cr Sales Revenue` **subtotal − discount** *(net-into-revenue, G1 decision)* / `Cr VAT/GST Payable` tax. **No discount line.** **Omit any zero-amount line** *(G2)*. **Replace `updateSalesInvoiceGLEntries`' two fixed `UPDATE`s with reverse-and-re-post** *(H2)* — a fixed set cannot delete a VAT row that should no longer exist after an edit |
| 5.3 | **L26** editable statuses | Align `editableStatuses` with statuses actually written; settle `partial` vs `partially_paid` on one value |
| 5.4 | **L22a** cancelled receivables | Add `ne(status,'cancelled')`; remove the dead `or()` |
| 5.5 | **L22b** currency | Apply `exchangeRate` in `getReceivables` |
| 5.6 | **L11** projectId | Ensure cancellation and payment rows carry it |
| 5.7 | **L13** approval paths *(G3)* | Consolidate `POST` and `PATCH .../approve` into one path with one resulting status, recording `approvedById`/`approvedAt`. Currently they leave the invoice in **different** statuses and only one records the approver |
| 5.8 | **G6** status value | Settle `partial` vs `partially_paid` on one value, **migrate existing rows**, and update every filter that references either — `getReceivables` ([report.ts:126](server/storage/report.ts:126)), `recalculateProjectCost` ([project-asset.ts:1092](server/storage/project-asset.ts:1092)), the invoice list filters, and `editableStatuses` |

### Test cases

Invoice: subtotal 10,000 + VAT 500 = **10,500**.

| ID | Test |
|---|---|
| **T5.1** | GIVEN the invoice → WHEN approved → THEN `Dr AR 10,500` / `Cr Sales Revenue 10,000` / `Cr VAT Payable 500`; **ΣDr = ΣCr** |
| **T5.2** | *(L1 regression)* GIVEN an approved invoice → WHEN a 1,000 credit note is issued → THEN **no `Cash/Bank` row exists**, AR net movement = **−1,000** (previously −2,000), and **ΣDr = ΣCr**. Row shape — 2 rows zero-VAT, 3 rows with VAT — is asserted by T5.20 |
| **T5.3** | GIVEN the credit note → WHEN issued → THEN `invoice_payments` still gains a `credit_note` row and the invoice shows part-settled (document behaviour preserved) |
| **T5.4** | GIVEN a genuine cash payment of 1,000 → WHEN recorded → THEN `Dr Cash/Bank 1,000` / `Cr AR 1,000` — the normal path still posts |
| **T5.5** | GIVEN a USD 1,000 invoice at 3.6725 → WHEN approved → THEN GL is in AED (3,672.50) and the description carries the currency note |
| **T5.6** | GIVEN an approved invoice → WHEN cancelled → THEN a reversing set including the **VAT line**; all three accounts return to zero |
| **T5.7** | GIVEN a cancelled invoice → WHEN the receivables report runs → THEN it does **not** appear (L22a) |
| **T5.8** | GIVEN a USD 1,000 and an AED 1,000 invoice → WHEN receivables runs → THEN the USD one reports **3,672.50**, not 1,000 (L22b) |
| **T5.9** | GIVEN an invoice approved via `POST /approve` → WHEN edited with an edit note → THEN the edit **succeeds** and GL re-posts (L26 — previously blocked) |
| **T5.10** | GIVEN an edited invoice → WHEN GL re-posts → THEN the VAT split is recalculated, both sides updated, ΣDr = ΣCr |
| **T5.11** | GIVEN an invoice on project X → WHEN cancelled or paid → THEN those GL rows carry `project_id = X` (L11) |
| **T5.12** | GIVEN receivables → WHEN summed → THEN the total equals the `Accounts Receivable` control balance |
| **T5.13** | *(G2)* GIVEN an invoice with `taxAmount = 0` → WHEN approved → THEN the posting succeeds, **no line exists for `VAT/GST Payable`**, and ΣDr = ΣCr *(R4)* |
| **T5.14** | *(G1, net-into-revenue)* GIVEN subtotal 10,000, discount 1,000, VAT 5% on **9,000** = 450, total **9,450** → WHEN approved → THEN `Dr AR 9,450` / `Cr Sales Revenue 9,000` / `Cr VAT Payable 450`; **ΣDr 9,450 = ΣCr 9,450**. **No discount line exists** |
| **T5.15** | *(G1)* GIVEN a discounted **and** zero-VAT invoice (subtotal 10,000, discount 1,000) → THEN `Dr AR 9,000` and `Cr Sales Revenue 9,000` (net of discount) exist, **no `VAT/GST Payable` line**, ΣDr = ΣCr *(R4)* |
| **T5.16** | GIVEN a 10,000 invoice paid in **three** instalments of 4,000 / 4,000 / 2,000 → WHEN all posted → THEN AR for that invoice nets to **exactly zero** |
| **T5.17** | GIVEN a **USD** invoice → WHEN a credit note is issued against it → THEN the AR credit uses one consistent rate, and AR nets to zero when invoice + credit note offset (previously the two AR credits used different rates) |
| **T5.18** | *(L13)* GIVEN both approval endpoints → WHEN each is used → THEN the invoice lands in the **same** status and `approvedById`/`approvedAt` are recorded in both cases |
| **T5.19** | *(G6)* GIVEN a part-paid invoice → WHEN listed, filtered, edited and reported → THEN one consistent status value is used throughout |
| **T5.20** | *(H1)* GIVEN a 1,000 credit note carrying 5% VAT (net 952.38, VAT 47.62) → WHEN issued → THEN `Dr Sales Returns 952.38` / `Dr VAT Payable 47.62` / `Cr AR 1,000.00`. Output VAT **decreases** — previously the full 1,000 hit Sales Returns and VAT was never reversed |
| **T5.21** | *(H2)* GIVEN an approved invoice **with** VAT and a discount → WHEN edited so the discount is removed and the customer becomes zero-rated → THEN the old VAT and discount rows **no longer exist**, the new posting is 2 rows, and ΣDr = ΣCr. *A fixed in-place UPDATE would have stranded both rows* |
| **T5.22** | *(H2)* GIVEN an edited invoice → WHEN the GL is inspected → THEN the prior posting is visible as a reversal, not silently overwritten |

---

# Phase 6 — Purchase ledger postings

**Decisions:** D1, D5 · **Findings:** L5, L11, L28, L29. **Depends on:** P0.

### Changes

| # | Change | Detail |
|---|---|---|
| 6.1 | **L5** purchase credit note GL | Post `Dr Accounts Payable` gross / `Cr Purchase Expense` net / **`Cr VAT Recoverable` tax** *(H1)*. Currently posts **nothing**. Applies to **both** entry paths — create-as-issued ([purchase.ts:2824](server/storage/purchase.ts:2824)) and draft→issued update ([purchase.ts:2885](server/storage/purchase.ts:2885)) |
| 6.2 | **D5** VAT split | `Dr Purchase Expense` **subtotal − discount** *(net, G1 decision)* / `Dr VAT Recoverable` tax / `Cr AP` total. **No discount line.** **Omit any zero-amount line** *(G2)*. **Replace `updatePurchaseInvoiceGLEntries`' fixed `UPDATE`s with reverse-and-re-post** *(H2)* |
| 6.3 | **L29** `lineTotal` | **✅ DONE 2026-07-25 — but deliberately NOT as originally scoped.** ~~Make `lineTotal` tax-exclusive everywhere~~ — **dropped**: `lineTotal` stays **tax-inclusive** (`taxable + taxAmount`; e.g. a 5,000 line less 500 discount at 5% stores 4,725 = 4,500 + 225). Redefining it would change line totals on live UAT documents and printouts for no accounting benefit. ~~server-validate that lines sum to `subtotal`~~ — **dropped as unnecessary**: `applyPurchaseDocumentTotals` recomputes every total authoritatively and never trusts a client-supplied `lineTotal`, so a bad value is overwritten rather than accepted. **What WAS done:** project cost allocates the discounted, ex-VAT line amount as `lineTotal − taxAmount` (`taxable` is already net of the line and apportioned header discount), so `Σ project cost = Purchase Expense`, both net of discount and excluding VAT |
| 6.4 | **L28** status bypass | Constrain create to `draft`; ignore a caller-supplied status |
| 6.5 | **L11** projectId | **✅ DONE 2026-07-25, but the model is per-LINE, not per-invoice.** Purchase projects live on `purchase_invoice_items.project_id`; a single invoice can carry cost for several projects, so `purchase_invoices.projectId` is normally **null** and copying it onto GL rows attributes nothing. Instead **`Purchase Expense` is split into one row per project** (weighted by each line's net-of-discount ex-VAT amount, apportioned so the parts sum exactly), across approval, edit re-post and cancellation. `VAT Recoverable` and `Accounts Payable` stay **whole and unattributed** — input VAT is reclaimed from the tax authority and the payable is owed to the supplier; neither is a project cost |

### Test cases

Purchase invoice: subtotal 5,000 + VAT 250 = **5,250**.

| ID | Test |
|---|---|
| **T6.1** | GIVEN the invoice → WHEN approved → THEN `Dr Purchase Expense 5,000` / `Dr VAT Recoverable 250` / `Cr AP 5,250`; ΣDr = ΣCr |
| **T6.2** | *(L5 regression)* GIVEN an approved PI → WHEN a 1,000 purchase credit note is issued → THEN GL posts `Dr AP` / `Cr Purchase Expense`. Previously **no GL at all** |
| **T6.3** | GIVEN the purchase credit note → THEN the payment row is still created and `paidAmount` updates, but that row posts **no** GL (D1 symmetry with T5.3) |
| **T6.4** | *(L28 regression)* GIVEN `POST /api/purchase-invoices` with `status: "approved"` → WHEN submitted → THEN the invoice is created as **draft**, and no GL, goods receipt or project cost is created until it is properly approved |
| **T6.5** | *(L29 — REWRITTEN, see 6.3)* ~~`Σ lineTotal` = `subtotal` (tax-exclusive)~~ — **`lineTotal` is tax-INCLUSIVE, so this can never hold and asserting it produces a false failure.** GIVEN a PO with tax converted to an invoice → WHEN approved → THEN `Σ (lineTotal − taxAmount)` = `subtotal − totalDiscount`, and project cost matches GL `Purchase Expense` **exactly** |
| **T6.6** | *(REWRITTEN, see 6.3)* ~~a client-supplied `lineTotal` that does not sum to `subtotal` is rejected~~ — the server does not reject it, it **overwrites** it. GIVEN a client-supplied `lineTotal` / `taxAmount` that disagrees with the line inputs → WHEN saved → THEN the persisted row holds the **server-recomputed** figures (VAT on the discounted base), and the client value is discarded |
| **T6.7** | *(REVISED, see 6.5)* GIVEN an approved PI whose lines allocate to project X, with VAT → WHEN cancelled → THEN the reversal set mirrors **every** original line including `VAT Recoverable`, the `Purchase Expense` reversal is split **per project** so project X's ledger nets to zero, and project cost returns to its prior value. ~~all rows carry `project_id = X`~~ — `VAT Recoverable` and `Accounts Payable` are deliberately unattributed |
| **T6.8** | *(REVISED, see 6.5)* GIVEN a supplier payment → THEN `Dr AP` / `Cr Cash/Bank`. ~~with `project_id` set~~ — a payment settles the supplier, not a project, and the invoice-level projectId is null under per-line allocation; neither row is project-attributed |
| **T6.9** | GIVEN an approved PI → WHEN edited → THEN GL re-posts with the VAT split intact |
| **T6.10** | GIVEN VAT Payable (output) and VAT Recoverable (input) balances → WHEN a period's sales and purchases are posted → THEN net VAT equals `output − input` and is derivable for a return |
| **T6.11** | *(G2)* GIVEN a purchase invoice with `taxAmount = 0` → WHEN approved → THEN the posting succeeds, **no line exists for `VAT Recoverable`**, and ΣDr = ΣCr *(R4)* |
| **T6.12** | *(G1, net)* GIVEN subtotal 5,000, discount 500, VAT 5% on **4,500** = 225, total **4,725** → WHEN approved → THEN `Dr Purchase Expense 4,500` / `Dr VAT Recoverable 225` / `Cr AP 4,725`; **ΣDr 4,725 = ΣCr 4,725**. No discount line |
| **T6.13** | *(G1)* GIVEN a discounted purchase invoice → WHEN project cost is recalculated → THEN it reconciles to `Purchase Expense` **net of discount**, consistent with L29 |
| **T6.14** | *(H1)* GIVEN a purchase credit note with VAT → WHEN issued → THEN `Dr AP` gross / `Cr Purchase Expense` net / `Cr VAT Recoverable` tax — input VAT is **reduced**, so the VAT return is not over-claimed |
| **T6.15** | *(H2)* GIVEN an approved purchase invoice with VAT → WHEN edited to remove the tax → THEN the VAT row no longer exists and ΣDr = ΣCr |
| **T6.16** | GIVEN sales VAT, purchase VAT, a sales credit note and a purchase credit note in one period → WHEN the VAT position is computed → THEN `output − input` reflects **all four** and matches a hand calculation |

---

# Phase 7 — Deletes and reversals

**Decision:** D8 · **Finding:** L7. **Depends on:** P5, P6.

### Changes

Deleting a document that has posted to the GL first writes a **reversing set**
(2–4 rows, mirroring however many the original posting had — VAT and discount
lines included), copying `invoiceNumber`, `entityName` and `description` so the
orphaned entries stay traceable after the document is gone. Applies to sales
invoices, credit notes, purchase credit notes. Drafts (no GL) delete as now.

### Test cases

| ID | Test |
|---|---|
| **T7.1** | GIVEN an issued credit note with GL → WHEN deleted → THEN a reversing set is posted **before** deletion, line-for-line against the original; net GL movement = **zero** |
| **T7.2** | GIVEN the above → WHEN inspecting the reversal → THEN it carries the deleted document's number, entity name and description |
| **T7.3** | GIVEN a **draft** credit note (no GL) → WHEN deleted → THEN no reversal is posted and no GL rows are created |
| **T7.4** | GIVEN any document deletion → WHEN the trial balance is run before and after → THEN it balances in **both** cases |
| **T7.5** | GIVEN a deleted posted document → WHEN the GL is listed → THEN both the original and reversal remain visible, no dangling single side |

---

# Phase 8 — Manual journal entries

**Decisions:** D3 · **Findings:** L4, L16. **Depends on:** P0.
**Must precede P11.**

### Changes

| # | Change | Detail |
|---|---|---|
| 8.1 | **L16** fix the block | Send the journal `entryType` value added to the CHECK constraint in **P0.9** *(G5)*. Neither `payable` nor `receivable` fits a general journal such as a PF payout (`Dr 2120 / Cr Cash/Bank`), which is why the constraint is widened rather than the form forced into an ill-fitting value. Same for the `createJournalEntry` default |
| 8.2 | **New journal UI** | 2+ lines, running Dr/Cr totals, submit disabled until balanced, posts to `/journal` |
| 8.3 | **Retire** single-sided | Remove `POST /api/general-ledger` (**D3**) |
| 8.4 | **Reversal not edit** | Replace `PUT /:id` amount editing with reversal-and-repost |
| 8.5 | **Validate account** | Reject any `accountName` not in `chart_of_accounts` (now a closed set) |

### Test cases

| ID | Test |
|---|---|
| **T8.1** | *(L16 regression)* GIVEN the journal form → WHEN a balanced 2-line entry is submitted → THEN it **saves**. Previously every manual entry failed the CHECK constraint |
| **T8.2** | GIVEN an unbalanced entry (Dr 100 / Cr 90) → WHEN submitting → THEN blocked client-side **and** rejected server-side |
| **T8.3** | GIVEN a 3-line entry Dr 100 / Cr 60 / Cr 40 → THEN accepted |
| **T8.4** | GIVEN an account name not in the chart → WHEN submitted → THEN rejected (8.5) |
| **T8.5** | GIVEN `POST /api/general-ledger` (old single-sided route) → WHEN called → THEN **404 / 410** |
| **T8.6** | GIVEN a posted journal entry → WHEN a correction is needed → THEN reversal-and-repost is offered and the original remains visible |
| **T8.7** | GIVEN any sequence of journal entries → WHEN the trial balance is run → THEN it **always** balances |
| **T8.8** | Permission — GIVEN a non-admin/finance user → WHEN posting a journal → THEN rejected |
| **T8.9** | *(G5)* GIVEN a PF payout journal `Dr 2120 / Cr Cash/Bank` → WHEN submitted → THEN accepted with the journal `entryType`, not forced into `payable`/`receivable` |
| **T8.10** | GIVEN a journal line with a zero amount → WHEN submitted → THEN rejected with a clear message rather than a constraint error |
| **T8.11** | GIVEN `PUT /api/general-ledger/:id` with changed `debitAmount`, `creditAmount` or `accountName` → WHEN called → THEN the amount/account edit is **refused** — corrections go through reversal-and-repost only (**D3**) |

---

# Phase 9 — Statements and payables on documents

**Decision:** D9 · **Findings:** L17, L21, L22. **Depends on:** P5, P6.

### Changes

Move `getCustomerStatement`, `getSupplierStatement` and `getPayables` onto
invoice + payment records, matching `getReceivables`. Remove the cross-account
summary (L17) from both the server (`ledger.ts`) and the client
(`payables-receivables.tsx`).

### Test cases

| ID | Test |
|---|---|
| **T9.1** | *(L17 regression)* GIVEN one **unpaid** 10,000 invoice → WHEN the receivables summary runs → THEN outstanding = **10,000**. Previously **0.00**, because the Revenue credit cancelled the AR debit |
| **T9.2** | GIVEN an invoice paid in full → THEN outstanding = **0** |
| **T9.3** | *(L21 regression)* GIVEN payroll GL exists → WHEN the supplier payables list runs → THEN **no salary rows** appear. Previously they did, tagged `entryType: 'payable'` |
| **T9.4** | GIVEN a cancelled purchase invoice → WHEN payables runs → THEN excluded |
| **T9.5** | GIVEN payables rows → THEN none has `amount = 0.00` (previously every Purchase Expense debit did) |
| **T9.6** | GIVEN a customer with a 10,000 invoice, a 4,000 cash payment and a 1,000 issued credit note → WHEN the statement runs → THEN closing balance = `Σ invoices − Σ cash payments (paymentType ≠ 'credit_note') − Σ issued credit notes` = **5,000**, and the credit note appears **exactly once**, as a credit-note line — its `invoice_payments` mirror row is excluded, never shown as a payment. *(A naive Σ payments − Σ credit notes double-counts the mirror and yields 4,000)* |
| **T9.6b** | GIVEN the same customer → WHEN the statement total is reconciled to GL → THEN it equals the AR control movement (Dr 10,000 − Cr 4,000 − Cr 1,000 = 5,000) — proving mirror exclusion at the document layer matches GL suppression at the ledger layer (**D1**) |
| **T9.7** | **Reconciliation** — GIVEN all customers → WHEN their statement balances are summed → THEN the total equals the `Accounts Receivable` control balance in the GL |
| **T9.8** | Same for suppliers vs `Accounts Payable` |
| **T9.8b** | *(symmetric with T9.6)* GIVEN a supplier with a purchase invoice, a cash payment and an issued purchase credit note → WHEN the supplier statement runs → THEN the credit note appears **exactly once** — its `purchase_invoice_payments` mirror row is excluded — and the balance matches `Σ invoices − Σ cash payments − Σ credit notes` and the AP control movement |
| **T9.9** | *(H4)* GIVEN the dashboard → WHEN loaded after P5/P6/P9 → THEN it renders without error and its receivable/payable/revenue figures agree with the corresponding reports — a regression guard, not a consumer-layer audit |

---

# Phase 10 — Foreign-currency double conversion

**Decision:** D13 · **Finding:** L10 (first half only). **Depends on:** P5, P6.

### Change

Make the payment currency explicit so a payment already in AED against a
foreign-currency invoice is not multiplied by the invoice rate a second time.
**FX gain/loss recognition is deferred** (D13).

**UI impact:** the payment dialogs (sales and purchase) gain a currency
indicator, defaulting to the invoice currency — the server needs to know which
currency the entered amount is in, and today it silently assumes document
currency.

### Test cases

| ID | Test |
|---|---|
| **T10.1** | GIVEN a USD 1,000 invoice at 3.6725 → WHEN a USD 1,000 payment is recorded → THEN GL posts **3,672.50** |
| **T10.2** | *(the bug)* GIVEN the same invoice → WHEN a payment of **AED 3,672.50** is recorded → THEN GL posts **3,672.50**, not 13,487.26 (3,672.50 × 3.6725 double-converted) |
| **T10.3** | GIVEN an AED invoice and an AED payment → THEN unchanged behaviour |
| **T10.4** | GIVEN a fully-paid foreign-currency invoice → WHEN AR is checked → THEN it settles to **zero** at the invoice rate (FX difference deferred, not silently absorbed elsewhere) |

---

# Phase 11 — COA re-seed and ledger rebuild

**Decisions:** D15, D17. **Depends on:** P0–P10 — it must call the corrected
posting code.

### Changes

Admin UI action (D17) backed by an endpoint, with **all** of:

| Guard | Detail |
|---|---|
| Environment check | **Server-side**, refuses unless an explicit non-production marker is set — protects production regardless of the UI |
| Two-step | Preview (counts, what cannot be regenerated, projected trial balance) → confirm |
| Typed phrase | Not a plain OK |
| Auto-export | GL exported before deletion |
| Re-authentication | Admin re-enters password for this action specifically |
| Audit log | Who, when, resulting counts |

**Rebuild scope:** delete all GL → re-post from approved sales invoices,
payments, credit notes, purchase invoices, supplier payments, purchase credit
notes → **regenerate** payroll (not replay — D2 and §1.6 change the figures) →
post reimbursements by category.

**Cannot be regenerated** — must be reported, not silently lost: manual
journals; any reimbursement still uncategorised at rebuild time (expected:
**none** — Open Item 5 resolved as manual categorisation before the first
payroll run; T11.7 blocks rather than defaults).

**Payroll scope note:** payroll has never been generated in UAT (confirmed
2026-07-24), so the rebuild's payroll-regeneration step applies only if payroll
comes to exist before the rebuild runs. The first generation is expected to
happen on corrected code, after P2 + P4.

**COA re-seed inside the rebuild** uses the seed script's full-truncate path —
acceptable only here, inside D17's guards, because the ledger is being rebuilt
immediately afterwards against the fresh account set.

### Test cases

| ID | Test |
|---|---|
| **T11.1** | GIVEN the production environment marker → WHEN the endpoint is called directly (bypassing the UI) → THEN **refused**. *The single most important test in this phase* |
| **T11.2** | GIVEN a non-admin session → WHEN called → THEN rejected |
| **T11.3** | GIVEN an admin who does not re-authenticate → WHEN confirming → THEN rejected |
| **T11.4** | GIVEN the wrong confirmation phrase → THEN aborted, GL unchanged |
| **T11.5** | GIVEN preview mode → WHEN run → THEN counts are reported and the GL row count is **unchanged** afterwards |
| **T11.6** | GIVEN manual journal entries exist → WHEN previewing → THEN they are **reported as un-regenerable** before any deletion |
| **T11.7** | GIVEN uncategorised reimbursements → WHEN previewing → THEN listed with the chosen fallback stated |
| **T11.8** | GIVEN a rebuild completes → WHEN the trial balance runs → THEN **ΣDr = ΣCr exactly** |
| **T11.9** | GIVEN a rebuild → WHEN comparing to pre-rebuild document totals → THEN every approved invoice, payment and credit note has its expected GL pair |
| **T11.10** | GIVEN a rebuild → WHEN checked for orphans → THEN **no** GL row references a non-existent document, and no account name is outside the chart |
| **T11.11** | *(G8, corrected)* GIVEN a rebuild is run **twice** → THEN the second produces identical **postings** — same account, amount, side and reference for every row. Ids, `created_at` and row order will differ and must **not** be asserted |
| **T11.12** | GIVEN a rebuild fails midway → THEN it either rolls back fully or reports precisely where it stopped — never leaves a half-built ledger silently |
| **T11.13** | GIVEN the export runs before deletion → THEN the export file contains every pre-deletion row |

---

# Phase 12 — Trial balance and balance sheet

**Decision:** D10 · **Finding:** M12. **Depends on:** P11.

### Changes

Build a trial balance (ΣDr vs ΣCr overall, by account, by date range) and a
balance sheet, then **verify every preceding phase against them**.

Also add an **unmatched account name** check — GL account names absent from
`chart_of_accounts`, which the P&L inner join silently drops today.

**Equity derivation *(H5)*:** there is no period close (**M11** deferred), so
`Retained Earnings` and `Current Year Earnings` are never posted. The balance
sheet must compute current-year earnings **on the fly** as
`Σ revenue − Σ expenses` and present it inside equity — otherwise
`Assets = Liabilities + Equity` can never hold. This is a derived line, clearly
labelled, not a posted balance.

### Test cases

| ID | Test |
|---|---|
| **T12.1** | GIVEN a rebuilt ledger → WHEN the trial balance runs → THEN **ΣDr = ΣCr exactly**, difference 0.00 |
| **T12.2** | GIVEN each account → THEN its balance sits on its normal side (assets/expenses Dr, liabilities/revenue/equity Cr), and any exception is explainable |
| **T12.3** | GIVEN the unmatched-name check → THEN **zero** results (P0 guaranteed this; this proves it holds) |
| **T12.4** | *(L2 end-to-end)* GIVEN all payroll approved and paid → THEN `Salary Payable` = **0.00** |
| **T12.5** | *(L1 end-to-end)* GIVEN all credit notes → THEN `Accounts Receivable` equals `Σ` document outstanding balances |
| **T12.6** | GIVEN the balance sheet → THEN `Assets = Liabilities + Equity` |
| **T12.7** | GIVEN the balance sheet → THEN **no Inventory balance** appears, consistent with D6 (inventory deferred) — confirming a known, deliberate gap rather than an error |
| **T12.8** | GIVEN the P&L → THEN revenue is **net of VAT** and expenses net of recoverable VAT (D5) |
| **T12.9** | GIVEN project P&L → THEN project labour and purchase costs reconcile to the corresponding GL rows (D7, L29) |
| **T12.10** | GIVEN a period with every transaction type → WHEN each is reversed → THEN the trial balance returns to its opening position |
| **T12.11** | *(H4)* GIVEN the dashboard and every report page → WHEN loaded against the rebuilt ledger → THEN all render without error and cross-agree: dashboard totals = report totals = GL control balances |
| **T12.12** | *(H5)* GIVEN the balance sheet → THEN equity includes a derived "Current Year Earnings" line equal to the P&L's net profit for the same range, and the equation holds with it |

---

## Summary

| Phase | Covers | Blocking dependency |
|---|---|---|
| **P0** Chart of accounts | D4, D5, D16, §7c | — |
| **P0b** Test infrastructure | committed (Open Item 3) | — |
| **P0c** Verification fixture | makes T0.5, T12.1, T12.5, T11.8/9 non-vacuous | P0 |
| **P1** Foundations | L18, L19, L23, L25, L30 | — |
| **P2** Payroll calculation | D2, D16, §1.6 | P0 |
| **P3** Salary Expense multiply | **L15** | P1 |
| **P4** Payroll ledger | D7, D14, L2, L3, L24, L31 | P0, P2, P3 |
| **P4b** VAT base (UAE law) ⚠ | compliance — VAT on discounted subtotal | — |
| **P5** Sales ledger | D1, D5, L1, L11, L22, L26 | P0, **P4b** |
| **P6** Purchase ledger | D1, D5, L5, L28, L29 | P0, **P4b** |
| **P7** Deletes & reversals | D8, L7 | P5, P6 |
| **P8** Manual journal | D3, L4, L16 | P0 |
| **P9** Statements on documents | D9, L17, L21, L22 | P5, P6 |
| **P10** FX double conversion | D13, L10 | P5, P6 |
| **P11** Rebuild tool | D15, D17 | P0–P10 |
| **P12** Trial balance | D10, M12 | P11 |

**Deferred by decision, not oversight:** inventory on the ledger (D6, M2–M4) ·
FX gain/loss (D13, M9) · PF payout workflow (D14) · period close (M11) ·
gratuity (client scope) · depreciation and fixed assets (M6, M7).

---

## Open items — the only undecided questions in this plan

| # | Question | Recommendation | Blocks |
|---|---|---|---|
| 1 | **Discount treatment (G1)** | **✅ RESOLVED 2026-07-24: net into revenue.** No 4160/5050; discounts reportable from documents. Plan updated (P0.8 dropped, P5.2/P6.2/P6.3, T5.14/T5.15/T6.12) | — |
| 2 | **Existing discounted UAT invoices (4b.6)** | **✅ RESOLVED 2026-07-24: recalculate with report.** Note logged: **line-level discounts are a coming enhancement** — see 4b.8 forward-compatibility | — |
| 3 | **Test infrastructure (P0b)** | **✅ RESOLVED 2026-07-24: committed.** jest/ts-jest installed, phases automate where practical | — |
| 4 | **Accommodation account** | **✅ RESOLVED 2026-07-24: add `Accommodation` (6125)** — P0.7; D16 category maps to it | — |
| 5 | **Reimbursement category backfill (P11)** | **✅ RESOLVED 2026-07-24: manual categorisation via the UI, made trivial by the facts.** Payroll has **never been generated in UAT**, so no reimbursement is welded into any payroll journal — all rows are free-standing and editable. Once P2.6 ships the category field, the team categorises the applicable reimbursements before the first payroll run. T11.7 stays as the guard: the rebuild preview blocks and reports any uncategorised row rather than defaulting. **Operational note: hold the first payroll generation until P2 + P4 are deployed** so it runs on corrected code from day one | — |

## Process notes — for the team, outside this plan's code scope

- **L20 — migration drift.** The `.sql` files do not describe the live
  constraints (`payroll_payment` exists only in the database). Until re-synced,
  any schema review must use the introspected `migrations/schema.ts`.
- **H6 — VAT on foreign-currency invoices.** The FTA expects AED at the
  published rate on the date of supply; the system uses the invoice's own rate.
- **M11 — period lock** before any period is reported externally (raised under
  D7).
- **`0041` retirement state:** functions dropped (P0.11), template accounts and
  sub-accounts removed (P0.3/0.4), `entity_type`/`entity_id` columns left in
  place and documented as unused.

## Traceability appendix — finding → phase → tests

### Audit findings (L)

| Finding | Fixed in | Verified by |
|---|---|---|
| L1 credit-note double post | P5.1 | T5.2–T5.4 |
| L2 gross/net Salary Payable | P4.2, P4.11 (**D18**) | T4.4, T4.5, T4.7–T4.7d, T12.4 |
| L3 clearPayrollPeriod orphans | P4.4 | T4.9 |
| L4 unbalanced manual entries | P8.2–8.4 | T8.2, T8.5, T8.6, T8.11 |
| L5 purchase CN posts nothing | P6.1 | T6.2, T6.3, T6.14 |
| L6 Cash/Bank not in COA | P0.1 | T0.1, T0.5 |
| L7 deletes orphan GL | P7 | T7.1–T7.5 |
| L8 referenceType collisions | P4.8 | T3.5, T4.17 |
| L9 VAT never separated | P4b, P5.2, P6.2 | T5.1, T6.1, T6.10, T12.8 |
| L10 FX double conversion | P10 *(gain/loss deferred D13)* | T10.1–T10.4 |
| L11 projectId dropped | P5.6, P6.5 | T5.11, T6.7, T6.8 |
| L12 per-project rounding | P3.2 | T3.6, T3.7 |
| L13 two approval paths | P5.7 | T5.18 |
| L14 no transactions | P1.7 | T1.9–T1.11 |
| L15 Salary Expense multiply | P3.1 | T3.1–T3.4 |
| L16 manual entries impossible | P0.9 + P8.1 | T8.1, T8.9 |
| L17 cross-account summary | P9 | T9.1, T9.2 |
| L18 delete script | P1.2 | T1.4 |
| L19 reset:revenue script | P1.3 | T1.5, T1.6 |
| L20 migration drift | *process note* | — |
| L21 payables includes payroll | P9 | T9.3–T9.5 |
| L22 (+a, b) receivables | P5.4, P5.5, P9 | T5.7, T5.8, T9.6–T9.8b |
| L23 rowCount undefined | P1.1 | T1.1–T1.3 |
| L24 clearAll no GL | P4.5 | T4.10 |
| L25 swallowed GL errors | P1.5 | T1.7 |
| L26 unreachable edit path | P5.3, P5.8 | T5.9, T5.19 |
| L27 per-entity infra unwired | P0.3, P0.4, P0.11 *(decision: none)* | T0.2, T0.3, T0.8 |
| L28 status bypass on create | P6.4 | T6.4 |
| L29 lineTotal inconsistent | P6.3 | T6.5, T6.6, T6.13 |
| L30 dead broken function | P1.6 | removal + compile |
| L31 project labour disagrees | P4.6 | T4.11–T4.13 |

### Missing coverage (M)

| Finding | Status | Verified by |
|---|---|---|
| M1 purchase CN | = L5, P6.1 | T6.2 |
| M2–M4 inventory | **deferred (D6)** | T12.7 guards the deliberate gap |
| M5 reimbursements | P4.3, P2.6, P4.10 | T4.8, T4.19 |
| M6/M7 assets, depreciation | **deferred** | — |
| M8 VAT | = D5 | see L9 |
| M9 FX gain/loss | **deferred (D13)** | T10.4 guards |
| M10 PF liability | P4.2 | T4.4, T4.6 |
| M11 period close | **deferred** | T12.12 (derived equity) |
| M12 trial balance | P12 | T12.1–T12.12 |

### Review corrections (G, H) and design items

| Item | Folded into | Verified by |
|---|---|---|
| G1 discount balance | P5.2, P6.2, P6.3 *(net-into-revenue; P0.8 dropped)* | T5.14, T5.15, T6.12, T6.13 |
| G2 zero-amount lines | P5.2, P6.2, 4b.5 | T5.13, T6.11, T4b.5, T4b.7 |
| G3 | = L14, L8, L12, L13 | see those rows |
| G4 payroll approval | P4.9 | T4.15, T4.16 |
| G5 journal entryType | P0.9, P8.1 | T8.9 |
| G6 status value | P5.8 | T5.19 |
| G7 down migrations | P0.10, P2.9 | revert drill |
| G8 test gaps | — | T5.16, T5.17, T4.18, T11.11 |
| H1 CN VAT reversal | P5.1, P6.1 | T5.20, T6.14 |
| H2 reverse-and-re-post edits | P5.2, P6.2 | T5.21, T5.22, T6.15 |
| H3 VAT rounding | P4b.7 | T4b.11 |
| H4 consumer regression | — | T9.9, T12.11 |
| H5 derived equity | P12 | T12.12 |
| H6 FX VAT rate | *process note* | — |
| §1.6 calendar days | P2.1 | T2.1–T2.6 |
| D2 PF base | P2.2, P2.3 | T2.7–T2.12 |
| PF row protection | P2.4 | T2.13 |
| PF universal | — | T2.14 |
| Payslip ×7 | P2.7 | T2.15–T2.18 |
| Dead JSON columns | P2.8 | T2.19 |
| D16 reimb. category | P2.6, P4.3 | T2.17, T4.8 |
| P4b VAT base (UAE) | P4b.1–4b.7 | T4b.1–T4b.11 |
| D14 PF payout deferral | P4.7 | T4.14, T8.9 |
| D15/D17 rebuild | P11 | T11.1–T11.13 |
| T9.6 mirror exclusion | P9 | T9.6, T9.6b, T9.8b |

*(Decisions D1–D17 are logged with full wording in `LEDGER-AUDIT-REPORT.md` §7b;
each maps to the phases above.)*

---

*Plan only — no code written. Awaiting approval per phase.
Line references are against commit `8fa6710`; re-verify after any rebase on
`origin/main`.*
