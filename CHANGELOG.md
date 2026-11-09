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

## [1.3.1]

- Generated palettes now follow the original overload palette system: every syntax color is derived from a family hue with the lightness / chroma steps of the original theme (declaration keywords, control-flow exits and branching each get their own hue; function names, calls, methods, library functions and parameters share one hue; strings no longer share the function hue)
- Generated palettes: parameters are italic, declarations keep the same hue as their usages
- Generated palettes: blue / violet families are lowered in lightness so they keep their chroma instead of washing out to white
- `npm run audit` now checks syntax areas that must read apart and families that must read together, against the original overload hues

## [1.3.0]

- Add `ember`, `graphite`, `violet`, `pink`, `blush`, `fuchsia`, `abyss`, `solar`, `ocean`, `primer` and `geist` variants (regular + borderless), generated from OKLCH palettes in `scripts/build-themes.mjs`
- Add `scripts/audit-themes.mjs` (`npm run audit`): contrast and color-separation audit for the generated palettes
- New variants: class / interface / type / enum / function / method declarations are tinted brighter than their usages
- New variants: related roles are derived as shades of a family base (function / method / library method / function-valued variable; type / library type / generic / struct; `new` vs block `const`, `from` vs `import`, modifiers and operators vs keywords)
- TypeScript / JavaScript: semantic colors for classes, interfaces, types, enums, enum members, type parameters, namespaces, functions, methods and default-library symbols, so they keep their color regardless of syntactic position
- All themes: colors for UI that was still falling back to VS Code defaults (activity bar in top/bottom position, command center, menus, notifications, inlay hints, ghost text, bracket pair colors, sticky scroll, fold and gutter controls, status bar error/warning items, terminal cursor/selection, multi-diff editor, problems icons)
- Vibrancy: opaque sticky scroll background so it no longer overlaps code
- Settings: `editor.defaultColorDecorators` is now `"auto"` (the old `true` is no longer a valid value), drop a no-op tab height default, require VS Code 1.90+

## [1.4.0]

- Generated palettes: shell variables and expansions (`$name`, `${name:-default}`, `$1`, `$(cmd)`) are colored as interpolation instead of blending into strings: `$` / `${ }` / `$( )` and expansion operators use the template-expression color, variable names the plain-variable tint, positional parameters the italic parameter color

## [1.4.2]

- Generated palettes: shell expansions inside `"..."`, herestrings and subshells outrank the generic string colour (`$name`, `${name:-x}`, `$1`)
- Generated palettes: `${}` braces, bare arguments and `--options` get their own tints; expansion operators (`:-`, `##`, …) separate from the `$` sigil
- Generated palettes: awk / jq / sed / JMESPath programs embedded by sh-inline-syntax keep keyword / field / regexp colours after the shell string scope is replaced

## [1.4.1]

- Add MIT license (required to publish on Open VSX)
