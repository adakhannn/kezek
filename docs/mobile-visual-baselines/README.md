# Mobile visual baselines

Captured on 2026-06-08 from the Expo development build on Android API 35.

## Baselines

- `auth-360dp.png`: sign-in shell at 1440 px / 640 dpi (360dp logical width).
- `auth-412dp.png`: sign-in shell at 1440 px / 560 dpi (approximately 411dp logical width).
- `whatsapp-entry-412dp.png`: WhatsApp entry screen at approximately 411dp.

## Visual contract

- The auth card remains centered and fully visible without clipped text.
- Header hierarchy remains badge, title, subtitle, helper copy, methods caption.
- CTA priority remains Google neutral, Telegram outlined accent, WhatsApp solid brand.
- All CTA touch targets remain at least 48dp tall.
- System status/navigation icons remain light over the dark application shell.
- Screenshots must not contain account data, real phone numbers, transient Toasts, or dev-menu overlays.

## Recapture

Use a clean AVD so the authenticated test session on the primary emulator is not modified. Capture
at density 640 and 560, remove transient development overlays, and update the PNGs only after manual
comparison with the previous baseline.
