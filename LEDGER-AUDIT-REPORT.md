# LEDGER AUDIT REPORT — General Ledger postings & reversals

**Date:** 2026-07-24
**Branch audited:** `refactor/split-storage-layers-replay` (commit `8fa6710`)
**Scope:** every code path that inserts, updates, or deletes a row in
`general_ledger_entries`, plus every financially significant event that does
*not* post to it.
**Status: REPORT ONLY — nothing has been changed.** Per CLAUDE.md rule 4.

---

## 1. Method

### Second pass, 2026-07-24

The first pass searched for the Drizzle table object only, and missed
`updatePayrollEntryTotals`, which writes via raw SQL (**L15**). A second,
exhaustive pass was run across **eight write vectors** to establish that nothing
else is missed:

| # | Vector | Method | Result |
|---|---|---|---|
| 1 | Drizzle table object | `generalLedgerEntries` insert/update/delete | 5 files — §1 below |
| 2 | Raw SQL via `db.execute` | every `db.execute(` / `sql\`` site in `server/` + `scripts/`, 12-line context | **2 writes** — payroll.ts:757, 766 (**L15**) |
| 3 | Raw SQL via `pg.Pool` | every `pool.query(` site | 1 site, **read-only** (`getProfitLossEntries`) |
| 4 | Storage helper methods | callers of all 5 GL helpers | covered in §3 |
| 5 | **Standalone scripts** | `scripts/` — outside tsconfig, never type-checked | **2 writes — new findings L18, L19** |
| 6 | **SQL migrations** | every `.sql` for INSERT/UPDATE/DELETE on the table | none — but **constraints found, L16, L20** |
| 7 | **DB triggers / functions** | `CREATE TRIGGER` / `CREATE FUNCTION` across migrations | 3 functions in `0041`, all on `chart_of_accounts`, **none on GL** |
| 8 | **FK cascades** | foreign keys targeting the table | only `project_id → projects` and `created_by → users`, both `ON DELETE no action` — **no cascade can delete GL rows** |

Vector 8 confirms **L7**: nothing at the database level cleans up GL rows when a
document is deleted. Vector 5 is where the first pass was weakest — `scripts/`
is excluded from `tsconfig.json` (`include` is `client/src`, `shared`, `server`
only), so nothing in it is ever type-checked.

### Original write surface

Every write to `general_ledger_entries` in the repo was located and read in
full. The complete write surface is five files, plus the two scripts and the
raw-SQL path found in the second pass:

| File | Role |
|---|---|
| `server/storage/ledger.ts` | primitives + sales-invoice post/cancel helpers |
| `server/storage/sales.ts` | credit notes, invoice payments, invoice-edit re-post |
| `server/storage/purchase.ts` | PI approve / cancel / payment, PI-edit re-post |
| `server/storage/payroll.ts` | payroll accrual, payroll payment, period clear |
| `server/routes/general-ledger.routes.ts` | manual entry, manual journal, manual edit |

Read-only consumers examined for what they assume: `customer.ts:385`
(customer statement), `supplier.ts:552` (supplier statement), `report.ts:98`
(payables), `ledger.ts:298` (P&L).

---

## 2. How the ledger is modelled

`general_ledger_entries` ([shared/schema.ts:1120](shared/schema.ts:1120)) stores
**one account per row**. Each row carries `debitAmount` **or** `creditAmount`
(never both). A balanced transaction therefore = two or more rows written by two
or more separate calls. Nothing in the schema or the database links the two
halves of a pair.

`createGeneralLedgerEntry` ([ledger.ts:387](server/storage/ledger.ts:387))
validates a single row: exactly one of Dr/Cr non-zero, both non-negative,
account name / description / date present. **It cannot validate that a
transaction balances** — it only ever sees one side.

`createJournalEntry` ([ledger.ts:499](server/storage/ledger.ts:499)) is the only
function that enforces `ΣDr = ΣCr` (tolerance 0.01, line 555). Only one caller
uses it: `POST /api/general-ledger/journal`.

Two helpers bypass `createGeneralLedgerEntry` entirely and `db.insert()`
straight into the table, skipping all validation:
`createCancellationGLEntries` ([ledger.ts:672](server/storage/ledger.ts:672)) and
`createInvoiceGLEntries` ([ledger.ts:746](server/storage/ledger.ts:746)).
`purchase.ts` does the same at lines 2265, 2287, 2442, 2458, 2583, 2599.

**Amounts are stored in AED.** Every posting multiplies the document amount by
the document's `exchangeRate` and appends a note like `(USD 1000.00 @ 3.6725)`
to the description.

**Chart of accounts** is seeded by `scripts/seed-chart-of-accounts.ts`
(116 accounts). `account_name` is `UNIQUE`. Nothing validates a GL row's
`accountName` against it at write time.

---

## 3. Complete inventory of ledger postings

Amount basis abbreviations: `T×R` = `totalAmount × exchangeRate`,
`P×R` = `payment amount × invoice exchangeRate`.

### 3.1 Sales cycle

| ID | When (trigger) | Where | Account | Dr/Cr | Amount | entryType / referenceType / referenceId / status |
|---|---|---|---|---|---|---|
| **E1** | Sales invoice approved — `POST /api/sales-invoices/:id/approve` (status `draft`→`unpaid`) | [routes:53](server/routes/sales-invoices.routes.ts:53) → [ledger.ts:773](server/storage/ledger.ts:773) | Accounts Receivable | **Dr** | T×R | receivable / sales_invoice / invoice.id / pending |
| | | [ledger.ts:791](server/storage/ledger.ts:791) | Sales Revenue | **Cr** | T×R | receivable / sales_invoice / invoice.id / pending |
| **E2** | Sales invoice approved — `PATCH /api/sales-invoices/:id/approve` (status `pending_approval`→`approved`) | [routes:294](server/routes/sales-invoices.routes.ts:294) → [sales.ts:1740](server/storage/sales.ts:1740) → same helper | Accounts Receivable / Sales Revenue | **Dr / Cr** | T×R | identical to E1 |
| **E3** | Sales invoice edited while non-draft — `PUT /api/sales-invoices/:id` | [routes:178](server/routes/sales-invoices.routes.ts:178) → [sales.ts:1925](server/storage/sales.ts:1925) | Accounts Receivable | **Dr** (row updated in place) | new T×R | matches referenceType `sales_invoice` + referenceId + accountName, `status ≠ cancelled` |
| | | [sales.ts:1946](server/storage/sales.ts:1946) | Sales Revenue | **Cr** (row updated in place) | new T×R | same filter |
| **E4** | Sales invoice cancelled — `PATCH /:id/cancel` | [sales.ts:1831](server/storage/sales.ts:1831) → [ledger.ts:696](server/storage/ledger.ts:696) | Accounts Receivable | **Cr** | T×R | receivable / sales_invoice / invoice.id / **cancelled** |
| | | [ledger.ts:713](server/storage/ledger.ts:713) | Sales Revenue | **Dr** | T×R | receivable / sales_invoice / invoice.id / **cancelled** |
| **E5** | Customer payment recorded — `createInvoicePayment` | [sales.ts:692](server/storage/sales.ts:692) | Cash/Bank | **Dr** | P×R | receivable / payment / invoicePayments.id / paid |
| | | [sales.ts:728](server/storage/sales.ts:728) | Accounts Receivable | **Cr** | P×R | receivable / payment / invoicePayments.id / paid |
| **E6** | Sales credit note created with status `issued` | [sales.ts:318](server/storage/sales.ts:318) | Sales Returns and Allowances | **Dr** | T×R | receivable / credit_note / creditNote.id / issued |
| | | [sales.ts:353](server/storage/sales.ts:353) | Accounts Receivable | **Cr** | T×R | receivable / credit_note / creditNote.id / issued |
| | *…then* [sales.ts:398](server/storage/sales.ts:398) fires **E5 again** | | Cash/Bank + Accounts Receivable | **Dr / Cr** | T×R | ⚠ see L1 |
| **E7** | Sales credit note transitioned `draft`→`issued` | [sales.ts:499](server/storage/sales.ts:499), [518](server/storage/sales.ts:518) | as E6 | | | *…then* [sales.ts:548](server/storage/sales.ts:548) fires **E5 again** ⚠ L1 |

### 3.2 Purchase cycle

| ID | When (trigger) | Where | Account | Dr/Cr | Amount | entryType / referenceType / referenceId / status |
|---|---|---|---|---|---|---|
| **E8** | Purchase invoice approved | [purchase.ts:2265](server/storage/purchase.ts:2265) | Accounts Payable | **Cr** | T×R | payable / purchase_invoice / invoice.id / pending |
| | | [purchase.ts:2287](server/storage/purchase.ts:2287) | Purchase Expense | **Dr** | T×R | payable / purchase_invoice / invoice.id / pending |
| **E9** | Purchase invoice edited while approved — `PUT /api/purchase-invoices/:id` | [routes:238](server/routes/purchase-invoices.routes.ts:238) → [purchase.ts:3092](server/storage/purchase.ts:3092) | Accounts Payable | **Cr** (in place) | new T×R | `status ≠ cancelled` |
| | | [purchase.ts:3113](server/storage/purchase.ts:3113) | Purchase Expense | **Dr** (in place) | new T×R | same |
| **E10** | Purchase invoice cancelled | [purchase.ts:2442](server/storage/purchase.ts:2442) | Accounts Payable | **Dr** | T×R | payable / purchase_invoice / invoice.id / **cancelled** — ⚠ no `projectId` |
| | | [purchase.ts:2458](server/storage/purchase.ts:2458) | Purchase Expense | **Cr** | T×R | same — ⚠ no `projectId` |
| **E11** | Supplier payment recorded | [purchase.ts:2583](server/storage/purchase.ts:2583) | Accounts Payable | **Dr** | P×R | payable / payment / purchaseInvoicePayments.id / paid — ⚠ no `projectId` |
| | | [purchase.ts:2599](server/storage/purchase.ts:2599) | Cash/Bank | **Cr** | P×R | same |

### 3.3 Payroll

