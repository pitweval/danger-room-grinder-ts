# Contributing

## Project standards

- Write focused, readable TypeScript and keep the compiler in strict mode.
- Format all changes with `npm run format`; CI verifies formatting with
  `npm run format:check`.
- Resolve every issue reported by `npm run lint`.
- Add or update Vitest coverage for behavior changes and run `npm test`.
- Run `npm run build` before submitting a change.

Keep modules small, avoid unrelated refactors, and do not commit generated output or
dependencies.
