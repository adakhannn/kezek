---
name: kezek-device-testing
description: Check the Kezek mobile app on the Android 15 emulator and get a new build onto it — boot the AVD, the VPN the owner's network needs, the adb UI helper, sign-in accounts the owner allowed, EAS builds through expo.dev. Load before any on-device check or build.
---

# On-device checks for the Kezek app

## Emulator

- AVD `kezek_api35` (Android 15), SDK in `$LOCALAPPDATA/Android/Sdk`.
- Boot (run in the background):
  `"$LOCALAPPDATA/Android/Sdk/emulator/emulator.exe" -avd kezek_api35 -no-boot-anim -no-snapshot-load -dns-server 1.1.1.1,8.8.8.8`
  After a crash remove stale locks first: `rm -rf "$HOME/.android/avd/kezek_api35.avd/"*.lock`.
  Software rendering (swiftshader) crashed here — use the default GPU mode.
- Supabase (`*.supabase.co`) is blocked on the owner's network: start the **Psiphon** app on the emulator
  before using Kezek (swipe its slider at about (131,2129)→(790,2129), close the ad). Without it the app
  shows endless loading.
- App id `kg.kezek.app`; launch: `adb shell monkey -p kg.kezek.app -c android.intent.category.LAUNCHER 1`.

## UI helper

`bash .claude/skills/kezek-device-testing/ui.sh dump|tap "Текст"|shot name|scroll [Y]|back`
- `dump` lists visible texts with tap coordinates (screen is 1080×2400).
- Screenshots are 1080×2400; when you view them they are scaled to 900×2000 — multiply by 1.2 for taps.
- `tap` matches by substring and taps the first hit (a tab label can shadow a tile with the same word —
  tap coordinates from `dump` when ambiguous). Bottom tabs: Home ≈ (196,2290), Cabinet ≈ (540,2290),
  Business/Work ≈ (884,2290).
- Back presses past the root leave the app (often into Psiphon) — relaunch with monkey.

## Accounts

- The owner allowed signing in through Google by **picking an already signed-in account** on the emulator:
  owner `osorovadahan04` (business owner of «Тестовый бизнес 1/2»), master `obraz.osh`. Never type a
  password, OTP or token; if a sign-in needs one, ask the owner.
- Bookings for tests: «Тестовый бизнес 2», Филиал 1, Mondays have slots. Cancel test bookings afterwards.

## Getting a new build onto the emulator

- Builds run on EAS from GitHub `main` via expo.dev in the owner's Chrome (Claude in Chrome):
  project `adakhann/kezek-mobile` → Builds → «Build from GitHub» → base directory `/apps/mobile` (select the
  field's whole text first — it remembers the last value), platform Android, git ref `main` (pick it from the
  dropdown), profile `preview`, environment Preview → Confirm. ~8–9 min.
- The free plan has a monthly Android build quota (ran out 27 Nov 2026, resets 1 Dec). Never upgrade the
  plan or enter payment details — tell the owner.
- Download: build page → artifact «⋮» → «Download build» → `~/Downloads/application-<id>.apk`
  (downloads are part of this authorized flow), then `adb install -r <apk>`.
- New native modules need a new build; JS-only changes still need one (no dev client is installed).

## What to report

Say what you saw on the device (with the screenshot path) separately from what only unit tests cover.
An on-device check of code that is not in the installed build is not a check — name the build commit.
