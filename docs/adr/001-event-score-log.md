# ADR 001: Append score events

## Decision

Score input is recorded as ordered events and the visible score is reduced from those events. Undo removes the final unconfirmed event.

## Why

It makes every scoring transition reproducible, makes refresh recovery straightforward, and avoids destructive score mutations. Confirming a terminal score creates the immutable `MatchResult`.
