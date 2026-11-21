---
name: Vault Academy
description: An exact blue learning instrument for offline school resources, assessments, and live competition.
colors:
  primary: "#1457D9"
  primary-hover: "#0B3FA8"
  primary-light: "#D8E9FF"
  surface: "#FFFFFF"
  background: "#F5F9FF"
  surface-2: "#EAF2FF"
  border: "#B9CDEE"
  text: "#0B1E4B"
  text-muted: "#385478"
  accent-blue: "#2387E8"
  accent-green: "#08734D"
typography:
  display:
    fontFamily: "Bahnschrift, DIN Alternate, Aptos, Arial Narrow, sans-serif"
    fontSize: "clamp(3rem, 7vw, 6rem)"
    fontWeight: 900
    lineHeight: 0.82
    letterSpacing: "-0.075em"
  headline:
    fontFamily: "Bahnschrift, DIN Alternate, Aptos, Arial Narrow, sans-serif"
    fontSize: "clamp(1.2rem, 2.5vw, 1.7rem)"
    fontWeight: 850
    lineHeight: 1.15
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Bahnschrift, DIN Alternate, Aptos, Arial Narrow, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Bahnschrift, DIN Alternate, Aptos, Arial Narrow, sans-serif"
    fontSize: "0.72rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "0.06em"
rounded:
  none: "0px"
  tight: "2px"
  control: "2px"
  status: "999px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2.25rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0.65rem 1rem"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.surface}"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.control}"
    padding: "0.55rem 0.85rem"
  index-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.none}"
    padding: "0.8rem 0.65rem"
  lan-panel:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.none}"
    padding: "clamp(1rem, 2vw, 1.4rem)"
---

# Design System: Vault Academy

## Overview

**Creative North Star: "The Blue Grid Instrument"**

Vault Academy is a precise offline learning instrument, not a generic education app. White and pale-blue fields hold a visible construction grid; cobalt typography and rules turn resources, exams, and competition into a direct operational index. The system feels institutional and modular: Wim Crouwel-influenced specimen structure, compact labels, strong numeric markers, and information arranged for fast school-network use.

The identity is built around the first viewport. The wordmark leads, LAN state establishes that the system is local and live, and the three indexed learning tools remain immediately recognizable on desktop and mobile.

**Key Characteristics:**
- Visible 32px construction-cell grids behind mastheads and large surfaces
- Cobalt text, blue rules, pale-blue fields, and white document surfaces
- Rule-defined directory rows rather than floating promotional cards
- Modular, uppercase, tightly tracked labels and monumental condensed headings
- A dark-blue instrument rail on desktop and a compact labeled bottom rail on mobile

## Colors

The palette is white/cobalt-first: high-contrast Cobalt Primary supplies authority and navigation, Ice Field areas organize information, and Dark Navy carries the side rail and long-form text.

