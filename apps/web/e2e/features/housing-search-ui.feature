Feature: Housing search UI golden paths
  Golden paths for the user-facing display application, derived from the
  housing-search-ui capability: unit detail, mobile behavior, error
  surfaces, and honest presentation of imperfect data.

  Scenario: Detail opened from pin
    When a user clicks a map pin
    Then the slide-over detail opens for that unit with the map still visible

  Scenario: Complete detail content
    When the detail panel renders for a unit
    Then it shows unit specs (address, bedrooms, size, cost), program policies (referral, sobriety, background check, sex-offense restrictions, treatment, vouchers, population, gender, length of stay), and the provider contact block (organization, program, phone, email, website, application process)

  Scenario: Honest unknowns in detail
    When a policy field is unknown at the source
    Then the detail panel displays "not publicly listed" for that field

  Scenario: Citizen on a phone
    When the app is used at phone width
    Then map and list remain fully operable through tabs, filters through the sheet, and detail through the bottom sheet

  Scenario: Unknown page
    When a user navigates to a nonexistent route
    Then a plain-language 404 page appears; no stack traces or internal errors are exposed

  Scenario: Backend down mid-session
    When the API becomes unreachable after results loaded
    Then the UI shows a retry banner and retains the last rendered results where possible
