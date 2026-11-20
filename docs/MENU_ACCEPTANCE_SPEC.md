# MAX FLIX 22 — Menu Acceptance Specification

Status: review candidate  
Art direction: Industrial Noir  
Scope: main menu, section navigation, loading overlay and cinematic intro  
Constraint: preserve game modes, saves, progression and existing action IDs

## 1. Audit basis

The current `main` already contains a three-mode front page, four navigation groups, twelve section destinations, compact operator details, per-tab scroll memory, keyboard navigation, shared responsive scaling, an Industrial Noir visual layer, a procedural intro and an asset loader. This pass consolidates those systems rather than introducing a competing menu.

A separate document explicitly named "Hub report" was not found in the available project library or repository. The available Android build report is packaging/QA evidence, not a menu UX study; it is not treated as the basis for UX claims. Decisions here are tied to source files and regression tests currently in the repository.

## 2. Information architecture

### Primary layer — always visible
1. **Brand header** — game identity, concise genre line, release/status strip and optional Odprawa action. Do not turn it into a long feature inventory.
2. **Three primary mode cards** — always visible together and outside secondary tabs:
   - **Survival** — immediate endless run; primary "Graj teraz" action.
   - **Kampania** — opens five-stage campaign board and continues the next available stage.
   - **Arena PvP** — opens the PvP lobby; online readiness and local bot practice must be described honestly.
3. **Four grouped navigation categories** — twelve destinations remain individually addressable, including Uzbrojenie.
4. **One active content viewport** — only the selected destination is visible; details expand within it.
5. **Persistent launch/confirm action** — stays separated from scrollable reference content wherever the existing mode contract provides it.

### Navigation groups and their purpose

| Group | Destination | Purpose |
|---|---|---|
| 01 / Rozgrywka | Operatorzy | Pick one of five operators and inspect their profile |
| 01 / Rozgrywka | Kampania | Stage selection, continue, stars, mastery objectives and rewards |
| 01 / Rozgrywka | Arena PvP | Match type, manual-aim guidance, bot/online state and lobby |
| 02 / Świat i BHP | Zagrożenia | Enemy catalogue, telegraphs and counterplay |
| 02 / Świat i BHP | Uzbrojenie | Current ten primary firearms, ranges, damage, cadence and reload data |
| 02 / Świat i BHP | Moduły BHP | Perks, passive modules, unlock/use descriptions |
| 02 / Świat i BHP | Kodeks | Controls, weapons, rules, mechanics and field reference |
| 03 / Postępy | Drzewko | Account-level talents and long-term development |
| 03 / Postępy | Rangi | Account ranks, thresholds and bonuses |
| 03 / Postępy | Ranking | Online leaderboard with explicit offline/error states |
| 03 / Postępy | Osiągnięcia | Campaign/Survival achievements and secrets |
| 04 / System | Ustawienia | Audio, graphics, controls, privacy and accessibility |

No destination is removed or merged. The campaign panel may describe the connected Survival world, but must label these as distinct systems so users do not mistake the Survival map for a campaign stage selector.

## 3. Operator selection

- Keep five operator choices visible as compact identity cards.
- Emblems are bounded thumbnails, never oversized overlays across names, stats or controls.
- Selecting an operator updates one shared detail pane.
- Detail pane exposes three mutually exclusive subviews: **Profil**, **Zdolności**, **Mistrzostwo**.
- Health, movement, attack, defence and ability data remain numeric and legible.
- Voice preview remains optional and must not trigger gameplay.
- Operator selection must not reset progression or alter balance values.

## 4. Navigation and scrolling contract

- Menu shell is viewport-bounded and respects safe-area insets.
- The active content viewport is the single vertical scroll owner.
- The navigation rail/grid scrolls only if its own content exceeds its viewport.
- Switching tabs saves the outgoing scroll position and restores the incoming position.
- Exactly one tab is selected; inactive panels are hidden and inert.
- Touch selection uses native click only; no duplicate touchend selection handler.
- Desktop rail is vertical and uses Up/Down arrows. Horizontal/mobile navigation uses Left/Right.
- Home/End select first/last destination; Enter/Space activates the focused control.

