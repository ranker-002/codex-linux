# Redesign Audit v3 (Claude Identity)

## Scope analyzed
- Source of truth: `claude-design-system-final.html`
- Active app shell + active routes from `src/renderer/App.tsx`
- Shared active UI components used by active routes
- Inactive/orphan components inventory for migration risk

## Identity baseline from `claude-design-system-final.html`

### Visual rules (mandatory)
- Neutral-first color model: black/white/gray as primary visual language (90%).
- Teal only as secondary accent (10% max), never as large background.
- One dominant primary CTA per view.
- Semantic states must use success/warning/error/info (not teal).

### Token system
- Dark and light themes share the same structure.
- Canonical tokens: `--n-*`, `--bg-*`, `--text-*`, `--border-*`, `--a-*`, `--c-*`.
- Typography tokens: `--f-display`, `--f-body`, `--f-mono`.
- Spacing base 4px (`--sp-*`), radius (`--r-*`), fixed layout sizes.

### Structural identity
- Zone A: Sidebar fixed 220px.
- Zone B: Topbar fixed 52px.
- Zone C: Main content scroll area.
- Zone D: Input area fixed 72px.
- Zone E: Optional right panel fixed 240px.
- Content grid: 12 columns, consistent gutters and margins.

## Current implementation status

### Foundation (good progress)
- Neutral token foundation exists in `src/renderer/styles/design-system.css`.
- Light/dark theme switching is wired in app runtime (`data-theme` on `<html>`).
- Sidebar/topbar dimensions and base shell values are aligned with target.
- Legacy aliases are present, enabling gradual migration without breaking UI.

### Active route coverage (from `src/renderer/App.tsx`)
| Route | Component | Fidelity vs Claude identity | Notes |
|---|---|---:|---|
| `/` | `WelcomeChat` | 72% | Visual tone close, but structure diverges from strict B/C/D zoning |
| `/agents` | `AgentPanel` | 61% | Functional but teal overuse and density reduce identity fidelity |
| `/code` | `CodeWorkspace` | 82% | Strong neutral shell alignment, split/editor stack is closest |
| `/worktrees` | `WorktreePanel` | 67% | Mostly tokenized, still multi-CTA accent usage |
| `/skills` | `SkillsPanel` | 65% | Tokenized, but accent and modal patterns not yet normalized |
| `/automations` | `AutomationPanel` | 66% | Similar to worktrees/skills, needs CTA hierarchy cleanup |
| `/audit` | `AuditTrailPanel` | 86% | Clean neutral styling and good semantic state usage |
| `/settings` | `SettingsPanel` | 57% | Largest gap; many accent usages and mixed patterns |

## Component-level findings

### Shell components
- `Sidebar` is structurally close to target grouping and identity.
- `Header` is visually consistent with shell but differs from Claude doc behavior (tabs/theme toggle emphasis).

### Active workspace components
- `CodeWorkspace`, `FileExplorer`, `CodeEditor`, `DiffViewer`, `SplitPane` are mostly on-system.
- These components now use neutral-first tokens and semantic colors better than other pages.

### Inactive/orphan component risk
- 27 components are currently unreachable from `App` entry flow and still contain legacy semantic utility patterns.
- If re-enabled without migration, they will break identity consistency immediately.

## Critical gaps for "perfect faithful" adoption

### P0 (must fix first)
1. Accent governance not enforced in high-traffic pages (especially Agents/Settings).
2. Global layout contract (A/B/C/D/E) is not implemented as a reusable page scaffold.
3. 12-column content system is not standardized across route pages.

### P1 (next)
1. Typography hierarchy is partially applied; several pages still use ad-hoc sizing/weights.
2. Interaction states are inconsistent (focus/loading/disabled semantics vary by page).
3. Modal/panel conventions are duplicated per page instead of shared primitives.

### P2 (cleanup)
1. Migrate or deprecate orphan components to avoid future visual regressions.
2. Remove remaining hardcoded color literals where token equivalents already exist.

## Recommended migration sequence
1. Build a reusable `AppPageLayout` implementing zones A/B/C/D/E and 12-column content wrappers.
2. Refactor `SettingsPanel` and `AgentPanel` first (highest visual drift).
3. Normalize CTA policy (single primary CTA per view) in Worktrees/Skills/Automations.
4. Migrate orphan components before reactivation.
5. Add a design-lint checklist for token usage and accent rule compliance.

## Current global fidelity estimate
- Active user-facing routes: **~69%**
- Shell + code tools subset: **~82%**
- Target for "identité parfaite et fidèle": **95%+**
