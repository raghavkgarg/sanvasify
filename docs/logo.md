# Sanvasify Brand Logo & Identity

## Overview
In this session, we transitioned the Sanvasify brand identity from a static image to a dynamic, theme-aware SVG system. This change improves performance, ensures crisp rendering on all screens, and solves visibility issues across different themes.

## Summary of Work
- **SVG Migration**: We moved the logo's geometry (three triangles) from `logo.html` into a centralized JavaScript function in `common.js`. This allows the logo to be injected dynamically into any page using a simple placeholder.
- **Tagline Integration**: We realized that the tagline "Accumulate. Invest. Amplify." was missing from the small navbar logo. We updated the injection logic to automatically add the tagline as HTML text, which is more readable and easier to style than embedded SVG text.
- **Layout Refactoring**: We updated `style.css` to use **CSS Grid** for the brand section. This ensures the logo icon, the "Sanvasify" title, and the tagline stay perfectly aligned regardless of screen size.
- **Dynamic Visibility (Dark Mode Fix)**: The original Navy blue color was nearly invisible in the dark theme. We solved this by:
    - Defining **Design Tokens** in `design-tokens.css` for the three brand colors.
    - Using CSS variables (`--color-logo-p1`, etc.) that automatically switch shades based on the active theme.
    - Mapping these variables to both the SVG `fill` and the tagline `color` in `style.css`.

## Files Changed and Why
| File | Purpose of Change |
| :--- | :--- |
| `design-tokens.css` | Created theme-aware color variables (`--color-logo-pX`) to ensure contrast in both Light and Dark modes. |
| `style.css` | Implemented the Grid layout for the brand container and applied the new color variables to the logo and tagline. |
| `common.js` | Added the `injectBrandLogo` function to handle the dynamic injection of the SVG and tagline markup. |
| `index.html`, `nav.html`, `compare.html`, etc. | Replaced static `<img>` tags with `<span class="brand-logo"></span>` placeholders. |

## Implementation Details

### 1. Dynamic Injection (`common.js`)
The `injectBrandLogo()` function looks for placeholders with the class `.brand-logo` and injects:
- The redesigned overlapping three-triangle SVG icon with theme-aware strokes for separation.
- The "Accumulate. Invest. Amplify." tagline (if not already present).

### 2. Layout & Alignment (`style.css`)
The brand identity uses a CSS Grid layout:
```css
.brand {
  display: grid !important;
  grid-template-areas: 
    "logo name"
    "tagline tagline";
  grid-template-columns: auto 1fr;
  align-items: center;
  column-gap: var(--space-3);
  line-height: 1;
}
```

### 3. Theme-Aware Visibility
All logo visual properties, including fills and the separating stroke, are driven by CSS Variables in `design-tokens.css`.

| Component | Variable | Dark Theme (Default) | Light Theme |
| :--- | :--- | :--- | :--- |
| Triangle 1 / "Accumulate" | `--color-logo-p1` | `#8ea5d1` (Light Blue) | `#1C2B4A` (Dark Navy) |
| Triangle 2 / "Invest" | `--color-logo-p2` | `#2A8A8C` (Teal) | `#2A8A8C` (Teal) |
| Triangle 3 / "Amplify" | `--color-logo-p3` | `#E4B45F` (Gold) | `#E4B45F` (Gold) |
| Separation Stroke | `--color-logo-stroke` | `var(--color-surface)` | `var(--color-surface)` |

## Usage
To use the logo in any new HTML file, simply add:
```html
<a href="/" class="brand"><span class="brand-logo"></span><span>Sanvasify</span></a>
```