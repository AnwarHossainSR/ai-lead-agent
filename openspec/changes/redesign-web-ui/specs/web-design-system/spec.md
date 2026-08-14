## Purpose

Defines the visual and interaction contract every screen of the signed-in web
workspace must satisfy: a semantic theme with a light and dark mode, a shared
set of UI primitives, how the outcome of an action is announced, how loading,
empty, error and partial data are presented without ever overstating what is
known, and the responsiveness, motion and accessibility floor below which no
page may fall.

## ADDED Requirements

### Requirement: Semantic theme tokens

The workspace SHALL derive every colour from a named semantic token rather than
a literal colour value, and each token SHALL carry a definition for both the
light and the dark theme. Status meaning SHALL be expressed through a fixed set
of semantic roles — success, warning, danger, info and neutral — so that the
same meaning is the same colour on every screen.

#### Scenario: A status colour means the same thing on every screen

- **WHEN** the same lead priority, outreach status, staleness or health value is
  rendered on two different pages
- **THEN** both render it with the same semantic role, and therefore the same
  colour, in the active theme

#### Scenario: No component hard-codes a colour

- **WHEN** the workspace's styles are inspected for colour values
- **THEN** colours appear only as theme token definitions, and every component
  references a token; no component declares a literal hex, `rgb()` or `oklch()`
  colour of its own

#### Scenario: Chart series are distinguishable

- **WHEN** a chart renders more than one series
- **THEN** each series takes a distinct colour from the theme's chart ramp, and
  adjacent series are distinguishable from one another in both themes and under
  a monochrome rendering

### Requirement: Theme preference

The workspace SHALL let a signed-in user choose light, dark, or following the
operating system, SHALL remember that choice across visits, and SHALL apply the
chosen theme on the first paint of a page without rendering the other theme
first.

#### Scenario: Choosing a theme

- **WHEN** a user selects dark from the theme control
- **THEN** the interface switches to the dark theme immediately, without a full
  page reload

#### Scenario: The choice survives a reload

- **WHEN** a user who has selected dark reloads the page or opens a different
  page in the workspace
- **THEN** the page renders in the dark theme, and at no point during loading is
  the light theme visible

#### Scenario: Following the system

- **WHEN** a user selects the system option and the operating system reports a
  dark colour scheme
- **THEN** the workspace renders in the dark theme, and it follows the operating
  system if that preference later changes

### Requirement: Consistent interactive states

Every interactive element — link, button, form control, sortable header,
navigable table row — SHALL present a visible hover, focus, active and disabled
state, and its focus indicator SHALL be visible for keyboard users regardless of
whether it is visible for pointer users.

#### Scenario: Keyboard focus is always visible

- **WHEN** a user moves focus through a page with the keyboard alone
- **THEN** the focused element carries a clearly visible focus indicator at every
  step, and no element receives focus without one

#### Scenario: A disabled control cannot be operated

- **WHEN** a control is disabled because the signed-in account's role does not
  permit the action, or because a submission is in flight
- **THEN** the control is presented as disabled, does not respond to activation,
  and states why it is unavailable

### Requirement: Action outcomes are announced

Every action that changes data — approving, rejecting or recording an outreach
message as sent, marking or clearing a do-not-contact marker, retrying a failed
job, signing in and signing out — SHALL confirm its outcome to the user through
a transient notification, and SHALL do so for failure as well as success. The
notification SHALL be announced to assistive technology.

#### Scenario: A successful action is confirmed

- **WHEN** a user approves an outreach message and the action succeeds
- **THEN** a notification appears confirming the message was approved

#### Scenario: A failed action says so

- **WHEN** an action fails — the API is unreachable, the request times out, or
  the server rejects it
- **THEN** a notification appears reporting the failure and what went wrong, it
  is visually distinct from a success notification, and the user is not left
  believing the action succeeded

#### Scenario: A refused action explains itself

- **WHEN** an action is refused because the signed-in account's role does not
  permit it
- **THEN** the notification says the account's role does not permit the action,
  rather than reporting a generic error

#### Scenario: Notifications reach assistive technology

- **WHEN** a notification appears
- **THEN** it is placed in a live region so a screen reader announces it without
  the user having to move focus, and focus is not stolen from wherever the user
  was

#### Scenario: Notifications do not accumulate

- **WHEN** several notifications appear in quick succession
- **THEN** they are presented together in a bounded stack, each dismisses itself
  after a readable interval, and each can be dismissed early by the user

### Requirement: Loading state

While a page or a panel is waiting for data, the workspace SHALL show a
placeholder that occupies the shape and position of the content it is standing
in for, so that content does not shift when it arrives, and SHALL never present
a placeholder as though it were data.

#### Scenario: A panel loads independently

- **WHEN** one panel on a page is still loading and the others have their data
- **THEN** the loading panel shows its own placeholder and the rest of the page
  is fully rendered and usable

