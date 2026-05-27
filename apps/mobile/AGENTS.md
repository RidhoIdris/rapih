# Rapih Mobile — agent guide

## Expo HAS CHANGED

This app is **Expo SDK 55 / React Native 0.83 / Expo Router v5 / Reanimated 4**.
Your training data is older than this. Read the exact versioned docs at
https://docs.expo.dev/versions/v55.0.0/ before writing any native/config code.

## What this app is

Rapih is an AI personal-finance app for Indonesian Gen-Z (Bahasa Indonesia UI, IDR). The app runs against a real backend (`apps/api`) — Google sign-in works end-to-end, and domain CRUD (wallets, …) is wired feature-by-feature.

Currently implemented end-to-end (UI + API): **auth flow** (Google sign-in via `@react-native-google-signin`, JWT + refresh, onboarding with `PATCH /me/onboarding`), **wallets / dompet** (CRUD via `/wallets`).

Other features still UI-only against dummy data: Beranda, Tanya, Aktivitas / Scan Struk / Rutin, Budget / Goal, Profil.

## Stack (decided — do not swap without reason)

- **Navigation**: Expo Router v5, file-based. Routes in `src/app` ONLY.
- **State**: Zustand (`src/features/*/...-store.ts`). Lightweight, no providers.
- **Styling**: central design tokens + typed primitives. **Inline styles only**
  (RN has no CSS/Tailwind here). Never hardcode a color/size — pull from
  `@/theme`.
- **Icons**: `react-native-svg`, ported in `src/components/icons/icon.tsx`.
- **Fonts**: `@expo-google-fonts/*` via `src/lib/fonts.ts` (Bricolage
  Grotesque = display, Plus Jakarta Sans = UI, JetBrains Mono = figures).
- **Haptics**: `expo-haptics` wrapped in `src/lib/haptics.ts` (iOS-only no-op).

## Directory map

```
src/
  theme/        tokens.ts (color/space/radius/shadow) · typography.ts · index.ts
  lib/          fonts.ts · money.ts (rupiah) · haptics.ts
  components/
    ui/         Text Button Card Screen Field Chip Caret Glow ProgressDots
                BackButton LabeledDivider TabBar  ← primitives, import via @/components/ui
    brand/      RapihMark RapihWordmark Monogram
    icons/      icon.tsx  ← <Icon name=... />, the only place raw <Svg> lives
                (exception: TabBar owns its own nav glyphs — stateful fill/stroke)
  features/
    auth/
      signup-store.ts          zustand wizard state (seeded w/ design sample data)
      components/step-header.tsx  feature-local shared piece
      screens/*.tsx            screen compositions (NOT routes)
    home/
      screens/beranda-screen.tsx  home dashboard (PulseRing helper is local)
    tanya/
      screens/tanya-screen.tsx    AI co-pilot chat (NO TabBar — has composer;
                                  custom header+scroll+absolute composer layout,
                                  not <Screen>; SVG fade behind composer)
    wallet/
      screens/dompet-screen.tsx         wallet list (has TabBar)
      screens/dompet-detail-screen.tsx  BCA detail (inline SVG LinearGradient
                                        card bg + sparkline; back via router)
      screens/tambah-dompet-screen.tsx  add wallet (x closes via router.back)
    activity/
      screens/transaksi-screen.tsx        TRANSAKSI HUB — a TabBar tab.
                                          Segmented "Aktivitas | Rutin"
                                          (mode from `?mode=rutin` param);
                                          Rutin mode renders <RutinPanel/>.
                                          FAB is mode-aware: Aktivitas →
                                          inline chooser (Tulis manual /
                                          Scan struk); Rutin → push direct
                                          to /(app)/tambah-rutin (single
                                          destination, no chooser).
      screens/transaksi-detail-screen.tsx tx detail
      screens/tambah-transaksi-screen.tsx add tx (faux amount + caret)
    scan/
      screens/scan-struk-screen.tsx        dark camera (NO Screen; own
                                           StatusBar light; shutter→review)
      screens/scan-struk-review-screen.tsx OCR review (Screen)
    recurring/
      components/rutin-panel.tsx           recurring-bills content (no Screen/
                                           header) — Rutin mode of the hub
      screens/recurring-detail-screen.tsx  KPR detail (solid #0060af + Glow)
      screens/tandai-bayar-screen.tsx      bottom-sheet (transparentModal;
                                           NO Screen; own StatusBar light)
      screens/tambah-rutin-screen.tsx      add recurring (Cicilan/Asuransi/
                                           Langganan segmented; faux amount
                                           + caret; frequency picker)
    budget/
      components/budget-panel.tsx          envelope buckets w/ progress
                                           bars (REWRITE — replaces the
                                           original bento "water-line" mock)
      components/goals-panel.tsx           goals card grid + filter chips
      screens/budget-screen.tsx            BUDGET HUB — a TabBar tab.
                                           Segmented "Budget | Goal"
                                           (mode from `?mode=goal` param);
                                           FAB is mode-aware: Goal → push
                                           /(app)/tambah-goal; Budget →
                                           push /(app)/tambah-budget.
      screens/goal-detail-screen.tsx       single goal detail (moss hero +
                                           ritme nabung bars)
      screens/tambah-goal-screen.tsx       create goal (preview + form +
                                           icon picker + AI rhythm)
      screens/tambah-budget-screen.tsx     create envelope (live preview
                                           row + 6-emoji category picker
                                           + plafon picker)
    profile/
      screens/saya-screen.tsx              profile tab (TabBar) — gear in
                                           header → /(app)/pengaturan
      screens/pengaturan-screen.tsx        settings (AI persona / notif
                                           toggles / display selects)
      screens/notifikasi-screen.tsx        notification feed (grouped Hari
                                           ini / Minggu ini)
  app/          ROUTES ONLY — thin files that re-export a feature screen
    _layout.tsx          fonts + splash gate + providers
    index.tsx            redirect → /(auth)/splash
    (auth)/_layout.tsx   auth Stack
    (auth)/...            splash login register/email register/name register/income done
    (app)/_layout.tsx    main-app Stack (post-auth)
    (app)/beranda.tsx    → Beranda
    (app)/tanya.tsx      → Tanya (TabBar center button)
    (app)/budget.tsx     → Budget hub (TabBar tab; `?mode=goal` for
                           Goal mode)
    (app)/transaksi.tsx  → Transaksi hub (TabBar tab; `?mode=rutin` for
                           Rutin mode — Beranda "Tagihan" tile uses this)
    (app)/dompet.tsx · dompet-detail.tsx · tambah-dompet.tsx
    (app)/transaksi-detail.tsx · tambah-transaksi.tsx (from hub FAB)
    (app)/scan-struk.tsx · scan-struk-review.tsx (from hub FAB / Beranda tile)
    (app)/rutin-detail.tsx · tandai-bayar.tsx (transparentModal in _layout)
    (app)/tambah-rutin.tsx (from Rutin FAB / dashed "Tambah tagihan rutin")
    (app)/goal-detail.tsx · tambah-goal.tsx · tambah-budget.tsx (from Budget hub)
    (app)/saya.tsx · pengaturan.tsx · notifikasi.tsx
```

