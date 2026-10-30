Feature: Dynamic filtering golden paths
  Golden paths for the schema-driven filter system, derived from the
  dynamic-filtering capability: the map and card list always render the
  same result set, and zero-result states offer ways to relax filters.

  Scenario: Filter applied to both views
    When a user selects "Ward 5" and "Transitional"
    Then map pins and card list both reflect exactly the matching units

  Scenario: No matches
    When the active filters match zero units
    Then a clear empty-state panel appears explaining no units match, with controls to relax the filters
