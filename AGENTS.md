# PulseBridge Backend Agent Instruction

PulseBridge is a NestJS GraphQL monorepo migrated from a real-estate platform (Nestar) into a healthcare platform: patients find clinics and doctors, book appointments and read health articles.

## Project Shape

- Backend apps are `pulsebridge-api` and `pulsebridge-batch`.
- Keep the existing NestJS resolver/service/module pattern based on MVC and DI.
- Keep DTOs, enums, schemas under `apps/pulsebridge-api/src/libs`.
- Keep shared modules reusable: auth, member, like, view, comment, follow, article, notification, socket.
- Domain modules: clinic, doctor, appointment.

## Domain Rules

- Do not reintroduce property or real-estate fields.
- `MemberType` is `PATIENT | DOCTOR | CLINIC | ADMIN`. `ADMIN` cannot be chosen at signup, and members cannot change their own type or status.
- Permissions come from ownership, not only from `memberType`:
  - clinic owner = `clinics.memberId` (1 member = 1 clinic)
  - doctor = a `doctors` profile created at DOCTOR signup (`clinicId` null). It joins a clinic via `clinicJoinRequests` (PENDING → the clinic owner APPROVED/REJECTED); removal sets `clinicId` back to null. Only doctors with a clinic are public, bookable or likeable
  - appointment: the patient cancels; the doctor or clinic owner completes or cancels (`appointment.policy.ts`)
- Member = account, Clinic/Doctor = profile: `memberType` is required at signup and CLINIC/DOCTOR send `clinicProfile`/`doctorProfile` in the same signup. One account = one role (a clinic owner is not a doctor).
- Like/View/Comment groups are `DOCTOR | CLINIC | ARTICLE`. `*RefId` points to `doctors._id`, `clinics._id` or `articles._id`.
- Escape user text before `$regex` with `shapeIntoSearchRegex` (`libs/config.ts`).

## Workflow

1. Analyze before editing.
2. Keep changes small and consistent with existing project patterns.
3. Do not remove working logic unless it is replaced safely.
4. Add or update focused tests when behavior changes.

## Validation

Use these checks for backend work:

```bash
npx tsc -p apps/pulsebridge-api/tsconfig.app.json --noEmit
npx tsc -p apps/pulsebridge-batch/tsconfig.app.json --noEmit
npm run build
npx nest build pulsebridge-batch
npx jest
```

`npm run lint` runs ESLint with `--fix`, so use it only when file rewriting is acceptable!
