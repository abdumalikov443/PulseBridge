# Architectural Decisions: Nestar → PulseBridge

Format: lightweight ADR. Status values: **Accepted** (implemented or binding), **Proposed** (agreed direction, not implemented), **Open** (needs an owner decision).

| ID | Decision | Status |
|---|---|---|
| D-01 | Phased migration: rename layer first, domain changes later | Accepted |
| D-02 | Freeze the GraphQL contract during the rename phase | Accepted |
| D-03 | Keep Mongo model and collection names during the rename phase | Accepted |
| D-04 | Keep `.env` keys; database name rename is the owner's call | Accepted (keys) / Open (DB name) |
| D-05 | Use `git mv` for folder renames | Accepted |
| D-06 | Lowercase `pulsebridge-*` for package and app identifiers, `PulseBridge` for classes and text | Accepted |
| D-07 | `Property` is replaced by `Clinic`, plus a separate `Doctor` collection | Accepted |
| D-08 | Fix existing bugs before domain changes, as a separate change | Superseded (bugs fixed during the domain migration, security fixes in their own commit) |
| D-09 | Hard GraphQL renames with coordinated frontend release (no alias layer) | Accepted |
| D-10 | Extract shared `libs/common` for api + batch | Proposed |
| D-11 | Minimal JWT payload | Proposed |
| D-12 | Healthcare compliance baseline (audit, logging, verification) | Proposed |
| D-13 | Socket chat → per-appointment rooms, stored messages | Proposed |
| D-14 | Don't fix the broken ESLint setup inside the rename change | Accepted |
| D-15 | Add a `typecheck` npm script | Accepted |
| D-16 | Roles PATIENT/DOCTOR/CLINIC/ADMIN with ownership-based permissions | Accepted |
| D-17 | Like/view/comment counters and rank live on `doctors` and `clinics` | Accepted |
| D-18 | Existing Nestar property data is deleted by the migration script | Accepted |
| D-19 | Enum values kept: `CommentStatus.DELETE` (+ `BLOCK`), `NotificationStatus.WAIT` | Accepted |
| D-20 | JWT secret loaded through `ConfigService` (`registerAsync`) | Accepted |

---

### D-01: Phased migration, rename layer first
- **Decision:** Phase 0 renames project and app identifiers only. Domain changes (roles, Property → Clinic, appointments) come in later phases that can each be verified and committed on their own.
- **Why:** A rename touches ~90 files but carries no behaviour risk. Mixing it with domain changes would make review and bisecting much harder.
- **Risks:** For a while the code is half migrated: PulseBridge names on top of real-estate domain code, which can confuse contributors.
- **Alternatives:** A big-bang rewrite (rejected: high risk, no working checkpoints) or a fresh NestJS project with code copied in (rejected: loses git history).

### D-02: Freeze the GraphQL contract in Phase 0
- **Decision:** No resolver method, `@ObjectType`, `@InputType` or `registerEnumType` name changes during the rename.
- **Why:** The existing Next.js frontend keeps working without changes, and the generated schema stays byte-for-byte identical.
- **Risks:** Real-estate names (`getProperties`, `AGENT`) stay in the public API until Phase 3/4.
- **Alternatives:** Rename the contract at the same time (rejected: would break the frontend immediately).

### D-03: Keep Mongo model and collection names in Phase 0
- **Decision:** `members`, `properties`, `boardArticles`, `comments`, `likes`, `views`, `follows`, `notices` and `notifications` stay as they are.
- **Why:** Collection renames need a data migration and changes to hard-coded `$lookup.from` strings (`libs/config.ts`, `like.service.ts`, `view.service.ts`).
- **Risks:** None in Phase 0. Phase 4 must rename the collection and every `$lookup` that refers to it at the same time.
- **Alternatives:** Rename now (rejected: data risk).

