# Next Steps: Nestar → PulseBridge

Priority: **P0** = do first, blocks or is a security issue · **P1** = this phase · **P2** = later.

Updated 2026-10-04 after the healthcare domain migration (COMPLETED_TASKS §5).

## 0. Before deploying the domain migration

| Pri | Task | Command / detail | Done when |
|---|---|---|---|
| P0 | Back up the database | `mongodump --uri "$MONGO_DEV"` (and prod) | Backup stored |
| P0 | Dry-run the data migration, check the counts | `npm run migrate:pulsebridge` | Counts look right |
| P0 | Apply the migration | `node scripts/migrate-nestar-to-pulsebridge.js --apply` (add `--prod` for prod) | Script finishes without errors |
| P0 | Smoke test against a real DB | signup as CLINIC → `createClinic` → `createDoctor` → signup PATIENT → `createAppointment` → `updateAppointment` → `getNotifications` | All succeed |
| P0 | Tell users to log in again | JWT secret fix invalidates old tokens (D-20) | — |
| P0 | Release the frontend together with the new GraphQL contract | BACKEND_MIGRATION §9.3, D-09 | Frontend uses the new operations |
| P1 | Decide on the `.env` DB name (D-04) | Keep `Nestar`, or copy into `PulseBridge` | Decision recorded |

## 1. Backend

| Pri | Task | Location |
|---|---|---|
| P1 | `checkAuthRoles`: use `RolesGuard` (bug #10, `@Roles` has no effect with `AuthGuard`) | `member.resolver.ts` |
| P1 | Minimal JWT payload (D-11): `{ _id, memberType, memberStatus }` | `auth.service.ts` |
| P1 | Former AGENT members are DOCTOR without a `doctors` record: clinics must add them | product / support |
| P1 | Comment `DELETE`/`BLOCK` does not decrement `*Comments` counters (behaviour kept from Nestar) | `comment.service.ts` |
| P1 | Removing a clinic leaves its `doctors` records; decide cascade rules | `clinic.service.ts` |
| P1 | Fix ESLint (D-14) | `package.json`, `eslint.config.mjs` |
| P2 | Clinic managers (`clinics.clinicManagers`) and doctor approval (`doctorStatus`) if needed (D-16) | clinic / doctor modules |
| P2 | DoctorSchedule (working hours) so booking can check availability | new module |
| P2 | Batch: appointment reminders, auto-complete past CONFIRMED appointments | `pulsebridge-batch` |
| P2 | Socket: per-appointment consultation rooms (D-13) | `socket.gateway.ts` |
| P2 | Extract `libs/common` (D-10) | `nest g library common` |
| P2 | Compliance baseline (D-12): audit log, less `console.log` of inputs | — |
| P2 | `start:prod` across platforms (`cross-env`) | `package.json` |

## 2. Frontend

| Pri | Task | Ref |
|---|---|---|
| P0 | Switch to the new operations, types and enums | BACKEND_MIGRATION §9 |
| P1 | Pages: clinic (owner dashboard, doctors list), doctor profile, booking, my appointments, notifications | FRONTEND_MIGRATION |

## 3. Testing

| Pri | Task |
|---|---|
| P1 | e2e against a test MongoDB: booking flow, double booking rejected, permissions per role |
| P1 | GraphQL schema snapshot test (commit `schema.gql`) |
| P1 | Fix the e2e specs that expect `'Hello World!'` |

## 4. Documentation

| Pri | Task |
|---|---|
| P1 | Replace the boilerplate `README.md` with PulseBridge setup, env keys, scripts |
| P2 | `.env.example` with key names only |
| Ongoing | After each change update BACKEND_MIGRATION, COMPLETED_TASKS and DECISIONS |
