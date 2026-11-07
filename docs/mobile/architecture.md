# Architecture Guide — Loan Request Mobile App

> **IMPORTANT FOR AI AGENTS & DEVELOPERS**
> Read this file in full at the start of every session, model switch, or new task before writing or modifying any code. All implementation decisions must comply with the rules and patterns defined here.

---

## 1. Project Overview

| Field | Detail |
|---|---|
| **App Name** | Loan Request Mobile App |
| **Platform** | Flutter (iOS & Android) |
| **Goal** | Allow users to apply for loans, track loan status, make repayments, and manage their profile through a clean, secure mobile interface. |
| **State Management** | Provider (`ChangeNotifier`) |
| **Navigation** | GoRouter (`go_router ^17.1.0`) |
| **HTTP Client** | Dio (`dio ^5.4.0`) |
| **Local Storage** | SharedPreferences via `StorageService` |
| **Architecture Pattern** | Layered MVVM with Repository Pattern |

---

## 2. Architecture Pattern — Layered MVVM + Repository

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│  views/  ──► (reads state, dispatches actions)              │
│  viewmodels/  ──► (ChangeNotifier, holds UI state)          │
├─────────────────────────────────────────────────────────────┤
│                      DATA LAYER                             │
│  repositories/  ──► (business logic, orchestration)         │
│  datasources/   ──► (remote API / mock / local)             │
│  models/        ──► (data models, JSON serializable)        │
├─────────────────────────────────────────────────────────────┤
│                      CORE LAYER                             │
│  network/   ──► (DioClient, AuthInterceptor)                │
│  services/  ──► (StorageService, FormService, ThemeProvider)│
│  routes/    ──► (AppRouter, AppRoutes, AppPaths)            │
│  theme/     ──► (AppColors, AppFonts, AppTheme)             │
│  utils/     ──► (AppLogger)                                 │
│  widgets/   ──► (shared reusable widgets)                   │
│  constants/ ──► (ImagesConstant, etc.)                      │
│  config/    ──► (AppConfig, ApiConfig)                      │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow (always one direction)

```
View  →  ViewModel  →  Repository  →  Datasource  →  API / Local
View  ←  ViewModel  ←  Repository  ←  Datasource  ←  API / Local
```

The View **never** talks to a Repository or Datasource directly.  
The Repository **never** imports anything from the presentation layer.

---

## 3. Project Structure

```
lib/
├── main.dart                          # App entry point only (MyApp + providers)
│
├── core/
│   ├── config/
│   │   ├── api_config.dart            # Base URLs, endpoint constants
│   │   └── app_config.dart            # Environment / build config
│   ├── constants/
│   │   └── images_constant.dart       # Asset path constants
│   ├── error/                         # NEW: Error handling & failures
│   │   ├── error_handler.dart         # Centralized error processing
│   │   ├── exceptions.dart            # Custom exceptions
│   │   └── failure.dart               # Failure types (NetworkFailure, etc.)
│   ├── network/
│   │   ├── dio_client.dart            # Dio singleton + interceptor setup
│   │   └── auth_interceptor.dart      # Token injection + refresh logic
│   ├── routes/
│   │   ├── app_router.dart            # GoRouter instance + redirect guards
│   │   └── app_routes.dart            # AppRoutes (named) + AppPaths (paths)
│   ├── services/
│   │   ├── storage_service.dart       # SharedPreferences wrapper
│   │   ├── form_service.dart          # Form state / validation helpers
│   │   └── theme_provider.dart        # Dark/light mode ChangeNotifier
│   ├── theme/
│   │   ├── app_colors.dart
│   │   ├── app_fonts.dart
│   │   └── app_theme.dart
│   ├── utils/
│   │   └── logger.dart                # AppLogger — ONLY logger to use
│   └── widgets/                       # Shared reusable UI components
│
└── features/
    └── <feature_name>/
        ├── data/
        │   ├── datasources/
        │   │   ├── <feature>_datasource.dart        # Abstract interface
        │   │   ├── <feature>_remote_datasource.dart # Dio implementation
        │   │   └── <feature>_mock_datasource.dart   # Mock for dev/testing
        │   ├── models/
        │   │   ├── <feature>_model.dart              # Domain model (copyWith)
        │   │   └── http/
        │   │       ├── <name>_request.dart
        │   │       └── <name>_response.dart
        │   └── repositories/
        │       └── <feature>_repository.dart         # Abstract repo
        |       └── <feature>_repository_impl.dart    # Implement repo
        logic layer
        └── presentation/
            ├── viewmodels/
            │   └── <feature>_viewmodel.dart          # ChangeNotifier
            └── views/
                ├── <feature>_page.dart               # Full screen
                └── widgets/                          # Screen-specific widgets
                    └── <widget_name>.dart

```
---