| ID | When (trigger) | Where | Account | Dr/Cr | Amount | entryType / referenceType / referenceId / status |
|---|---|---|---|---|---|---|
| **E12** | Payroll generated for a month | [payroll.ts:479](server/storage/payroll.ts:479) *(one row per project)* or [497](server/storage/payroll.ts:497) *(single row)* | Salary Expense | **Dr** | gross `calculatedTotalEarnings` ([payroll.ts:335](server/storage/payroll.ts:335)) | payable / **manual** / payrollEntry.id / pending |
| | | [payroll.ts:515](server/storage/payroll.ts:515) | Salary Payable | **Cr** | gross `calculatedTotalEarnings` | payable / **manual** / payrollEntry.id / pending |
| **E13** | Payroll entry status set to `paid` | [payroll.ts:643](server/storage/payroll.ts:643) | Salary Payable | **Dr** | **net** `payrollEntry.totalAmount` ([payroll.ts:729](server/storage/payroll.ts:729)) | payable / payroll_payment / payrollEntry.id / paid |
| | | [payroll.ts:660](server/storage/payroll.ts:660) | Cash/Bank | **Cr** | **net** `payrollEntry.totalAmount` | payable / payroll_payment / payrollEntry.id / paid |
| **E14** | Payroll period cleared | [payroll.ts:816](server/storage/payroll.ts:816) | Salary Expense + Salary Payable | **hard DELETE** | — | matches referenceType `manual` + referenceId + those two account names only |
| **E18** | **Any** addition/deduction added, edited or deleted; any payroll entry update | [payroll.ts:756](server/storage/payroll.ts:756) | Salary Expense | **Dr** (raw-SQL UPDATE) | `basicSalary + totalAdditions` | matches `reference_type='manual'` + `reference_id` + account name — **no row limit, see L15** |
| | | [payroll.ts:765](server/storage/payroll.ts:765) | Salary Payable | **Cr** (raw-SQL UPDATE) | same | same filter |

### 3.4 Manual

| ID | When (trigger) | Where | Behaviour |
|---|---|---|---|
| **E15** | `POST /api/general-ledger` | [routes:72](server/routes/general-ledger.routes.ts:72) → [ledger.ts:387](server/storage/ledger.ts:387) | Writes **one row**. No counterpart required, no balance check. |
| **E16** | `POST /api/general-ledger/journal` | [routes:93](server/routes/general-ledger.routes.ts:93) → [ledger.ts:499](server/storage/ledger.ts:499) | Multi-row, **enforces ΣDr = ΣCr** (±0.01). The only correct manual path. |
| **E17** | `PUT /api/general-ledger/:id` | [routes:119](server/routes/general-ledger.routes.ts:119) → [ledger.ts:611](server/storage/ledger.ts:611) | Overwrites any field of any row — `debitAmount`, `creditAmount`, `accountName` — with no balance check and no counterpart update. |

### 3.5 Account usage vs chart of accounts

Eight account names are used in code. Cross-checked against
`scripts/seed-chart-of-accounts.ts`:

| Account name used in code | In chart of accounts? | Code | Type |
|---|---|---|---|
| Accounts Receivable | ✅ 1100 | asset |
| Sales Revenue | ✅ 4050 | revenue |
| Sales Returns and Allowances | ✅ 4150 | revenue *(see L9)* |
| Accounts Payable | ✅ 2000 | liability |
| Purchase Expense | ✅ 5040 | expense |
| Salary Expense | ✅ 6010 | expense |
| Salary Payable | ✅ 2110 | liability |
| **Cash/Bank** | ❌ **not present** | — | — |

---

## 4. Double-entry verification

Every system-generated pair was checked for `ΣDr = ΣCr` at the moment it is
written.

| Event | Balanced? | Notes |
|---|---|---|
| E1 / E2 invoice approve | ✅ | Dr AR = Cr Revenue = T×R |
| E3 invoice edit re-post | ✅ | both sides rewritten to the same new figure |
| E4 invoice cancel | ✅ | exact mirror of E1 |
| E5 customer payment | ✅ | |
| E6 / E7 credit note | ✅ *as a pair* | **but a second, unwanted pair fires — see L1** |
| E8 PI approve | ✅ | Cr AP = Dr Expense = T×R |
| E9 PI edit re-post | ✅ | |
| E10 PI cancel | ✅ | exact mirror of E8 (`projectId` dropped — L5) |
| E11 supplier payment | ✅ | |
| E12 payroll accrual | ✅ | per-project Dr rows sum to gross, because for consultants `basicSalary = "0"` and `consultantFee = Σ projectEarnings` ([payroll.ts:329,335](server/storage/payroll.ts:329)). Sub-cent rounding risk — L10 |
| E13 payroll payment | ✅ *as a pair* | **but does not match E12 — see L2** |
| E14 payroll clear | ❌ | deletes only half the postings — L3 |
| E18 payroll totals rewrite | ❌ | multiplies the debit across per-project rows — L15 |
| E15 manual single | ❌ | one-sided by design — L4 |
| E16 manual journal | ✅ | enforced |
| E17 manual edit | ❌ | unchecked — L4 |

**There is no trial balance and no balance sheet anywhere in the system.**
Report endpoints are limited to `customer-statement`, `supplier-statement`,
`profit-loss-entries`, `project-location`
([reports.routes.ts](server/routes/reports.routes.ts)); client pages are
`customer-statement`, `payables-receivables`, `profit-loss`, `project-location`,
`supplier-statement`. Nothing ever checks that the ledger balances, which is
why the imbalances below have not surfaced in UAT.

---

## 5. Findings

Ranked by financial impact. **Nothing here has been fixed.**

> **Second pass, 2026-07-24.** The first pass searched only for the Drizzle table
> object and missed **L15** (`updatePayrollEntryTotals`, raw SQL). A full
> eight-vector re-audit (§1) added **five further findings — L15 through L20** —
> including two in `scripts/`, which is excluded from type-checking, and two
> arising from database CHECK constraints that the `.sql` migration files do not
> accurately describe. All six are listed first, ahead of the original findings.
>
> Coverage is now believed complete: Drizzle writes, raw `db.execute`, `pg.Pool`,
> storage helpers, standalone scripts, SQL migrations, database triggers, and FK
> cascades have each been searched exhaustively.

### L15 — Editing any payroll addition or deduction multiplies Salary Expense across project rows
**Severity: critical.** [payroll.ts:756](server/storage/payroll.ts:756).

For a consultant or contractor split across projects, **E12** creates **one
Salary Expense row per project** ([payroll.ts:478](server/storage/payroll.ts:478)),
all sharing the same `reference_id` and account name. `updatePayrollEntryTotals`
then runs:

```sql
UPDATE general_ledger_entries
SET debit_amount = <totalEarnings>, description = ...
WHERE reference_type = 'manual' AND reference_id = <id>
  AND account_name = 'Salary Expense'
```

There is no project filter and no row limit, so **every one of those rows is set
to the full total**. A consultant on 3 projects earning AED 10,000 ends up with
3 × 10,000 debited to Salary Expense against 10,000 credited to Salary Payable —
**the ledger is left unbalanced by (N−1) × total earnings**, and project cost
allocation is destroyed at the same time.

This fires on a very common path — it is called on **every** addition or
deduction create, update and delete
([payroll.ts:953, 985, 1018, 1092, 1124, 1157](server/storage/payroll.ts:953)),
and on every payroll entry update including the transition to `paid`
([payroll.ts:607](server/storage/payroll.ts:607)). Adding a single allowance to
a multi-project consultant corrupts the ledger.

Two further problems in the same two statements:
- The raw SQL bypasses `updateGeneralLedgerEntry` and every validation in the
  storage layer.
- It reuses `reference_type = 'manual'`, so it can rewrite a genuine manual
  journal line that happens to share the id and account name — same namespace
  collision as **L3**.

Note also that the amount basis differs from the accrual: E12 credits
`calculatedTotalEarnings` (`basicSalary + consultantFee`) while E18 writes
`basicSalary + totalAdditions`. These agree for consultants, whose fees are
stored as additions, but they are **not** the same figure in general.

### L31 — Project cost and the ledger disagree on payroll: different timing and different project attribution
**Severity: high.**
[project-asset.ts:977](server/storage/project-asset.ts:977) vs
[payroll.ts:324](server/storage/payroll.ts:324).

`recalculateProjectCost` computes `projects.actualCost` from source tables and
**never reads the ledger** ([project-asset.ts:965](server/storage/project-asset.ts:965)).
Two independent divergences result:

**1. Timing.** Payroll is created with `status: "generated"`
([payroll.ts:360](server/storage/payroll.ts:360)), and the GL posts Salary
Expense **immediately at generation** (**E12**). But project cost only counts
payroll with `status IN ('approved','paid')`
([project-asset.ts:986](server/storage/project-asset.ts:986)). So between
generation and approval the ledger carries an expense the project does not.

**2. Attribution.** For a consultant across N projects the GL writes **one Salary
Expense row per project** ([payroll.ts:478](server/storage/payroll.ts:478)),
correctly split. But `payrollEntries.projectId` stores only the **last** project
seen in the loop — the code says so:

```js
projectId = assignment.projectId; // Keep last for GL tracking as fallback
```

and `recalculateProjectCost` groups labour by that single column
([project-asset.ts:985](server/storage/project-asset.ts:985)). So a consultant
working three projects has **100% of their salary charged to one project** in
`actualCost`, while the ledger splits it three ways. Neither figure can be
reconciled to the other, and the other two projects show no labour cost at all.

Two supporting observations in the same function:

- The reimbursement double-count guard depends on a **string prefix match** —
  `like(payrollAdditions.description, "Reimbursement:%")`
  ([project-asset.ts:1002](server/storage/project-asset.ts:1002)) — to subtract
  reimbursements from labour before adding them back from the `reimbursements`
  table ([:1104](server/storage/project-asset.ts:1104)). It also assumes the
  reimbursement and the payroll entry carry the **same** `projectId`; if they
  differ, one project double-counts and another under-counts. This is the same
  fragility flagged in `PAYROLL-DEDUCTIONS-DESIGN.md` §3.1.
- The purchase-invoice filter allows
  `status IN ('approved','partially_paid','paid')`
  ([:1092](server/storage/project-asset.ts:1092)), but `purchaseInvoices.status`
  is only ever `draft`, `pending_approval`, `approved`, `cancelled` or
  `rejected` — payments write the separate `paymentStatus` column
  ([purchase.ts:2556](server/storage/purchase.ts:2556)). Two of the three values
  are dead. Harmless today because `approved` persists, but it shows the filter
  was written against a status model the code does not implement.

### L29 — `lineTotal` means three different things, so project cost and GL expense can never agree
**Severity: high.** Multiple sites in
[purchase.ts](server/storage/purchase.ts).

`approvePurchaseInvoice` allocates cost to projects from `item.lineTotal`
([purchase.ts:2195](server/storage/purchase.ts:2195)), while the GL posts the
invoice's `totalAmount` ([purchase.ts:2287](server/storage/purchase.ts:2287)).
Those only reconcile if `Σ lineTotal` equals `totalAmount`. It is defined
inconsistently:

