# ADR 006: Retained cancellation and safe history deletion

Stopping a live session records it as cancelled and preserves partial score events for auditability. Cancelled sessions are immutable and excluded from statistics. Destructive history actions are limited to completed/cancelled records; active scoring is protected.
