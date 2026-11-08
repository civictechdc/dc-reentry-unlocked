# feature-flags Specification

## Purpose

Lets candidate features ship behind dev-session toggles so they can be
trialed in a running development session, while guaranteeing flagged code
and toggle machinery are absent from every non-development build.

## Requirements

### Requirement: Flagged behavior is opt-in during development
The web app SHALL keep every behavior guarded by a feature flag disabled
by default in a development session, enabling it only when the flag is
explicitly set.

#### Scenario: Flag unset at dev launch
- **WHEN** the dev server starts without a flag's command-time setting
- **THEN** the behavior guarded by that flag is disabled in the loaded app

#### Scenario: Flag set at dev launch
- **WHEN** the dev server starts with a flag's command-time setting enabled
- **THEN** the behavior guarded by that flag is enabled for that whole dev session

### Requirement: Page-load URL override in development
In a development session, the app SHALL accept a URL query parameter that
overrides flag values for that page load without a dev-server restart.
Unknown flag names SHALL be ignored, and an empty value SHALL enable
nothing.

#### Scenario: Override enables a flag
- **WHEN** the app loads in a development session with the flag query parameter naming a registered flag
- **THEN** that flag's guarded behavior is enabled for that page load regardless of its command-time setting

#### Scenario: Unknown flag name ignored
- **WHEN** the flag query parameter names a flag that is not registered
- **THEN** the parameter entry is ignored and no guarded behavior changes

#### Scenario: Empty override value
- **WHEN** the flag query parameter is present but empty
- **THEN** no guarded behavior is enabled by it

### Requirement: No flag surface in non-development builds
Non-development builds of the web app SHALL provide no flag-configuration
surface: neither environment settings at build time nor URL parameters at
run time SHALL enable any flagged behavior.

#### Scenario: URL parameter on a production build
- **WHEN** a non-development build is loaded with the flag query parameter naming a registered flag
- **THEN** that flag's guarded behavior stays disabled

#### Scenario: Build-time environment setting on a production build
- **WHEN** a non-development build is produced with a flag's environment variable set
- **THEN** the build output still contains no enabled flagged behavior and no runtime flag surface

### Requirement: Flagged code is stripped from non-development builds
Every non-development build SHALL exclude, at build time, the code guarded
by a feature flag and the dev-only override machinery — flagged code is
kept only in development sessions.

#### Scenario: Build output scan
- **WHEN** a flag-guarded behavior exists in source and a non-development build is produced
- **THEN** scanning the build output finds no flag-toggle surface and none of the guarded behavior's code

### Requirement: Flag names come from a single registry
All flag names SHALL be declared in one registry that is the single
source of truth for valid names; a name absent from the registry SHALL be
rejected when the app is built or type-checked, not discovered at run time.

#### Scenario: Guarding an unregistered name
- **WHEN** source code references a flag name absent from the registry
- **THEN** the build or type check fails

#### Scenario: Adding a flag
- **WHEN** a new flag name is added to the registry and a consumer guards behavior with it
- **THEN** the flag is disabled by default in dev sessions and available to both toggle surfaces without any other registration step
