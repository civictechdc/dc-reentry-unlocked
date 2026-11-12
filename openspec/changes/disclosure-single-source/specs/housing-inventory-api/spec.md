## ADDED Requirements

### Requirement: Synthetic provenance in units payloads

Every successful units payload SHALL carry `synthetic: true` and a `disclosure` equal to the dataset's synthetic disclosure sentence, including when no units match.

#### Scenario: Units payload preserves dataset provenance

- **WHEN** a units request succeeds against an accepted synthetic dataset
- **THEN** the payload carries `synthetic: true` and `disclosure` exactly equal to the dataset's disclaimer

#### Scenario: Empty results preserve dataset provenance

- **WHEN** a units request succeeds with no matching units
- **THEN** the payload still carries `synthetic: true` and the dataset's disclosure sentence

### Requirement: Contract disclosure agreement

Every successful units payload SHALL carry a disclosure sentence exactly equal to the canonical synthetic disclosure sentence defined by the units-data contract.

#### Scenario: Served disclosure agrees with the contract

- **WHEN** a units request succeeds
- **THEN** its disclosure sentence exactly equals the units-data contract's canonical synthetic disclosure sentence

### Requirement: Disclosure drift refuses startup

The service SHALL refuse startup if the dataset's disclaimer differs from the units-data contract's canonical synthetic disclosure sentence. It SHALL NOT serve inventory from that dataset.

#### Scenario: Dataset disclaimer differs from the contract

- **WHEN** startup loads a dataset whose disclaimer differs from the canonical synthetic disclosure sentence
- **THEN** startup fails before the service accepts requests
