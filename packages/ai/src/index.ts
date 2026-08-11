/**
 * @mela/ai — the platform's only sanctioned path to a language model.
 *
 * Two layers: `AIProvider` is the thin transport over one vendor; `AIService`
 * is the only thing application code calls. Prompts are versioned modules
 * reviewed like code. Output is requested as structured data and always
 * parsed against the prompt's declared Zod schema — never coerced, never
 * defaulted. See docs/architecture.md.
 */

export {};
