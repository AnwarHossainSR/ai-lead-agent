## Purpose

The chrome every screen sits inside — navigation, the top bar, the command
palette, and the density and composition rules that make a page built next month
look like one built today without anyone having to be told how.

## ADDED Requirements

### Requirement: Navigation states where you are and what is waiting

The sidebar SHALL name every top-level destination, SHALL mark the current one
distinctly from the rest, and SHALL show a count beside any destination holding
work that needs a person. A count SHALL be shown only when it is greater than
zero, and SHALL NOT be shown while it is still being read.

#### Scenario: The current destination is marked

- **WHEN** the operator is on any workspace page
- **THEN** that page's navigation entry is visually distinct from the others and
  is exposed to assistive technology as the current page

#### Scenario: Waiting work is counted

- **WHEN** drafts are awaiting review
- **THEN** the outreach review entry shows how many, and the count disappears
  when none remain

#### Scenario: An unread count is not guessed

- **WHEN** the count of waiting drafts cannot be read
- **THEN** no count is shown, and no zero is shown in its place

### Requirement: The sidebar collapses without losing navigation

The sidebar SHALL be collapsible to an icon rail on which every destination
remains reachable and named to assistive technology. Below the tablet breakpoint
it SHALL become a dismissible drawer opened from the top bar. The chosen state
SHALL survive navigation within a session.

#### Scenario: Collapsed navigation is still usable

- **WHEN** the sidebar is collapsed
- **THEN** every destination is still present, still activates, and still
  announces its name

#### Scenario: Small screens get a drawer

- **WHEN** the viewport is narrower than the tablet breakpoint
- **THEN** the sidebar is hidden, a menu control appears in the top bar, and
  opening it presents the full navigation over the page

#### Scenario: The collapse choice persists

- **WHEN** the operator collapses the sidebar and navigates to another page
- **THEN** the sidebar is still collapsed

### Requirement: The top bar locates the page and reaches the whole workspace

The top bar SHALL show where the current page sits, SHALL offer a search that
opens with a keyboard shortcut, and SHALL present the signed-in account with its
role. The role SHALL be visible without opening a menu, because what an account
may do changes what the page offers.

#### Scenario: The page is located

- **WHEN** any workspace page is open
- **THEN** the top bar names the section and the current page

#### Scenario: Search opens from the keyboard

- **WHEN** the operator presses the search shortcut anywhere in the workspace
- **THEN** the search opens focused, and dismissing it returns focus to where it
  came from

#### Scenario: The role is legible

- **WHEN** an account whose role is viewer is signed in
- **THEN** the interface states that role without the operator opening a menu

### Requirement: Search finds a company or a lead by what a person remembers

Search SHALL match companies and leads on name and on website domain, SHALL
group results by what they are, and SHALL state plainly when a query matched
nothing rather than presenting an empty list.

#### Scenario: A partial name matches

- **WHEN** the operator types part of a company's name
- **THEN** matching companies and leads are listed, grouped by kind, each with
  enough detail to tell two similar names apart

#### Scenario: A domain matches

- **WHEN** the operator types a website domain
- **THEN** the company holding that domain is found

#### Scenario: Nothing matches

- **WHEN** a query matches no company and no lead
- **THEN** the palette says so in words, and does not present an empty list that
  could be mistaken for still loading

### Requirement: A stated density scale

The interface SHALL define its type scale, spacing scale, control heights and
surface treatments once, as tokens, and every screen SHALL be composed from
them. A page SHALL NOT introduce a one-off size, radius, shadow or surface
colour.

#### Scenario: A new screen inherits the language

- **WHEN** a screen is built from the documented primitives without any bespoke
  styling
- **THEN** its type sizes, spacing, control heights, panel treatment and colours
  match every other screen

#### Scenario: Data-dense reading stays legible

- **WHEN** a table of leads is displayed at the default density
- **THEN** body text meets the accessibility floor for contrast and size, and
  numeric columns align on their digits

### Requirement: Page composition is consistent

Every workspace page SHALL open with a header giving the section, the page name,
one line saying what the page is for, and — where the page has one — its primary
action. Content below SHALL be grouped into panels, each with a heading and,
where useful, a line of context.

#### Scenario: A page identifies itself

- **WHEN** any workspace page loads
- **THEN** it states its section, its name and its purpose before any data

#### Scenario: The primary action is where it is expected

- **WHEN** a page has one action that matters more than the others
- **THEN** that action appears in the page header, and secondary actions do not
