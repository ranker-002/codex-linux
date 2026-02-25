# Redesign Analysis v4 (Images 1-4 + Claude Design System Final)

## Scope
- Identity source: `claude-design-system-final.html`
- Runtime shell: `src/renderer/App.tsx`
- Active routes: `/`, `/agents`, `/code`, `/worktrees`, `/skills`, `/automations`, `/audit`, `/settings`
- Visual references: provided screenshots `[Image #1]` to `[Image #4]`

## 1) Full pages/components analysis

### Active pages (user-facing)
| Route | Component | Structural status | Visual status |
|---|---|---|---|
| `/` | `WelcomeChat.tsx` | Aligned to hero composer flow (toolbar, composer, suggestions, preview, warning) | Close to image #1/#2 tone and hierarchy |
| `/agents` | `AgentPanel.tsx` | Migrated to `AppPageLayout` with two-pane operational workspace | Good alignment, final micro-spacing pass left |
| `/code` | `CodeWorkspace.tsx` | Strong alignment (workspace/split/editor) | Good neutral fidelity |
| `/worktrees` | `WorktreePanel.tsx` | Migrated to `AppPageLayout` | Good baseline, minor spacing polish left |
| `/skills` | `SkillsPanel.tsx` | Migrated to `AppPageLayout` with two-pane grid | Good alignment, minor micro-spacing polish left |
| `/automations` | `AutomationPanel.tsx` | Migrated to `AppPageLayout` | Good baseline, minor CTA hierarchy tweaks left |
| `/audit` | `AuditTrailPanel.tsx` | Migrated to `AppPageLayout` | High fidelity in neutral-first style |
| `/settings` | `SettingsPanel.tsx` | Migrated to `AppPageLayout` | Improved, still dense in some sections |

### Core shell components
| Component | Status | Notes |
|---|---|---|
| `Sidebar.tsx` | Reworked | Chat/Code switch, new session flow, sessions list, subtle tools row, profile footer |
| `Header.tsx` | Stable | Kept for non-chat routes |
| `AppPageLayout.tsx` | Implemented | Shared structural contract for route pages |
| `design-system.css` | Expanded | Centralized tokens, shell rules, welcome and sidebar blocks |

## 2) Full analysis of `claude-design-system-final.html`

### Identity rules extracted
- Neutral-first palette is primary language (`--n-*`, `--bg-*`, `--text-*`, `--border-*`).
- Accent (`--a-*`) is secondary and must remain controlled.
- Semantic colors reserved for feedback states (`--c-success`, `--c-warning`, `--c-error`, `--c-info`).
- Fixed shell zoning:
  - Zone A sidebar fixed
  - Zone B top bar fixed
  - Zone C scroll content
  - Zone D fixed input area patterns
  - Zone E optional right panel
- 4px spacing rhythm and rounded-corner scale are consistent across all components.

### Token parity check
- Implemented in app CSS:
  - `--n-*`, `--bg-*`, `--text-*`, `--border-*`, `--a-*`, `--c-*`
  - font tokens and layout tokens
  - light/dark theme parity
- Migration strategy already in place via legacy aliases to avoid breakage.

### Structural parity check
- Sidebar width, topbar height, content rails, and card language now follow the same system logic.
- Welcome composer and session-driven left navigation now reflect the same component grammar as the source design system.

## 3) Image fidelity check (1/2/3/4)

### Matched patterns
- Large centered composer block with neutral cards and controlled accent.
- Folder/runtime controls above composer.
- Session-oriented left navigation with quick Chat/Code switch.
- Preview card language and warning panel semantics.
- Dot-grid atmospheric background + subtle radial accents.

### Remaining high-priority gaps
1. Some route-level actions still overuse accent in dense sections.
2. Final pixel pass still required on typography micro-spacing (line-height and card vertical rhythm).
3. Final side-by-side screenshot QA is still needed for strict visual parity.

## Recommended completion order
1. Complete accent governance in remaining dense route sections.
2. Run final route-by-route visual QA pass (desktop widths) against images and source identity.
3. Freeze styles and package a clean final commit.

## Execution update (steps 1 / 2 / 3)

### 1) `SkillsPanel` migration
- `SkillsPanel` is now migrated to the shared scaffold with `AppPageLayout`.
- Structure now follows design shell standards:
  - left searchable library rail
  - right detail pane for selected skill
  - single primary route CTA in page header
- Visual language moved to neutral-first cards/borders with controlled accent usage.

### 2) `AgentPanel` accent and CTA hierarchy
- Primary emphasis is now concentrated in the page header (`New Agent`) via `AppPageLayout`.
- List and detail panes shifted to neutral-selected/border states where possible.
- Queue add action remains ghost style to avoid competing with the main route CTA.
- Modal “Create Agent” remains the dominant action inside the creation flow.
- `AgentPanel` now uses `AppPageLayout` for shell consistency with other active routes.

### 3) QA pass status
- Build-level QA done (`vite build` renderer passes).
- Structural route QA done against shell rules (zones/grid/tokens).
- Remaining manual visual QA: final side-by-side screenshot comparison at runtime for micro spacing and typography.
