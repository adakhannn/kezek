# Mobile UI guide

**Status:** current engineering guidance, reviewed 2026-11-26.
**Audience:** anyone (people or agents) building or polishing a screen of `apps/mobile`.
**Prerequisites:** [CONTRIBUTING.md](../../CONTRIBUTING.md); the product-wide visual direction is in [UI_SYSTEM_FOUNDATION.md](../UI_SYSTEM_FOUNDATION.md), and this guide is its concrete mobile implementation.
**Source of claims:** the code in `apps/mobile/src/constants/theme.ts`, `apps/mobile/src/constants/colors.ts` and `apps/mobile/src/components/ui/*`, checked by `apps/mobile/src/__tests__/components/designSystem.test.tsx` and `themeContrast.test.ts`.
**Outcome:** every screen uses the same gutter, rhythm, surfaces, type and controls, so the app reads as one product.

## 1. The rules in one screen

1. **The navigation header carries the title.** A screen never starts with a second big title that repeats the header ("Новая услуга" under "Новая услуга"). If context helps, one muted `ScreenIntro` line ("Low Fade · Бишкек").
2. **One gutter: 16dp.** `Screen` applies it. Never add `padding: 20/24/26` to a screen container.
3. **Vertical rhythm:** 24 between sections (`layout.sectionGap`, the `Screen` default), 12 between items of a section, 16 between form fields.
4. **One card level.** A card never contains a card. Inside a card use rows, separators, `KeyValueRow`, fields. A section title sits on the page, above its card, not inside it.
5. **At most one primary (gradient) button per screen.** Other actions are `outline`, `ghost`, a `ListRow`, or a `Section` text action.
6. **Copy:** short labels (1–2 words for tabs and chips, nouns for section titles). Helper text only when it prevents a mistake ("Квадратное фото до 5 МБ"), never a sentence under every heading. No developer words on client screens ("Live", "Режим данных", "синхронизирован").
7. **Dates and times are picked, never typed.** `DateField`, `TimeField`, `DateRangeField`, `DateNavigator`. No `YYYY-MM-DD` / `HH:MM` placeholders.
8. **Units live in the field:** `suffix="сом"`, `suffix="мин"`, `suffix="%"`. Paired values (price from/to, start/end) go side by side in a `FieldRow`.
9. **Touch targets ≥ 44dp** (`MIN_TOUCH_TARGET`), every icon-only control has an `accessibilityLabel`, every string comes from the i18n dictionaries in ru, ky and en.
10. **States:** loading = `SkeletonList`/`SkeletonCard` (a spinner only for a tiny inline wait), empty = `EmptyState`, failure = `ErrorState` with retry (FE-08: a failure is never shown as empty data).

## 2. Tokens

Import from `src/constants/theme.ts` (scales) and `src/constants/colors.ts` (palette). The older `colors.layout.*` and `typography.*` stay for existing code; new code uses the scales below.

| Token | Values | Use |
| --- | --- | --- |
| `space` | `xxs 2 · xs 4 · sm 8 · md 12 · lg 16 · xl 20 · xxl 24 · xxxl 32 · huge 48` | All paddings, margins and gaps. No other numbers. |
| `layout` | `gutter 16`, `sectionGap 24`, `itemGap 12`, `fieldGap 16`, `tabBarClearance`, `actionBarHeight` | Page structure; `Screen` applies most of it. |
| `radii` | `xs 6 · sm 8 · md 12 · lg 16 · xl 20 · xxl 28 · pill 999` | Cards `lg`, controls `md`, chips and badges `pill`. |
| `typeScale` | `display 32 · title 22 · headline 17 · body 15 · bodyStrong 15/600 · callout 14 · caption 13 · overline 12 caps · metric 24` | `title` for a hero name, `headline` for section titles, `body` for content, `caption` for meta. `display` only for one hero number. |
| `surface` | `canvas < page < card < raised < emphasis`, `overlay` | Depth comes from a lighter fill, not from borders. Page = `surface.page`; a card = `surface.card`; a control inside a card = `colors.fill.input`/`raised`. |
| `text` | `primary · secondary · tertiary · onAccent · accent · success · warning · danger` | `tertiary` only for meta next to readable text. |
| `colors.tone.<accent/success/warning/danger/info/neutral>` | `{ fg, bg, border }` | Badges, status pills, tinted icons, error text. Each `fg` is AA on a card and on its own `bg` (tested). |
| `colors.gradient.accent` / `accentSoft` | `[from, to]` | The primary button (built in) and the one `accent` card of a screen. |
| `colors.fill` | `input · track · skeleton · pressed · selected` | Control fills. |
| `elevation` | `none · card · raised · floating` | Shadows only for floating things (sheet, tab bar, toast). |

```tsx
import { colors } from '../../constants/colors';
import { radii, space, typeScale } from '../../constants/theme';

const styles = StyleSheet.create({
    title: { ...typeScale.headline, color: colors.text.primary },
    meta: { ...typeScale.caption, color: colors.text.secondary },
    box: { padding: space.lg, borderRadius: radii.lg, backgroundColor: colors.surface.card },
});
```