| Writer | `lineTotal` formula | Tax included? |
|---|---|---|
| `createPurchaseOrder` [:1001](server/storage/purchase.ts:1001) | `qty × price + taxAmount` | ✅ yes |
| `updatePurchaseOrder` [:1107](server/storage/purchase.ts:1107) | `qty × price + taxAmount` | ✅ yes |
| **`convertPurchaseOrderToInvoice`** [:1363](server/storage/purchase.ts:1363) | `qty × price` | ❌ **no** |
| `createPurchaseInvoiceStandalone` [:1877](server/storage/purchase.ts:1877) | client-supplied, unvalidated | ❔ |
| `updatePurchaseInvoice` [:1967](server/storage/purchase.ts:1967) | client-supplied, unvalidated | ❔ |
| `createPurchaseInvoiceFromPO` [:2080](server/storage/purchase.ts:2080) | copies the PO value | ✅ yes |

For any invoice created through **`convertPurchaseOrderToInvoice`** — the main
PO→invoice path — project `actualCost` is understated relative to GL Purchase
Expense by exactly the tax amount, on every line. For the two client-supplied
paths the server never checks that the lines sum to the header, so they can
differ by any amount.

This compounds **L11** (project attribution) and is a second, independent reason
project P&L cannot be reconciled to the ledger.

### L30 — `createPurchaseInvoiceFromPO` is dead code that would fail if wired up
**Severity: low now, high if enabled.**
[purchase.ts:2028](server/storage/purchase.ts:2028).

Never called — the only reference is the interface declaration at
[storage.ts:734](server/storage.ts:734). If it were wired up it would throw
immediately: its `inventoryTransactions` insert
([purchase.ts:2106](server/storage/purchase.ts:2106)) uses three column names
that do not exist and omits one that is `NOT NULL`.

| Written | Actual schema |
|---|---|
| `inventoryItemId` | `itemId` |
| `transactionType: "in"` | `type` (`inflow`/`outflow`) |
| `totalCost` | *(no such column)* |
| — | `remainingQuantity` — **NOT NULL, not supplied** |

It also increments stock at **create** time while `approvePurchaseInvoice` raises
a goods receipt at **approve** time
([purchase.ts:2236](server/storage/purchase.ts:2236)), so enabling it would
double-count inventory. Recommend deleting rather than fixing.

### L28 — A purchase invoice can be created already "approved", bypassing all ledger posting
**Severity: high.**
[purchase-invoices.routes.ts:129](server/routes/purchase-invoices.routes.ts:129)
and `createPurchaseInvoiceStandalone`.

The create route spreads the request body straight through:

```js
const invoiceData = { ...req.body, items: JSON.parse(req.body.items || "[]"), … };
const invoice = await storage.createPurchaseInvoiceStandalone(invoiceData);
```

and the storage method takes the status from that payload —
`status: invoiceData.status || "draft"`. Nothing constrains it to `"draft"`.

A client that posts `status: "approved"` gets an approved purchase invoice
**without `approvePurchaseInvoice()` ever running**, so none of its side effects
occur:

- **no GL entries** (Cr Accounts Payable / Dr Purchase Expense — **E8**);
- no goods receipt for product lines
  ([purchase.ts:2236](server/storage/purchase.ts:2236));
- no project cost recalculation
  ([purchase.ts:2219](server/storage/purchase.ts:2219));
- no asset maintenance records
  ([purchase.ts:2200](server/storage/purchase.ts:2200)).

The invoice then appears in every list and report as a normal approved invoice
while being invisible to the ledger. Whether the current UI sends a status is
secondary — the API accepts it, and the same route is the one used for bulk or
scripted imports.

The sales side does not share this defect: `POST /api/sales-invoices` is
followed by an explicit approve step that owns the GL posting.

### L27 — Per-entity sub-account infrastructure exists in the database but is completely unwired
**Severity: high (blocks the intended design).**
[migrations/0041_add_entity_chart_accounts.sql](migrations/0041_add_entity_chart_accounts.sql).

Context from the team (2026-07-24): the intent is a **fixed chart of accounts**,
with **dynamic account creation only for suppliers, customers and employees**.
Migration `0041` is a partial implementation of exactly that — and none of it is
connected.

What `0041` built:
- `entity_type` / `entity_id` columns on `chart_of_accounts`, plus an index;
- four template accounts — `1100-C` Customer Receivables, `2000-S` Supplier
  Payables, `4000-P` Project Revenue, `5000-P` Project Costs;
- three PL/pgSQL functions — `create_project_accounts`,
  `create_customer_accounts`, `create_supplier_accounts` — each inserting a
  sub-account like `1100-C-{id}` / *"Receivables - {name}"* parented to the
  control account;
- one-off `DO` blocks backfilling sub-accounts for existing rows.

What is missing:

| Gap | Evidence |
|---|---|
| **The three functions are never called from application code** | no reference anywhere in `server/`, `client/src`, `scripts/` — they ran once, in the migration's backfill blocks, and never again |
| **No posting ever uses a per-entity account** | no code writes `1100-C-*`, `2000-S-*`, `"Receivables - "` or `"Payables - "`; every posting uses the generic control account (§3) |
| **New customers/suppliers get no sub-account** | the only call site that would have done it is commented out at [customer.ts:189](server/storage/customer.ts:189) |
| **Employees cannot have one at all** | the CHECK constraint is `entity_type IN ('project','customer','supplier')` ([0041:6](migrations/0041_add_entity_chart_accounts.sql:6)) — **`employee` is rejected**, so the stated requirement needs a migration |
| **Projects are in scope in `0041` but out of scope in the plan** | `4000-P` / `5000-P` templates and `create_project_accounts` exist but the team says only supplier/customer/employee should be dynamic |

### ✅ RESOLVED 2026-07-24 — no per-entity accounts

Team decision: **do not create separate accounts for customers, suppliers or
employees.** The chart of accounts is **fully fixed**. Per-customer and
per-supplier receivables and payables are tracked from **invoice and payment
records**, not from sub-accounts.

Consequences, which simplify the remediation considerably:

1. **Everything `0041` built is dead.** The `entity_type` / `entity_id` columns,
   the four template accounts (`1100-C`, `2000-S`, `4000-P`, `5000-P`), the three
   PL/pgSQL functions, and the sub-accounts the backfill created for existing
   customers/suppliers/projects. These should be **explicitly retired** — left in
   place they are a trap for the next developer, and the template rows currently
   appear in the account picker as if they were selectable accounts.
2. **Account validation becomes simple and strict.** With a closed account set,
   `accountName` can be validated against `chart_of_accounts` on every write
   (§7 D3) with no special-casing for dynamic names. This also makes **L6**
   (`Cash/Bank` missing from the chart) unambiguous: add it to the fixed set, or
   post to `Bank Accounts` (1020).
3. **The `entityId` / `entityName` columns on GL rows stay** as the per-entity
   tag. They are what `getCustomerStatement`
   ([customer.ts:357](server/storage/customer.ts:357)) and `getSupplierStatement`
   ([supplier.ts:524](server/storage/supplier.ts:524)) use today, and they work.
4. **`getReceivables`' document-based approach (L22) is now the intended
   direction, not a defect** — but it makes `getPayables` (**L21**) the
   inconsistent one, since it derives from the ledger. The two should be brought
   onto the same basis.

**One sub-question remains** (carried into the plan, not assumed): should the
customer and supplier *statements* keep reading the GL via `entityId`, or move to
documents like `getReceivables`? Both can work; what matters is that only one is
authoritative and that its total reconciles to the AR/AP control account. I have
not picked one.

⚠ **Related hazard:** `scripts/seed-chart-of-accounts.ts` opens with
`TRUNCATE TABLE chart_of_accounts RESTART IDENTITY CASCADE`
([:120](scripts/seed-chart-of-accounts.ts:120)). Under a fixed-COA-plus-dynamic-
sub-accounts design, running that seed **destroys every per-entity sub-account**
and resets the id sequence that `parent_account_id` depends on. It is not wired
to an npm alias, but it is a foot-gun that gets worse once sub-accounts carry
real balances.

### L21 — `getPayables()` returns payroll rows, expense rows and cancelled entries as if they were supplier payables
**Severity: critical.** [report.ts:80](server/storage/report.ts:80), served by
`GET /api/general-ledger/payables`
([general-ledger.routes.ts:146](server/routes/general-ledger.routes.ts:146)).

```js
.select({ amount: generalLedgerEntries.creditAmount, … })
.from(generalLedgerEntries)
.where(eq(generalLedgerEntries.entryType, "payable"))
```

The **only** filter is `entryType = 'payable'`. There is no account filter and no
status filter. Every payable-tagged row is returned, so the payables list
includes:

- **Purchase Expense** debit rows — returned with `amount = 0.00`, because the
  query aliases `creditAmount` as `amount` and a debit row's credit is zero;
- **payroll** rows — Salary Expense, Salary Payable and Cash/Bank all carry
  `entryType: 'payable'` ([payroll.ts:480](server/storage/payroll.ts:480)), so
  staff salaries appear in the supplier payables list;
- **cancelled** invoices — `status` is never checked;
- **payment** rows — the Dr Accounts Payable side of every supplier payment.

The correct implementation exists elsewhere: `getSupplierStatement`
([supplier.ts:524](server/storage/supplier.ts:524)) filters on
`accountName = 'Accounts Payable'` as well as entry type.

### L22 — Receivables and payables are computed from two different systems
**Severity: high.** [report.ts:113](server/storage/report.ts:113).

Despite its name and its route (`GET /api/general-ledger/receivables`),
`getReceivables()` **never touches `general_ledger_entries`**. It reads
`sales_invoices` and `invoice_payments` and computes outstanding balances from
the documents.

So the two halves of the same report are derived from different sources —
payables from the ledger (L21), receivables from the document tables — and
cannot be reconciled against each other or against the GL. Any divergence
between documents and ledger (which **L1** guarantees for credit notes) shows up
as an unexplainable difference.

**Update 2026-07-24 — the document-based *approach* is now the intended design**
(see the resolution under **L27**: no per-entity accounts; receivables and
payables tracked from invoice and payment records). The approach is therefore
kept. **The implementation, however, was verified line-by-line and has two
defects that must be fixed.**

#### L22a — Cancelled invoices are reported as receivables
The filter excludes `draft`, `rejected` and `pending_approval` — but **not
`cancelled`** ([report.ts:120–130](server/storage/report.ts:120)). The `or()`
clause that looks like it constrains status is a **no-op**: its last arm is
`isNotNull(salesInvoices.invoiceNumber)`, which every approved invoice satisfies,
including cancelled ones — `cancelSalesInvoice` sets the status but never clears
the number ([sales.ts:1826](server/storage/sales.ts:1826)).

Since an invoice can only be cancelled when it has **no payments**
([sales.ts:1817](server/storage/sales.ts:1817)), its `paidAmount` is zero and its
**full value is reported as outstanding**. The company would be chasing money on
invoices it has cancelled.

`getSalesStats` in the same file gets this right — it excludes `cancelled`
explicitly ([report.ts:53](server/storage/report.ts:53)).

