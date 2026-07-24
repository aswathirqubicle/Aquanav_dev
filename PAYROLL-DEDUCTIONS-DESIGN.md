# Payroll deductions & withholdings — how it should work

**Date:** 2026-07-24
**Companion to:** `LEDGER-AUDIT-REPORT.md` findings **L2** and **M10**
**Status: DESIGN NOTE — no code changed.**

Answers two questions:
1. TDS is deducted from salary but never accounted for or recorded on payment.
2. Deductions don't consider which account they should be paid from, based on
   deduction type.

Both have the same root cause, but they are separate problems and need separate
fixes.

---

## 1. What the code does today

### 1.1 The automatic deduction

[payroll.ts:345](server/storage/payroll.ts:345) computes a flat 5% of gross:

```
const tdsAmount = calculatedTotalEarnings * 0.05;
const netAmount = calculatedTotalEarnings - tdsAmount;
```

and writes a deduction row at [payroll.ts:367](server/storage/payroll.ts:367):

```
description: "Provident Fund Contribution",
note:        "5% of total earnings",
```

**The naming disagrees with itself in three places:**

| Place | Says |
|---|---|
| [payroll.ts:345](server/storage/payroll.ts:345) variable name | `tdsAmount` — Tax Deducted at Source |
| [payroll.ts:369](server/storage/payroll.ts:369) deduction label | `"Provident Fund Contribution"` |
| [seed-chart-of-accounts.ts:40](scripts/seed-chart-of-accounts.ts:40) account 2120 | name `"Provident Fund Contribution"`, description `"Withholding taxes to be remitted"` |

TDS and provident fund are different things with different counterparties and
different remittance rules. This needs a decision before anything is built —
see §6.

### 1.2 Manual deductions have no type

`payroll_deductions` ([shared/schema.ts](shared/schema.ts)) is:

```
payrollEntryId, description (free text), amount, note
```

There is **no type, category, or account field**. The UI
([payroll/index.tsx:5018](client/src/pages/payroll/index.tsx:5018)) is a plain
text input with placeholder `"e.g., Tax, Insurance, Loan"`. So "Loan",
"loan repayment" and "Advance recovery" are three unrelated strings that a
human can tell apart and code cannot.

`payroll_additions` has the identical shape and the identical gap.

**This is the direct answer to your second question:** there is currently
nothing to route on. Deduction type doesn't exist as data.

### 1.3 What reaches the ledger

| Event | Posting | Amount |
|---|---|---|
| Payroll generated | Dr Salary Expense / Cr Salary Payable | **gross** |
| Marked paid | Dr Salary Payable / Cr Cash/Bank | **net** |
| Deduction | *nothing* | — |
| Remittance to the fund/authority | *no such event exists* | — |

The deducted amount is never posted anywhere. It simply remains as an
unexplained residue in Salary Payable, growing every month and never clearing.
For an employee on AED 10,000:

```
Accrual:   Dr Salary Expense  10,000
              Cr Salary Payable        10,000
Payment:   Dr Salary Payable    9,500
              Cr Cash/Bank              9,500
                              ─────────────────
           Salary Payable balance:  500  ← stuck forever
```

The AED 500 withheld is real money the company is holding on someone else's
behalf. Right now the books say nothing about who it belongs to or that it has
to be paid out.

### 1.4 Two dead columns

`payroll_entries.additions` and `payroll_entries.deductions` are `json` columns
that are **never written** — only read back at
[payroll.ts:548](server/storage/payroll.ts:548), where they return their `[]`
default. The child tables are the live storage. Same trap as
`sales_invoice_items` (CLAUDE.md §6). Worth removing or populating, but it is a
separate decision — flagging it so it isn't mistaken for the source of truth.

---

## 1.5 Jurisdiction: Dubai, UAE — this changes the answer

Confirmed 2026-07-24: the company is based in Dubai. That resolves questions 1
and 2 in §6, and it changes what "correct" looks like.

### The UAE has no personal income tax

There is **no TDS on salaries in the UAE**. A withholding tax deduction from an
employee's pay has no legal basis for a Dubai entity. The UAE's actual tax
obligations are Corporate Tax (9% on company profit — not payroll) and VAT (5%
— which ties to finding **L9** in the ledger audit, where VAT is never posted).

### The 5% provident fund is a deliberate client requirement

Confirmed by the user: **the client asked for a provident fund at 5% deduction
on total payable.** So the deduction is intended, and the label
`"Provident Fund Contribution"` at
[payroll.ts:369](server/storage/payroll.ts:369) is the correct one. This
resolves the naming question in §1.1 — with one loose end: the variable is still
called `tdsAmount` ([payroll.ts:345](server/storage/payroll.ts:345)) and account
2120's description still reads *"Withholding taxes to be remitted"*
([seed-chart-of-accounts.ts:40](scripts/seed-chart-of-accounts.ts:40)). Both are
cosmetic, but they are why this looked like tax withholding on first reading and
they will mislead the next person too.

A company provident fund in the UAE is a **voluntary employer scheme**, not a
statutory withholding. That is good news for the design: there is no tax
authority to remit to and no filing deadline. But it does not change the
accounting — the money is still not the company's.

