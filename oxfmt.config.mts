import { defineConfig, type OxfmtConfig } from "oxfmt";

export default defineConfig({
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: false,
  singleAttributePerLine: false,
  bracketSameLine: false,
  trailingComma: "all",
  bracketSpacing: true,
  arrowParens: "always",
  sortImports: true,
} satisfies OxfmtConfig);
