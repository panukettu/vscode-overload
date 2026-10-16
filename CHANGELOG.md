# Change Log

All notable changes to the "overload" extension will be documented in this file.

## [Released]

- Initial release
- Add alternative colors
- Add borderless for both color themes
- Add solidity semantic tokens

## [1.2.0]

- Remove dependency on APC Customize UI++ (broken since VSCode 1.94)
- Use native `workbench.activityBar.location` for bottom activity bar
- Document optional UI tweaks / vibrancy via Custom UI Style

## [1.3.0]

- Add `ember`, `graphite`, `violet`, `pink`, `blush`, `fuchsia`, `abyss`, `solar`, `ocean`, `primer` and `geist` variants (regular + borderless), generated from OKLCH palettes in `scripts/build-themes.mjs`
- Add `scripts/audit-themes.mjs` (`npm run audit`): contrast and color-separation audit for the generated palettes
- New variants: class / interface / type / enum / function / method declarations are tinted brighter than their usages
- New variants: related roles are derived as shades of a family base (function / method / library method / function-valued variable; type / library type / generic / struct; `new` vs block `const`, `from` vs `import`, modifiers and operators vs keywords)
- TypeScript / JavaScript: semantic colors for classes, interfaces, types, enums, enum members, type parameters, namespaces, functions, methods and default-library symbols, so they keep their color regardless of syntactic position
- All themes: colors for UI that was still falling back to VS Code defaults (activity bar in top/bottom position, command center, menus, notifications, inlay hints, ghost text, bracket pair colors, sticky scroll, fold and gutter controls, status bar error/warning items, terminal cursor/selection, multi-diff editor, problems icons)
- Vibrancy: opaque sticky scroll background so it no longer overlaps code
- Settings: `editor.defaultColorDecorators` is now `"auto"` (the old `true` is no longer a valid value), drop a no-op tab height default, require VS Code 1.90+
