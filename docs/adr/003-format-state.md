# ADR 003: Pure format engines

## Decision

Fixture generation and progression helpers are pure modules; persisted session state holds the configuration and eventual progression payload.

## Why

Tournament edge cases such as byes, queue ordering, and tie-break ranking are easier to test without database or UI concerns.