## 4. Rules — All Must Be Followed

### RULE 1 — Separation of Concerns in the UI

- Views **only** interact with their ViewModel via `context.read<VM>()` or `context.watch<VM>()`.
- Views must **not** contain business logic, API calls, repository calls, or direct `SharedPreferences` access.
- If logic grows complex in a widget, extract it into the ViewModel or a helper class.

```dart
// ✅ CORRECT — view delegates to viewmodel
onPressed: () => context.read<AuthViewModel>().login(username, password),

// ❌ WRONG — view calls repository directly
onPressed: () => authRepository.login(username, password),
```

---

### RULE 2 — State Management Must Be Reactive and Accurate

- Every ViewModel must expose clear state (use enums or sealed classes for status).
- When an entity changes (e.g., user profile updated), **all widgets observing that state must reflect the change** — avoid local copies that go stale.
- Use `context.watch<VM>()` (or `Consumer<VM>`) to rebuild on state change, not one-time reads for reactive UI.
- Shared data that multiple screens depend on should live in a **shared ViewModel** provided at the app level, not recreated per screen.

```dart
// Enum state pattern (required)
enum AuthState { idle, loading, success, error, otpSent }

class AuthViewModel extends ChangeNotifier {
  AuthState _state = AuthState.idle;
  AuthState get state => _state;

  void _setState(AuthState newState) {
    _state = newState;
    notifyListeners();
  }
}
```

---

### RULE 3 — Repository Pattern with Dependency Injection

- Every ViewModel must receive its Repository via constructor injection.
- Every repository must define an abstract interface first.
The ViewModel depends on this abstract type — never the concrete class directly. (Abstract Interface)
- The concrete class implements the abstract interface. It receives the datasource via constructor injection.
- No ViewModel or Repository should instantiate its own dependencies with `new` / direct constructors.
- Providers are wired in `main.dart` using `MultiProvider`.

---

### RULE 4 — Models Must Implement `copyWith`

Every data model class must implement `copyWith` so that state updates are immutable and performance-efficient.

```dart
class UserModel {
  final String id;
  final String name;
  final String phone;

  const UserModel({required this.id, required this.name, required this.phone});

  UserModel copyWith({String? id, String? name, String? phone}) {
    return UserModel(
      id: id ?? this.id,
      name: name ?? this.name,
      phone: phone ?? this.phone,
    );
  }
}
```

---

### RULE 5 — Split UI Into Components (No Monolithic Screens)

- If a widget block can be logically isolated (e.g., a card, a section header, a form field group), extract it into its own file under `views/components/`.
- A page file should be a composition of components, not a 500-line monolith.
- Shared components used across multiple features go in `core/widgets/`.

```
views/
├── profile_page.dart           # Composes smaller widgets
└── components/
    ├── profile_header.dart
    ├── profile_info_tile.dart
    └── profile_action_buttons.dart
```

---

### RULE 6 — Use `AppLogger` for All Debugging

- **Never** use `print()` or `debugPrint()` anywhere in the codebase.
- Always use `AppLogger` from `core/utils/logger.dart`.

```dart
import 'package:flutter_project/core/utils/logger.dart';

AppLogger.i('User logged in successfully');
AppLogger.d('Response data: $data');
AppLogger.w('Token is about to expire');
AppLogger.e('Login failed', error, stackTrace);
```