**Navigation**: `<TabBar>` self-routes via its internal `ROUTES` map
(`beranda`/`budget`/`transaksi`/`tanya`/`saya` all wired). Callers just
render `<TabBar active="..." />` — do NOT pass `onTab` unless overriding.
Tabs: Beranda · Budget · ⟨Tanya⟩ · Transaksi · Saya.

**Design figures & accents** (added for Beranda, reuse everywhere):
- `textVariants.figureXL/figureL/figureM/figureS` — serif (Bricolage) money &
  stat numbers. Use these for any large figure; override `fontSize` in `style`
  only for one-off sizes (matches the auth-screen pattern).
- `tint` from `@/theme` — pastel category tile colors (`amber/mint/iris/peach`
  + matching `*Ink`). For quick-access tiles, category bars, info cards. These
  are CONTENT accents, separate from the core brand `palette`.
- `<TabBar active="beranda" />` — floating bottom nav, 4 tabs + raised center
  Tanya button. Render it as a sibling AFTER `<Screen>` (it's absolutely
  positioned); give the Screen `bottomInset≈96` so content clears it. Pass
  `onTab={(id) => …}` to wire navigation (Beranda routes `tanya` → `/(app)/tanya`).
- `tint.gold` (#e0a83e) — mid-saturation gold for chart/breakdown bars
  (distinct from the pale `tint.amber` fill tile). `Icon name="send"` =
  paper-plane glyph (chat composer send button).

## Conventions (follow these to stay consistent)

1. **Routes are dumirror files.** A file in `src/app` is one line:
   `export { XScreen as default } from '@/features/x/screens/x-screen';`
   The real UI lives in `features/<domain>/screens`. Never put components,
   utils or types inside `src/app` (Expo Router anti-pattern).
2. **All text** goes through `<Text variant="...">` from `@/components/ui`.
   Add a new entry to `textVariants` in `theme/typography.ts` rather than
   ad-hoc `fontSize`.
3. **All color/spacing** comes from `palette` / `space` / `radius` / `shadow`
   in `@/theme`. A redesign should be a tokens-only change.
4. **Shadows** use the CSS `boxShadow` string prop (never legacy RN
   `shadow*`/`elevation`).
5. **New fonts/weights**: add to BOTH `theme/typography.ts` (`fontFamily`) and
   `lib/fonts.ts` (`FONT_MAP`) — keys must match.
6. **Screens** are wrapped in `<Screen>` which handles safe-area + scroll
   **+ the status-bar style** (auto: light content on `moss` bg, dark
   otherwise — so clock/battery/wifi stay visible). Top spacing is the
   **bare safe-area inset** — there is NO `topInset`; never re-add a manual
   `paddingTop` in a header (the inset already clears the status bar). Only
   `bottomInset` exists, and only to clear the floating TabBar (≈96). A
   screen that does NOT use `<Screen>` (e.g. Tanya's custom chat layout)
   must use `useSafeAreaInsets()` (`insets.top`, no extra gap) and render
   its own `<StatusBar style="dark|light" />` from `expo-status-bar`.
   Use the `flex:1` spacer pattern to pin a CTA to the bottom (see any
   auth screen).
7. After changes: `npx tsc --noEmit` and `npx eslint src --max-warnings=0`
   must both pass. Typed routes regenerate when Metro runs (`npx expo start`).

## Mocked / deferred (wire later, structure already supports it)

- **Inputs are visual.** `Field` renders a label + value/placeholder, not a
  real `<TextInput>`. The signup store is seeded with the design's sample
  values so screens match the mock. To make editable: swap the value `<Text>`
  in `components/ui/field.tsx` for a `TextInput` and bind to the store — no
  screen changes needed.
- **Beranda is static.** All numbers/transactions are hardcoded inline in
  `beranda-screen.tsx` (mirrors the design mock). No store yet — add a
  `home-store.ts` (zustand) and lift the consts into it when wiring data.
- **TabBar is presentational.** Taps fire haptics + an optional `onTab`
  callback; tab→route navigation isn't wired (only Beranda exists). The
  `(app)` group is where post-auth tab screens go.
- Social / forgot-password / OTP buttons are inert by design.

## Adding a new screen (recipe)

1. Build it in `src/features/<domain>/screens/<name>-screen.tsx` using
   `@/components/ui` primitives + `@/theme`. No raw colors/sizes.
2. Add a one-line route file under `src/app/...` re-exporting it.
3. Register it in the relevant `_layout.tsx` `<Stack>` if it needs specific
   options (background, gestures).
4. `tsc` + `eslint`, then `npx expo start` to smoke-test in Expo Go.

## Wiring a feature to the API (domain CRUD pattern)

The canonical reference is **wallet** (`src/features/wallet/`). When wiring a new domain (categories, transactions, goals, budgets, …), follow that pattern exactly:

```
src/features/{resource}/
  api.ts                  apiRequest wrappers (list/get/create/update/delete) returning DTO types from @rapih/shared
  {resource}-store.ts     Zustand: { status, error, items, fetch(), create(), update(), remove() }
  brands.ts (optional)    display-only data: brand colors, suggestion lists — NOT stored on the backend
  screens/*.tsx           screen compositions; route files in src/app re-export these
```

### API client

- `apiRequest<T>(path, opts)` from `@/lib/api` handles bearer + auto-refresh on 401. Don't `fetch()` directly.
- Type the response with the DTO from `@rapih/shared` (e.g. `WalletDto`, `WalletListResponse['data']`).
- For 204 responses (DELETE), the wrapper returns `undefined as T`.

### Money

- Money is sent as a numeric **string** in JSON (`"8420000"`, including negative for liabilities).
- For sums and display, parse with `Number(s)` — wallets/transactions won't realistically exceed `Number.MAX_SAFE_INTEGER` cents.
- Use `rupiah(cents, { short })` from `@/lib/money` for display.

### Auth

- Bootstrap on splash (`src/features/auth/bootstrap.ts`) reads refresh from SecureStore → `/auth/refresh` → `/auth/me` → routes based on `onboarding_completed_at`.
- All non-auth endpoints require completed onboarding (backend enforces 403 `onboarding.required`). Don't call them on the splash/login screens.
- Google sign-in: `googleSignIn()` from `src/features/auth/google-signin.ts` returns `{kind: 'success', idToken}` or one of the failure states; pass `idToken` to `signInWithGoogle()`.

### Routing & params

- Expo Router v5 typed-routes choke on the `{ pathname, params }` object form. Use querystring strings instead:

  ```ts
  // ✅ works
  router.push(`/(app)/dompet-detail?id=${encodeURIComponent(id)}` as Href);

  // ❌ TS errors
  router.push({ pathname: '/(app)/dompet-detail', params: { id } });
  ```

- Read params with `useLocalSearchParams<{ id?: string }>()`.

### Env

- Add new public-safe vars under `apps/mobile/.env` with `EXPO_PUBLIC_` prefix and validate them in `src/lib/env.ts`. The `required(name)` helper throws at module-load if missing.

### Empty states + pull-to-refresh

- Wrap list screens in a `<ScrollView refreshControl={<RefreshControl ... />}>` so users can re-fetch.
- Empty state copy in Bahasa Indonesia, friendly tone (mirror dompet-screen).
