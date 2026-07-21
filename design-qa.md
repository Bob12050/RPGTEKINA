# Home, quest-hub, and gacha redesign design QA

## Comparison target

- Source visual truth path: `C:\Users\rei49\.codex\generated_images\019f8445-c9df-7940-a83a-512428998b84\exec-1e457141-2ee0-41e3-bdf5-90cf272a5a86.png`
- Implementation screenshot path: `C:\Users\rei49\.codex\visualizations\2026\07\21\019f8445-c9df-7940-a83a-512428998b84\rpgtekina-home-build\home-v3.png`
- Viewport: 390 × 844 CSS pixels
- State: fresh new game, home screen, no modal open
- Local implementation: `http://127.0.0.1:5173/`
- Full-view comparison evidence: `C:\Users\rei49\.codex\visualizations\2026\07\21\019f8445-c9df-7940-a83a-512428998b84\rpgtekina-home-build\comparison-v3.png`
- Focused-region evidence: not required. The comparison keeps both screens at the native 390 × 844 viewport, and the logo, status bar, primary CTA, banner, mission card, and bottom navigation remain legible at that scale.

## Findings

- No remaining P0, P1, or P2 findings.
- The implementation preserves the reference hierarchy: gold logo and resource strip, full-bleed hero art, dominant adventure CTA, event banner, beginner mission progress, and persistent five-item navigation.

## Required fidelity surfaces

- Fonts and typography: Japanese UI text uses the existing Hiragino/Noto/Yu Gothic fallback stack with bold optical weight for primary labels. The logo is the generated raster logo rather than substituted text. Hierarchy and wrapping match the source; no clipped or truncated labels were found.
- Spacing and layout rhythm: the 480 × 1040 logical canvas maps cleanly to 390 × 844. CTA, banner, mission card, and navigation align closely with the source's vertical landmarks. Persistent controls stay inside the viewport with no horizontal overflow.
- Colors and visual tokens: the navy, electric-blue, gold, mint stamina/progress, and warm CTA palette follows the source. Borders, glows, dark translucent panels, and selected states retain sufficient contrast.
- Image quality and asset fidelity: the hero, event banner, and transparent logo are dedicated high-resolution assets with correct crops and no visible stretching, halos, or placeholder content. Standard navigation and status symbols use Font Awesome icons.
- Copy and content: `RPGTEKINA`, `冒険をつづける`, `初心者ミッション`, resource values, mission progress, and the five navigation labels match the selected direction and use live game state where available.

## Comparison history

1. First normalized comparison
   - Evidence: `C:\Users\rei49\.codex\visualizations\2026\07\21\019f8445-c9df-7940-a83a-512428998b84\rpgtekina-home-build\comparison-v2.png`
   - Finding: [P2] The primary CTA was a generic rounded gold pill with a dark compass badge, while the source used a faceted fantasy plaque with pointed ends and jewel ornaments.
   - Fix: removed the compass badge, centered the label, and rebuilt the CTA with a faceted silhouette, double gold border, side engravings, stronger glow, and top/bottom diamond accents.
2. Post-fix comparison
   - Evidence: `C:\Users\rei49\.codex\visualizations\2026\07\21\019f8445-c9df-7940-a83a-512428998b84\rpgtekina-home-build\comparison-v3.png`
   - Result: no actionable P0/P1/P2 differences remain. CTA hierarchy and fantasy/gacha styling now match closely enough for handoff.

## Primary interactions tested

- Title `はじめから` → home
- `冒険をつづける` → quest hub
- Bottom navigation → quest, gacha, monster box, and menu
- Menu → shop; cancel returns to home
- Beginner mission card → mission progress message
- Browser console checked: no errors; only Vite connection debug messages

## Open Questions

- None blocking.

## Implementation Checklist

- [x] Dedicated hero, banner, and logo assets placed
- [x] Five-item bottom navigation wired
- [x] Existing utility actions consolidated into the menu
- [x] Responsive portrait and landscape layouts implemented
- [x] Production build passed
- [x] 90 automated tests passed
- [x] Browser interaction and console verification passed

## Follow-up Polish

