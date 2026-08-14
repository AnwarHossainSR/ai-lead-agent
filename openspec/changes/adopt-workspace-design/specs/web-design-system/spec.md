## ADDED Requirements

### Requirement: The design language lives in tokens and primitives

Visual decisions — colour, type scale, spacing, radius, elevation, control height
and surface treatment — SHALL be expressed once as tokens and shared primitives.
A page or feature SHALL NOT introduce a bespoke value for any of them.

#### Scenario: A screen carries no bespoke styling

- **WHEN** any workspace page's markup is inspected
- **THEN** its colours, sizes, spacing, radii and shadows resolve to the shared
  tokens, and no literal colour, font size or shadow appears in page-level code

#### Scenario: Changing a token changes every screen

- **WHEN** a surface or accent token's value is changed
- **THEN** every screen using that surface or accent changes with it, without
  any page being edited

### Requirement: A visual reference is kept honest or removed

Where a mock or reference implementation is kept in the repository, it SHALL be
excluded from the build, lint, type-check and test of the shipped application,
and SHALL be removed once the design it describes has been adopted. A reference
SHALL NOT be a second, diverging source of truth for the interface.

#### Scenario: The reference does not enter the build

- **WHEN** the workspace is linted, type-checked, tested and built
- **THEN** the reference implementation is not compiled and does not affect the
  result

#### Scenario: The reference is retired

- **WHEN** every screen the reference covers has been adopted
- **THEN** the reference is deleted, and the design it carried survives in the
  tokens and primitives rather than in a parallel copy

### Requirement: A trend is only drawn from data that supports it

A sparkline, delta, chart or progress indicator SHALL be rendered only from
values the system actually holds. Where the underlying window is incomplete, the
interface SHALL say so alongside the visual rather than drawing a shorter shape
as though it were the whole period.

#### Scenario: A delta with nothing to compare against is absent

- **WHEN** a headline figure has no preceding period to compare against
- **THEN** no delta is rendered, and the absence is stated rather than shown as
  no change

#### Scenario: A partial series says what it covers

- **WHEN** a series covers fewer days than the period it is labelled with
- **THEN** the interface states the period actually covered

#### Scenario: Progress reflects recorded state

- **WHEN** a progress indicator is displayed for work in flight
- **THEN** its value derives from recorded counts, and it does not advance on a
  timer independent of them