## 5. Responsive behavior

### Phone portrait (Poco F6 class)
- Three primary modes stay visible together: two cards in the first row, PvP across the second row.
- Four navigation groups form a compact two-by-two matrix.
- Labels remain readable; icons never overlap text.
- Long descriptions remain inside their destination, not the home screen.
- Operator emblems stay inside fixed thumbnail bounds.
- Only the active section scrolls.

### Very narrow portrait
- Navigation groups fall back to one column to preserve legible labels.
- Controls retain usable hit areas.
- Copy wraps/clamps without expanding inactive sections.

### Phone landscape / short viewport
- Three mode cards fit in one compact row.
- Navigation remains grouped and tappable.
- Intro, loader and controls respect top/bottom/side safe areas.
- No action sits beneath system gesture bars or camera cutouts.

### Tablet and desktop
- Preserve the desktop control-room layout and left navigation rail.
- Keep three primary modes aligned in one row when space permits.
- Use one content pane with stable maximum width.
- Do not enlarge operator artwork to fill empty layout space.

## 6. Visual system

Industrial Noir is the only art direction in this pass.

| Token | Value | Role |
|---|---|---|
| Ink | `#111719` | Main canvas |
| Panel | `#1a2223` | Main panels |
| Raised panel | `#202a2a` | Cards and selected surfaces |
| Ivory | `#e5e0d3` | Primary text |
| Muted | `#a6aaa1` | Secondary text |
| Champagne | `#c5ad7b` | Active/focus accent |
| Mint | `#8eaa98` | Positive/status accent |
| Steel | `#879eaa` | PvP/system accent |

Use thin borders, restrained depth, quiet gradients, readable contrast and consistent radii. Avoid repeated neon glow, oversized artwork and decorative elements that compete with action labels.

## 7. Intro and loading

- Keep procedural Canvas intro lightweight; do not add a large video payload.
- Preserve skip, Escape and click-away dismissal.
- Respect reduced-motion preference.
- Keep Survival, Campaign and PvP labels synchronized with real game capabilities.
- Loader progress must reflect the actual asset-loader state; never fabricate percentages.
- Loader card is viewport-bounded and scrollable on short screens.
- Intro/loader must not block gameplay after required assets are ready.

## 8. Accessibility and performance

- Champagne focus ring; text meaning is not conveyed by color alone.
- Touch targets aim for at least 40–44 CSS px on normal phone layouts.
- Tabs expose selected state and their corresponding panel; inactive panels are aria-hidden and inert.
- Arrow direction follows rail orientation; Home/End always work.
- Reduced motion collapses transitions and disables hover lift.
- Do not add a menu video, large new texture atlas or continuous particle system.
- Avoid expensive blur on mobile; preserve lazy loading and offline fallbacks.
- Do not rewrite game logic, progression schemas, save keys or Android packaging in a menu-only pass.
- PvP online readiness is a runtime service state, not a decorative promise.

## 9. Acceptance checklist

- [ ] Survival, Kampania and Arena PvP are visible together and retain current actions.
- [ ] All twelve destinations remain present, including the current armory catalogue.
- [ ] Four navigation categories remain named and visually distinct.
- [ ] Only one content panel is visible at a time.
- [ ] Panel scroll memory survives tab switches.
- [ ] Phone portrait uses grouped compact navigation, not a long one-column list.
- [ ] Short landscape and safe-area layouts remain usable.
- [ ] Operator art cannot cover labels or controls.
- [ ] Intro can be skipped and respects reduced motion.
- [ ] Loader remains bounded and reflects actual loader state.
- [ ] Keyboard arrows follow current navigation orientation.
- [ ] Existing game logic, progression and saved data remain unchanged.

## 10. Validation status

Regression tests cover stylesheet order, retained destinations, the single-scroll-owner contract, touch layout and orientation-aware keyboard navigation. A full Vite build, TypeScript lint and physical device visual pass still need to run in CI/project build environment; source-level tests do not substitute for those checks.