#### L22b — No currency conversion: mixed currencies are summed as one unit
`totalAmount` and `paidAmount` are used raw
([report.ts:165–172](server/storage/report.ts:165)), in **document currency**.
`exchangeRate` is available on the row (the query is `select()`, all columns) and
is **never applied**.

So a USD 1,000 invoice and an AED 1,000 invoice each report outstanding
`1000.00`, and the report's total is a meaningless sum of mixed currencies. It
can never reconcile to Accounts Receivable in the ledger, which stores AED
(`totalAmount × exchangeRate` — **E1**).

Again `getSalesStats` gets it right in the same file:
`SUM(total_amount * exchange_rate)`
([report.ts:44–45](server/storage/report.ts:44)).

Two lesser observations, not defects:
- `Math.max(invoicePaidAmount, paymentsPaidAmount)`
  ([report.ts:171](server/storage/report.ts:171)) hedges between the invoice's
  stored `paidAmount` and the sum of its payments — an acknowledgement that the
  two disagree. Credit notes correctly reduce the balance here, since they are
  written as payment rows.
- The whole `invoice_payments` table is loaded into memory unfiltered
  ([report.ts:157](server/storage/report.ts:157)) and filtered in JavaScript.
  Performance only.

### L23 — `result.rowCount` is always `undefined` on this driver: 18 call sites silently report "nothing deleted"
**Severity: high (systemic).**

The project uses **postgres-js** (`drizzle-orm/postgres-js`,
[db.ts:6](server/db.ts:6)). Its result object exposes **`.count`**, not
`.rowCount` — the string `rowCount` does not appear anywhere in
`node_modules/drizzle-orm/postgres-js/`, whose session returns the raw driver
result (`client.unsafe(...)`).

The codebase uses both conventions:

| Convention | Sites | Correct? |
|---|---|---|
| `result.count` | 2 — [payroll.ts:1016](server/storage/payroll.ts:1016), [1155](server/storage/payroll.ts:1155) | ✅ |
| `result.rowCount` | 18 across `server/storage/` | ❌ always `undefined` |

Consequences where `undefined` is used: `result.rowCount \|\| 0` → **always 0**;
`result.rowCount > 0` → **always false**.

GL-relevant call sites:

- [payroll.ts:828](server/storage/payroll.ts:828) — `clearPayrollPeriod` reports
  `deletedGeneralLedgerEntries: 0` **even when it deleted GL rows**. An operator
  is told nothing was cleared and may re-run it or assume failure.
- [payroll.ts:865](server/storage/payroll.ts:865), [883](server/storage/payroll.ts:883)
  — payroll clear operations always report 0 deleted.
- [sales.ts:1461](server/storage/sales.ts:1461) — `deleteCreditNote` always
  returns `false` (route ignores it, so no user impact today).
- [purchase.ts:2954](server/storage/purchase.ts:2954) — `deletePurchaseCreditNote`
  always returns `false`.

The rows **are** deleted — the SQL executes. This is a reporting failure, not a
data-loss failure, except where the boolean gates later logic. Note this
interacts with **L3**: `clearPayrollPeriod`'s already-incomplete GL cleanup is
also mis-reported, making the problem harder to notice.

### L24 — `clearAllPayrollEntries()` wipes all payroll with no ledger cleanup whatsoever
**Severity: critical.** [payroll.ts:880](server/storage/payroll.ts:880), served by
`POST /api/payroll/clear-all`.

```js
const result = await db.delete(payrollEntries);
```

No `where`, and **no GL handling at all** — not even the partial attempt
`clearPayrollPeriod` makes (**L3**). Every payroll GL entry ever posted —
Salary Expense, Salary Payable, Cash/Bank, across every period — is orphaned in
the ledger while the payroll records that justified them are destroyed.

This is strictly worse than **L3**, and unlike L3 it is not period-scoped.

### L25 — Credit-note GL failures are silently swallowed on the update path
**Severity: high.** [sales.ts:555](server/storage/sales.ts:555).

```js
} catch (glError) {
  console.error("Error creating GL entries for credit note:", glError);
  // Don't fail the entire request if GL entry creation fails
}
```

When a credit note transitions `draft → issued` via `updateCreditNote`, the
invoice's paid amount is updated and the request returns **success** even if the
ledger postings failed. The document says the customer was credited; the ledger
never records it.

This is inconsistent with `createCreditNote`, which **re-throws** on the same
failure ([sales.ts:340](server/storage/sales.ts:340),
[375](server/storage/sales.ts:375)). Identical business events, opposite failure
semantics, depending on which path the user took.

### L26 — After approval an invoice's status is outside the editable allowlist, so the GL re-post path is unreachable
**Severity: high.**
[sales-invoices.routes.ts:106](server/routes/sales-invoices.routes.ts:106) vs
[sales.ts:168](server/storage/sales.ts:168).

The edit route permits only:

```js
const editableStatuses = ["draft", "approved", "partial", "paid"];
```

But `updateInvoicePaidAmount` — called immediately after approval
([sales-invoices.routes.ts:56](server/routes/sales-invoices.routes.ts:56)) —
writes one of `"unpaid"`, `"partially_paid"`, `"paid"` or `"overdue"`
([sales.ts:168–181](server/storage/sales.ts:168)). Of those, **only `"paid"` is
editable**.

So an invoice approved through `POST /api/sales-invoices/:id/approve` lands in
`"unpaid"` and can never be edited — the PUT returns
*"This invoice cannot be edited in its current status"*. Consequently
`updateSalesInvoiceGLEntries` (**E3**) is effectively **dead code** for
invoices approved by that route.

This also resolves the open question in CLAUDE.md §13: **both** `"partial"` and
`"partially_paid"` are written, by different code paths —
[sales.ts:172](server/storage/sales.ts:172) writes `partially_paid`,
[sales-invoices.routes.ts:187](server/routes/sales-invoices.routes.ts:187) writes
`partial`.

### L16 — ⚠ CORRECTED 2026-07-24 after restoring a real UAT copy

> **The original finding was wrong about its mechanism, and the correction makes
> L4 worse rather than better.**
>
> This finding claimed manual entries always fail because `entry_type='manual'`
> violates a CHECK constraint. That constraint was read from
> `migrations/schema.ts`. Having restored an actual UAT dump
> (`aquanav_erp`, PostgreSQL 17.7, 2026-07-24) it is now established that
> **`general_ledger_entries` has NO CHECK constraints at all — on UAT or on
> local.** The constraints in `migrations/schema.ts` exist in neither database.
>
> **What this changes:**
> - Manual entries do **not** fail on a constraint. `POST /api/general-ledger`
>   with `entryType: "manual"` would be **accepted**.
> - The "silver lining" recorded under **L4** — that L16 incidentally blocked
>   single-sided posting — is **false**. **L4 is live and exploitable**: any
>   admin or finance user can post a one-sided entry that breaks the trial
>   balance. Its severity increases accordingly.
> - **D3** (journal-only, balanced entries) becomes more urgent, not less.
> - Step **0.9** of the P0 migration, which widens the constraint, is on both
>   databases actually *creating* it for the first time. Harmless and arguably
>   an improvement, but it is not the "widening" it was described as.
>
> **What survives:** UAT contains **zero** rows with `entry_type='manual'`, so
> no manual journal has ever been posted. The observable outcome the finding
> described is real; only the explanation was wrong.
>
> **Root cause of the error:** `migrations/schema.ts` was trusted as a
> description of the live schema. It is not — see **L20**, now materially
> stronger than first reported.

The original text follows, retained for the record.

**The live database enforces** *(claimed, from
[migrations/schema.ts:401](migrations/schema.ts:401) — **not true of any real
database**)*:

```sql
CHECK (entry_type = ANY (ARRAY['payable', 'receivable']))
```

**Only two values are legal.** But:

- The manual-entry form posts `entryType: "manual"`
  ([index.tsx:219](client/src/pages/general-ledger/index.tsx:219)) →
  **every manual GL entry created through the UI fails** with a check-constraint
  violation, surfacing as `500 Failed to create general ledger entry`.
- `createJournalEntry` defaults to `entryType: journalData.entryType || "manual"`
  ([ledger.ts:574](server/storage/ledger.ts:574)) → the balanced journal endpoint
  **also fails** unless the caller explicitly sends `payable` or `receivable`.
  The route adds no default
  ([general-ledger.routes.ts:89](server/routes/general-ledger.routes.ts:89)).
- **No client code calls `/api/general-ledger/journal` at all** — verified across
  `client/src`. The only correct, balance-enforcing path in the system has no UI.

**Consequence: there is currently no working way to post an adjusting journal
entry.** That matters well beyond this finding — several remediations in §7
assume corrections can be made by manual journal, and today they cannot.

Silver lining: because the insert always fails, **L4 is not actually exploitable
through the UI**. It becomes exploitable the moment someone "fixes" the manual
entry form by changing `entryType` without also adding a balance check. L4 and
L16 must therefore be fixed **together**.

### L17 — Payables & receivables are computed across all accounts, so an unpaid invoice reports zero outstanding
**Severity: critical.** [ledger.ts:245](server/storage/ledger.ts:245) (server) and
[payables-receivables.tsx:330](client/src/pages/reports/payables-receivables.tsx:330) (client).

Both implementations sum debits and credits over **every row carrying the
entry type**, without filtering to the control account. Because each posting
pair shares one `entryType`, every transaction nets to zero inside its own
subledger:

| Scenario | Rows (all `entryType = 'receivable'`) | Reported outstanding | Correct |
|---|---|---|---|
| **Unpaid** invoice 1,000 | Dr AR 1,000 · Cr Sales Revenue 1,000 | **0.00** ❌ | 1,000 |
| Invoice paid in full | + Dr Cash/Bank 1,000 · Cr AR 1,000 | 0.00 ✅ | 0 |

The Sales Revenue credit cancels the Accounts Receivable debit, so a completely
unpaid invoice shows **nothing outstanding**. The same holds on the payables side
(`totalPayable = totalCredit − totalDebit` at
[ledger.ts:272](server/storage/ledger.ts:272)), where the Purchase Expense debit
cancels the Accounts Payable credit.

Note the server summary also **ignores the `accountName` filter** — it is absent
from `summaryConditions` ([ledger.ts:196](server/storage/ledger.ts:196)) — so a
user cannot work around it by filtering to the control account in the UI.

The system already contains the correct implementation elsewhere:
`getReceivables` ([customer.ts:385](server/storage/customer.ts:385)) and
`getPayables` ([supplier.ts:552](server/storage/supplier.ts:552)) both filter on
`accountName = 'Accounts Receivable' / 'Accounts Payable'`. So two different
methods of computing the same number coexist, and the wrong one drives the
Payables & Receivables report and the GL summary cards.

### L18 — A maintenance script can delete the entire general ledger
**Severity: critical (latent).**
[scripts/delete-projects-employees.ts:58](scripts/delete-projects-employees.ts:58).

