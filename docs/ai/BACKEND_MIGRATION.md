# Backend Migration: Nestar → PulseBridge

> Status as of 2026-10-04 · branch `modification` · last migration commit `631ec51`
> Phase completed: **Phase 0 (identifier rename)**. Domain logic is still real estate.

## 1. Original project: Nestar

Nestar is a real-estate listing platform: agents publish properties, users browse, like, comment and follow, and admins moderate.

| Aspect | Value |
|---|---|
| Framework | NestJS 10 monorepo (`nest-cli.json` → `monorepo: true`) |
| API style | GraphQL, code-first (`@nestjs/graphql` 12 + Apollo Server 4, `autoSchemaFile: true`) |
| Realtime | Raw WebSocket (`@nestjs/platform-ws`, `WsAdapter`) with a single public chat room |
| Database | MongoDB via Mongoose 8, URI from `MONGO_DEV` / `MONGO_PROD` |
| Auth | JWT (`@nestjs/jwt`, 30d expiry, secret `SECRET_TOKEN`), bcryptjs password hashing |
| Uploads | `graphql-upload` 13, written to local `./uploads/<target>/`, served statically at `/uploads` |
| Scheduler | Separate app using `@nestjs/schedule` cron jobs for ranking |
| Apps | `nestar-api` (port `PORT_API`), `nestar-batch` (port `PORT_BATCH`) |

## 2. New project: PulseBridge

PulseBridge is a healthcare platform: patients find doctors and clinics, book appointments, consult over chat and read health content. It reuses the Nestar engine (auth, engagement, community, admin, batch) and replaces the real-estate domain.

| Aspect | Target |
|---|---|
| Apps | `pulsebridge-api`, `pulsebridge-batch` (**done**) |
| Roles | `PATIENT` / `DOCTOR` / `ADMIN` (planned; currently `USER` / `AGENT` / `ADMIN`) |
| Core listing entity | `Clinic` (working name, see DECISIONS D-07; currently `Property`) |
| New entities | `Appointment`, `DoctorSchedule`, `Review` (planned) |
| Realtime | Authenticated per-appointment consultation rooms with stored messages (planned) |
| Compliance | Smaller JWT payload, audit log, less sensitive data in logs (planned) |

## 3. Backend migration goal

Convert the backend in **phases that can each be verified and committed on their own**, so that each step either:
1. changes names only (no behaviour change), or
2. changes one domain area behind a clear GraphQL contract change that is documented here and in `FRONTEND_MIGRATION.md`.

Phase plan:

| Phase | Scope | Status |
|---|---|---|
| 0 | Rename project/app identifiers Nestar → PulseBridge | ✅ Done (`631ec51`) |
| 1 | Fix existing bugs (see §8) without contract changes | ⏳ Next |
| 2 | Extract shared `libs/common` (schemas, enums, DTOs) for api + batch | ⏳ |
| 3 | Member roles → PATIENT/DOCTOR/ADMIN, doctor profile, smaller JWT payload | ⏳ |
| 4 | Property → Clinic (schema, DTOs, resolvers, enums, sorts) | ⏳ |
| 5 | Appointment + DoctorSchedule + Notification wiring | ⏳ |
| 6 | Socket → per-appointment consultation rooms | ⏳ |
| 7 | Batch → top doctors, reminders, no-show handling | ⏳ |

## 4. Naming changes

### 4.1 Completed (Phase 0)

| Location | Before | After |
|---|---|---|
| App folder | `apps/nestar-api` | `apps/pulsebridge-api` |
| App folder | `apps/nestar-batch` | `apps/pulsebridge-batch` |
| `package.json` / `package-lock.json` `name` | `nestar` | `pulsebridge` |
| `nest-cli.json` project keys | `nestar-api`, `nestar-batch` | `pulsebridge-api`, `pulsebridge-batch` |
| `nest-cli.json` root/sourceRoot/tsConfigPath | `apps/nestar-*` | `apps/pulsebridge-*` |
| Build `outDir` | `dist/apps/nestar-*` | `dist/apps/pulsebridge-*` |
| npm scripts | `start:dev:batch`, `start:prod`, `start:prod:batch`, `test:e2e` | paths/projects updated; added `typecheck` |
| Batch root module class | `NestarBatchModule` | `PulseBridgeBatchModule` |
| Absolute imports | `apps/nestar-api/src/...` | `apps/pulsebridge-api/src/...` |
| `GET /` text (api) | `Welcome to Nestar API Backend Server!` | `Welcome to PulseBridge API Backend Server!` |
| `GET /` text (batch) | `Welcome to Nestar BATCH Server!` | `Welcome to PulseBridge BATCH Server!` |

### 4.2 Not renamed on purpose

