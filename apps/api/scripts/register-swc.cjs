const { transformSync } = require("@swc/core");

require.extensions[".ts"] = (module, filename) => {
  const source = require("node:fs").readFileSync(filename, "utf8");
  const output = transformSync(source, {
    filename,
    sourceMaps: "inline",
    module: { type: "commonjs" },
    jsc: {
      target: "es2023",
      parser: { syntax: "typescript", decorators: true },
      transform: { legacyDecorator: true, decoratorMetadata: true },
    },
  });

  module._compile(output.code, filename);
};
