## MODIFIED Requirements

### Requirement: Prototype disclosure banner

Every screen SHALL display a persistent, prominent banner identifying the app as a prototype using synthetic data, so no inventory is mistaken for real housing opportunities. The banner body SHALL display the units-data contract's canonical synthetic disclosure sentence verbatim and remain rendered regardless of API availability.

#### Scenario: Synthetic-data notice visible
- **WHEN** any view of the app is displayed
- **THEN** the prototype/synthetic-data banner is visible and its body displays the units-data contract's canonical synthetic disclosure sentence verbatim

#### Scenario: Synthetic-data notice survives an unreachable API
- **WHEN** the app is displayed and the API is unreachable, including on initial load before any successful units response
- **THEN** the prototype/synthetic-data banner remains visible with the full units-data contract disclosure sentence

### Requirement: Internationalization readiness

All user-facing UI chrome strings SHALL be externalized for localization from day one. Contract-carried data values, including the units-data contract's synthetic disclosure sentence and schema-carried filter labels, SHALL render from the contract; they are neither component-local literals nor localizable chrome. The prototype ships in English only, but adding a language SHALL require no component rewrites for chrome.

#### Scenario: String externalization
- **WHEN** a developer audits the UI code
- **THEN** no user-facing UI-chrome string is hardcoded inside components, while contract-carried data renders from the contract