- [P3] The reference uses more dimensional illustrated icons for the mission reward and bottom navigation; the implementation intentionally uses a consistent vector icon library.
- [P3] The generated hero composition places the moon slightly higher and renders the slime slightly larger than the source mock.

## Quest hub comparison target

- Source visual truth path: `C:\Users\rei49\.codex\.chatgpt-projects\g-p-6a5e281e094c81919e448bb7dacc7174\RPGTEKINA\design\quest-hub-target.png`
- Implementation screenshot path: `C:\Users\rei49\.codex\visualizations\2026\07\21\019f8445-c9df-7940-a83a-512428998b84\rpgtekina-quest-build\quest-hub-v4.png`
- Viewport: 390 × 844 CSS pixels
- State: fresh new game, quest hub, no modal open, touch-default state without keyboard focus ring
- Full-view comparison evidence: `C:\Users\rei49\.codex\visualizations\2026\07\21\019f8445-c9df-7940-a83a-512428998b84\rpgtekina-quest-build\comparison-v4.png`
- Focused-region evidence: not required. Both native-width panes keep the header, all card labels and subjects, emblems, progress strip, and navigation readable in the full comparison.

## Quest hub findings

- No remaining P0, P1, or P2 findings.
- The implementation matches the reference structure: gold back/title chrome, compact resource strip, three illustrated category cards, progress and recommended-power strip, and persistent quest-selected bottom navigation.

## Quest hub required fidelity surfaces

- Fonts and typography: title, category labels, badges, metrics, and navigation use the established Japanese font stack and hierarchy. All labels remain readable without clipping or unexpected wrapping.
- Spacing and layout rhythm: card starts, card height, inter-card gaps, compact progress strip, and navigation position were normalized to the 390 × 844 reference. No viewport overflow or off-screen persistent action remains.
- Colors and visual tokens: midnight navy and gold chrome are shared with home; red, purple, and emerald accents distinguish the three quest modes while retaining consistent gold framing.
- Image quality and asset fidelity: the background and all three category cards are dedicated high-resolution raster assets. The normal-card V2 restores the reference's larger center-right slime and restrained frame. No placeholder or OS emoji is used in the redesigned screen.
- Copy and content: `クエスト`, the three category labels, `期間限定`, progress, recommended power, resource values, and five navigation labels are present and use game state where applicable.

## Quest hub comparison history

1. First post-layout comparison
   - Evidence: `C:\Users\rei49\.codex\visualizations\2026\07\21\019f8445-c9df-7940-a83a-512428998b84\rpgtekina-quest-build\comparison-v3.png`
   - [P2] Category emblems were small circles or a narrow plate rather than the reference's large projecting shield/hex motif.
   - [P2] The normal-card slime was too small and too close to the right edge, weakening the first card's focal hierarchy.
   - [P2] The initial cyan focus outline and bright frame treatment made the card system noisier than the restrained gold reference.
2. Fixes applied
   - Generated and installed `src/assets/quest/normal-card-v2.png`, enlarging the slime and moving it toward center-right while simplifying the frame.
   - Added a consistent large shield/hex badge system to all three cards.
   - Suppressed keyboard focus chrome until keyboard input occurs, preserving a clean touch-default state.
   - Compacted the resource/progress/navigation proportions to the reference landmarks.
3. Post-fix comparison
   - Evidence: `C:\Users\rei49\.codex\visualizations\2026\07\21\019f8445-c9df-7940-a83a-512428998b84\rpgtekina-quest-build\comparison-v4.png`
   - Result: no actionable P0/P1/P2 differences remain.

## Quest hub primary interactions tested

- Home `冒険をつづける` and Quest tab → quest hub
- Normal card → normal stage map → back
- Event card → event quest list → back
- Training card → training quest list → back
- Bottom navigation → Home, Gacha, Monster box, and Home menu
- Keyboard navigation retains a visible selected/focus state after keyboard input
- Browser console checked after the final build: 0 errors

## Quest hub follow-up polish

- [P3] The free icon library's normal/recommended-power crest differs from the reference's exact crossed-swords illustration.
- [P3] The generated normal card's frame is slightly simpler and the exposed background hero strip is slightly shorter than the mock.
- [P3] The inactive monster navigation icon is more abstract than the reference slime icon.

