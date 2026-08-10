import base from "@mela/eslint-config";

export default [
  ...base,
  {
    files: ["src/**/*.ts"],
    rules: {
      // The shared config prefers `import type` for imports used only in type
      // position. A NestJS constructor parameter *is* a type position, but
      // `emitDecoratorMetadata` writes those types into `design:paramtypes` at
      // runtime — which is how dependency injection knows what to supply. A
      // type-only import is erased, the metadata becomes `Object`, and every
      // provider fails to resolve.
      //
      // Applying the rule's autofix here would produce code that lints clean
      // and does not start. typescript-eslint documents turning it off in
      // projects that rely on decorator metadata; this is one.
      "@typescript-eslint/consistent-type-imports": "off",
    },
  },
];
