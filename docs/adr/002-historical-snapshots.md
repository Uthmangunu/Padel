# ADR 002: Session participant snapshots

## Decision

Sessions store participant name and rating snapshots and teams refer to participants, rather than current player fields.

## Why

Roster ratings improve over time and players can be soft-deleted. Historical matches must retain the context in which they were played.