```js
await db.delete(schema.generalLedgerEntries).where(
  schema.generalLedgerEntries.projectId !== null      // ← JavaScript, not SQL
);
```

`schema.generalLedgerEntries.projectId` is a Drizzle **column object**. Comparing
it to `null` with JavaScript `!==` always evaluates to **`true`** — it is not a
SQL predicate. The intent was `isNotNull(generalLedgerEntries.projectId)`.

The console message immediately above reads *"Deleting general ledger entries
related to projects…"*, but the condition expresses no restriction to projects
at all. Depending on how Drizzle handles a non-`SQL` value in `.where()`, the
statement either throws or **executes an unrestricted `DELETE FROM
general_ledger_entries`** — destroying the entire ledger, not just
project-linked rows. **The exact runtime behaviour must be confirmed on a
scratch database before this script is ever run again.** Either way it does not
do what it claims.

It survived because `scripts/` is outside `tsconfig.json`'s `include`, so this
type error is never checked. The script is **not** wired to an npm command, so
it requires a deliberate `tsx` invocation — the only thing currently preventing
this.

### L19 — `npm run reset:revenue` silently strips project attribution from the ledger
**Severity: high.**
[scripts/zero-project-financials.ts:73](scripts/zero-project-financials.ts:73).

```js
await tx.update(schema.generalLedgerEntries)
  .set({ projectId: null })
  .where(eq(schema.generalLedgerEntries.projectId, projectId));
```

This is wired to a convenient npm alias — **`npm run reset:revenue`**
([package.json:19](package.json:19)) — and nulls `project_id` on every GL row for
a project. The amounts stay, so the trial balance is unaffected, but the entries
become permanently unattributable: project P&L
([ledger.ts:339](server/storage/ledger.ts:339) filters on `gle.project_id`) loses
that history with **no way to reconstruct it**, since nothing else records which
project a GL row belonged to.

The operation is described in the script as *"Unlinking non-financial but
related items"* — but `general_ledger_entries` is the financial record, not a
non-financial one. It runs inside a transaction, so it is all-or-nothing, but
there is no confirmation prompt and no dry-run.

### L20 — Neither the `.sql` files NOR `migrations/schema.ts` describe the real schema
**Severity: HIGH (raised from medium 2026-07-24).**

> **Escalated after restoring a real UAT dump.** The original finding said the
> `.sql` files were unreliable and recommended using the introspected
> `migrations/schema.ts` instead. **That recommendation was wrong** —
> `schema.ts` is also unreliable, and trusting it produced an incorrect audit
> finding (**L16**).
>
> Verified across two real databases:
>
> | | `migrations/schema.ts` says | UAT 17.7 actually has | local 16.14 actually had |
> |---|---|---|---|
> | `general_ledger_entries` CHECK constraints | **3** (entry_type, reference_type, status) | **0** | **0** |
> | `0041` account functions | implied present | **0** | **0** |
> | `chart_of_accounts` rows | — | 99 (4 templates) | 101 (4 templates + 2 local-only bank sub-accounts) |
> | PostgreSQL major version | — | **17.7** | **16.14** |
>
> **No artefact in this repository describes the deployed schema.** The `.sql`
> files are partial, the journal covers 19 of 80, and the introspected snapshot
> matches nothing that exists. Any future audit must read a live database.
>
> **Environment divergence** is a second, separate issue: UAT runs PostgreSQL
> **17.7** while local development ran **16.14**. A dump from UAT cannot be
> restored into a 16.x server at all, which is how this was discovered.
> CLAUDE.md §13 lists deployment details as unverified; this is concrete
> evidence they diverge in engine version as well as schema.
>
> **The 1020-1 / 1020-2 bank sub-accounts are local-only** — they do not exist
> on UAT. The 0.5b step added to the P0 migration remains correct and defensive,
> but the condition it fixes was a local artefact, not a UAT one.

The original text follows.

The live database permits `reference_type = 'payroll_payment'`
([migrations/schema.ts:401](migrations/schema.ts:401)), which the payroll payment
posting relies on ([payroll.ts:645](server/storage/payroll.ts:645)). **No `.sql`
migration file adds it** — the last one to touch that constraint is
`0045_update_gl_reference_types_for_credit_notes.sql`, which stops at
`credit_note`. Someone altered the constraint directly against the database.

Consequences:
- Reading the `.sql` files gives a **wrong** picture of what the database
  enforces. This audit had to use the introspected `migrations/schema.ts`
  instead — worth knowing for any future review.
- A rebuild from migrations produces a database where **marking payroll as paid
  fails**, because `payroll_payment` would be rejected.
- Combined with CLAUDE.md §6 (only 19 of 80 migrations are journalled), the
  reproducibility of the schema cannot be assumed.

The three CHECK constraints actually in force:

| Column | Permitted values |
|---|---|
| `entry_type` | `payable`, `receivable` |
| `reference_type` | `sales_invoice`, `purchase_invoice`, `payment`, `credit_note`, `manual`, `payroll_payment` |
| `status` | `pending`, `paid`, `overdue`, `cancelled`, `active`, `issued` |

All values written by server code conform **except** `entry_type: "manual"` —
see **L16**.

### L1 — Sales credit note credits Accounts Receivable twice, and debits cash that was never received
**Severity: critical.** [sales.ts:398](server/storage/sales.ts:398) and
[sales.ts:548](server/storage/sales.ts:548).

> **✅ CONFIRMED on real UAT data, 2026-07-24.** Predicted in advance, then
> reproduced by the team performing the actions themselves on a restored UAT
> copy (`aquanav_uat`, PostgreSQL 17.7).
>
> Actions: a payment of **1,000.00** against `INV-AQNV-2026-008`, then issuing
> credit note **CN-AQNV-2026-001** for **100.00**.
>
> | | Should be | Actually | Error |
> |---|---|---|---|
> | Accounts Receivable | −1,100.00 | **−1,200.00** | −100.00 |
> | Cash/Bank | +1,000.00 | **+1,100.00** | +100.00 |
> | Trial balance | 0.00 | **0.00** | balanced ✓ |
>
> Six GL rows were produced where four were correct. The two spurious rows:
>
> ```
> 147 | payment | Cash/Bank           | Dr 100.00 | "Payment received for Invoice: INV-AQNV-2026-008"
> 148 | payment | Accounts Receivable | Cr 100.00 | "Payment received for Invoice: INV-AQNV-2026-008"
> ```
>
> Labelled *"Payment received"* for a payment nobody recorded. Rows 145–146 had
> already credited AR correctly for the credit note.
>
> **The trial balance stayed at 0.00 throughout.** Both wrong pairs balance
> internally, so every aggregate check passes while AR is understated and cash
> overstated by the credit note's full value. This is the empirical basis for
> testing per phase at account level rather than relying on **P12**'s trial
> balance.
>
> **Concrete acceptance criterion for T5.2:** replaying this scenario after
> **P5** must move AR by **−1,100.00** and Cash/Bank by **+1,000.00**, with no
> `Cash/Bank` row attached to a `credit_note` payment. The
> `invoice_payments` row itself is retained by design (**D1**) — only its GL
> side-effect is suppressed.

Issuing a credit note posts the correct pair (Dr Sales Returns, Cr AR). It then
calls `createInvoicePaymentForCreditNote`
([sales.ts:1497](server/storage/sales.ts:1497)), which calls
`createInvoicePayment` ([sales.ts:1515](server/storage/sales.ts:1515)) — the
same function that posts E5. So a second pair is written: **Dr Cash/Bank,
Cr Accounts Receivable**.

Net effect of one AED 1,000 credit note:

| Account | Should be | Actually posted |
|---|---|---|
| Sales Returns and Allowances | Dr 1,000 | Dr 1,000 |
| Accounts Receivable | Cr 1,000 | **Cr 2,000** |
| Cash/Bank | — | **Dr 1,000** |

The trial balance still foots (both pairs balance individually), so this is
invisible without account-level review. **Accounts Receivable is understated by
the full credit note amount and Cash/Bank is overstated by the same** — on
every credit note ever issued. It flows straight into the customer statement,
which filters exactly these rows
([customer.ts:385](server/storage/customer.ts:385)).

Secondary: the two AR credits use *different* rates — the credit note pair uses
`creditNote.exchangeRate` ([sales.ts:310](server/storage/sales.ts:310)), the
payment pair uses `invoice.exchangeRate`
([sales.ts:680](server/storage/sales.ts:680)). On a foreign-currency invoice the
two wrong entries are not even equal.

### L2 — Salary Payable is credited gross and debited net, so it never clears
**Severity: critical.** [payroll.ts:515](server/storage/payroll.ts:515) vs
[payroll.ts:643](server/storage/payroll.ts:643).

- E12 credits Salary Payable with `calculatedTotalEarnings` — **gross**
  (`basicSalary + consultantFee`, [payroll.ts:335](server/storage/payroll.ts:335)).
- E13 debits Salary Payable with `payrollEntry.totalAmount` — **net**
  (`totalEarnings − totalDeductions`, [payroll.ts:729](server/storage/payroll.ts:729)),
  which includes the 5% TDS deducted at
  [payroll.ts:345](server/storage/payroll.ts:345).

Every fully-paid employee leaves a permanent Salary Payable residue of 5% of
gross. It accumulates every month and never washes out. **The withheld TDS is
never credited to a tax liability account** — `VAT/GST Payable` (2220) and
`Provident Fund Contribution` (2120) exist in the chart of accounts and are
never used by any code path.

Compounding it: reimbursements are added into `totalAmount` at
[payroll.ts:438](server/storage/payroll.ts:438) *after* the accrual, so they are
debited at payment without ever having been credited. Depending on the mix of
TDS and reimbursements the residual can go either direction.

Also note E12 uses gross earnings while `totalAdditions` (allowances) are folded
into `totalAmount` at [payroll.ts:729](server/storage/payroll.ts:729) but never
reach Salary Expense — **Salary Expense understates actual payroll cost by the
additions**.

### L3 — Clearing a payroll period deletes half the ledger and leaves the other half
**Severity: critical.** [payroll.ts:816](server/storage/payroll.ts:816).

`clearPayrollPeriod` hard-deletes GL rows matching
`referenceType = 'manual' AND referenceId = payrollId AND accountName IN
('Salary Expense','Salary Payable')`.

The payment rows from E13 have `referenceType = 'payroll_payment'` and one of
them is `Cash/Bank` — **neither matches the filter**. Clearing a period that
contains paid entries leaves orphaned `Dr Salary Payable / Cr Cash/Bank` rows
behind. The ledger is left genuinely unbalanced by the total net pay of the
cleared period, and the accrual side that justified those payments is gone.

Two further problems with the same call:
- It is a **hard `DELETE`, not a reversal** — the audit trail is destroyed, not
  corrected.