#### Scenario: A placeholder is not mistaken for content

- **WHEN** a placeholder is displayed
- **THEN** it is hidden from assistive technology as decorative, and the region
  it occupies is marked as busy

### Requirement: Empty state

When a list, table or panel has no data to show, the workspace SHALL say so in
words, SHALL distinguish "there is nothing yet" from "nothing matches the
current filters", and in the filtered case SHALL offer a way to clear the
filters.

#### Scenario: Nothing matches the filters

- **WHEN** a user applies filters that match no leads
- **THEN** the table is replaced by a message saying no leads match these
  filters, together with a control that clears them

#### Scenario: There is genuinely nothing yet

- **WHEN** a list has no rows and no filters are applied
- **THEN** the message explains that there is nothing here yet rather than
  implying a filter is hiding something

### Requirement: Error and degraded state

When data cannot be fetched, the workspace SHALL present a designed error state
naming what is unavailable and why, SHALL keep the rest of the page usable, and
SHALL offer a way to retry. A slow-but-degraded response SHALL be distinguished
from an unreachable one.

#### Scenario: One panel fails, the page survives

- **WHEN** one panel's request fails or times out
- **THEN** that panel shows an error state naming what is unavailable and
  offering a retry, and every other panel on the page renders normally

#### Scenario: Degraded is not the same as down

- **WHEN** a request succeeds slowly enough to be reported as degraded
- **THEN** the data is shown with an indication that it may be stale or slow,
  which is visually distinct from the state shown when the source is unreachable

### Requirement: Certainty is preserved in presentation

The redesign SHALL NOT flatten the distinction between an observed fact, an
inferred one, and an unknown value. Inferred values SHALL remain visibly marked
as inferred, unknown values SHALL remain visibly distinct from empty or zero,
AI-generated text SHALL remain visibly marked as generated, and evidence links
SHALL remain reachable.

#### Scenario: An unknown value is not shown as a blank

- **WHEN** a field's value is unknown
- **THEN** it is presented as explicitly unknown, distinguishable from a value of
  zero, an empty string, and a field that is still loading

#### Scenario: An inferred value carries its marker

- **WHEN** a value the system inferred rather than observed is rendered
- **THEN** it carries a visible marker identifying it as inferred, and its source
  or evidence remains reachable from where it is shown

#### Scenario: Generated text stays labelled

- **WHEN** AI-generated text such as a research summary or a draft message is
  rendered
- **THEN** it remains visibly labelled as generated, and the styling does not
  make it look like an observed fact

### Requirement: Responsive layout

Every page SHALL be usable on a small screen. Primary navigation SHALL be
reachable at every viewport width, and wide tables SHALL remain readable below
the desktop breakpoint without the page scrolling horizontally as a whole.

#### Scenario: Navigation on a small screen

- **WHEN** the workspace is viewed at a small viewport width
- **THEN** primary navigation is reachable through a control that opens it, it
  can be opened and closed with the keyboard, and it is not simply absent

#### Scenario: A wide table on a small screen

- **WHEN** a multi-column table is viewed below the desktop breakpoint
- **THEN** its rows remain readable and every row stays reachable, and the page
  body itself does not scroll horizontally

### Requirement: Motion respects the user

Motion SHALL be used only to explain a change of state — something appearing,
dismissing, expanding or updating — and SHALL be suppressed when the user has
asked their system to reduce motion.

#### Scenario: Reduced motion is honoured

- **WHEN** the user's system requests reduced motion
- **THEN** transitions and animations are suppressed or reduced to a
  non-moving change, and no information is conveyed only through motion

### Requirement: Accessibility floor

Every page SHALL meet a stated accessibility floor: text and meaningful
non-text contrast sufficient for WCAG AA in both themes, one main landmark and a
single first-level heading per page, a correct heading order, an accessible name
on every control, and no automated accessibility violations in the workspace's
test suite. Colour SHALL never be the only carrier of meaning.

#### Scenario: Automated checks pass in both themes

- **WHEN** the accessibility test suite runs against a page in the light theme
  and again in the dark theme
- **THEN** it reports no violations in either

#### Scenario: Status is not carried by colour alone

- **WHEN** a status is shown with a colour
- **THEN** it also carries text or a shape that conveys the same meaning to a
  user who cannot distinguish the colour

### Requirement: Presentation-only change

The redesign SHALL NOT change what any page shows or what any account may do.
The set of routes, the data each page fetches, the fields it displays, and the
role gating on every action SHALL be the same after the redesign as before it.

#### Scenario: The route list is unchanged

- **WHEN** the workspace's routes are enumerated after the redesign
- **THEN** they are exactly the routes that existed before it, with no route
  added, removed or renamed

#### Scenario: Role gating survives the restyle

- **WHEN** an account whose role does not permit an action views the screen that
  offers it
- **THEN** the action is unavailable to that account exactly as it was before the
  redesign, and the restyling has not made a gated control operable
