# Contributing

Use a conventional-commit branch (`feat/`, `fix/`, `chore/`, `test/`, or `docs/`) and open a pull request—never commit directly to `main`. Keep a PR to one logical change and describe what changed, why, and how it was tested.

Before opening a PR, run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. Changes to domain rules require focused tests first. Bug fixes require a regression test. CI runs these same checks on a Postgres service.

Do not add fake match history to the seed. New external request inputs must be validated with Zod, and business rules belong in pure `src/lib` modules rather than route handlers or React components.