| Item | Reason |
|---|---|
| `.env` keys (`PORT_API`, `PORT_BATCH`, `MONGO_DEV`, `MONGO_PROD`, `SECRET_TOKEN`) | They contain no "Nestar"; renaming them would break existing deployments |
| `.env` Mongo URI values (contain `Nestar`, likely the DB name) | Changing them points the app at a new, empty database. The edit was blocked by tool permissions and left to the owner (D-04) |
| Batch cron names `BATCH_ROLLBACK`, `BATCH_TOP_PROPERTIES`, `BATCH_TOP_AGENTS` | Brand-neutral; they change with the domain in Phase 7 |
| All GraphQL operations, types and enums | Contract freeze for Phase 0 (D-02) |
| Mongoose model names and collections | Data compatibility (D-03) |

### 4.3 Planned domain renames (Phases 3–4)

| Current | Planned | Notes |
|---|---|---|
| `MemberType.USER` | `MemberType.PATIENT` | Needs a data migration for existing `members.memberType` |
| `MemberType.AGENT` | `MemberType.DOCTOR` | Add `doctorSpecialty`, `doctorLicenseNo`, `doctorVerified`, `doctorExperience` |
| `Property*` (class, DTOs, enums, fields `property*`) | `Clinic*` (`clinic*`) | Pending D-07 (Clinic vs DoctorService) |
| `PropertyType` (APARTMENT/VILLA/HOUSE) | `ClinicSpecialty` / `MedicalSpecialty` | e.g. GENERAL, PEDIATRICS, DERMATOLOGY, DENTAL, … |
| `PropertyStatus.SOLD` | `ClinicStatus.CLOSED` (or `PAUSED`) | `soldAt` → `closedAt` |
| `PropertyLocation` | `ClinicLocation` | Same Korean city values; keep them |
| `propertyPrice` | `clinicConsultationFee` | |
| `propertySquare/Beds/Rooms/Barter/Rent` | removed | No healthcare equivalent |
| `memberProperties` counter | `memberClinics` | |
| `BoardArticleCategory` FREE/RECOMMEND/NEWS/HUMOR | FREE/QNA/HEALTH_TIPS/NEWS | |
| `getAgents` / `AgentsInquiry` | `getDoctors` / `DoctorsInquiry` | |

## 5. Module changes

### 5.1 Current module graph (unchanged by Phase 0)

```
AppModule
├── ConfigModule.forRoot()
├── GraphQLModule (Apollo, autoSchemaFile)
├── DatabaseModule (MongooseModule.forRootAsync)
├── SocketModule → SocketGateway (ws)
└── ComponentsModule
    ├── AuthModule (JwtModule, HttpModule) — exports AuthService
    ├── MemberModule    [Member, Follow]  → Auth, View, Like
    ├── PropertyModule  [Property]        → Auth, View, Member, Like
    ├── BoardArticleModule [BoardArticle]
    ├── CommentModule   [Comment]         → Member, Property, BoardArticle
    ├── LikeModule      [Like]
    ├── ViewModule      [View]
    └── FollowModule    [Follow]

PulseBridgeBatchModule (apps/pulsebridge-batch)
├── DatabaseModule, ConfigModule, ScheduleModule
└── MongooseModule.forFeature([Property, Member])  ← imports schemas from apps/pulsebridge-api/src
```

### 5.2 Planned module changes

| Module | Change | Phase |
|---|---|---|
| *(new)* `libs/common` | Shared schemas, enums, DTOs, `config.ts` lookups; batch stops importing from `apps/pulsebridge-api/src` | 2 |
| `PropertyModule` | → `ClinicModule` | 4 |
| *(new)* `AppointmentModule` | Booking lifecycle; depends on Member, Clinic, Notification | 5 |
| *(new)* `DoctorScheduleModule` | Availability slots | 5 |
| *(new)* `NotificationModule` | Registers the existing `Notification.model.ts` (currently dead) | 5 |
| *(new)* `NoticeModule` | Registers the existing `Notice.model.ts` (currently dead) | 5 |
| `CommentModule` | `Review` with rating, limited to patients with a completed appointment (or a separate `ReviewModule`) | 5 |
| `SocketModule` | Rooms keyed by appointment, messages stored in the database, guests not allowed | 6 |
| *(new)* `AuditModule` | Records reads and writes of appointment and medical data | 5–6 |

## 6. GraphQL changes

**Phase 0: none.** The generated schema is identical, because no resolver, DTO, `@ObjectType`, `@InputType` or `registerEnumType` name changed.

Current operations (contract baseline for the frontend):