## 3. Components

All live in `src/components/ui/` and are re-exported from `src/components/ui/index.ts`. Existing APIs (`Card`, `Input`, `Button`, `EmptyState`, `SegmentedTabs`) stay backward compatible.

| Component | When to use | Notes |
| --- | --- | --- |
| `Screen` | The root of every screen | Page background, 16dp gutter, 24dp gaps, pull to refresh (`refreshing` + `onRefresh`), bottom room for the floating tab bar (`tabBar`), sticky `footer`, `keyboard` for forms. `scroll={false}` when the screen owns a `FlatList`. |
| `ScreenIntro` | Optional first line of context | One muted line, max two lines. Not a title. |
| `Section` | A titled group on the page | `title`, optional `caption`, a text action (`actionLabel` + `onAction`) or `right`. No box. |
| `Card` | One grouped surface | Variants: `plain` (default for new work: filled, no border), `elevated` (legacy default), `outlined`, `accent` (the one highlighted block), `muted`. Padding `md` (16) for new work. Never nested. |
| `ListGroup` + `ListRow` | Menus, settings, short lists, people | Row = icon or `leading` (Avatar), title, subtitle, `value` / `trailing` / chevron / switch (`switchValue` + `onSwitchChange`). `destructive` for sign out / delete. A group draws hairline separators; `inset` indents them past the icon. |
| `KeyValueRow` | Label – value lines (booking details, payouts) | `emphasis` for a total, `tone` for a colored value. |
| `StatTile` + `StatGrid` | KPIs | `StatGrid columns={2|3}`. Value colored by `tone`. Optional `onPress` to drill down. |
| `Badge` / `StatusPill` | A short label / a record state with a dot | Tones from `colors.tone`. Do not invent new pill styles. |
| `ChipGroup` | Filters and small single/multi choices | One line that scrolls sideways (bleeds to the screen edges) — chips never wrap into ragged rows. `layout="wrap"` only for a short fixed set inside a form. Selected chip = filled accent + check. `count` shows a number. |
| `SegmentedTabs` | 2–4 views of one screen | Labels never wrap (one line, scales down slightly). More than three tabs scroll. Keep labels to one word ("Календарь", "Ресепшен", "Список"). |
| `FormField` | A text field | `label`, `required`, `hint`, `error`, `prefix`/`suffix` units, `multiline`. Built on `Input` (which also gained these props). |
| `FieldRow` | Two or three short fields side by side | Price from/to, percent master/salon, lat/lon. |
| `FieldGroup` | A titled block of fields inside a form | Overline title ("НАЗВАНИЕ", "ВРЕМЯ И ЦЕНА"); use several groups instead of one long flat stack. |
| `CheckboxRow` / `RadioRow` / `SwitchRow` | Choices with labels | The whole row toggles. `CheckboxRow` accepts `leading` (an Avatar). Use `SwitchRow` for on/off settings, checkboxes for "which of these". |
| `DateField` | One date | Shows "Чт, 26 ноября 2026" in the app language, opens the native calendar (Android dialog, iOS sheet with inline calendar), `minDate`/`maxDate`, `clearable`, `timeZone` (business tz decides "today"). Values are `YYYY-MM-DD` business dates. |
| `TimeField` | A time of day | 24-hour native clock, `minuteInterval`, `compact` for schedule rows ("09:00 – 18:00"). Values are `HH:MM`. |
| `DateRangeField` | A period | Two DateFields side by side; the end follows the start. |
| `DateNavigator` | Day-by-day stepping **where the website also steps** | ‹ date › + "Сегодня"; the date label opens the calendar. `step={7}` for weeks, `format` for a custom label. The opsKit `Stepper` (`pickDate` prop) and manageStaff `DateStepper` now open the calendar the same way. |
| `useNativePicker` | A custom control that needs the picker | `const picker = useNativePicker(); picker.open({ mode, value, onPick })` and render `{picker.sheet}`. |
| `Avatar` | A person | Photo (`uri`) or initials on a stable AA-contrast color; falls back to initials if the photo fails. Sizes: 32 dense, 40 list, 44 cards, 56–64 headers, 88 profile. `ring` for selected / "you". |
| `SkeletonList` / `SkeletonCard` / `SkeletonBlock` | Loading | Respect "reduce motion". |
| `EmptyState` | Nothing here yet | Tinted icon, short title, one line of message, optional action. `compact` inside sections. |
| `ErrorState` | A failed read | Defaults to "Не удалось загрузить / Проверьте соединение / Повторить" in the app language; pass `onRetry`. |
| `ActionBar` | Sticky bottom actions of a stack form or a flow step | One primary + optional secondary (left). Pass as `footer` of `Screen`. **Not on tab screens** (the floating tab bar covers it) — put the save button at the end of the content there. |

## 4. Layout recipes

### A list screen

