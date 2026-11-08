# Android implementation status

## Validation (this pass)

| Command | Exit |
|---|---|
| `npm run build` | **0** (`tsc -b` + `vite build`) |
| `npm test` | **0** (10 files, 72 tests) |

Storage-safety work from the previous pass is unchanged. Android files and scripts were not touched.

Parent verifies GUI and owns Gradle / `cap sync` / signing / publish.

## Profile update sheet vs bottom nav

Cause: overlay is portaled into `.phone` (kept). `.tabbar` is `z-index: 30` and `.fab` is `31` inside that stacking context; `.scrim` / `.sheet2` were `20` / `21`, so the tab bar painted over the sheet footer. Pointer hits landed on 记下.

Fix: wrap only the update overlay in `.update-layer` (`position: absolute; inset: 0; z-index: 32`) so backdrop + sheet + footer sit just above the tab bar, cover it, capture pointer, and trap Tab. Footer still uses `16px + safe-area`. Dish sheets and toast (`z-index: 35`) are unchanged.

## Privacy / data-loss (retained)

1. **Backup off.** `allowBackup=false`, `fullBackupContent=false`, `dataExtractionRules` exclude cloud backup and device transfer. FileProvider unchanged.
2. **Reads fail closed.** `readUtf8` returns `null` only for Capacitor 8 `OS-PLUG-FILE-0008`. Hydrate treats current/previous independently; I/O errors set `persistBlocked`.
3. **Staged native save.** Staging file, validate, keep previous, rename onto current.
4. **Migration copy.** Failed first native write does not claim migration succeeded.

## Not done here

`npx cap sync` / Gradle / keystore / GitHub Release publish. No secret values in source.
