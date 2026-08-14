## MODIFIED Requirements

### Requirement: The web application renders a shell backed by live API status

The system SHALL serve a web application containing the site chrome and the operator's working views — leads, companies, the outreach review queue, analytics and pipeline operations — styled with the project's design system. The application SHALL display the API health status obtained from the API, and SHALL render a clear degraded state rather than an error page when the API is unreachable, slow, or returns an error. Every server-side request SHALL be bounded by a timeout, and a panel whose data cannot be loaded SHALL degrade without affecting the rest of the page.

#### Scenario: The shell renders with the API up

- **WHEN** the web application is opened while the API is healthy
- **THEN** the shell renders and displays a healthy API status

#### Scenario: The shell degrades gracefully with the API down

- **WHEN** the web application is opened while the API is not running
- **THEN** the shell still renders and displays an unavailable API status
- **AND** no unhandled error page is shown

#### Scenario: The operator's views are reachable

- **WHEN** the web application is opened while the API is healthy
- **THEN** the leads, companies, outreach review, analytics and operations views are reachable from the navigation

#### Scenario: A slow API does not hang a page

- **WHEN** the API does not respond within the configured timeout
- **THEN** the page renders with the condition displayed

#### Scenario: One failing panel does not take the page down

- **WHEN** one panel's data cannot be loaded
- **THEN** the remaining panels render normally

## ADDED Requirements

### Requirement: The web application is checked for accessibility in CI

The system SHALL run automated accessibility checks against the main views as part of the workflow, and SHALL fail the run when a violation at the configured level is found.

#### Scenario: The workflow runs the accessibility checks

- **WHEN** the workflow runs
- **THEN** the accessibility checks run against the lead list, lead detail and outreach review views

#### Scenario: A violation fails the run

- **WHEN** an accessibility violation at the configured level is introduced
- **THEN** the workflow reports a failing status

### Requirement: The unauthenticated deployment posture is documented

The system SHALL state in its documentation that the web application and the API carry no authentication and are intended to be run locally only, until an authentication capability exists.

#### Scenario: The documentation states the posture

- **WHEN** the setup documentation is read
- **THEN** it states that there is no authentication and that the applications are intended for local use only
