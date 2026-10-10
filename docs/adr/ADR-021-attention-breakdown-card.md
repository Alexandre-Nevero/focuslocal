# ADR-021: Attention breakdown card

- Status: Accepted
- Date: 2026-10-10

## Context

The Dashboard's lower-right card needs a visual specification. The product records local attention visits and displays them with the existing Served/Drift labels, plus Away and Not recorded states. BR-006 excludes rates and scores, and gaps must not be presented as observed activity.

## Why now

The dashboard card is being specified. Leaving its data treatment unresolved would invite percentage or break-time estimates that the existing record does not support.

## Options

1. Keep a static emblem and absolute-duration list, with no ring visualization.
2. Use a terracotta double donut, center captured attention duration, and a legend of existing categories with their absolute durations.
3. Show category percentages or progress values in the ring and legend.

## Decision

Use option 2. Label the card **ATTENTION BREAKDOWN** and place **MONTH** at the right of its heading. Center recorded attention-visit duration, including Served, Drift, Unclear, and judging time. List existing review categories and their absolute durations. Do not show percentages, progress, trend comparisons, or inferred break time.

## Why this option

It gives the dashboard the requested visual summary while keeping each value tied to recorded durations and established labels. The double ring is a visual treatment, not a performance measure.

## Overrides

This decision replaces the former D-02 placeholder in `docs/design.md` with the specification in §5.3.1. It does not override PRD BR-006, the display-label rules, or the distinction between Away and Not recorded.

## Consequences

The card can render only durations supported by local records. Missing or unsupported values are shown as unavailable, never estimated. The design has no percentage denominator because it displays no percentages.
