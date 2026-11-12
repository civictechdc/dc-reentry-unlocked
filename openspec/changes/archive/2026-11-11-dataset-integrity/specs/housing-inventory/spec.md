# Spec Delta

## ADDED Requirements

### Requirement: Dataset hierarchy integrity at the serving boundary

Before serving a dataset, the serving boundary SHALL require unique Provider ids, globally unique Program ids, and each Unit's programId to equal its enclosing Program's id. Checks SHALL include empty Providers and Programs and Units of every availability state. Any violation SHALL reject the whole dataset before projection into served inventory.

#### Scenario: Unit references a different Program
- **WHEN** a dataset contains a Unit whose programId differs from its enclosing Program's id, regardless of the Unit's availability state
- **THEN** the serving boundary SHALL reject the whole dataset before serving any inventory from it

#### Scenario: Program identity occurs more than once
- **WHEN** a dataset repeats a Program id within one Provider or across different Providers, including Programs without Units
- **THEN** the serving boundary SHALL reject the whole dataset before serving any inventory from it

#### Scenario: Provider identity occurs more than once
- **WHEN** a dataset repeats a Provider id, including Providers without Programs
- **THEN** the serving boundary SHALL reject the whole dataset before serving any inventory from it