### D-04: `.env` keys stay; database name rename is the owner's call
- **Facts:** The keys `PORT_API`, `PORT_BATCH`, `MONGO_DEV`, `MONGO_PROD` and `SECRET_TOKEN` contain no "Nestar". The `MONGO_DEV` and `MONGO_PROD` *values* contain `Nestar`, most likely the database name.
- **Decision:** Keys unchanged. The automated edit of the URI values was blocked by tool permissions, so it is left to the owner.
- **Why:** Renaming the DB segment points the app at a new, empty database. Existing data is not lost, but it becomes invisible to the app.
- **Risks:** If the owner renames it without copying data, the app appears empty. If it isn't renamed, the database is still branded Nestar.
- **Alternatives:** (a) Keep the DB name until a planned `mongodump`/`mongorestore` copy (recommended). (b) Rename now and start fresh. (c) Add a `PULSEBRIDGE_` prefix to the keys (rejected: breaks every deployment environment for no functional gain).

### D-05: `git mv` for the folder renames
- **Why:** Git records the moves as renames (`R` status), so `git log --follow` and blame keep working.
- **Alternatives:** Delete and re-create the files (rejected: loses history).

### D-06: Casing convention
- **Decision:** Lowercase kebab-case for the npm package (`pulsebridge`, required by npm), app folders and Nest project keys (`pulsebridge-api`). PascalCase `PulseBridge` for classes (`PulseBridgeBatchModule`) and user-facing text.
- **Risks:** The repo folder itself is `pulseBridge` (camelCase) and is outside this convention.

### D-07: `Property` → `Clinic` or `DoctorService`
- **Status:** Accepted (2026-10-04). The owner's ERD has both `clinics` and `doctors`: a clinic is owned by one `CLINIC` member (`clinics.memberId`, unique), a doctor record links a member to one clinic (`doctors.memberId` unique, `doctors.clinicId`). Property is removed. The analysis below is kept for history.
- **Option A, `Clinic`:** An organisation-level listing with location, specialties and fee. Fits the existing location, image and like/view model. Doctors belong to clinics.
- **Option B, `DoctorService`:** A per-doctor offering (e.g. "Dermatology consultation, 30 min, ₩30,000"). Closer to how the current `Property` is owned by one `AGENT`.
- **Trade-off:** In the current data model `Property.memberId` is the agent who owns it. With Clinic, a doctor-to-clinic relationship is needed (possibly many-to-many). With DoctorService, the ownership model stays as it is.
- **Recommendation:** Decide before Phase 4. If unsure, choose DoctorService first because it's a straight replacement, and add Clinic later as a parent entity.

### D-08: Fix existing bugs before domain changes, as their own change
- **Why:** Bugs fixed in Nestar code are easier to review than the same bugs inside renamed or reshaped code, and Phase 0 had to keep behaviour identical.
- **Risk:** The plaintext password logging in `signup` is live until the fix lands, so it is the highest priority.

### D-09: Hard GraphQL renames with a coordinated release
- **Decision:** In Phases 3–4, rename operations and types outright (e.g. `getAgents` → `getDoctors`) and ship the frontend change at the same time.
- **Why:** There is one first-party client and no external API consumers. An alias or deprecation layer would double the resolver code.
- **Alternatives:** Keep the old operations with `@deprecated` for one release (worth doing if a mobile app or a separately deployed frontend exists).

### D-10: Shared `libs/common`
- **Why:** `pulsebridge-batch` imports schemas, DTOs and enums straight from `apps/pulsebridge-api/src/...`, which couples the two apps and broke on the folder rename (fixed in Phase 0).
- **Plan:** Run `nest g library common` and add a `@app/common` path alias in `tsconfig.json` (`paths` is currently `{}`).

### D-11: Minimal JWT payload
- **Why:** `AuthService.createToken` copies the whole member document into the token. In healthcare that could expose personal or health data to any client or log that decodes it.
- **Plan:** Payload `{ _id, memberType, memberStatus }`; load the profile when needed. Consider shorter access tokens plus refresh tokens instead of the current 30 days.