## Gacha comparison target

- Source visual truth path: `C:\Users\rei49\.codex\.chatgpt-projects\g-p-6a5e281e094c81919e448bb7dacc7174\RPGTEKINA\design\gacha-target.png`
- Implementation screenshot path: `C:\Users\rei49\.codex\visualizations\2026\07\21\019f8445-c9df-7940-a83a-512428998b84\rpgtekina-gacha-build\gacha-menu-final.png`
- Viewport: 390 × 844 CSS pixels
- State: fresh new game, gacha menu, no modal open, touch-default state
- Full-view comparison evidence: `C:\Users\rei49\.codex\visualizations\2026\07\21\019f8445-c9df-7940-a83a-512428998b84\rpgtekina-gacha-build\comparison-final.png`
- Flow evidence: `gacha-confirm-v1.png`, `gacha-charge-v1.png`, `gacha-multi-v2.png`, `gacha-single-v3.png`, `gacha-rates-v2.png`, and `gacha-history-v2.png` in the same evidence directory.

## Gacha findings

- No remaining P0, P1, or P2 findings after two independent visual-QA passes.
- The implementation matches the selected structure: gold back/title chrome, compact resource strip, tall illustrated limited banner, owned-currency panel, differentiated single/ten-pull CTAs, functional rate/history utilities, and persistent gacha-selected navigation.
- The summon result experience uses a dedicated cathedral stage, timed reveal, high-definition family portraits, exact-species pixel badges, rarity-colored framing, and separate one/ten-pull layouts.

## Gacha comparison history

1. Initial implementation
   - Evidence: `comparison-v1.png`, `gacha-multi-v1.png`, `gacha-rates-v1.png`, and `gacha-history-v1.png`.
   - [P1] Small pixel sprites were not strong enough as the central summon reward against the high-definition banner art.
   - [P2] The limited banner was too short, creating dead space before navigation.
   - [P2] Rate notes, history labels, and utility/close targets needed greater readable and tappable size.
2. Main and result fixes
   - Generated two dedicated 2×2 high-definition family portrait atlases covering all eight monster families.
   - Expanded the limited banner to the reference landmark, moved currency/actions down, and enlarged utility and modal-close targets past 44 CSS pixels.
   - Increased probability-note and result-label size and contrast.
   - Evidence: `comparison-v2.png`, `gacha-multi-v2.png`, `gacha-rates-v2.png`, and `gacha-history-v2.png`.
3. Single-result polish
   - [P2] The first high-definition single portrait exposed its square source boundary.
   - Fixed with a dedicated rounded portrait panel, edge fades, rarity-colored double framing, and a shorter result card.
   - Evidence: `gacha-single-v3.png`.
   - Independent re-review result: P0/P1/P2 none; passed.

## Gacha primary interactions tested

- Gacha tab and back control
- Single and ten-pull confirmation, currency deduction, capacity checks, and insufficient-currency message
- Timed summon charge, tap-to-skip, single reveal, sequential ten-card reveal, and return to menu
- Provider rates modal and close target
- Recent summon-history empty and populated states
- Bottom navigation between Home, Quest, Gacha, Monster box, and Home menu
- Browser console checked throughout: 0 errors

## Gacha implementation checklist

- [x] Dedicated background, featured-sanctuary, summon-stage, and eight-family portrait assets placed
- [x] Master PNG art retained and optimized WebP delivery assets wired into the app
- [x] Single/ten-pull confirmation and reveal flows implemented
- [x] Rates and recent-history controls functional
- [x] Portrait and landscape layouts implemented
- [x] Production build passed
- [x] 90 automated tests passed
- [x] Same-size reference/implementation comparison completed
- [x] Independent visual QA passed

## Gacha follow-up polish

- [P3] The exact-species badges intentionally retain the original pixel-art identity while the primary portraits use the new high-definition family style.
- [P3] The reference uses more engraved metalwork and flare detail on the ten-pull button; the implementation keeps the same hierarchy with a lighter ornament load.

## Monster management comparison target

