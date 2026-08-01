# ADR-0001: Blue education theme

## Status
Accepted

## Context
The supplied reference system uses a muted gold accent and a light gray shell. The requested product should keep the layout language but use blue as the primary education color, Cairo typography, low-contrast borders and no shadows.

## Decision
Use a tokenized blue scale with `#2F78F4` as primary 500 and preserve the reference spacing/radius/surface patterns. All components consume CSS variables; hard-coded feature colors are prohibited.

## Consequences
The product remains visually related to the reference while gaining a distinct education identity. Frontend teams can retheme the entire product from `tokens.css`.