### What the client-approved payslip actually shows

The payslip is generated at
[my-payslips.tsx:213](client/src/pages/my-payslips.tsx:213) (employee's own
copy) and mirrored in the payroll module. It has exactly three money totals —
**and no line labelled "Total Payable"**:

| Payslip line | Formula | Source |
|---|---|---|
| **Total Earnings** | `basicSalary + totalAdditions` | computed [my-payslips.tsx:210](client/src/pages/my-payslips.tsx:210) |
| **Total Deductions** | sum of the deduction rows (includes the PF row itself) | [:211](client/src/pages/my-payslips.tsx:211) |
| **Net Pay** | `payroll_entries.totalAmount` | [:301](client/src/pages/my-payslips.tsx:301) |

Layout: Basic Salary → each addition listed → **Total Earnings**; then each
deduction listed → **Total Deductions**; then a **Net Pay** box.

### ✅ DECIDED 2026-07-24 — the base is EARNINGS; deductions do NOT reduce it

An earlier instruction said "net salary after reducing all deductions". On
review the team corrected it, reasoning that a deduction is money **already paid
to the employee**, so it should not reduce the PF base. That is the sounder
position and it is the decision:

```
PF base = basicSalary + additions (bonus, overtime)      ← excludes reimbursements
PF      = 5% × PF base
Net Pay = PF base − all deductions (incl. PF) + reimbursements
```

**Why deductions must not reduce it.** An advance is paid *early against
earnings*, not instead of them. Someone who earns 10,000 and repays a 2,000
advance still earned 10,000. Reducing the base would give:

| Both earning 10,000 | Took a 2,000 advance | Took none |
|---|---|---|
| PF contribution | 400 | **500** |

— two identical earners accumulating different provident funds purely because of
*when* one took cash. Since **every** deduction in this system is a recovery of
money already paid (§3.1), none of them touch the base.

**This also removes the circularity entirely.** Nothing is subtracted from the
base, so PF cannot appear inside its own base, and the 4.7619% problem
documented below no longer applies to the live design. The reference section is
retained only to explain why the net-based reading was rejected.

**Worked example** — 10,000 basic, 1,000 overtime, 2,000 advance recovery,
500 travel reimbursement:

```
PF base    = 10,000 + 1,000           = 11,000    ← deductions do NOT reduce this
PF         = 5% × 11,000              =    550
Deductions = 2,000 advance + 550 PF   =  2,550
Net Pay    = 11,000 − 2,550 + 500     =  8,950
```

**Recomputation dependency is now single, not double.** PF must be recalculated
when an **addition** is created, edited or deleted after generation (a later
bonus does attract PF). It is **unaffected by deductions**, so deduction changes
need not touch it. Simpler than the net-based version.

**One distinction decides whether this is buildable in one pass: does PF count
as one of the "all deductions" that reduce its own base?**

- **PF excluded from its own base** — the base is earnings less the *other*
  deductions (loans, advances, fines). Straightforward: one multiplication, one
  pass, exactly 5% of a figure you can point at.
- **PF included in its own base** — circular, because the base then depends on
  the answer. Resolves to an effective 4.7619%, worked through below.

**I am proceeding on "PF excluded from its own base"** — it is the only reading
that is computable directly, it gives a true 5%, and it matches the natural
sense of "apply PF *to* the net salary" (you arrive at a net figure first, then
apply PF to it). Worked example, salary 10,000 with a 1,000 loan repayment:

```
Total Earnings              10,000
less loan repayment        − 1,000
                          ─────────
PF base                      9,000
PF = 5% × 9,000            −   450
                          ─────────
Net Pay                      8,550
```

If instead PF were included in its own base, the same case gives PF = 428.57 and
Net Pay = 8,571.43. **A 21.43 difference per employee per month** — small
individually, wrong permanently, and it compounds across headcount. Please
confirm the 450 figure is what the client expects.

### Two consequences of the net base — both mandatory, not optional

**1. PF must recompute whenever any deduction or addition changes.** Under the
old "5% of Total Earnings" reading, recomputation was a judgement call (§6.2).
Under a net base it is forced: the PF *depends* on the other deductions, so
adding a loan deduction must reduce the PF in the same operation. The natural
home is `updatePayrollEntryTotals`
([payroll.ts:701](server/storage/payroll.ts:701)), which already re-sums
everything else on every change — but note it must recompute PF **before**
summing `totalDeductions`, or the total will be one revision stale.

**2. The base must be floored at zero.** If deductions exceed earnings in a
given month, the base goes negative and 5% of a negative number is a *negative
deduction* — i.e. the system would silently pay the employee extra.
`createGeneralLedgerEntry` would then reject the posting outright, since it
refuses negative amounts
([ledger.ts:426](server/storage/ledger.ts:426)). Needs an explicit
`Math.max(0, base)` and a decision on what the payslip shows in that month.

---

### Reference: why the circular reading resolves to 4.7619%

Kept because the client asked, and it explains the distinction above.

PF is itself one of the deductions subtracted to arrive at Net Pay — so Net Pay
depends on PF, while the rule says PF depends on Net Pay. Each needs the other
before it can be calculated.

You can see the problem by trying to compute it in one pass, on a salary of
AED 10,000 with no other deductions:

```
Net before PF     = 10,000
PF = 5% of 10,000 =    500
Net after PF      =  9,500
Check: is PF 5% of Net Pay?   5% × 9,500 = 475,  but we deducted 500.  ✗
```

The payslip now contradicts its own rule. Deduct 475 instead and Net becomes
9,525, so 5% is 476.25 — still wrong. It converges only if you solve it
algebraically:

```
Let E = Total Earnings, D = other deductions, P = PF, N = Net Pay

    N = E − D − P          (net is earnings less ALL deductions, PF included)
    P = 0.05 × N           (the rule, if "payable" means net)

⇒   P = 0.05 × (E − D − P)
⇒   P + 0.05P = 0.05 × (E − D)
⇒   1.05P = 0.05 × (E − D)
⇒   P = (0.05 ÷ 1.05) × (E − D)  =  4.7619% × (E − D)
```

On the AED 10,000 example: **PF = 476.19**, Net Pay = 9,523.81, and 5% of
9,523.81 is indeed 476.19 ✓ — self-consistent at last, but the employee sees a
deduction of **476.19 against Total Earnings of 10,000, which is 4.76%**, and
will ask why it is not the 5% they were told.

**Second problem: it becomes unstable.** Because the formula contains *other*
deductions, an unrelated deduction changes the provident fund:

| Scenario (E = 10,000) | PF under "5% of Net" | PF under "5% of Total Earnings" |
|---|---|---|
| No other deductions | 476.19 | 500.00 |
| Add a 1,000 loan repayment | **428.57** | 500.00 |

Adding a loan repayment should not alter someone's provident fund contribution,
but under the Net Pay reading it does — the PF drops by 47.62. Under the Total
Earnings reading it stays at 500 regardless.

Both problems disappear if PF is **excluded from its own base** — which is the
reading adopted above. PF then depends on the other deductions (intended, per
the client) but not on itself (circular, not intended).

**If it means Total Earnings, it is clean and conventional:**
`PF = 5% × (basicSalary + totalAdditions)`.

**Recommendation: Total Earnings.** It is non-circular, it is the standard PF
base, and it is the line immediately above the deductions block on the approved
payslip. Please confirm with one word before this is built — see §6 Q1.

### What "5% on total payable" means matters, and the code doesn't match it

[payroll.ts:345](server/storage/payroll.ts:345) computes:

```
tdsAmount = calculatedTotalEarnings * 0.05     // basicSalary + consultantFee
```

That base **excludes `payroll_additions`** — allowances, bonuses, overtime,
reimbursements — because those rows are created after the calculation, and for
permanent staff they are not part of `calculatedTotalEarnings` at all.

Worse, the 5% is computed **once, at generation, and never recalculated.**
`updatePayrollEntryTotals` ([payroll.ts:701](server/storage/payroll.ts:701))
re-sums additions, deductions and the total from the child tables on every
change — but it does **not** recompute the provident fund row. So:

> Generate payroll for an employee on AED 10,000 → PF is AED 500.
> Add a AED 2,000 allowance → Total Earnings becomes AED 12,000,
> **PF stays at AED 500** — 4.2%, not 5%.

**The 5% applies to all three employee categories** — settled and not in question
(§1.5, "Scope decisions"). What differs is only whether the *base* the code
multiplies by 5% equals the required net base. Measured against
`basicSalary + additions − other deductions`:

| Category | 5% applies? | Code's PF base | Required base | Correct? |
|---|---|---|---|---|
| **Consultant / contract** | **Yes** | `0 + consultantFee` | `0 + totalAdditions − otherDeductions` — project fees are written as additions at [payroll.ts:382](server/storage/payroll.ts:382) | ✅ **only** at generation, before any deduction exists |
| **Permanent** | **Yes** | `basicSalary` only | `basicSalary + totalAdditions − otherDeductions` | ❌ **under-deducts** whenever the employee has any allowance, bonus or overtime |

At generation the PF row is the *first* deduction created
([payroll.ts:367](server/storage/payroll.ts:367)), so there are no other
deductions to subtract and the net base momentarily equals Total Earnings. That
is why the consultant case looks correct — it is correct only for that instant.

**The moment finance adds any deduction, the code is wrong for every category**,
because nothing recomputes PF. Same for any addition created after generation.

So the deduction fires for everyone, as required, but the amount is right only
for a payroll that is never touched after it is generated. The fix is to correct
the base and recompute it on change — never to narrow who it applies to.

### Scope decisions recorded

**End-of-service gratuity — OUT OF SCOPE.** The client did not ask for it
(confirmed 2026-07-24). Nothing in the codebase models it and nothing will be
built. Recorded here only so the position is explicit rather than an oversight:
gratuity remains a statutory entitlement under UAE labour law whether or not the
ERP tracks it, so the company's real liability will be larger than the books
show. That is the client's call to make, and they have made it. Handled outside
the system.

**PF applies to EVERY employee category — permanent, consultant and contract.**
Confirmed twice by the client and marked **strictly required** (2026-07-24).
The 5% deduction applies universally; there is no category exemption and **none
is to be introduced**. The current behaviour at
[payroll.ts:335–345](server/storage/payroll.ts:335) is correct on this point and
must be preserved through any change made under this note.