- Source visual truth path: `C:\Users\rei49\.codex\.chatgpt-projects\g-p-6a5e281e094c81919e448bb7dacc7174\RPGTEKINA\design\monster-box-target.png`
- Implementation screenshot path: `C:\Users\rei49\.codex\visualizations\2026\07\21\019f8445-c9df-7940-a83a-512428998b84\rpgtekina-monster-build\monster-final-v2.png`
- Viewport: 390 × 844 CSS pixels
- State: fresh new game, party tab, no modal open, touch-default state
- Full-view comparison evidence: `C:\Users\rei49\.codex\visualizations\2026\07\21\019f8445-c9df-7940-a83a-512428998b84\rpgtekina-monster-build\comparison-final.png`
- Flow evidence: `monster-selected-v2.png`, `monster-box-tab.png`, `monster-sort-overlay.png`, `monster-filter-overlay.png`, `monster-status-v2.png`, `monster-rabbit-status.png`, and `monster-landscape.png` in the same evidence directory.

## Monster management findings

- No remaining P0, P1, or P2 findings after the independent post-fix visual review.
- The implementation preserves the selected hierarchy: gold back/title chrome, shared resource strip, working Party/Box tabs, party-power and luck summary, four formation slots, portrait roster, sorting/filtering controls, fixed selection actions, and persistent Monster-selected navigation.
- Party changes now support a direct full-party replacement flow instead of forcing a separate remove-then-add sequence.

## Monster management comparison history

1. Initial implementation
   - Evidence: `comparison-1.png`, `monster-final.png`, `monster-status-final.png`, and `monster-landscape.png`.
   - [P1] `rabbit` was incorrectly represented by the generic beast-family wolf portrait, making species identification unreliable.
   - [P2] Party portraits were too small and dark relative to the target.
   - [P2] Card labels and detail-page supporting text were too small at the 390px viewport.
   - [P2] Tabs, sort/filter controls, and selected-monster actions appeared below the 44px touch-target baseline.
2. Fixes applied
   - Generated and installed a dedicated `rabbit` portrait and introduced species-ID portrait routing. Species without a matching dedicated image now fall back to the exact palette-aware game sprite instead of an incorrect family portrait.
   - Enlarged portrait crops by more than 20%, reduced the lower fade, and increased card-name, level, luck, skill, and profile typography.
   - Enlarged Party/Box tabs, roster controls, modal options, and selection actions to approximately 44–46 CSS pixels at the verified mobile viewport.
3. Post-fix comparison
   - Evidence: `comparison-final.png`, `monster-final-v2.png`, `monster-selected-v2.png`, `monster-status-v2.png`, and `monster-rabbit-status.png`.
   - Independent re-review result: P0/P1/P2 none; passed.

## Monster management primary interactions tested

- Home Monster tab → monster management screen
- Party and Box tabs
- Recommended/rank/level/luck sorting modal
- All/party/box filtering modal
- Monster selection and fixed `ボックスへ` / `編成する` / `詳細` actions
- Party-to-box and box-to-party round trip with UID and growth state preserved
- Full-party replacement logic covered by automated tests
- Explicit header and footer back controls on the detail screen; arbitrary content taps no longer close it
- Bottom navigation and responsive portrait/landscape layouts
- Browser console checked after the final interaction pass: 0 errors

## Monster management implementation checklist

- [x] Exact visual target and dedicated monster-management background placed
- [x] Dedicated starter-rabbit portrait placed; safe exact-species fallback implemented
- [x] Party/Box tabs, sort, filter, paging, selection, details, and direct replacement implemented
- [x] Movement safety rules retained: final-member, farm-capacity, party-capacity, and viable-fighter checks
- [x] Portrait and landscape layouts implemented
- [x] Production build passed
- [x] 93 automated tests passed, including new party-management tests
- [x] Same-size reference/implementation comparison completed
- [x] Independent visual QA passed

## Monster management follow-up polish

- [P3] The capacity display intentionally uses the actual combined maximum of Party 4 + Box 50 (`54`), while the generated target used the shorthand `50`.
- [P3] Additional species-specific high-definition portraits can be added over time; species without a dedicated portrait already use the correct palette-aware sprite, so they are never shown as a different species.
- [P3] The implementation keeps a lighter ornament load than the generated target to preserve readability when the box reaches many populated cards.

final result: passed
