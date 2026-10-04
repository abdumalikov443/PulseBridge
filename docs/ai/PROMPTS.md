# Prompts: Nestar → PulseBridge Migration

Prompts for the next AI coding session (Claude Code or Codex). Before running one, read `docs/BACKEND_MIGRATION.md`, `docs/DECISIONS.md` and `docs/NEXT_STEPS.md`.

## 1. Prompts used in this session

| # | Prompt (as used) | Outcome |
|---|---|---|
| 1 | "Analyze current Nestar monorepo structure to transform existing NestJS Monorepo Nestar platform into healthcare platform" | Structure analysis, domain mapping, 10 bugs, phase plan |
| 2 | "Safe rename layer (No business logic change). Rename all visible project/app identifiers from Nestar to PulseBridge. Do not change domain logic. Keep APIs and database collections unchanged. Update package names, env labels, constants. Run lint and typecheck after refactoring. Please make plan first" | Plan → approval → commit `631ec51` |
| 3 | "If there is environment variables, them too" | Found `Nestar` in the Mongo URI values; DB-name risk raised (D-04) |
| 4 | "Create docs/ … BACKEND_MIGRATION, DECISIONS, FRONTEND_MIGRATION, COMPLETED_TASKS, NEXT_STEPS, PROMPTS … Do not change application source code" | This folder |

**What worked:** asking for a plan first; stating what must *not* change (APIs, collections, domain logic); asking for lint and typecheck by name.
**What to add next time:** say how to handle data-bearing config (DB names), and list the exact commands for validation.

## 2. Reusable prompts

### 2.1 Session bootstrap
```
Read AGENTS.md and everything in docs/. Summarize in ≤10 bullets: current phase,
last commit, open decisions (Open status in DECISIONS.md), and the top 5 P0/P1 items
in NEXT_STEPS.md. Do not modify files.
```

### 2.2 Close out Phase 0 validation
```
Run: npm run typecheck; npx nest build pulsebridge-api; npx nest build pulsebridge-batch;
npx eslint "apps/**/*.ts" (no --fix). Report each exit code and the first error if any.
Update docs/COMPLETED_TASKS.md §3 with the results. Do not change source code.
```

### 2.3 Phase 1 bug fixes (no contract change)
```
Fix the bugs listed in docs/NEXT_STEPS.md §1, one commit per bug, in priority order.
Constraints:
- Do not change any GraphQL operation, type, field, or enum name (generated schema must
  stay identical).
- Do not change Mongo model or collection names.
- Add a regression unit test per fix where feasible.
After each fix run `npm run typecheck`. Make a plan first and wait for approval.
Finally update docs/COMPLETED_TASKS.md and tick items in docs/NEXT_STEPS.md.
```

### 2.4 Fix ESLint setup
```
Lint crashes with "TypeError ... no-unused-expressions ... allowShortCircuit" because
eslint.config.mjs imports typescript-eslint, @eslint/js and globals that are not in
package.json (they resolve from a parent node_modules). Propose the smallest fix that
makes `npx eslint "apps/**/*.ts"` run with the existing rules, without reformatting
source files. Plan first; do not run with --fix.
```

### 2.5 Extract shared library
```
Create libs/common with `nest g library common`. Move schemas/, libs/enums, libs/dto,
libs/types and the $lookup helpers from apps/pulsebridge-api/src into it, add a
@app/common path alias, and update imports in both apps so pulsebridge-batch no
longer imports from apps/pulsebridge-api/src. No behaviour or schema change.
Verify with typecheck and both builds. Plan first.
```

### 2.6 Phase 3: Member roles
```
Implement Phase 3 from docs/BACKEND_MIGRATION.md: MemberType USER→PATIENT,
AGENT→DOCTOR; add doctor fields (doctorSpecialty, doctorLicenseNo, doctorVerified,
doctorExperience); minimal JWT payload {_id, memberType, memberStatus} (D-11);
getAgents→getDoctors, AgentsInquiry→DoctorsInquiry. Write an idempotent Mongo
migration script for members.memberType. List every GraphQL contract change in
docs/FRONTEND_MIGRATION.md. Plan first.
```

### 2.7 Phase 4: Property → Clinic
```
Decision D-07 = <Clinic|DoctorService>. Rename the Property domain end-to-end
following the tables in docs/FRONTEND_MIGRATION.md §4–5: schema, model name,
collection (with migration script), DTOs, enums, resolver operations, sort lists in
libs/config.ts, every $lookup.from string, Like/View/Comment/Notification groups,
and the batch jobs. Remove square/beds/rooms/barter/rent. Keep behaviour otherwise
identical. Plan first, then implement in reviewable commits.
```

### 2.8 Phase 5: Appointments
```
Add AppointmentModule and DoctorScheduleModule following the existing
module/resolver/service/DTO conventions (see AGENTS.md). Appointment statuses:
PENDING, CONFIRMED, CANCELLED, COMPLETED, NO_SHOW. Prevent double booking with a
unique index on (doctorId, slotStart). Register Notification and Notice models
and emit notifications on status changes. Plan the GraphQL contract first and add
it to docs/FRONTEND_MIGRATION.md before writing code.
```

### 2.9 Frontend inventory
```
In the Next.js frontend repo, inventory pages/, libs/components/, apollo/ documents,
libs/enums and libs/types. Fill in docs/FRONTEND_MIGRATION.md §3 with real file paths
(replace the "verify" entries) and count occurrences of property/agent/nestar.
Do not modify source code.
```

### 2.10 Docs refresh after any phase
```
Update docs/BACKEND_MIGRATION.md, docs/COMPLETED_TASKS.md, docs/DECISIONS.md and
docs/NEXT_STEPS.md to reflect the work completed in this session (commits, files,
validation results with exit codes). Only edit docs/.
```

## 3. Prompting rules for this repo
- Always ask for **"plan first"** on anything that touches more than one module.
- Always say what must **not** change: GraphQL contract, collections, `.env` keys.
- Name the validation commands explicitly: `npm run typecheck`, `nest build <project>`, `npx eslint "apps/**/*.ts"`.
- For anything that affects stored data (DB names, collection renames, enum values in stored data), ask for a migration script and a dry-run.