| Domain | Queries | Mutations |
|---|---|---|
| Member | `checkAuth`, `checkAuthRoles`, `getMember`, `getAgents`, `getAllMembersByAdmin` | `signup`, `login`, `updateMember`, `likeTargetMember`, `updateMemberByAdmin`, `imageUploader`, `imagesUploader` |
| Property | `getProperty`, `getProperties`, `getFavorites`, `getVisited`, `getAgentProperties`, `getAllPropertiesByAdmin` | `createProperty`, `updateProperty`, `likeTargetProperty`, `updatePropertyByAdmin`, `removePropertyByAdmin` |
| BoardArticle | `getBoardArticle`, `getBoardArticles`, `getAllBoardArticlesByAdmin` | `createBoardArticle`, `updateBoardArticle`, `likeTargetBoardArticle`, `updateBoardArticleByAdmin`, `removeBoardArticleByAdmin` |
| Comment | `getComments` | `createComment`, `updateComment`, `removeCommentByAdmin` |
| Follow | `getMemberFollowings`, `getMemberFollowers` | `subscribe`, `unsubscribe` |
| App | `sayHello` | — |

The planned operation renames are listed in `FRONTEND_MIGRATION.md` §4. Breaking changes will be released together with the matching frontend change; no GraphQL aliasing layer is planned (D-09).

## 7. MongoDB collection / schema changes

**Phase 0: none.**

| Model name | Collection | Schema file | Registered? | Planned change |
|---|---|---|---|---|
| `Member` | `members` | `schemas/Member.model.ts` | ✅ | Role enum values; doctor fields; `memberProperties` → `memberClinics` |
| `Property` | `properties` | `schemas/Property.model.ts` | ✅ (api + batch) | → `Clinic` / `clinics` (migration script required) |
| `BoardArticle` | `boardArticles` | `schemas/BoardArticle.model.ts` | ✅ | Category enum values |
| `Comment` | `comments` | `schemas/Comment.model.ts` | ✅ | `CommentGroup.PROPERTY` → `CLINIC` |
| `Like` | `likes` | `schemas/Like.model.ts` | ✅ | Fix enum (uses `ViewGroup`, should use `LikeGroup`); group value rename |
| `View` | `views` | `schemas/View.model.ts` | ✅ | Group value rename |
| `Follow` | `follows` | `schemas/Follow.model.ts` | ✅ | none |
| `Notice` | `notices` | `schemas/Notice.model.ts` | ❌ (dead) | Register |
| `Notification` | `notifications` | `schemas/Notification.model.ts` | ❌ (dead) | Register; `propertyId` → `clinicId`; add `appointmentId`; new types |
| — | `appointments` | *(new)* | — | New |
| — | `doctorSchedules` | *(new)* | — | New |
| — | `auditLogs` | *(new)* | — | New |

Hard-coded collection names in `$lookup` must change together with any collection rename: `libs/config.ts` (`likes`, `follows`, `members`) and `like.service.ts` / `view.service.ts` (`properties`).

## 8. Compatibility notes

- **Runtime contract unchanged in Phase 0.** GraphQL schema, REST `GET /` route, WebSocket protocol, Mongo collections and env keys are all the same. The only visible difference is the welcome text returned by `GET /`.
- **Deployment paths changed.** Production start commands must use `dist/apps/pulsebridge-api/main` and `dist/apps/pulsebridge-batch/main`. Update any PM2 or Docker config outside the repo.
- **Nest CLI project names changed.** Use `nest start pulsebridge-batch` and `nest build pulsebridge-api`.
- **Leftover build output:** `dist/apps/nestar-*` is still on disk (untracked); the next `nest build` with `deleteOutDir` removes it.
- **`.env` database name:** the URIs still point at the `Nestar` database. This is intentional for data continuity until the owner decides on a DB rename plus data copy (D-04).
- **`start:prod` uses POSIX `NODE_ENV=production ...`**, which fails in Windows PowerShell or cmd. This existed before the migration and was not changed.
- **Existing bugs carried over unchanged** (Phase 0 kept behaviour identical on purpose). They are tracked in `NEXT_STEPS.md` §1:
  1. `signup` logs the plaintext password (`member.resolver.ts`).
  2. `batchTopAgents` doesn't await `find()` and writes `propertyRank` to members; both batch jobs use `findOneAndUpdate(_id, …)`.
  3. `soldAt` / `deletedAt` are never saved in `updateProperty` and `updatePropertyByAdmin`.
  4. `getAllPropertiesByAdmin` filters on a non-existent field, `propertyLocationList`.
  5. `removeCommentByAdmin` passes a bare ObjectId as the filter.
  6. `Like.model.ts` validates `likeGroup` with `ViewGroup`.
  7. Path traversal through the upload `target` argument.
  8. Unescaped user `RegExp` in search (ReDoS).
  9. `JwtModule.register` reads `SECRET_TOKEN` at import time, possibly before `ConfigModule` loads `.env` (needs checking).
  10. `@Roles` on `checkAuthRoles` has no effect because it's paired with `AuthGuard`.