```tsx
<Screen refreshing={refreshing} onRefresh={refresh}>
    <ScreenIntro>{business.name}</ScreenIntro>
    <Button title={t('manageStaff.staff.addStaff')} onPress={add} fullWidth />
    <Section>
        <Input value={query} onChangeText={setQuery} leadingIcon={<Ionicons name="search" size={18} color={colors.text.secondary} />} />
        <ChipGroup options={filters} value={status} onChange={setStatus} />
        {loading ? <SkeletonList /> : error ? <ErrorState onRetry={retry} /> : (
            <ListGroup>
                {rows.map((row) => (
                    <ListRow key={row.id} leading={<Avatar name={row.full_name} uri={row.avatar_url} />}
                        title={row.full_name} subtitle={row.branch}
                        trailing={<StatusPill label={t('…active')} tone="success" />}
                        onPress={() => open(row)} />
                ))}
            </ListGroup>
        )}
    </Section>
</Screen>
```

Reference: `screens/manageStaff/ManageStaffListScreen.tsx` (each row keeps its quick actions under a hairline because the website offers them in the list).

### A form

```tsx
<Screen keyboard footer={<ActionBar primary={{ title: t('…save'), onPress: save, loading: saving }} />}>
    {formError ? <FeedbackBanner variant="danger" message={formError} compact /> : null}
    <FieldGroup title={t('…group.name')}>
        <FormField label={t('…langRu')} required value={name} onChangeText={setName} error={errors.name} />
    </FieldGroup>
    <FieldGroup title={t('…group.pricing')}>
        <FormField label={t('…durationLabel')} suffix={t('…unitMin')} keyboardType="number-pad" … />
        <FieldRow>
            <FormField label={t('…priceFrom')} suffix={t('…unitSom')} keyboardType="decimal-pad" … />
            <FormField label={t('…priceTo')} suffix={t('…unitSom')} keyboardType="decimal-pad" … />
        </FieldRow>
    </FieldGroup>
    <Section title={t('…group.availability')} actionLabel={t('…selectAll')} onAction={selectAll} gap={0}>
        <Card variant="plain" padding="md">
            {branches.map((b) => <CheckboxRow key={b.id} label={b.name} checked={…} onChange={…} />)}
            <SwitchRow label={t('…activeTitle')} value={active} onChange={setActive} />
        </Card>
    </Section>
</Screen>
```

Reference: `screens/manage/catalog/ServiceEditScreen.tsx`.

### A hub (tab screen)

Hero (the entity with an `accent` card), then the sections as an even grid of equal tiles (2 columns, icon in a tinted square + label), then the live list, then secondary links as a `ListGroup`. Reference: `screens/dashboard/DashboardScreenSections.tsx`. Use `Screen tabBar`.

### A settings / profile screen

Hero (Avatar + name), then `Section` + `Card variant="plain"` per topic, links as `ListGroup` with `ListRow`s, sign out as a `destructive` row. Reference: `screens/profile/ProfileScreenSections.tsx`.

## 5. Dates and time zones

- A business date is `YYYY-MM-DD` on the business calendar (`businesses.tz`, default Asia/Bishkek), a time is `HH:MM` on the business clock ([Модель дат](../DATE_HANDLING_MODEL.md)).
- The pickers carry the value as a device-local `Date` with the same calendar fields (`utils/pickerValues.ts`) and read it back field by field, so the phone's own zone never shifts the day.
- "Today" for an empty field and the "Сегодня" shortcut come from the business time zone: pass `timeZone`.
- Booking day strips (client booking step 4, staff create booking) stay as horizontal day chips: the booking window is a short fixed list, as on the website.

## 6. Photos

`screens/staff/StaffAvatarEditor.tsx` is the master's own photo (website `/staff` avatar block): gallery with the system square crop (`allowsEditing`, `aspect [1,1]`), the website limits (image, ≤ 5 MB) checked before upload, upload with progress (`lib/staffAvatar.ts`, XHR multipart to `POST /api/staff/avatar/upload` with `X-Kezek-Staff-Id`), remove with confirmation (`POST /api/staff/avatar/remove`). Show people with `Avatar` and their `avatar_url` wherever the data has it.

## 7. Checklist for a polished screen

- [ ] Root is `Screen` (with `tabBar` on tab screens); no own container padding.
- [ ] No second title; at most one `ScreenIntro` line.
- [ ] Sections titled on the page; one card level; no bordered box around every block.
- [ ] One primary button; others outline/ghost/rows.
- [ ] Chips on one scrolling line; tabs single-line with short labels.
- [ ] Forms grouped (`FieldGroup`), units as suffixes, pairs in `FieldRow`, checkboxes/switches as rows, sticky `ActionBar` on stack forms.
- [ ] Every date/time is a picker.
- [ ] Skeleton while loading, `EmptyState` when empty, `ErrorState` with retry on failure.
- [ ] People shown with `Avatar`.
- [ ] Strings in ru/ky/en; touch targets ≥ 44; labels for icon-only controls.
- [ ] `pnpm -C apps/mobile typecheck`, `npx jest`, `pnpm -C apps/mobile lint` pass; render tests updated for changed texts.
