## Purpose

Defines the platform's only sanctioned path to a language model: versioned prompts held as reviewed code, output that must satisfy a declared schema before anything downstream sees it, per-call cost accounting with a ceiling, and an audit record that makes every AI-derived claim traceable to the call that produced it.

## ADDED Requirements

### Requirement: A single typed call path to the model

The system SHALL expose one service through which all model calls are made. Callers SHALL identify a prompt by registered name and version and supply typed input; they SHALL NOT construct raw prompt text, choose a model per call site, or talk to a vendor SDK directly. The service SHALL return a value already parsed by the prompt's declared output schema.

#### Scenario: A caller runs a registered prompt

- **WHEN** application code requests a registered prompt name and version with input matching that prompt's input type
- **THEN** the service returns a value satisfying that prompt's output schema

#### Scenario: An unregistered prompt is refused

- **WHEN** a caller requests a prompt name that is not registered
- **THEN** the call fails with an error naming the requested prompt and listing the registered ones
- **AND** no request is sent to the provider

#### Scenario: An unregistered version is refused

- **WHEN** a caller requests a registered prompt at a version that does not exist
- **THEN** the call fails with an error naming the prompt and the versions that do exist

### Requirement: Prompts are versioned, reviewed code

Each prompt SHALL be a versioned module declaring its template, its input type and its output schema. Prompt text SHALL be assembled only from the declared input; values from external sources SHALL be inserted as data, never concatenated into instruction text. An existing published prompt version SHALL NOT be edited in place — a behavioural change SHALL be a new version.

#### Scenario: Prompt input is confined to a data position

- **WHEN** a prompt is rendered with input containing text that reads as an instruction
- **THEN** that text appears in the rendered prompt only within the input section, never as part of the instruction section

#### Scenario: Two versions of one prompt coexist

- **WHEN** a second version of an existing prompt is registered
- **THEN** both versions remain callable
- **AND** records produced by the earlier version continue to identify the version that produced them

### Requirement: Model output is validated, never coerced

The system SHALL request structured output and SHALL parse every response against the prompt's output schema. A response that fails validation SHALL be retried at most once, supplying the validation failure to the model. A second failure SHALL raise an error. The system SHALL NOT fill in defaults, drop failing fields, accept partial output, or return a value that did not satisfy the schema.

#### Scenario: Valid output is returned

- **WHEN** the provider returns a response satisfying the output schema
- **THEN** the parsed value is returned to the caller

#### Scenario: Invalid output is retried once, then fails

- **WHEN** the provider returns a response that fails schema validation twice in succession
- **THEN** the call fails with an error naming the prompt, the version and the failing fields
- **AND** no partially-valid value is returned

#### Scenario: A refusal is a result, not a failure

- **WHEN** a prompt declares that the model may report insufficient evidence, and the model does so
- **THEN** the caller receives that outcome as a valid parsed result rather than an error
- **AND** nothing is invented to fill the gap

### Requirement: Every call is recorded and attributable

The system SHALL record each model call with the prompt name, prompt version, model identifier, input and output token counts, estimated cost, latency, and outcome. Each record SHALL have an identifier that callers can attach to any value they derive from that call. A recorded call SHALL NOT store the API key.

#### Scenario: A successful call is recorded

- **WHEN** a model call completes successfully
- **THEN** an invocation record exists carrying the prompt name, version, model, token counts, estimated cost, latency and a success outcome
- **AND** the caller can obtain that record's identifier

#### Scenario: A failed call is recorded

- **WHEN** a model call fails validation or is rejected by the provider
- **THEN** an invocation record exists with a failure outcome and the tokens actually consumed

#### Scenario: An inferred fact can be traced to its call

- **WHEN** a stored value was derived from a model call
- **THEN** the invocation that produced it can be identified from the stored record

### Requirement: Spending is bounded

The system SHALL enforce a configurable spend ceiling over a configurable window. When the ceiling is reached the system SHALL refuse further model calls with an error stating the ceiling and the window, and SHALL NOT send the request.

#### Scenario: Calls proceed below the ceiling

- **WHEN** recorded spend in the current window is below the configured ceiling
- **THEN** a model call proceeds normally

#### Scenario: Calls are refused at the ceiling

- **WHEN** recorded spend in the current window has reached the configured ceiling
- **THEN** further calls fail with an error naming the ceiling and the window
- **AND** no request reaches the provider

### Requirement: Transient provider failures are retried, permanent ones are not

The system SHALL retry rate-limit and transient network failures with exponential backoff up to a configured attempt limit, and SHALL NOT retry authentication failures, invalid-request failures, or content refusals. Every call SHALL be bounded by a timeout.

#### Scenario: A rate limit is retried

- **WHEN** the provider reports a rate limit and a later attempt succeeds
- **THEN** the call returns the successful result
- **AND** the invocation record reflects the attempts made

#### Scenario: An authentication failure is not retried

- **WHEN** the provider rejects the API key
- **THEN** the call fails immediately without further attempts

#### Scenario: A hanging call is bounded

- **WHEN** the provider does not respond within the configured timeout
- **THEN** the call fails with a timeout error rather than waiting indefinitely

### Requirement: Credentials and payloads stay out of the logs

The system SHALL NOT write the API key, the rendered prompt, or the full model response to any log or error message. Log output SHALL be limited to the prompt name, version, model, token counts, cost, latency and outcome.

#### Scenario: A failure is logged without its payload

- **WHEN** a model call fails and the failure is logged
- **THEN** the log entry contains the prompt name, version and outcome
- **AND** contains neither the API key nor the rendered prompt text

#### Scenario: The key never appears in an error

- **WHEN** the provider rejects the API key and the resulting error is surfaced
- **THEN** the error message does not contain the key or any part of it
