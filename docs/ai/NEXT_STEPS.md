# Next Steps: Nestar → PulseBridge

Priority: **P0** = do first, blocks or is a security issue · **P1** = this phase · **P2** = later.

## 0. Close out Phase 0 (≈30 min)

| Pri | Task | Command / detail | Done when |
|---|---|---|---|
| P0 | Run the post-rename checks | `npm run typecheck`, `npx nest build pulsebridge-api`, `npx nest build pulsebridge-batch` | All exit 0; record the result in COMPLETED_TASKS §3 |
| P0 | Decide on the `.env` DB name (D-04) | Keep `Nestar`, or `mongodump` → `mongorestore` into `PulseBridge`, then edit the URIs | Decision recorded in DECISIONS D-04 |
| P0 | Update deployment configs outside the repo | PM2, Docker or CI paths → `dist/apps/pulsebridge-*/main` | Deploy succeeds |
| P1 | Commit `docs/` | `git add docs && git commit -m "docs: add migration documentation"` | |

## 1. Backend cleanup (Phase 1: bug fixes, no contract change)

| Pri | Task | Location |
|---|---|---|
| P0 | Remove the plaintext password log in `signup` (`console.log("input: ", input)`) | `components/member/member.resolver.ts` |
| P0 | Path traversal: whitelist the upload `target` (`member`, `property`, `article`) | `member.resolver.ts` `imageUploader`, `imagesUploader` |
| P0 | Escape user text before `new RegExp` (ReDoS) | `property.service.ts` `shapeMatchQuery`; `member.service.ts` `getAgents`, `getAllMembersByAdmin`; board-article search |
| P0 | Check JWT secret load order; switch to `JwtModule.registerAsync` with `ConfigService` | `components/auth/auth.module.ts` |
| P1 | `batchTopAgents`: `await` `find()`, write `memberRank` (not `propertyRank`); use `findByIdAndUpdate` in both batch jobs | `apps/pulsebridge-batch/src/batch.service.ts` |
| P1 | Save `soldAt`/`deletedAt` by assigning them to `input` | `property.service.ts` `updateProperty`, `updatePropertyByAdmin` |
| P1 | Admin location filter: `match.propertyLocation = { $in: propertyLocationList }` | `property.service.ts` `getAllPropertiesByAdmin` |
| P1 | `removeCommentByAdmin`: `findOneAndDelete({ _id: input })` | `comment.service.ts` |
| P1 | `Like.model.ts`: `enum: LikeGroup` | `schemas/Like.model.ts` |
| P1 | `checkAuthRoles`: `@UseGuards(RolesGuard)` | `member.resolver.ts` |
| P1 | Fix ESLint: add `typescript-eslint`, `@eslint/js` and `globals` as devDependencies matching ESLint, or go back to `.eslintrc` for ESLint 8. Remove the stray `C:\Users\abdum\node_modules` from the resolution path | `package.json`, `eslint.config.mjs` |
| P2 | Make `start:prod` work across platforms (`cross-env NODE_ENV=production`) | `package.json` |
| P2 | Extract `libs/common` (D-10) | `nest g library common`; `tsconfig.json` `paths` |

## 2. Backend domain migration (Phases 3–7)

| Pri | Task | Depends on |
|---|---|---|
| P0 | Decide D-07 (Clinic vs DoctorService) | — |
| P1 | Phase 3: `MemberType` → PATIENT/DOCTOR/ADMIN, doctor fields, minimal JWT payload (D-11), data migration for `members.memberType` | Phase 1 |
| P1 | Phase 4: Property → Clinic (schema, DTOs, resolver, enums, sort lists, `$lookup.from`, Like/View/Comment groups, batch) plus a collection migration script | D-07, Phase 3 |
| P2 | Phase 5: Appointment, DoctorSchedule, Notification and Notice modules, Review | Phase 4 |
| P2 | Phase 6: per-appointment socket rooms with stored messages (D-13) | Phase 5 |
| P2 | Phase 7: batch top doctors, reminders, no-shows | Phase 5 |
| P2 | Compliance baseline (D-12): audit log, logging cleanup, doctor verification | Phase 3 |

## 3. Frontend migration

| Pri | Task | Ref |
|---|---|---|
| P1 | Open the Next.js repo and fill in the inventory (FRONTEND_MIGRATION §2 step 1); check the expected page/component names in §3 | — |
| P1 | Branding-only rename (step 2); can ship now because the backend contract is unchanged | — |
| P2 | Move UI copy to i18n keys (step 3) | — |
| P2 | Type and Apollo document renames (steps 4–5), released together with backend Phases 3–4 | D-09 |
| P2 | Appointment booking and consultation UI (steps 7–8) | Phases 5–6 |

## 4. Testing

| Pri | Task |
|---|---|
| P1 | Fix the e2e specs: they expect `'Hello World!'` but get the welcome text; set the expected text to `Welcome to PulseBridge …` |
| P1 | Add a GraphQL schema snapshot test (print the schema and compare it with a committed `schema.gql`) so contract changes are noticed |
| P1 | Unit tests for every Phase 1 bug fix (one regression test each) |
| P2 | e2e tests: signup/login, getProperties paging, like toggle, comment counter, admin removal |
| P2 | Data migration dry-run tests against a copy of the database (Phases 3–4) |

## 5. Documentation

| Pri | Task |
|---|---|
| P1 | Replace the NestJS boilerplate `README.md` with PulseBridge setup, env keys, scripts and app layout |
| P1 | Expand `AGENTS.md`: conventions (module/resolver/service/DTO layout, guards, `$facet` pagination, stats editors), phase rules, "no contract change without updating docs" |
| P1 | Fill in `SKILLS.md` with repeatable workflows (rename layer, add a domain module, data migration) |
| P2 | Add a committed `.env.example` with key names only |
| Ongoing | After each phase, update BACKEND_MIGRATION, COMPLETED_TASKS and DECISIONS |