To be explicit, since §1.5 compares the categories on a different axis: the
question there is whether each category's *calculation base* matches the
payslip, **not** whether the deduction applies. It applies to all of them.

Note the interaction with finding **L15**: consultants are exactly the case that
carries multiple per-project Salary Expense rows, so consultant PF work and the
L15 fix touch the same code path and should be sequenced together.

For completeness, since the entity is in Dubai: there is no personal income tax
in the UAE, so no salary withholding tax is due — the 5% is a company scheme,
not a statutory withholding. GPSSA pension applies only to UAE and GCC
nationals, and the employees table has no `nationality` or Emirates ID field to
identify them — worth knowing only if UAE nationals are ever hired, since that
scheme has both an employee and an employer share.

---

## 1.6 CLIENT BUG — working days should be calendar days

Reported by the client 2026-07-24: *the system calculates working days excluding
holidays, but it should be based on calendar days with no deduction for
holidays.* Confirmed in the code.

### What it actually excludes

`calculateWorkingDays` ([base.ts:110](server/storage/base.ts:110)) counts only
**Monday–Friday**, skipping `dayOfWeek === 0` (Sunday) and `6` (Saturday). So it
excludes **weekends**, not public holidays — **there is no public-holiday
calendar anywhere in the codebase**. Worth stating precisely so the fix targets
the right thing: the client's "holidays" means weekends here.

Two call sites, both in the consultant/contract branch:

| Line | Use |
|---|---|
| [payroll.ts:313](server/storage/payroll.ts:313) | `dailyRate = salary ÷ getWorkingDaysInMonth(...)` — the **divisor** |
| [payroll.ts:306](server/storage/payroll.ts:306) | `projectWorkingDays = calculateWorkingDays(start, end)` — the **numerator** |

**Permanent staff are unaffected** — they get the full month, and their stored
`workingDays` is already calendar days
([payroll.ts:248](server/storage/payroll.ts:248)). So the two categories already
disagree about what a "day" is, and the payslip prints both labels
([my-payslips.tsx:256](client/src/pages/my-payslips.tsx:256)).

### Why the error is erratic rather than constant

Because numerator and divisor share the same Mon–Fri basis, a consultant
assigned for a **whole month is paid correctly either way**. The error only
appears on **partial-month assignments**, and its direction depends on where the
window falls. Using July 2026 (31 calendar days, 23 Mon–Fri days) and a
consultant on AED 10,000:

| Assignment window | Current (Mon–Fri) | Calendar days | Effect |
|---|---|---|---|
| Whole month | 10,000.00 | 10,000.00 | identical ✅ |
| Jul 1–15 *(11 weekdays / 15 days)* | 4,782.61 | 4,838.71 | **underpays** 56.10 |
| Jul 6–10 *(5 weekdays / 5 days)* | 2,173.91 | 1,612.90 | **overpays 561.01 — 35%** |
| Jul 4–5 *(weekend only)* | **0.00** | 645.16 | **pays nothing** |

The last row is the worst case and compounds: `earnings > 0` gates the project
row ([payroll.ts:316](server/storage/payroll.ts:316)), and
`calculatedTotalEarnings === 0` skips the employee from payroll **entirely** with
a `continue` ([payroll.ts:338](server/storage/payroll.ts:338)). A consultant
whose assignment falls only on a weekend gets **no payroll entry at all** that
month.

Erratic in both directions is exactly what makes a client report "the numbers
look wrong" rather than "the numbers are consistently X".

### Scope of the fix — contained

`calculateWorkingDays` and `getWorkingDaysInMonth` are called from **nowhere
except payroll** — verified across `server/` and `client/src`. The only callers
are payroll.ts:306, payroll.ts:313, and base.ts:297 (which serves payroll.ts:313).
So moving payroll to a calendar-day basis cannot affect any other module.

Changing to calendar days makes both helpers dead code. Per CLAUDE.md rule 4
they are reported, not removed.

Three places need to change together, or the payslip will contradict itself:

1. the divisor ([payroll.ts:313](server/storage/payroll.ts:313)) → calendar days in month;
2. the numerator ([payroll.ts:306](server/storage/payroll.ts:306)) → calendar days in the assignment window;
3. the stored `workingDays` for consultants
   ([payroll.ts:331](server/storage/payroll.ts:331)) → calendar days, so the
   payslip's "Working Days" line matches the money.

### Sequencing

This must be fixed **before** the PF work. PF is 5% of a base derived from these
earnings — correcting the deduction on top of a wrong gross just produces a
precisely-calculated wrong number. Suggested order: **1.6 (this) → L15 → PF
base → GL split.**

---

## 2. The principle

A deduction is not a reduction of the company's cost. **The full gross is the
company's expense.** The deduction only changes *who gets paid* — part goes to
the employee, part goes to somebody else, or part settles something the
employee already owed.

So the gross/net split belongs on the **credit side of the accrual**, not as a
residue:

```
Dr  Salary Expense                      gross
    Cr  Salary Payable                          net        ← what the employee gets
    Cr  <one account per deduction>             each       ← where the rest goes
                                        ─────────────
                    total credits  =  gross      ✓ balanced
```

