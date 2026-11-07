# Loan Request App — Project Rules

## Key References
- Architecture details: @docs/architecture.md
- API endpoints: @core/config/api_config.dart

---

## Architecture
- Pattern: MVVM + Repository
- State management: Provider (ChangeNotifier)
- Data flow is one direction only: View → ViewModel → Repository → Datasource → API
- Views never import Repository or Datasource directly
- Repositories never import anything from the presentation layer

## Navigation
- GoRouter only — always `context.go()` or `context.push()`
- Never `Navigator.push()` or `Navigator.pushNamed()`
- Exception: `Navigator.pushReplacement()` is allowed inside the loan form sub-flow only
- Route names defined in `AppRoutes`, paths in `AppPaths`

## ViewModels
- Always extend `ChangeNotifier`
- Always receive Repository via constructor injection — never instantiate inside
- Always use an enum for state: `{ idle, loading, success, error }`
- Always call `notifyListeners()` inside a private `_setState()` method only
- Never swallow exceptions silently — always log in catch block

## Models
- Decide for every model if `copyWith()` is needed
- Prefer `const` constructors
- JSON serialization via `json_serializable` — manual `fromJson` is fine for simple cases
- Always write a `.md` file explaining why the model was structured that way

## Datasources
- Every datasource must have an abstract interface first
- Concrete classes: `_remote_datasource` (Dio) and `_mock_datasource` (fake data)
- Repository depends on the abstract type, never the concrete class
- Must have abstract repository and `repository_impl`

## Feature Flags & Remote Config
- Two flag systems exist — do not mix their responsibilities:
  - **Backend `features/app_config`** (`GET /api/v1/customer/app-config/services`) — source of truth for per-service on/off toggles that ops controls. Fail-open.
  - **Firebase Remote Config** (`core/services/remote_config_service.dart`) — feature rollouts, kill-switches on new/risky features, and A/B experiments only. Never duplicate service toggles here.
- All RC keys live in `core/config/feature_flags.dart` as `FeatureFlagKeys` constants; every key MUST have a default in `kFeatureFlagDefaults`
- `RemoteConfigService` exposes typed getters only — never read raw string keys at call sites (same rule as `AnalyticsService` event names)
- Injected into ViewModels via constructor, like `AnalyticsService`
- RC values apply on next app launch — no in-session live updates; design flags to tolerate a stale first render

## Logging
- Never use `print()` or `debugPrint()` anywhere
- Always use `AppLogger` from `core/utils/logger.dart`
- `AppLogger.i()` info · `AppLogger.d()` debug · `AppLogger.w()` warning · `AppLogger.e()` error

## Dependency Injection
- All providers wired in `main.dart` using `MultiProvider`
- No ViewModel or Repository creates its own dependencies internally

## Code Quality
- `const` constructors wherever possible
- Extract classes into separate files only when the class is large enough, important enough, or reusable enough to justify isolation — small helper widgets that are tightly coupled to one screen can stay in the same file
- Extract widgets into `widgets/` when a page exceeds ~100 lines
- Shared widgets used across features go in `core/widgets/`
- No unresolved TODO comments
- Error handling must be explicit — never catch and ignore silently

## Folder Structure Per Feature
```
data/datasources/         — abstract interface + remote + mock
data/models/              — domain models + request/response models
data/repositories/        — business logic layer
presentation/viewmodels/  — ChangeNotifier state
presentation/views/       — full screen pages
presentation/views/widgets/<screen_name>/ — screen-specific extracted widgets
```

## UI Construction
- Never use private `_buildX()` helper methods — always extract into named `StatelessWidget` classes
- `build()` method on any page must stay under ~50 lines — it should only compose widgets, not build them
- No more than 4–5 levels of widget nesting inside `build()`
- Name extracted widgets clearly after what they represent: `LoanSummaryCard`, `PolicyHeaderSection`, `RepaymentListItem`
- `context.watch<VM>()` at the root page level causes the whole page to rebuild — scope rebuilds using `Consumer<VM>` to the smallest widget that needs the data
- `context.watch<VM>()` inside a helper method causes the entire page to rebuild — extract into its own `StatelessWidget` instead
- No pure pass-through helpers that only rename or wrap a single widget with no logic
- Screen-specific widgets → `presentation/views/widgets/<screen_name>/` (e.g. `widgets/policy_page/`)
- Shared widgets used across features → `core/widgets/`
- `SizedBox` for spacing, not `Container`
- `ListView.builder` for any list — never `Column` + `.map()`
- Never use `Opacity` widget — use `Visibility`, `Offstage`, or `AnimatedOpacity` instead
- Wrap frequently-updating subtrees (timers, animations, counters) in `RepaintBoundary`

## Typography & Colors
- **Never** use raw `TextStyle(fontSize: N, fontWeight: FontWeight.wN, color: Color(...))` anywhere
- **Never** use `Colors.grey[N]` — always map to the nearest `AppColors` constant
- Always use `AppFonts.headingN.copyWith(...)` for every text style in every file touched (new and existing)
- Always use `AppColors` constants for every color — `AppColors.textPrimary`, `AppColors.textSecondary`, `AppColors.grey500`, etc.
- Font weight constants: `AppFonts.regular / medium / semiBold / bold` — never `FontWeight.wXXX`
- Scale: `heading1`=20sp SemiBold · `heading2`=16sp SemiBold · `heading3`=14sp Medium · `heading4`=12sp Medium · `heading5`=10sp Medium
- Reason: `AppFonts` bakes in `fontFamilyFallback: [KantumruyPro]` — raw `TextStyle` skips this, breaking Khmer rendering
- Exception: structural decoration colors with no `AppColors` equivalent (e.g. divider `0xFFEEEEEE`) may use `const Color(...)` directly

## initState Pattern
- Never call `context.read()` directly inside `initState`
- Always wrap in `WidgetsBinding.instance.addPostFrameCallback((_) { ... })`
- Always guard with `if (mounted)` before using context after async gaps

## Form Pattern
- After every form step submit, call `loadCurrentDraft()` to re-sync server state
- Pre-fill form fields inside `_prefillFromDraft()` called from `addPostFrameCallback`
- Guard prefill with completion check before reading draft fields

## Error Handling
- Raw framework exceptions (e.g. `DioException`) are never allowed to reach the ViewModel
- Caught at the datasource boundary → wrapped in custom exceptions → transformed by repository → delivered to UI as friendly messages

## API Endpoints
- If any endpoint from `core/config/api_config.dart` is used, briefly note which one and why, you can comment directly inside the code such as the usage of that endpoint from viewmodel until remote datasource

## Note
- If I say write doc or documents or document or README file, use .claude/skills/write-doc/SKILL.md to make notes of how the specific feature as been implemented