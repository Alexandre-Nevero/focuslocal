# Twofold companion assets

This package prepares the card-shaped companion for later Electron integration. It does not connect the mascot to application behavior.

## Files

- `companion.svg`: self-contained neutral artwork for image tags, window prototypes, and fallbacks.
- `mascot-sprite.svg`: reusable views, expressions, poses, and compact UI states.
- `contact-sheet.svg`: visual inventory of the sprite. Keep it beside the sprite so its external references resolve.
- `manifest.json`: stable state IDs, palette values, and behavior-neutral defaults.
- `palette.css`: the canonical mascot swatches as CSS custom properties.

## Using a sprite state

```html
<svg viewBox="0 0 256 256" role="img" aria-label="Twofold companion">
  <use href="/assets/mascot/mascot-sprite.svg#pose-idle"></use>
</svg>
```

Use `pose-hover` only for pointer feedback and `pose-coach` when the coach panel is open. Keep `pose-idle` while a session runs. The companion must not change with the session outcome or a visit verdict. Compact `ui-ready` means an interface action completed; it must not represent a successful session.

## Motion handoff

Animate the containing SVG rather than paths inside the artwork. The intended hover response is a 4 px upward translation over 140 ms. Disable the translation under `prefers-reduced-motion`. Drag and click thresholds remain application behavior, not asset behavior.

## Rendering notes

All states use a `0 0 256 256` viewBox and transparent canvas. The warm card layers match the cream-on-cream interface while the dark-brown limbs remain readable on light desktop backgrounds. Dusty Blue appears only in secondary callouts; Coral and Ochre are fills, not small text.
