import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Shared flat ESLint config.
 *
 * Consume from a package's own eslint.config.js:
 *
 *   import base from "@mela/eslint-config";
 *   export default base;
 *
 * `eslint-config-prettier` is last so formatting rules never fight Prettier.
 */
export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/drizzle/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: {
      // Environment variables are read once, validated, and re-exported by
      // @mela/config. Reading process.env anywhere else bypasses validation.
      // packages/config turns this rule off for itself.
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "env",
          message:
            "Import validated environment config from @mela/config instead of reading process.env directly.",
        },
      ],

      // Unused values are almost always a mistake, but an underscore prefix
      // is the documented way to say "intentionally unused".
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // Never fabricate data: an empty catch silently turns a failure into a
      // success, which is how "unknown" becomes a fake fact.
      "no-empty": ["error", { allowEmptyCatch: false }],

      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
    },
  },
  {
    // Config files and scripts legitimately need process.env before the
    // validated config exists.
    files: ["**/*.config.{js,cjs,mjs,ts,cts,mts}", "**/scripts/**"],
    rules: {
      "no-restricted-properties": "off",
    },
  },
  prettier,
);
