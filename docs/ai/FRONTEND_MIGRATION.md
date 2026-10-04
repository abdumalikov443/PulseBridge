# Frontend Migration Plan: Nestar Next.js → PulseBridge

> **Source note:** The Next.js frontend repository was not available in this session. The GraphQL names below come from the backend resolvers and DTOs (authoritative). Page and component names follow the usual Nestar frontend layout and are marked **verify**; check them against the actual frontend repo before editing.

## 1. Preconditions

| # | Precondition | Why |
|---|---|---|
| 1 | Backend Phase 0 deployed (no contract change) | The frontend can do its branding rename at any time |
| 2 | D-07 decided (Clinic vs DoctorService) | Decides every `property*` rename in the frontend |
| 3 | Backend Phases 3–4 on a branch with a published schema | The frontend switches operations in step 5 |
| 4 | Lint/typecheck working in the frontend repo | Renames must be checked by the compiler, not only by search |

## 2. Step-by-step plan

| Step | Work | Contract dependency | Output |
|---|---|---|---|
| 1 | **Inventory:** list `pages/`, `libs/components/`, `apollo/user/query.ts`, `apollo/user/mutation.ts`, `apollo/admin/*`, `libs/enums/*`, `libs/types/*`, i18n files. Produce a grep count of `property`, `agent`, `nestar` | none | Inventory table (fill in §3) |
| 2 | **Branding only:** app name, `<title>`, logo, favicon, footer, meta tags, `package.json` name, env labels (`NEXT_PUBLIC_*` values that mention Nestar) | none | Deployable, same behaviour |
| 3 | **UI wording behind i18n keys:** replace hard-coded real-estate strings with keys; still pointing at the old API | none | Copy changes can ship separately |
| 4 | **Type layer:** copy the new enums (`MemberType`, `ClinicSpecialty`, `ClinicStatus`, `ClinicLocation`, groups) into `libs/enums`; mirror the new DTOs in `libs/types` | Phase 3–4 schema | Compiles against the new types |
| 5 | **Apollo documents:** rename queries and mutations (§4), update field selections (§5) | Phase 3–4 deployed | All documents validate against the new schema (`graphql-codegen` or Apollo's schema check) |
| 6 | **Pages and routes:** rename routes and components (§3); add redirects from old routes | step 5 | Old URLs still work for one release |
| 7 | **New features:** booking flow, doctor schedule editor, appointment list, consultation chat | Phases 5–6 | New pages |
| 8 | **WebSocket client:** connect with `?token=` and join an appointment room instead of the global chat | Phase 6 | |
| 9 | **Admin panel:** members (role filter PATIENT/DOCTOR, doctor verification), clinics, community, notices | Phases 3–5 | |
| 10 | **Regression pass:** auth, list/detail, like/view/follow, comments/reviews, uploads, admin | all | Test checklist signed off |

## 3. Page / component mapping (verify)

| Nestar route (expected) | PulseBridge route | Nestar component(s) (expected) | PulseBridge component(s) | Notes |
|---|---|---|---|---|
| `/` | `/` | `TopProperties`, `TrendProperties`, `PopularProperties`, `TopAgents`, `CommunityBoards`, `Events` | `TopClinics`, `TrendClinics`, `PopularClinics`, `TopDoctors`, `CommunityBoards`, `HealthEvents` | Home sections |
| `/property` | `/clinic` (or `/doctors`, see D-07) | `PropertyCard`, `Filter` | `ClinicCard`, `ClinicFilter` | Filters: specialty, location, fee range. Remove beds/rooms/square/barter/rent |
| `/property/detail?id=` | `/clinic/detail?id=` | `PropertyBigCard`, review block | `ClinicDetail`, `DoctorList`, `ReviewList`, **`BookAppointmentButton`** | |
| `/agent` | `/doctor` | `AgentCard` | `DoctorCard` | Uses `getDoctors` |
| `/agent/detail?agentId=` | `/doctor/detail?doctorId=` | agent profile + properties | doctor profile + specialties + schedule + reviews | |
| `/mypage` → My Properties / Add Property | `/mypage` → My Clinics / Add Clinic (DOCTOR only) | `MyProperties`, `AddProperty` | `MyClinics`, `AddClinic`, **`MySchedule`** | |
| `/mypage` → My Favorites / Recently Visited | same | `MyFavorites`, `RecentlyVisited` | same, clinic cards | `getFavorites`, `getVisited` |
| `/mypage` → Followers / Followings | same | `MemberFollowers`, `MemberFollowings` | same | No contract change |
| `/mypage` → My Articles / Write Article | same | `MyArticles`, `WriteArticle` | same | New categories |
| — | `/mypage/appointments` | — | **`AppointmentList`**, **`AppointmentDetail`** | New |
| `/community`, `/community/detail` | same | `CommunityCard`, `CommunityDetail` | same | Categories FREE/QNA/HEALTH_TIPS/NEWS |
| `/cs` (FAQ / Notice / Inquiry) | same | `Notice`, `Faq` | same | Backend Notice module is new (Phase 5) |
| `/account/join` | same | `Join` | `Join` with role picker PATIENT/DOCTOR and doctor fields | Doctors start unverified |
| `/_admin/users` | same | `MemberPanelList` | same + verify-doctor action | |
| `/_admin/properties` | `/_admin/clinics` | `PropertyPanelList` | `ClinicPanelList` | |
| `/_admin/community`, `/_admin/cs/*` | same | | | |
| global chat widget | consultation chat (inside appointment) | `Chat` | `ConsultationChat` | Phase 6 |

## 4. GraphQL operation rename plan

Status: **planned**. Every operation below exists unchanged in the backend today. Names assume D-07 = Clinic; with DoctorService, substitute `DoctorService` / `doctorServices`.

### 4.1 Queries

| Current | Planned | Guard | Change type |
|---|---|---|---|
| `getProperty(propertyId)` | `getClinic(clinicId)` | Without | rename + arg |
| `getProperties(input: PropertiesInquiry)` | `getClinics(input: ClinicsInquiry)` | Without | rename + input shape |
| `getFavorites(input: OrdinaryInquiry)` | `getFavorites` (returns `Clinics`) | Auth | return type |
| `getVisited(input: OrdinaryInquiry)` | `getVisited` (returns `Clinics`) | Auth | return type |
| `getAgentProperties(input: AgentPropertiesInquiry)` | `getDoctorClinics(input: DoctorClinicsInquiry)` | Roles DOCTOR | rename |
| `getAllPropertiesByAdmin(input: AllPropertiesInquiry)` | `getAllClinicsByAdmin(input: AllClinicsInquiry)` | Roles ADMIN | rename |
| `getAgents(input: AgentsInquiry)` | `getDoctors(input: DoctorsInquiry)` | Without | rename |
| `getMember`, `getAllMembersByAdmin`, `checkAuth`, `checkAuthRoles` | unchanged | | `memberType` values change |
| `getBoardArticle(s)`, `getAllBoardArticlesByAdmin` | unchanged | | category values change |
| `getComments` | unchanged (or `getReviews`) | | `commentGroup` value change |
| `getMemberFollowings`, `getMemberFollowers` | unchanged | | |
| — | `getAppointments`, `getAppointment`, `getDoctorSchedule`, `getNotifications`, `getNotices` | | **new** |

### 4.2 Mutations

| Current | Planned | Guard | Change type |
|---|---|---|---|
| `createProperty(input: PropertyInput)` | `createClinic(input: ClinicInput)` | Roles DOCTOR | rename |
| `updateProperty(input: PropertyUpdate)` | `updateClinic(input: ClinicUpdate)` | Roles DOCTOR | rename |
| `likeTargetProperty(propertyId)` | `likeTargetClinic(clinicId)` | Auth | rename |
| `updatePropertyByAdmin` | `updateClinicByAdmin` | ADMIN | rename |
| `removePropertyByAdmin(propertyId)` | `removeClinicByAdmin(clinicId)` | ADMIN | rename |
| `signup(input: MemberInput)` | unchanged | | input gets `memberType` PATIENT/DOCTOR and doctor fields |
| `login`, `updateMember`, `likeTargetMember`, `updateMemberByAdmin` | unchanged | | |
| `imageUploader(file, target)`, `imagesUploader(files, target)` | unchanged | | `target` becomes a whitelist (`member`, `clinic`, `article`) |
| `createBoardArticle`, `updateBoardArticle`, `likeTargetBoardArticle`, `*ByAdmin` | unchanged | | |
| `createComment`, `updateComment`, `removeCommentByAdmin` | unchanged (or `createReview` with `rating`) | | |
| `subscribe`, `unsubscribe` | unchanged | | |
| — | `createAppointment`, `cancelAppointment`, `confirmAppointment`, `completeAppointment`, `updateDoctorSchedule`, `verifyDoctorByAdmin`, `readNotification` | | **new** |

## 5. Type, enum and field rename plan

| Kind | Current | Planned |
|---|---|---|
| ObjectType | `Property`, `Properties` | `Clinic`, `Clinics` |
| InputType | `PropertyInput`, `PropertyUpdate`, `PropertiesInquiry`, `PISearch`, `AgentPropertiesInquiry`, `APISearch`, `AllPropertiesInquiry`, `ALPISearch`, `PricesRange`, `SquaresRange` | `ClinicInput`, `ClinicUpdate`, `ClinicsInquiry`, `CISearch`, `DoctorClinicsInquiry`, `DCISearch`, `AllClinicsInquiry`, `ACISearch`, `FeesRange`, *(removed)* |
| InputType | `AgentsInquiry` | `DoctorsInquiry` |
| Enum | `MemberType { USER, AGENT, ADMIN }` | `MemberType { PATIENT, DOCTOR, ADMIN }` |
| Enum | `PropertyType`, `PropertyStatus { ACTIVE, SOLD, DELETE }`, `PropertyLocation` | `ClinicSpecialty`, `ClinicStatus { ACTIVE, CLOSED, DELETE }`, `ClinicLocation` |
| Enum | `LikeGroup/ViewGroup/CommentGroup/NotificationGroup .PROPERTY` | `.CLINIC` |
| Enum | `BoardArticleCategory { FREE, RECOMMEND, NEWS, HUMOR }` | `{ FREE, QNA, HEALTH_TIPS, NEWS }` |
| Field | `propertyTitle/Price/Address/Images/Desc/Views/Likes/Comments/Rank` | `clinicTitle/ConsultationFee/Address/Images/Desc/Views/Likes/Comments/Rank` |
| Field | `propertySquare/Beds/Rooms/Barter/Rent`, `constructedAt`, `soldAt` | removed; `closedAt` |
| Field | `memberProperties` | `memberClinics` |
| Field | aggregation aliases `favoriteProperty`, `visitedProperty` | `favoriteClinic`, `visitedClinic` |
| Sort keys | `propertyLikes/Views/Rank/Price` | `clinicLikes/Views/Rank/ConsultationFee` |
| Filter option | `availableOptions: propertyBarter, propertyRent` | removed (or `acceptsInsurance`, `onlineConsultation`) |

## 6. UI terminology changes

| Nestar term | PulseBridge term |
|---|---|
| Nestar | PulseBridge |
| Property / Properties / Listing | Clinic(s) (or Service(s), per D-07) |
| Agent / Realtor | Doctor |
| User / Member (end user) | Patient |
| Price | Consultation fee |
| Property type (Apartment/Villa/House) | Specialty |
| Sold | Closed |
| Location | Location (unchanged) |
| Beds / Rooms / Square | — (removed) |
| Barter / Rent | — (removed) or Insurance / Online consultation |
| Add Property | Register Clinic |
| My Properties | My Clinics |
| Top Agents | Top Doctors |
| Recently Visited | Recently Viewed |
| Favorites | Saved Clinics / Saved Doctors |
| Comment (on property/agent) | Review |
| Community categories Free/Recommend/News/Humor | Free / Q&A / Health Tips / News |
| Chat | Consultation |
| — | Appointment, Book, Reschedule, Cancel, Available slots |