Then payment clears exactly:

```
Dr  Salary Payable      net
    Cr  Cash/Bank               net       → Salary Payable returns to zero ✓
```

And each withheld amount is settled by its own later event:

```
Dr  <deduction liability>   amount
    Cr  Cash/Bank                   amount    → when actually remitted
```

That third event is the one that does not exist in the system at all today.

---

## 3. Deduction types and where each one goes

> **Narrowed 2026-07-24 by client clarification.** Deductions in this system are
> **recoveries of money already paid to the employee** (advances and similar).
> Additions are **bonus and overtime on top of salary**. That collapses the
> general taxonomy below into just two live cases — see §3.1. The full table is
> kept as reference in case the scheme is ever extended.

This is the routing table. The important insight is that **deductions are not
all the same kind of thing** — they fall into four distinct accounting
behaviours:

| # | Type | What it really is | Credit at accrual | Settled later by |
|---|---|---|---|---|
| **A** | Statutory withholding (TDS / PF / pension / social security) | Money owed to a **third party** | `2120` Provident Fund Contribution *(or a correctly-named tax account — §6)* | Remittance: Dr 2120 / Cr Cash-Bank |
| **B** | Insurance premium — employee share | Money owed to the **insurer** | `2130` Employee Benefits Payable | Payment to insurer: Dr 2130 / Cr Cash-Bank |
| **C** | Salary advance / loan recovery | Settles an **asset** — the employee already received this cash | `1120` Employee Advances | **Nothing further.** The recovery *is* the settlement |
| | *— textbook only. In this system advances are never recorded when paid, so 1120 has no debit to settle. The decided mapping below (**D18** in the audit report's decisions log) keeps the recovery inside Salary Payable instead.* | | | |
| **D** | Fine, penalty, damage recovery | A **recovery of cost or other income** | `4130` Miscellaneous Income, or credit back the expense that bore the cost | Nothing further |
| **E** | Unpaid leave / absence | **Not a deduction at all** — the employee earned less | Should reduce `Salary Expense` at source, so gross is lower | n/a |

Categories **A and B create a liability** — the company is holding someone
else's money and must pay it out. Category **C reduces an asset** — no
liability, nothing left to remit. Category **D** is income or a cost recovery.
Category **E** shouldn't be a deduction row at all; it belongs in the earnings
calculation.

Treating C as if it were A would create a phantom liability that never clears —
the mirror of the bug you have now.

## 3.1 The actual model, per client clarification (2026-07-24)

Confirmed semantics — these override the general table above:

| Element | What it means here | Is it salary? |
|---|---|---|
| **Basic salary** | Permanent: full month. Consultant/contract: pro-rata by working days per project assignment | ✅ yes |
| **Additions** | Bonus, overtime — genuinely *on top of* salary | ✅ yes |
| **Deductions** | Recovery of money **already paid** to the employee (advance or similar) | ➖ settles an asset |
| **Reimbursement** | Travel, accommodation etc. the employee paid for. **Settled through the payslip but not part of salary** | ❌ **no** |
| **Provident fund** | 5% withheld, company holds it for the employee | ➖ creates a liability |

That reduces the routing table to four live cases:

| Element | Accounting treatment |
|---|---|
| Basic + additions | **Dr Salary Expense** — the company's payroll cost |
| Advance recovery | **No account of its own** — stays inside Salary Payable, which is settled in full on payment. See the decided mapping below; 1120 is *not* used, because nothing ever debited it |
| Provident fund | **Cr 2120 Provident Fund Contribution** — liability, cleared on exit (§6.1) |
| Reimbursement | **Dr the real expense account** (6120 Travel and Entertainment, 6060 Fuel and Transportation, or the project) — **never Salary Expense** |

### ⚠ Two consequences that change the calculation

**1. Reimbursements must be excluded from the PF base.** They currently are
not — and they would be under a naive reading of the client's rule.

Reimbursements are written into `payroll_additions` at
[payroll.ts:410](server/storage/payroll.ts:410) with a `"Reimbursement: "`
description prefix. The payslip lists every addition inside the Earnings block
and rolls them into **Total Earnings**
([my-payslips.tsx:275–283](client/src/pages/my-payslips.tsx:275)). So a
reimbursement is, today, indistinguishable from a bonus on both the payslip and
in `totalAdditions`.

Apply "5% on earnings plus all additions" to that and **the employee pays 5% PF
on their own money being returned to them** — AED 25 withheld from a AED 500
travel claim. Certainly not intended, and the employee will spot it.

The system already knows these rows are special: `recalculateProjectCost`
filters them out of project labour cost by matching the description prefix
([project-asset.ts:1002](server/storage/project-asset.ts:1002),
[2241](server/storage/project-asset.ts:2241)). Relying on a `LIKE 'Reimbursement:%'`
string match is fragile — this is exactly what the `type` field in §5 is for.

**2. Reimbursements must be excluded from Salary Expense.** A travel or
accommodation cost is not payroll. Booking it to Salary Expense overstates
payroll and understates travel/accommodation cost, and it distorts the
per-project labour figures — which is precisely why the project-cost calculation
already has to strip them back out.

### Proposed payslip structure

> ⏭️ **DEFERRED — user decision 2026-07-25 (plan item 2.7 skipped).** The payslip
> display is retained as-is: reimbursements continue to appear inside the Earnings
> block. This structure is **not implemented**; it is kept as a reference for if
> the client later wants reimbursements visually separated. Note the PF figure in
> the sketch below (450) reflects an early "deductions reduce the base" reading
> that **D2 later reversed** — PF is 5% of earnings only, so the correct figure is
> 550. The calc already follows D2; only this illustrative sketch is stale.

Reimbursements need their own block, applied **after** PF so they cannot attract
it:

```
EARNINGS
  Basic Salary                     10,000
  Overtime / bonus                  1,000
  Total Earnings                   11,000     ← PF base starts here

DEDUCTIONS
  Advance recovery                  2,000     ← reduces PF base (client rule)
  Provident Fund 5%                   450     ← 5% × (11,000 − 2,000)
  Total Deductions                  2,450

REIMBURSEMENTS  (not salary)
  Travel expense                      500     ← no PF on this
  Total Reimbursements                500

NET PAY                             9,050     = 11,000 − 2,450 + 500
```

### ✅ ACCOUNT MAPPING — decided 2026-07-25

Only two things get their own account. Everything else nets through
Salary Payable.

| Element | Account | Why |
|---|---|---|
| **Provident fund** | `Cr 2120 Provident Fund Contribution` | A genuine liability — the company is holding an employee's money and will pay it out later. It must be visible on the balance sheet |
| **Reimbursement** | `Dr` its category account (6120 / 6125 / 6060 / 6080 / 6090 / 6130 / **6160 other**), carrying `projectId` | So spend is visible by expense type, and a claim tagged to a project lands in that project's costs |
| **Advance recovery** | **no separate account** — stays inside `Salary Payable`, which is then settled **in full** | See below |
| Basic + additions | `Dr Salary Expense` | Overtime and bonus are earnings; they do not need separating |
| Salary Payable | `Cr` **gross − PF** (+ reimbursements); debited by that **same figure** on payment | Clears to zero. Note this is *not* the payslip net — see below |

#### Why advance recovery stays in Salary Payable

Confirmed 2026-07-25: **advances are never recorded in the ledger when paid.**
`Employee Advances` (1120) has **zero** GL rows, and the two existing recoveries
are described *"Salary advance prior joining"* — paid before the employee joined,
outside anything this system recorded. The system has no screen for recording an
advance at the moment it is paid.

That rules out crediting 1120: nothing ever debited it, so the credit would push
an **asset into a credit balance**, asserting the company is owed minus-386.

It also rules out reducing `Salary Expense` by the recovery — the treatment
recorded here until 2026-07-25. That version balances, but it leaves **two**
accounts wrong and one of them permanently: `Salary Expense` understates what the
employee earned, and `Cash/Bank` stays overstated forever by an advance that left
the company and was never booked.

The decided treatment fixes both. **Salary Payable is credited with gross less PF
— the advance is *not* deducted from it — and is then debited in full on payment,
crediting `Cash/Bank` for the same figure.** The recovery therefore has no GL line
of its own; it is simply never removed from the payable.

On UAT entry 26 — gross 1,736.09, PF 86.80, advance 386.00, payslip net 1,263.29:

**Accrual**
```
Dr  Salary Expense              1,736.09    ← what the employee actually earned
    Cr  Provident Fund Contribution            86.80
    Cr  Salary Payable                      1,649.29
                                ─────────────────────
                                1,736.09 =  1,736.09  ✓
```

**On marking paid**
```
Dr  Salary Payable              1,649.29
    Cr  Cash/Bank                           1,649.29    → Salary Payable = 0 ✓
```

Of the 1,649.29 credited to cash, **1,263.29 genuinely leaves today** and
**386.00 is the previously-unrecorded advance catching up** — money that left the
company earlier, outside the books, entering them now. The recovery is the only
point at which that outflow can be recognised, because nothing recorded it when
it happened.

Result: `Salary Expense` is truthful at 1,736.09, `Cash/Bank` reflects the total
ever paid to this employee, and `Salary Payable` clears exactly — which is **L2**,
the defect this phase exists to remove.

⚠ **Accepted imprecision (confirmed 2026-07-25 — "unavoidable").** The 386.00
cash outflow is dated to the payment date rather than to when the advance
actually left. For an advance described *"prior joining"* and never recorded,
there is no alternative short of an opening-balance journal, which is out of
scope for a new company with no historical data to migrate.

Two visible consequences of that, both expected:

1. **The cash credit exceeds the payslip net** in the month of recovery — 1,649.29
   booked against 1,263.29 actually transferred. Bank reconciliation for that
   month will show the difference. This is the correction landing, not an error.
2. **After it lands, the `Cash/Bank` *balance* is correct** and agrees with the
   bank. Only that one month's *movement* is overstated. Under the previous
   treatment the balance was wrong permanently, so this is strictly better.

⚠ **Constraint this depends on.** Every non-PF deduction must be a recovery of
money **already paid to the employee** — which is exactly what `advance_recovery`
means and how §3 defines deductions. If `Other` is ever used for a genuine
withholding (a fine, or anything remitted to a third party), this treatment would
credit `Cash/Bank` for money that never reached the employee. That case needs its
own deduction type and its own liability account; it must not be filed under
`Other`. No such deduction exists today.

⚠ **Revisit if** anyone starts recording advances at payment time
(`Dr Employee Advances / Cr Cash`). From that point the outflow would be booked
twice — once when paid, once on recovery — and the recovery would need to credit
1120 instead.

### The resulting journal entry

Basic 10,000 · overtime 1,000 · advance recovery 2,000 · travel reimbursement 500 ·
PF 550 (5% × 11,000 — deductions do **not** reduce the base, **D2**):

**Accrual, on approval**
```
Dr  Salary Expense                          11,000     earnings only
Dr  Travel and Entertainment (6120)            500     the reimbursement
    Cr  Provident Fund Contribution (2120)                550    liability
    Cr  Salary Payable                                 10,950    gross − PF + reimbursement
                                            ──────────────────
                                            11,500  =  11,500   ✓
```

**Payment**
```
Dr  Salary Payable      10,950
    Cr  Cash/Bank                  10,950     → Salary Payable = 0 ✓
```

Salary Payable clears to zero — the fix for finding **L2**.

The payslip shows **net pay 8,950** (11,000 − 2,550 + 500), and 8,950 is what the
employee actually receives this month. The 2,000 gap between that and the 10,950
cash credit is the advance being recognised, per the section above.

One open point on the reimbursement line: if a reimbursement is ever recognised
as a payable to the employee at *approval* time, the payroll entry should credit
that liability rather than debit the expense again. Today reimbursements post no
GL at all (**M5**), so recognising the expense at payroll time is correct as
things stand.

### Worked example (general reference)

Employee on AED 10,000 gross, with PF 500 and an advance recovery of 1,000.
Payslip net pay 8,500.

**Accrual**
```
Dr  Salary Expense                     10,000
    Cr  Provident Fund Contribution (2120)        500
    Cr  Salary Payable                          9,500     gross − PF
                                       ──────────────
                                       10,000  10,000  ✓
```

**Payment to employee**
```
Dr  Salary Payable       9,500
    Cr  Cash/Bank                9,500     → Salary Payable = 0 ✓
```
8,500 of that reaches the employee this month; the other 1,000 is the advance,
paid out earlier and unrecorded until now.

**Remittance of PF, later**
```
Dr  Provident Fund Contribution   500
    Cr  Cash/Bank                         500     → 2120 = 0 ✓
```

Every account returns to zero once fully settled. The advance recovery needs no
follow-up entry of its own — it was never removed from the payable, so settling
the payable in full is what recognises it.

⚠ **Deliberately not shown: a genuine withholding.** An earlier draft of this
example carried an insurance deduction of 200 credited to `Employee Benefits
Payable` (2130). That is the case the decided treatment does **not** cover, per
the constraint above: money withheld and remitted to a third party never reaches
the employee, so it cannot stay in Salary Payable and be settled as cash to them.
It would need its own deduction type and its own liability account. No such
deduction type exists today — `DEDUCTION_TYPES` is `provident_fund`,
`advance_recovery`, `other` ([shared/payroll-types.ts:19](shared/payroll-types.ts:19)).

---

## 4. The same problem exists on the additions side

`payroll_additions` has no type either, and it produces a live bug already
documented as **L2** in the audit report: reimbursements are folded into
`totalAmount` at [payroll.ts:438](server/storage/payroll.ts:438) *after* the GL
accrual, so they are debited at payment without ever having been credited.

Additions split the same way:

| Type | Accounting |
|---|---|
| Allowance / bonus / overtime | Genuine `Salary Expense` — must be inside the accrual, currently is not |
| **Expense reimbursement** | **Not salary at all.** Dr the original expense (or clear `1120` Employee Advances). Putting it through Salary Expense overstates payroll cost |
| Project fee (consultants) | Already handled per-project at [payroll.ts:382](server/storage/payroll.ts:382) |

Any fix to deductions should settle additions at the same time — they share the
schema shape and the same missing-type problem.

---

## 5. What would have to change

Listed for scope discussion only. **No work starts without your approval.**

1. **Add a type field** to `payroll_deductions` and `payroll_additions` — a
   constrained set, not free text. Needs a migration (hand-written, per
   CLAUDE.md §6) and a UI change from text input to select.
2. **Define the type → account mapping.** Three options:
   - hardcoded map in code — simplest, least flexible;
   - a column on the deduction type holding an `account_code`;
   - a small config table joined to `chart_of_accounts`.
   My suggestion is the second: one `account_code` column, validated against
   `chart_of_accounts`, so finance can retarget without a deploy.
3. **Move the split into the accrual** — credit Salary Payable net, credit each
   deduction account, keep Salary Expense at gross. This is the fix for L2.
4. **Build a remittance event** for categories A and B. This is genuinely new
   functionality — nothing like it exists today. It needs a UI, and it is the
   larger half of the work.
5. ~~**Backfill existing deductions.**~~ **Dropped** — new company, no
   historical data to correct (confirmed 2026-07-24).
6. **Decide on the dead JSON columns** (§1.4).
7. **Fix the PF calculation base** to match §1.5, and decide whether it
   recomputes on change (§6.2 Q2).

Sequence I would suggest: 7 → 1 → 2 → 3 (get the amount right, then post it to
the right account), then 4 (payout on exit). Steps 7 and 3 together fix
finding **L2**. Because consultants are involved, this work overlaps finding
**L15** — the per-project Salary Expense rows are rewritten by the same function
that would need to recompute PF — so **L15 should be fixed first or in the same
change**, not after.

---

## 6. Recommended scheme design & remaining decisions

### 6.1 How the fund should be held — recommended best practice

Answering "where does the withheld money go?" There is no external authority to
remit to, so the company holds it. Recommended:

1. **Segregate the cash into a separate designated bank account.** This is the
   single most important control. If PF money sits in the operating account it
   will be spent on operations, and the obligation becomes unfunded — the
   company owes real money it no longer has. A separate account also makes the
   liability trivially verifiable: bank balance should equal the 2120 balance.
2. **Recognise the liability from the first payroll** — `Cr 2120 Provident Fund
   Contribution` at accrual, as in §3. It is a liability from day one, not when
   the employee leaves.
3. **Clear it on exit, not monthly.** `Dr 2120 / Cr Cash-Bank` when an employee
   leaves and is paid out. Between accrual and exit the balance simply
   accumulates. This means 2120 grows continuously and is *expected* to — unlike
   Salary Payable, it should not return to zero each month.
4. **Keep a per-employee sub-ledger.** 2120 is a single pooled GL account; it
   cannot tell you what any one person is owed. Good news: payroll GL rows
   already carry `entityId` and `entityName` set to the employee
   ([payroll.ts:487](server/storage/payroll.ts:487)), so a per-employee balance
   is queryable from the ledger without new storage. It should be surfaced as a
   report, and shown to the employee — ideally as a running balance on the
   payslip or the My Payslips page.
5. **Write down the scheme rules before go-live.** Vesting (does someone leaving
   after three months get the full balance?), forfeiture on termination for
   cause, and whether any interest or return is credited. Without this the
   liability is legally ambiguous and the payout event has no defined amount.
6. **Do not accrue interest unless the scheme promises it.** If it does, that is
   an additional company expense (`Dr 6300 Financial Expenses / Cr 2120`), not
   part of the 5%.

Point 5 is the client's to answer, and it should be settled before the first
real payroll — it defines what the payout event actually pays.

### 6.2 Remaining decisions

**Resolved:** Dubai entity · the 5% PF is a client requirement · it applies to
consultants and contractors by design · **employee side only, no employer
matching contribution** · end-of-service gratuity out of scope · **no historical
data to correct — new company, fix forward**.

**Also resolved:** the PF base is **net salary** —
`basicSalary + additions − other deductions` (§1.5). Recomputation on change is
therefore **mandatory**, not a choice, and is no longer an open question.

One confirmation still outstanding:

1. **Does PF count as one of the deductions that reduce its own base?**
   Proceeding on **no** — see §1.5 for the arithmetic. On a 10,000 salary with a
   1,000 loan repayment that gives **PF = 450** and Net Pay = 8,550; the
   alternative gives PF = 428.57 and Net Pay = 8,571.43. Confirming the 450 is
   what the client expects closes this out. Everything else in the design is
   settled either way — only the number moves.

2. **Should an advance recovery really reduce the PF base?** Now that deductions
   are confirmed to be *advance recoveries*, the client's rule has a concrete
   consequence worth putting in front of them explicitly:

   | Employee, both earning 10,000 | Took a 2,000 advance | Took no advance |
   |---|---|---|
   | PF base | 8,000 | 10,000 |
   | **PF contribution** | **400** | **500** |

   Taking an advance permanently reduces that employee's provident fund, even
   though they earned exactly the same. An advance is a *timing* difference —
   money paid early, not money not earned — so the economically correct base
   would exclude it. **Proceeding as instructed (advances reduce the base)**;
   flagging once because it is invisible until an employee compares payslips
   with a colleague.

Two smaller calls needed during build:

- **Negative base** (§1.5) — when deductions exceed earnings, floor the base at
  zero. Confirm what the payslip should display that month.
- **Reimbursements excluded from the PF base and from Salary Expense** (§3.1).
  Treating this as settled by the clarification that reimbursement "is not
  actually part of the salary" — flagging only because it changes the payslip
  layout, which the client has already approved in its current form and will
  need to re-approve.

### 6.3 What the answers simplify

- **No employer contribution** → no `6020 / 2130` posting. The accrual is a
  three-line entry: `Dr Salary Expense / Cr Salary Payable + Cr 2120`.
- **New company, no historical data** → no adjusting journals, no restatement,
  and no backfill exercise to classify existing free-text deductions. Step 5 in
  §5 drops out entirely. Worth confirming separately whether the existing UAT
  payroll rows should simply be cleared before go-live rather than corrected.
- **Gratuity out of scope** → no second liability to model.

Question 1 blocks the rest: the amount to credit has to be right before there is
any point deciding which account it credits to.

---

*Design note only. No code changed, no migration written. Line references are
against commit `8fa6710`.*