### D-12: Compliance baseline
- **Scope:** An audit log for appointment and medical-data access, removing the `console.log` calls that print request inputs, encrypting sensitive free-text fields, an admin verification step for doctors (anyone can currently sign up as `AGENT`), and consent tracking.
- **Why:** Regulations such as Korea's PIPA and HIPAA (depending on market) expect these controls.

### D-13: Consultation chat redesign
- **Current:** One global room. The last 5 messages are kept in memory and sent to every connected client, guests included.
- **Target:** Authenticated rooms keyed by `appointmentId`, messages stored in the database, and only participants allowed in.
- **Alternative:** Move to Socket.IO rooms. `@nestjs/platform-socket.io` is already a dependency but unused.

### D-14: Don't fix ESLint inside the rename change
- **Facts:** Lint crashed *before* the rename with `TypeError … no-unused-expressions … allowShortCircuit`. `eslint.config.mjs` imports `typescript-eslint`, `@eslint/js` and `globals`, which are not in `package.json`. They resolve from a stray `C:\Users\abdum\node_modules` that doesn't match the project's ESLint 8.57.
- **Decision:** Leave it alone and fix it separately (NEXT_STEPS).

### D-15: `typecheck` script
- **Decision:** Add `npm run typecheck`, which runs `tsc --noEmit` against both `tsconfig.app.json` files.
- **Why:** It's a quick check that doesn't emit files and doesn't depend on the broken lint setup.

### D-16: Roles and ownership-based permissions
- **Decision:** `MemberType` is `PATIENT | DOCTOR | CLINIC | ADMIN` (replaces `USER | AGENT | ADMIN`; supersedes the old AGENTS.md rule "keep USER"). `memberType` only picks the account kind. What a member may do is checked against ownership: clinic owner = `clinics.memberId`, doctor = a `doctors` record with `memberId`.
- **Flow:** a CLINIC member creates one clinic, then adds DOCTOR members (or himself) as doctors. A doctor cannot attach himself to a clinic. Patients book; doctor or clinic owner completes/cancels; patient cancels.
- **Why:** One person can be both clinic owner and doctor without a new role or table.
- **Later:** clinic managers can be added as `clinics.clinicManagers: [memberId]` with an `owner || manager` check. Doctor approval can be `doctors.doctorStatus`.

### D-17: Counters on doctors and clinics
- **Decision:** `doctorLikes/Views/Comments/Rank` and `clinicLikes/Views/Comments/Rank` are added on top of the ERD.
- **Why:** Sorting lists and the batch ranking need them, and it keeps the existing `*StatsEditor` pattern.

### D-18: Nestar data migration
- **Decision:** `scripts/migrate-nestar-to-pulsebridge.js` maps USER→PATIENT, AGENT→DOCTOR, renames `boardArticles`→`articles`, and deletes `properties` plus all PROPERTY/MEMBER likes, views and comments. Dry run by default; `--apply` changes data.
- **Risk:** Destructive. Take a `mongodump` first. Former agents become DOCTOR members without a `doctors` record until a clinic adds them.

### D-19: Enum values kept by owner request
- `CommentStatus` = `ACTIVE | BLOCK | DELETE` (BLOCK is admin only). `NotificationStatus` = `WAIT | READ`. `NotificationGroup` additionally has `MEMBER`, used for FOLLOW notifications; like/view/comment groups do not have it.

### D-20: JWT secret through ConfigService
- **Facts:** `JwtModule.register({ secret: process.env.SECRET_TOKEN })` ran when `auth.module.ts` was imported, before `ConfigModule.forRoot()` loaded `.env`, so tokens were signed with the string `"undefined"` and could be forged.
- **Decision:** `JwtModule.registerAsync` with `ConfigService.getOrThrow('SECRET_TOKEN')`.
- **Impact:** All tokens issued before the change are invalid; users log in again.