- Because payroll writes `referenceType: "manual"`, the filter can also match a
  genuine manual entry created through `POST /api/general-ledger` that happens
  to use account name `Salary Expense`/`Salary Payable` and a `referenceId`
  equal to a payroll id. Lower likelihood, same delete.

### L4 — The manual GL endpoints can post and edit unbalanced entries
**Severity: high.** [general-ledger.routes.ts:72](server/routes/general-ledger.routes.ts:72)
and [:119](server/routes/general-ledger.routes.ts:119).

- `POST /api/general-ledger` writes a **single row** via
  `createGeneralLedgerEntry`. Any admin or finance user can post a one-sided
  entry. `createGeneralLedgerEntry` cannot detect this — it only sees one side.
- `PUT /api/general-ledger/:id` rewrites `debitAmount`, `creditAmount` and
  `accountName` on **any** row, including system-generated invoice and payroll
  rows, with no balance check and no counterpart adjustment.

The correct path, `POST /api/general-ledger/journal`, does enforce balance
([ledger.ts:555](server/storage/ledger.ts:555)) — but nothing forces callers to
use it over the single-entry endpoint.

### L5 — Purchase credit notes post no ledger entries at all
**Severity: high.** [purchase.ts:2851](server/storage/purchase.ts:2851) and
[purchase.ts:2917](server/storage/purchase.ts:2917).

`createPurchaseCreditNote` / `updatePurchaseCreditNote` insert **directly** into
`purchaseInvoicePayments`, bypassing `createPurchaseInvoicePayment` — which is
the function that carries the GL postings (E11). Result: the invoice's
`paidAmount` drops and the document UI looks settled, but **Accounts Payable is
never reduced and the expense is never reversed**.

This is the exact mirror-image of L1: sales credit notes post *twice*, purchase
credit notes post *never*. The supplier statement
([supplier.ts:552](server/storage/supplier.ts:552)) will overstate the amount
owed to that supplier permanently.

### L6 — `Cash/Bank` is not in the chart of accounts
**Severity: high.** Used at
[sales.ts:696](server/storage/sales.ts:696),
[purchase.ts:2603](server/storage/purchase.ts:2603),
[payroll.ts:664](server/storage/payroll.ts:664).

The chart of accounts has `Cash and Cash Equivalents` (1000), `Petty Cash`
(1010) and `Bank Accounts` (1020) — but no `Cash/Bank`. Consequences:

- `getProfitLossEntries` ([ledger.ts:368](server/storage/ledger.ts:368)) joins
  `general_ledger_entries` to `chart_of_accounts` with an **INNER JOIN on
  account name**. Any row whose account name is not in the chart is silently
  dropped from that query. Cash/Bank is a balance-sheet account so the P&L
  itself is unaffected today — but any future COA-driven report (trial balance,
  balance sheet, cash flow) inherits the same silent drop.
- Every cash movement in the system sits in an account that does not formally
  exist, so it can never be reconciled against a bank statement or split by
  bank account.
- Nothing validates `accountName` against the chart at write time, which is why
  this was never caught.

### L7 — Deleting a document leaves its ledger entries orphaned
**Severity: high.**

`general_ledger_entries.referenceId` is a plain `integer` with **no foreign
key** ([shared/schema.ts:1124](shared/schema.ts:1124)). Deleting the source
document does not touch the ledger, and no delete path posts a reversal:

| Delete path | Guard | GL reversal |
|---|---|---|
| `DELETE /api/credit-notes/:id` → [deleteCreditNote](server/storage/sales.ts:1457) | **none** — any status | ❌ |
| `DELETE /api/purchase-credit-notes/:id` → `deletePurchaseCreditNote` | **none** | ❌ (nothing was posted — L5) |
| [deleteSalesInvoice](server/storage/sales.ts:1789) | none in storage | ❌ |
| [deleteProformaInvoice](server/storage/sales.ts:1441) | n/a | n/a — proforma never posts |

Deleting an issued credit note is the worst case: it removes the document but
leaves **four** GL rows behind (the correct pair plus the L1 phantom pair), with
no way to trace them back.

Note that payments cannot be deleted at all — there is no
`deleteInvoicePayment` or `deletePurchaseInvoicePayment` anywhere in the
codebase. A mistaken payment can only be corrected by a manual journal.

### L8 — `referenceType: "payment"` collides between sales and purchase
**Severity: medium.** [sales.ts:694](server/storage/sales.ts:694) vs
[purchase.ts:2585](server/storage/purchase.ts:2585).

Both write `referenceType: "payment"`, with `referenceId` taken from two
*different* tables — `invoice_payments.id` and `purchase_invoice_payments.id`.
The id spaces overlap. Any query that resolves a GL row back to its payment
via `(referenceType, referenceId)` will match the wrong record roughly half the
time. Nothing does this today, so there is no live symptom — but every
reconciliation or drill-down feature added later will hit it.

Same class of problem: payroll writes `referenceType: "manual"`
([payroll.ts:481](server/storage/payroll.ts:481)), sharing a namespace with
genuine manual entries — see L3.

### L9 — VAT is never separated; revenue and expense are posted gross
**Severity: medium.**

Both `sales_invoices` and `purchase_invoices` carry a `taxAmount` column
(schema lines 23 and 29 of their respective tables). Every posting uses
`totalAmount` — **VAT-inclusive**:

- E1/E2 credit the full gross to **Sales Revenue** → output VAT is booked as
  revenue. Revenue is overstated by the VAT amount.
- E8 debits the full gross to **Purchase Expense** → input VAT is booked as
  expense rather than a recoverable asset.
- `VAT/GST Payable` (2220) exists in the chart of accounts and is **never
  written by any code path**.

Related, same root: `discount` / `discountPercentage` are netted into
`totalAmount` and never posted separately, so gross sales and discounts given
cannot be reported.

Also in this area: `Sales Returns and Allowances` (4150) is typed
`account_type: "revenue"` in the seed
([seed-chart-of-accounts.ts:72](scripts/seed-chart-of-accounts.ts:72)) rather
than as contra-revenue. Its debit balance will net against revenue correctly in
a Dr-vs-Cr calculation, but any report that sums revenue by
`credit_amount` alone will misreport it. Worth confirming against how
`profit-loss.tsx` aggregates.

### L10 — Foreign-currency payments convert at the invoice rate, so FX gain/loss is never recognised
**Severity: medium.** [sales.ts:682](server/storage/sales.ts:682),
[purchase.ts:2576](server/storage/purchase.ts:2576).

Payments are converted with the **invoice's** `exchangeRate`, not the rate on
the payment date. The AR/AP relief therefore always exactly equals the original
booking, and the realised exchange difference disappears. `Foreign Exchange
Gain` (4120) and `Foreign Exchange Loss` (6320) exist in the chart of accounts
and are never written.

Separate risk at the same lines: the payment amount is *assumed* to be in
document currency. If a user records a payment already in AED against a
USD invoice, it is multiplied by the rate a second time.

### L11 — `projectId` is dropped on cancellation and payment entries
**Severity: medium.** [purchase.ts:2442–2471](server/storage/purchase.ts:2442),
[purchase.ts:2583–2612](server/storage/purchase.ts:2583).

E8 sets `projectId: invoice.projectId || null`. The cancellation entries (E10)
and payment entries (E11) omit the field entirely. Any project-filtered ledger
view or project P&L sees the original cost but not its reversal or settlement.
`getProfitLossEntries` filters on `gle.project_id`
([ledger.ts:339](server/storage/ledger.ts:339)), so a cancelled purchase invoice
still shows its full expense against the project.

Sales-side equivalents (E4, E5) do carry `projectId` correctly.

### L12 — Sub-cent rounding on per-project payroll splits
**Severity: low.** [payroll.ts:485](server/storage/payroll.ts:485).

Each project's Salary Expense debit is rounded independently with
`.toFixed(2)`, while the single Salary Payable credit is
`calculatedTotalEarnings.toFixed(2)`. For an employee split across 3+ projects
the rounded debits can sum to a cent or two away from the credit, leaving the
transaction genuinely unbalanced. `createGeneralLedgerEntry` will not catch it —
it validates one row at a time.

### L13 — Two divergent sales-invoice approval paths
**Severity: low (structural).**
[routes:17](server/routes/sales-invoices.routes.ts:17) (`POST .../approve`) vs
[routes:269](server/routes/sales-invoices.routes.ts:269) (`PATCH .../approve`).

Both endpoints exist and both post E1's entries. They are mutually exclusive in
practice — `POST` requires status `draft` and sets `unpaid`; `PATCH` requires
`pending_approval` and sets `approved` — so no double-posting occurs today. But
they leave the invoice in **different statuses** for the same business event,
and only the `PATCH` path records `approvedById`/`approvedAt`
([sales.ts:1734](server/storage/sales.ts:1734)). Any change to the status
allowlist on one path can open a double-post on the other.

### L14 — No transaction wrapping on any posting
**Severity: medium (pre-existing, already noted as CLAUDE.md §12).**

Confirmed for the ledger specifically. E1 writes two rows in two separate
`db.insert()` calls with no transaction ([ledger.ts:773](server/storage/ledger.ts:773),
[791](server/storage/ledger.ts:791)) — same for E4, E8, E10, E11, E12, E13. A
failure between the two calls leaves a permanently one-sided ledger. E8 is the
widest exposure: it also creates asset maintenance records, recalculates project
costs, and creates a goods receipt
([purchase.ts:2200–2240](server/storage/purchase.ts:2200)) before it reaches the
GL writes.

Additionally, `getProfitLossEntries` opens **a brand-new `pg.Pool` on every
call** and ends it ([ledger.ts:375–378](server/storage/ledger.ts:375)), bypassing
the shared `postgres-js` connection in `server/db.ts`.

---

## 6. Missing ledger coverage

Events with real financial effect that write **no** GL row anywhere:

| # | Event | Where | What is missing |
|---|---|---|---|
| M1 | **Purchase credit note** | [purchase.ts:2824](server/storage/purchase.ts:2824), [2885](server/storage/purchase.ts:2885) | Dr Accounts Payable / Cr purchase-returns account. See L5 |
| M2 | **Goods receipt** | [inventory.ts:475](server/storage/inventory.ts:475) | Dr Inventory / Cr GRNI. Stock is received and valued (FIFO) entirely outside the ledger |
| M3 | **Goods issue** | [inventory.ts:269](server/storage/inventory.ts:269) | Dr COGS / Cr Inventory. `Cost of Goods Sold` (5000) and `Inventory` (1200) are never written |
| M4 | **Project consumables** | consumed via `project_consumables` | Dr project cost / Cr Inventory. Feeds `recalculateProjectCost` only |
| M5 | **Reimbursements** | `server/storage/reimbursement.ts` — 0 GL writes | Dr expense / Cr Employee Advances or Salary Payable. `Employee Advances` (1120) never written |
| M6 | **Asset purchase / capitalisation** | asset lines create maintenance records at [purchase.ts:2200](server/storage/purchase.ts:2200) | Everything is expensed to Purchase Expense. Fixed-asset accounts (1400–1460) never written |
| M7 | **Depreciation** | nowhere | Accounts 1500–1540 and 6400–6440 exist and are never written. No depreciation run exists |
| M8 | **VAT / tax** | see L9 | `VAT/GST Payable` (2220), tax accounts 2200–2230 never written |
| M9 | **FX gain / loss** | see L10 | 4120 / 6320 never written |
| M10 | **Payroll deductions (TDS)** | [payroll.ts:345](server/storage/payroll.ts:345) | Withheld but never credited to a liability. See L2 |
| M11 | **Opening balances / year-end close** | nowhere | No mechanism to set opening balances or close revenue/expense to `Retained Earnings` (3100) / `Current Year Earnings` (3200) |
| M12 | **Trial balance / balance sheet** | nowhere | No report verifies ΣDr = ΣCr. See §4 |

Correctly *not* posting (no action needed): sales quotations, proforma invoices
(convert to a **draft** invoice at
[sales-quotations.routes.ts:445](server/routes/sales-quotations.routes.ts:445),
GL waits for approval), purchase requests, purchase orders — all commitments,
not transactions. Invoice rejection also correctly posts nothing, since nothing
was posted before approval.

One dormant remnant: a commented-out GL write in
[customer.ts:189](server/storage/customer.ts:189) that would have created a
zero-amount "Customer: X" account row. It would now be rejected by
`createGeneralLedgerEntry`'s zero-amount check
([ledger.ts:419](server/storage/ledger.ts:419)). Leave as-is.

---

## 7. Proposed remediation plan — phase by phase

Ordered so that each phase is independently shippable and testable, and so
diagnosis comes before correction. **No work starts without your approval on
that specific phase.**

### Phase A — Visibility first (no behaviour change)
Build the instrument before touching the patient.
- A1. Add a trial-balance query/report: ΣDr vs ΣCr overall, by account, by date range.
- A2. Add an "unmatched account name" check: GL account names not present in `chart_of_accounts`.
- A3. Run both against the UAT database and capture the actual current damage per account.

**Why first:** every figure in §5 is derived from reading code. A3 tells us the
real AED exposure per finding and confirms which ones are actually biting.

### Phase B — Stop the bleeding (highest impact, smallest diffs)
- B1. **L1** — sales credit note double-post. Decide the intended treatment
  (post GL *or* create the payment row, not both), then remove one.
- B2. **L5** — purchase credit note posts nothing. Mirror whatever B1 settles on.
- B3. **L3** — `clearPayrollPeriod` leaving orphans.

### Phase C — Payroll correctness
- C1. **L2** — gross-vs-net Salary Payable, plus the missing TDS liability posting (**M10**).
- C2. **L12** — per-project rounding.
- C3. Decide whether payroll should stop using `referenceType: "manual"` (**L8**).

### Phase D — Ledger integrity guardrails
- D1. **L4** — require balanced pairs on the manual endpoints; decide whether
  `POST /api/general-ledger` should be removed in favour of `/journal`, and
  whether `PUT /:id` should be restricted or replaced by reversal-and-repost.
- D2. **L6** — reconcile `Cash/Bank` with the chart of accounts (add the account,
  or migrate existing rows to `Bank Accounts` — this is a data decision, not just code).
- D3. Validate `accountName` against `chart_of_accounts` at write time.
- D4. **L7** — status guards on delete paths; decide reversal-vs-block policy.

### Phase E — Completeness
- E1. **L9 / M8** — VAT split on sales and purchase postings.
- E2. **L11** — `projectId` on cancellation and payment entries.
- E3. **L10 / M9** — FX gain/loss on settlement.
- E4. **M2 / M3 / M4** — inventory into the ledger (largest design decision here;
  needs a call on perpetual vs periodic).
- E5. **M5** reimbursements, **M6 / M7** fixed assets and depreciation, **M11** year-end close.

### Phase F — Structural
- F1. **L14** — wrap each posting in a transaction; fix the per-call `pg.Pool`.
- F2. **L13** — consolidate the two approval paths.
- F3. **L8** — `referenceType` namespacing.

---

## 7b. Decisions log

Answers given by the team on 2026-07-24. These are settled and the plan is to be
written against them.

| # | Question | Decision | Affects |
|---|---|---|---|
| D1 | Credit note behaviour | **Keep both**: the credit note posts its own pair (Dr Sales Returns / Cr AR) **and** still creates the `invoice_payments` row so the invoice shows settled — but that row **skips GL posting**, branching on the existing `paymentType: "credit_note"` marker. Purchase side mirrors it: add the missing GL pair, keep the payment row. | **L1**, **L5** |
| D2 | Provident fund base | **Earnings only** — `basicSalary + additions`, excluding reimbursements. **Deductions do NOT reduce the base**, because they are recoveries of money already paid; reducing would give two identical earners different PF. Removes the circularity question entirely. | `PAYROLL-DEDUCTIONS-DESIGN.md` §1.5 |
| D3 | Manual entries | **Journal-only.** Rebuild the form as a balanced journal (2+ lines, running Dr/Cr totals, submit blocked until balanced) posting to `/journal`. **Retire** the single-sided `POST /api/general-ledger`. Replace `PUT /:id` editing with **reversal-and-repost**. | **L4**, **L16** |
| D4 | `Cash/Bank` account | **Add `Cash/Bank` to the fixed chart of accounts.** No code change, no data migration. *(Noted trade-off: a combined cash-and-bank account cannot be reconciled to a bank statement, and accounts 1000/1010/1020 stay unused.)* | **L6** |
| D5 | VAT | **Split on both sides.** Sales: Dr AR gross / Cr Sales Revenue net / Cr VAT Payable. Purchase: Dr Purchase Expense net / Dr VAT Recoverable / Cr AP gross. **A VAT Recoverable (input VAT) account must be added** — 2220 is output-only. Invoice templates already print a Tax line, so documents need no change. | **L9**, **M8** |
| D6 | Inventory in the ledger | **Keep off-ledger for now**, revisit before go-live. Purchases stay expensed on approval. Accepted consequence: no Inventory asset on a balance sheet, and profit understated in periods where stock is bought but unconsumed. | **M2**, **M3**, **M4** |
| D7 | Payroll timing & project labour | **Post payroll GL at approval, not generation** — drafts stay out of the ledger. **Keep `transactionDate` as the month worked** (June payroll approved in July books to June), consistent with how sales and purchase invoices already date entries. **Derive project labour from the per-project Salary Expense rows**, so project cost and ledger agree by construction. Depends on **L15** being fixed first. The `approved`/`paid` status gate in `recalculateProjectCost` becomes redundant. | **L31**, **E12** |

| D8 | Deleting a posted document | **Allow deletion, but post reversals first.** The reversal must copy the document number, entity name and description so the pair stays human-traceable after the document is gone. *(Noted trade-off: the reversal references a document that no longer exists.)* | **L7** |
| D9 | Per-entity balances | **Documents are authoritative.** Move `getCustomerStatement`, `getSupplierStatement` and `getPayables` onto invoices + payments, matching `getReceivables`. The GL keeps the AR/AP control totals, which should reconcile to the sum of document-derived balances. | **L21**, **L22**, **L17** |
| D10 | Trial balance timing | **Fix first, then build the trial balance and balance sheet and review the fixes against them.** *(Lower risk than usual here because there is no historical data to preserve — see D15.)* | **M12** |
| D11 | Risky scripts | **Delete `delete-projects-employees.ts`** (L18). **Keep `zero-project-financials.ts` but add a confirmation prompt and dry-run mode** (L19). **Add `scripts/` to `tsconfig.json`** so this class of error is caught by `npm run check`. | **L18**, **L19** |
| D12 | `rowCount` → `count` | **Fix all 18 sites in one focused change**, not just the four ledger-related ones. | **L23** |
| D13 | Foreign currency | **Fix the double-conversion now** — make the payment currency explicit so an AED payment against a USD invoice is not converted twice. **Defer FX gain/loss recognition** (4120/6320). | **L10**, **M9** |
| D14 | PF payout | **Defer the payout workflow.** Post the liability monthly; finance clears an individual's balance by manual journal (Dr 2120 / Cr Cash-Bank) on exit, using the journal form from **D3**. **Add a per-employee PF balance report** — cheap, since GL rows already carry `entityId`. | `PAYROLL-DEDUCTIONS-DESIGN.md` §6.1 |
| D15 | Existing UAT ledger data | **Wipe `general_ledger_entries` and re-post from approved documents** using the corrected code before go-live. Doubles as the end-to-end verification for **D10**. Needs a re-post routine that does not exist yet; payroll cannot simply be replayed while **L3** is unfixed. | all |

| D16 | Reimbursement routing | **Add a `category` field** to `reimbursements`, mapped to a chart-of-accounts code, selected on the claim form. GL row carries the existing `projectId`. Accommodation folds into `Travel and Entertainment` (6120) unless a 6125 account is added. | **M5**, §7c |
| D17 | COA re-seed & ledger rebuild | **Admin UI button behind the admin role**, backed by an endpoint. Required guards: server-side **environment check** so it can never run against production regardless of the UI; **two-step preview → confirm** showing counts and what cannot be regenerated; **typed confirmation phrase**, not a plain OK; **automatic GL export before deletion**; **admin re-authentication** for this specific action rather than relying on the session cookie; and an **audit-log entry** recording who ran it and the resulting counts. *(Noted trade-off: this places irreversible ledger deletion behind a session in a system with a known authorization gap — A10 — and no CSRF protection. The environment check and re-authentication are the mitigations.)* | **D15** |
| D18 | Advance-recovery posting | **Advance recoveries get no GL line and no account.** `Salary Payable` is credited with **gross − PF** (plus reimbursements) — the recovery is *not* deducted from it — and is debited by that same figure on payment, crediting `Cash/Bank`. The payable clears to zero; the portion above the payslip net is the advance, which left the company earlier with no GL record and is recognised at this point. Rejects two alternatives: crediting `Employee Advances` (1120) would drive an asset negative, since nothing ever debited it; reducing `Salary Expense` balances but understates earnings and leaves `Cash/Bank` overstated permanently. **Accepted:** the advance's cash outflow is dated to the payment month, so that month's bank reconciliation shows the difference — the balance is right afterwards, only the movement is misdated. **Depends on:** every non-PF deduction being a recovery of money already paid; a genuine third-party withholding would need its own type and liability account. | **L2**, `PAYROLL-DEDUCTIONS-DESIGN.md` §3 |

