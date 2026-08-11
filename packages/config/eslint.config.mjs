import base from "@mela/eslint-config";

/**
 * @mela/config is the one package allowed to read process.env: it reads each
 * variable once, validates it, and re-exports the frozen result. Everywhere
 * else the shared config's `no-restricted-properties` rule forbids it.
 */
export default [
  ...base,
  {
    files: ["src/env/**/*.ts"],
    rules: {
      "no-restricted-properties": "off",
    },
  },
];