The dark theme shifts the field to Midnight Navy (#07142F), with Academy Navy (#0B1E4B) surfaces, muted cobalt rules (#31558B), near-white text (#F4F8FF), and a light cobalt action color (#84BAFF). Green (#63D2A0) continues to signal a live local service.

### Primary
- **Cobalt Primary** (#1457D9): The primary brand, key rules, active controls, and hoverable directory modules.
- **Cobalt Hover** (#0B3FA8): Pressed and hover depth for blue controls and rule treatments.
- **Cobalt Wash** (#D8E9FF): Selected navigation and low-emphasis blue containers.

### Secondary
- **Signal Blue** (#2387E8): Focus indicators and secondary blue interface signals.
- **Local Green** (#08734D): Offline/online confirmation and positive availability states.

### Neutral
- **Construction White** (#FFFFFF): Document surfaces, cards, and copy panels.
- **Ice Field** (#F5F9FF): The page field and most pale workspace areas.
- **Pale Instrument Blue** (#EAF2FF): Secondary surfaces and grid-adjacent panels.
- **Rule Blue** (#B9CDEE): Dividers and grid-adjacent borders.
- **Dark Navy** (#0B1E4B): Main text and the desktop/mobile navigation rail.
- **Slate Blue** (#385478): Secondary copy and subdued labels.

### Named Rules
**The Blue Instrument Rule.** Blue is for structure and action, not decorative atmosphere. Keep white surfaces dominant and use Cobalt Primary where it identifies the system or advances a task.

**The Local State Rule.** Server availability belongs in a direct status block. Never imply cloud or internet dependence in the first viewport.

## Typography

**Display Font:** Bahnschrift (fallback DIN Alternate, Aptos, Arial Narrow, sans-serif)
**Body Font:** Bahnschrift (fallback DIN Alternate, Aptos, Arial Narrow, sans-serif)
**Label/Mono Font:** Courier New for LAN addresses and compact technical values

**Character:** Narrow, modular sans-serif letterforms create a printed grid-specimen quality. Display copy is dense and monumental; labels are small, uppercase, tightly tracked, and operational.

### Hierarchy
- **Display** (900, clamp(3rem, 7vw, 6rem), line-height 0.82): Home wordmark only. It is uppercase, tightly tracked, and held in a blue-rule masthead.
- **Headline** (850, clamp(1.2rem, 2.5vw, 1.7rem), line-height 1.15): Page and section titles. Page headings use uppercase type with a cobalt lower rule.
- **Title** (850, clamp(1.3rem, 2.2vw, 2rem), line-height 1.2): Indexed module names and primary in-page headings.
- **Body** (400, 1rem, line-height 1.55): Explanatory copy. Keep descriptions brief and direct.
- **Label** (800, 0.72rem, line-height 1.2, 0.06em tracking, uppercase): Status labels, directory counts, filter labels, and navigation metadata.

### Named Rules
**The One Voice Rule.** Intermixing rounded marketing typography or playful display treatments breaks the instrument character. Use the same narrow technical voice across headings and labels.

## Layout

The desktop shell uses a fixed 252px dark-blue sidebar and a fluid main field. Page content is padded with a clamp of 1.25rem to 2.75rem. The Home console has a 1120px maximum width, with a horizontal masthead grid, a three-row indexed directory, a three-column data strip, and a full-width LAN block.

The construction grid is a 32px repeat of one blue 1px line and transparent cell. It appears through mastheads and the pale instrument field rather than behind every surface. Home modules align to the same horizontal index: code, name, description, and action. Below 900px the directory reflows to a compact code/name/action row; below 768px the page removes the sidebar, switches to a compact bottom navigation rail, and uses 1rem page padding.

The mobile first viewport preserves: wordmark, LAN status, the three-row directory, counts, and LAN address. Dense text is shortened or hidden only where it would otherwise obscure the operational directory.

## Elevation & Depth

The shipped system is intentionally flat. Depth comes from borders, flat tonal fields, blue grid cells, and the dark sidebar rail; it does not rely on ambient shadows or floating surfaces.

### Named Rules
**The Flat Field Rule.** Do not add drop shadows to turn grid-aligned surfaces into cards. State and hierarchy are communicated with 1px rules, pale fills, and cobalt reversals.

**The Visible Rule.** Borders and rules remain crisp. Page-level shadows are reserved for transient overlays only.

## Shapes

The instrument is predominantly square or nearly square. Page controls use 2px radii; circular geometry is limited to status indicators, avatars, and compact switches. The desktop sidebar retains a pill-shaped theme toggle as a familiar utility control.

Borders are crisp and 1px, with prominent 2px headings/rules. Do not introduce softly sculpted cards, large radii, or decorative clipping.

## Components

### Primary Button
- **Shape:** Slightly tight square control (8px radius); compact and rule-defined.
- **Primary:** Cobalt Primary background, white text, 800-weight label, roughly 0.65rem 1rem padding.
- **Hover / Active:** Cobalt Hover background; no lift or diffuse shadow.
- **Focus:** 3px Signal Blue outline with 3px offset.

### Ghost / Secondary Button
- **Shape:** 8px radius.
- **State:** White or pale field, Cobalt text, 1px blue border; hover uses Cobalt Wash or Cobalt Primary with white text.

### Navigation Rail
- **Desktop:** Fixed 252px dark navy rail with a 42px grid-mark logo and compact navigation labels.
- **State:** Active link has a pale-blue fill and a 4px cobalt left rule.
- **Mobile:** Fixed bottom rail, eight-column maximum, compact icon plus 0.52rem label, and a dark navy field.

### Directory Row
- **Shape:** Square, full-width row with a 1px rule beneath it.
- **Grid:** Large indexed code, title, optional description, and right-aligned uppercase action.
- **Hover:** Cobalt Primary field with white text across code, title, description, and action.

### Resource Library Row
- **Shape:** Square, rule-separated library record rather than a card.
- **Layout:** Resource metadata on the left and compact catalog actions on the right.
- **Hierarchy:** Grade and category labels are restrained; filenames and titles remain the primary scan point.

### LAN Panel
- **Shape:** Full-width square blue broadcast block with a white headline and address.
- **Action:** White copy-address control with navy text; it is a direct operational action, not a promotional CTA.

### Exam & Arena Modules
- **Exam:** CBT remains a rule-defined module with white surfaces, compact blue chips, timer/data labels, and a square primary start action.
- **Arena:** Blue-grid competition surface with a compact live indicator, a centered join instrument, and no generic card ornament.

## Do's and Don'ts

### Do
- Keep the school learning network visually exact, compact, and operational.
- Let visible construction-grid cells align with type baselines and module boundaries.
- Preserve the wordmark, LAN status, indexed three-row directory, counts, and shareable LAN URL in the home first viewport.
- Use square rule-separated library rows and precise blue borders.
- Use small uppercase labels and large modular numbers to create hierarchy.
- Preserve the active page in both desktop and mobile navigation.
- Preserve PDF attribution and original publisher identity for third-party resources.

### Don't
- Don't use generic app cards, rounded marketing tiles, or decorative gradients.
- Don't replace the 32px construction grid with arbitrary spacing or off-grid mastheads.
- Don't shift to a red, warm, or multicolor dominant palette.
- Don't imply internet access or hide LAN/server state.
- Don't add diffuse shadows or elevated surfaces to ordinary directory modules.
- Don't rebrand or strip attribution from third-party PDF materials.