### Constraints on the rebuild (D17), carried into the plan

- **Payroll must be recomputed, not replayed.** **D2** and §1.6 of the payroll
  design change the payroll figures themselves, so net pay changes. The rebuild
  regenerates payroll entries, it does not merely re-post their GL.
- **Reimbursements cannot be regenerated until categorised** (**D16**).
  *Resolved 2026-07-24:* payroll has never been generated in UAT, so all
  existing reimbursement rows are free-standing; the team categorises them via
  the UI once the category field ships, before the first payroll run. The
  rebuild blocks on any still-uncategorised row rather than defaulting.
- **Manual journals are not derivable from documents** and would be destroyed.
  The tool must count and report them before deleting. Per **L16** there are
  probably none, since manual entries currently fail the CHECK constraint.
- **No account may be renamed.** GL rows reference accounts by name with no FK,
  and the P&L inner-joins on that name — a rename silently drops every affected
  row from the P&L. The planned changes are add / remove / deactivate only; the
  tool should assert this rather than assume it.

### Settled without needing a decision

- **L29 `lineTotal`** — determined by **D5**. With VAT split out, Purchase
  Expense posts **net**, so project cost must be net too: `lineTotal` becomes
  **tax-exclusive**. `convertPurchaseOrderToInvoice` is already correct; the two
  purchase-order writers ([:1001](server/storage/purchase.ts:1001),
  [:1107](server/storage/purchase.ts:1107)) change, and the two client-supplied
  paths must be server-validated to sum to the header.
- **Negative PF base** — removed by **D2**. Nothing is subtracted from the base,
  so it cannot go negative.
- **L17** — resolved by **D9**; the broken cross-account summary is replaced by
  the document-derived figures.
- Obvious corrections needing no decision: **L11** (add `projectId` to
  cancellation and payment entries), **L25** (re-throw instead of swallowing GL
  errors), **L26** (align `editableStatuses` with the statuses actually
  written), **L28** (constrain create status to `draft`), **L30** (delete the
  dead, broken `createPurchaseInvoiceFromPO`), **L22a/L22b** (exclude cancelled
  invoices, apply `exchangeRate`).

## 7c. Chart of accounts review

Reviewed 2026-07-24 against the decisions above. Source:
[scripts/seed-chart-of-accounts.ts](scripts/seed-chart-of-accounts.ts) —
**99 accounts** (corrected during P0 implementation; an earlier draft of this
section said 116), of which **8 are actually written by code**. The live
database additionally holds whatever per-entity sub-accounts `0041`'s backfill
created.

### Must add — required by decisions

| Code | Account | Type / category | Why |
|---|---|---|---|
| **1030** | `Cash/Bank` | asset / current_assets | **D4**. Currently posted to by every cash movement and absent from the chart (**L6**). 1030 is free — 1000, 1010, 1020 then 1100. |
| **1130** | `VAT Recoverable` | asset / current_assets | **D5**. Input VAT is an **asset** — recoverable from the FTA. The chart has only `VAT/GST Payable` (2220, output) and `VAT/GST Expense` (6520, non-recoverable). Without this the purchase-side split has nowhere to post. 1130 is free. |

### Must remove — dead under the no-per-entity-accounts decision

The four `0041` template accounts are in **both** the migration **and** the seed
script ([:11](scripts/seed-chart-of-accounts.ts:11),
[:35](scripts/seed-chart-of-accounts.ts:35),
[:61](scripts/seed-chart-of-accounts.ts:61),
[:76](scripts/seed-chart-of-accounts.ts:76)), so re-seeding recreates them:

`1100-C` Customer Receivables Template · `2000-S` Supplier Payables Template ·
`4000-P` Project Revenue Template · `5000-P` Project Costs Template

They appear in the account picker as **selectable accounts** — a user could post
to "Customer Receivables Template". Also remove the real sub-accounts `0041`'s
backfill created in the live database (`1100-C-{id}`, `2000-S-{id}`,
`4000-P-{id}`, `5000-P-{id}`).

### Should deactivate — duplicates that will split balances

Harmless today because code posts to hardcoded names. **Becomes a real risk once
the journal form (D3) lets users pick accounts from a dropdown** — two accounts
meaning the same thing split the balance and break reconciliation to the control
account.

| Keep | Deactivate | Both described as |
|---|---|---|
| `Accounts Receivable` (1100) | `Customer Receivables` (1110) | "Amounts owed by customers" |
| `Accounts Payable` (2000) | `Supplier Payables` (2010) | "Amounts owed to suppliers" |
| `Cash/Bank` (1030, new) | `Cash and Cash Equivalents` (1000), `Petty Cash` (1010), `Bank Accounts` (1020) | cash — four accounts once 1030 is added |

Use `isActive = false` rather than deleting — `getChartOfAccounts` already
filters on it ([ledger.ts:30](server/storage/ledger.ts:30)), so they vanish from
the picker while existing references stay valid.

### Should correct — misleading description

`2120 Provident Fund Contribution` is described as *"Withholding taxes to be
remitted"*. Now confirmed as a real company PF scheme, not withholding tax. This
mismatch is what made the deduction look like TDS on first reading; correct the
description so the next reader is not misled.

### ⚠ Gap — reimbursements cannot be routed to an expense account

`PAYROLL-DEDUCTIONS-DESIGN.md` §3.1 requires reimbursements to debit **the real
expense account** (travel, accommodation) rather than Salary Expense. But the
`reimbursements` table has **no category or account field** — only a free-text
`description` ([shared/schema.ts](shared/schema.ts)). The code has no way to
decide between `Travel and Entertainment` (6120), `Fuel and Transportation`
(6060) or anything else.

**✅ RESOLVED 2026-07-24 (D16): add an expense-category field.** A `category`
column on `reimbursements`, mapped to a chart-of-accounts code, selected on the
claim form. The GL row also carries `projectId`, which the table already holds
([shared/schema.ts](shared/schema.ts) — *"Optional project association"*).

**Proposed category → account mapping** (adjust during review):

| Category | Account |
|---|---|
| Travel | `Travel and Entertainment` (6120) |
| Accommodation | `Accommodation` (6125) — **added by fix-plan P0.7, approved 2026-07-24** |
| Fuel / transport | `Fuel and Transportation` (6060) |
| Office supplies | `Office Supplies` (6080) |
| Communication | `Communication Expenses` (6090) |
| Training | `Training and Development` (6130) |
| Other | `Operating Expenses` (6000) |

✅ **Resolved 2026-07-24:** an `Accommodation` account (**6125**) is added to
the chart (fix-plan **P0.7**); the Accommodation reimbursement category maps to
it rather than folding into 6120.

### This decision simplifies three existing problems

Because reimbursements now post to their own expense account rather than riding
inside Salary Expense:

1. **The `LIKE 'Reimbursement:%'` string match becomes unnecessary.**
   `recalculateProjectCost` currently subtracts reimbursements back out of
   payroll labour by matching a description prefix
   ([project-asset.ts:1002](server/storage/project-asset.ts:1002)). Once
   reimbursements are never in Salary Expense, there is nothing to subtract —
   the fragile match can go.
2. **The project double-count risk disappears.** Under **D7** project labour is
   derived from GL **Salary Expense** rows only; reimbursements post to a
   different account, so they cannot be counted twice regardless of whether the
   reimbursement and payroll entry share a `projectId`.
3. **Reimbursements stop attracting PF**, consistent with **D2** — they are
   outside the PF base because they are outside earnings entirely.

### Verified as correct — no change

- `Sales Returns and Allowances` (4150) is typed `revenue`, not contra-revenue.
  The P&L computes revenue as `credit − debit`
  ([profit-loss.tsx:217](client/src/pages/reports/profit-loss.tsx:217)), so its
  debit correctly **reduces** revenue. Works as-is.
- `Employee Advances` (1120) exists but is **deliberately unused** (**D18**).
  Advances are never recorded when paid, so 1120 has no debits; crediting it on
  recovery would drive an asset into a credit balance. Recoveries stay inside
  `Salary Payable` instead. Keep the account — it becomes correct the day
  advances are recorded at payment time, at which point D18 must be revisited.
- `Provident Fund Contribution` (2120) exists for the PF liability (**D14**).
- Accounts for deferred work already exist: `Inventory` (1200) and
  `Cost of Goods Sold` (5000) for **D6**; `Foreign Exchange Gain` (4120) and
  `Loss` (6320) for **D13**; `Retained Earnings` (3100) and
  `Current Year Earnings` (3200) for a future period close.

### Observation — 99 accounts, 10 in use

Not a defect; a full chart is normal. But once the journal form ships, a
~93-entry dropdown of never-used accounts invites mis-posting. Worth considering
deactivating everything outside the working set and re-activating on demand.
Raising it, not recommending it — it depends on how the finance team wants to
work.

### Follow-ups raised but not scheduled

- **Period close (M11).** No mechanism prevents back-dating into a month already
  reported on. Correct dating (D7) is right regardless; a period lock is needed
  before periods are reported externally.
- **Retiring migration `0041`.** Per the no-per-entity-accounts decision, its
  columns, template accounts and PL/pgSQL functions are dead. Decide whether to
  drop them or leave them documented as unused — the template rows currently
  appear in the account picker as selectable.
- **Migration drift (L20).** The `.sql` files do not describe what the database
  actually enforces. A process fix for the team, not a code change.
- **VAT Recoverable account.** **D5** requires an input-VAT account that does not
  exist in the fixed chart — 2220 is output-only. Must be added alongside
  `Cash/Bank` from **D4**.

---

## 8. Open questions for the team

These change what "correct" means and I have not assumed answers:

1. **Credit notes (L1/L5)** — should a credit note settle the invoice through
   the payments table (document-layer behaviour) *and* post GL, or only one?
   The two sides of the system currently disagree with each other.
2. **TDS (L2)** — which account should withheld tax credit to? `Provident Fund
   Contribution` (2120) is described as "Withholding taxes to be remitted",
   which contradicts its name. Is 5% TDS even correct for a UAE entity?
3. **Cash/Bank (L6)** — add `Cash/Bank` to the chart of accounts, or migrate
   existing rows onto `Bank Accounts` (1020)? The second option needs a data
   migration on live UAT rows.
4. **Inventory (M2/M3)** — should stock be on the ledger at all at this stage,
   or is off-ledger FIFO acceptable for the current scope?
5. **VAT (L9)** — is the system expected to produce a VAT return? That decides
   whether E1 needs the split.
6. **Existing bad data** — once L1/L2/L5 are fixed, the historic entries remain
   wrong. Correct them with adjusting journals, or leave UAT data as-is and fix
   forward?

---

*Prepared per CLAUDE.md rule 4 — report only, no code changed. Findings are
line-referenced against commit `8fa6710`; re-verify line ranges after any
rebase on `origin/main`.*