| Method | Usage |
|---|---|
| `AppLogger.i(msg)` | General info / lifecycle events |
| `AppLogger.d(msg)` | Debug values, response payloads |
| `AppLogger.w(msg)` | Non-critical warnings |
| `AppLogger.e(msg, err, st)` | Errors with optional error + stack trace |

---

### RULE 7 — Navigation via GoRouter Only

- All navigation must go through GoRouter (`context.go(...)` or `context.push(...)`).
- Never use `Navigator.push(...)` or `Navigator.pushNamed(...)` directly.
- Route names are defined in `AppRoutes`, route paths in `AppPaths` (both in `core/routes/app_routes.dart`).
- Auth redirect logic lives exclusively in the router's `redirect` callback.

```dart
// ✅ CORRECT
context.go(AppPaths.home);
context.push(AppPaths.repayment);

// ❌ WRONG
Navigator.push(context, MaterialPageRoute(builder: (_) => RepaymentPage()));
```

---

### RULE 8 — Datasource Abstraction

- Each feature's datasource must be defined as an **abstract class (interface)** first.
- Concrete implementations (`_remote`, `_mock`) implement that interface.
- The Repository depends on the abstract type, never on the concrete class directly.

```dart
// datasource interface
abstract class AuthDatasource {
  Future<UserModel> login(AuthRequest request);
}

// concrete implementation
class AuthRemoteDatasource implements AuthDatasource { ... }

// repository takes the abstract
class AuthRepository {
  final AuthDatasource _datasource;
  AuthRepository(this._datasource);
}
```

---

### RULE 9 — Code Quality Standards

- All code must be **production-ready**: no `TODO` comments left unresolved, no hardcoded strings for UI text that should be constants.
- Avoid deeply nested callbacks — extract into named functions or methods.
- Prefer `const` constructors wherever possible for performance.
- Keep files focused: one class per file (exceptions: small related enums or extensions in the same file).
- Error handling must be explicit — do not swallow exceptions silently.

---

## 5. Key Dependencies Reference

| Package | Purpose |
|---|---|
| `provider ^6.1.1` | State management (ChangeNotifier) |
| `go_router ^17.1.0` | Declarative navigation |
| `dio ^5.4.0` | HTTP client |
| `shared_preferences ^2.5.4` | Local key-value storage |
| `logger ^2.6.2` | Logging (via `AppLogger`) |
| `json_annotation + json_serializable` | JSON serialization |
| `build_runner` | Code generation |
| `flutter_dotenv` | Environment variables |
| `adaptive_platform_ui` | Platform-adaptive UI components |

---

## 6. Feature List

| Feature | Description |
|---|---|
| `auth` | Login, register (OTP flow), change password, logout |
| `home` | Dashboard, service navigation grid |
| `profile` | View and edit user profile |
| `loan_application` | Multi-step loan application forms (eKYC, identity, occupation, emergency contact, credit info) |
| `loan_calculator` | Loan amount and repayment simulator |
| `repayment` | Repayment schedule, ABA pay, QR payment |
| `account` | Account details |
| `career` | Career/job listings |
| `chat` | In-app messaging |
| `referral` | Referral / invite system |
| `reward` | Rewards and friend list |
| `splash` | Splash screen + onboarding |

---

## 7. AI Agent Checklist (Run Before Every Code Change)

Before writing or modifying any code, verify:

- [ ] Does the View only interact with a ViewModel? No repository/datasource imports in views.
- [ ] Is the ViewModel receiving its Repository via constructor injection?
- [ ] Does the new/updated model have `copyWith`?
- [ ] Is `AppLogger` used instead of `print`?
- [ ] Is navigation done via GoRouter (`context.go` / `context.push`)?
- [ ] Are large widgets split into component files?
- [ ] Is the datasource backed by an abstract interface?
- [ ] Is shared state that multiple screens need in a top-level Provider?
- [ ] Are `const` constructors used where applicable?
- [ ] Is error handling explicit and not silently swallowed?
