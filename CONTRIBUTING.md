# Contributing to @sanity/migrate

Welcome! This guide helps both human developers and AI agents contribute effectively to the Sanity migration toolkit.

## Quick Start

1. **Install dependencies**: `pnpm install`
2. **Build**: `pnpm build`
3. **Run tests**: `pnpm test`
4. **Create a feature branch**: `git checkout -b feature/my-feature`

For detailed setup, see [Development Workflow](#development-workflow).

---

## Project Architecture

### Overview

`@sanity/migrate` is a **library** that provides the programmatic building blocks for running data migrations on [Sanity.io](https://www.sanity.io/) projects: defining migrations, building mutations, reading documents from the API or a dataset export, and executing migrations (dry run and live).

It is consumed as an API — there are no CLI commands or executables in this package. The user-facing `sanity migrations create|list|run` commands live in the [Sanity CLI](https://github.com/sanity-io/cli) and call into this library's public API.

### Directory Structure

```
src/
├── _exports/          # Public API surface (the package entry point)
├── fetch-utils/       # HTTP request utilities
├── fs-webstream/      # File-based stream buffering
├── it-utils/          # Async iterator utilities
├── mutations/         # Mutation building and batching
├── runner/            # Migration execution engine (dry run + live)
├── sources/           # Data sources (API, export archives)
├── tar-webstream/     # Tar archive streaming (for dataset exports)
├── uint8arrays/       # Binary data utilities
└── utils/             # Shared stream/iterator helpers
```

Everything the package exposes is re-exported from `src/_exports/index.ts`. If something isn't exported there, it's internal.

### Separation of Concerns

```
┌─────────────────────────────────────┐
│  Public API (_exports)              │  defineMigration, run, dryRun, builders
├─────────────────────────────────────┤
│  Runner (Execution Engine)          │  Dry run, live run, batching, progress
├─────────────────────────────────────┤
│  Sources & Utilities                │  Data sources, streams, iterators
└─────────────────────────────────────┘
```

**Public API** (`_exports/`) is the contract consumers (including the Sanity CLI) depend on. Treat changes here as potentially breaking.

**Runner** (`runner/`) handles the actual migration execution — dry runs, live runs, mutation batching, and progress reporting.

**Sources & utilities** (`sources/`, `fetch-utils/`, `it-utils/`, `fs-webstream/`, `tar-webstream/`) provide the document streams the runner consumes.

---

## Development Workflow

### Setup

```bash
# Clone the repository
git clone https://github.com/sanity-io/migrate.git
cd migrate

# Install dependencies
pnpm install

# Build
pnpm build
```

### Available Scripts

| Script           | Description                                 |
| ---------------- | ------------------------------------------- |
| `pnpm build`     | Build with SWC + generate type declarations |
| `pnpm watch`     | Watch mode (rebuilds on changes)            |
| `pnpm test`      | Run tests with Vitest                       |
| `pnpm coverage`  | Run tests with coverage report              |
| `pnpm lint`      | Lint with ESLint                            |
| `pnpm lint:fix`  | Lint and auto-fix                           |
| `pnpm typecheck` | TypeScript type checking                    |
| `pnpm depcheck`  | Check for unused dependencies (Knip)        |
| `pnpm format`    | Format with oxfmt                           |

### Quality Checks

Before submitting a PR, run:

```bash
pnpm build        # Ensure it compiles
pnpm lint         # ESLint
pnpm typecheck    # TypeScript checking
pnpm depcheck     # Unused dependencies
pnpm test         # Run all tests
```

---

## Code Standards

### Module System

Always use ES Modules with `.js` extensions in imports:

```typescript
// ✅ Good
import {myFunction} from './utils/myUtil.js'
export {myFunction}

// ❌ Bad
import myFunction from './utils/myUtil' // Missing extension
const x = require('./x') // No CommonJS
```

### TypeScript

- Never use `any` — use `unknown` and narrow appropriately
- Use `satisfies` for type assertions where possible
- Enable all strict TypeScript flags

### Error Handling

Library code surfaces failures by throwing — let the caller (e.g. the CLI) decide how to present them:

```typescript
try {
  return await operation()
} catch (error) {
  throw new Error(`Failed to load migration: ${(error as Error).message}`, {cause: error})
}
```

### Cross-Platform Compatibility

Tests run on both **Ubuntu and Windows**. Keep these in mind:

- Use `path.join()` for constructing file paths — never hardcode `/` separators
- In test assertions, use `path.join()` or `expect.stringContaining()` with platform-aware values
- File operations may behave differently on Windows (e.g., `EPERM` instead of `ENOENT` for locked files)

---

## Testing

### Stack

- **Vitest** for the test runner
- **`vi.mock()`** for module mocking
- Fixtures (e.g. tar archives under `__test__/fixtures/`) for stream/source tests

### Test Structure

Tests exercise the public API and internal units directly — no command harness:

```typescript
import {describe, expect, test} from 'vitest'

import {at, collectMigrationMutations, defineMigration, setIfMissing} from '../../_exports/index.js'

describe('collectMigrationMutations', () => {
  test('produces a patch for each matching document', async () => {
    const migration = defineMigration({
      documentTypes: ['post'],
      migrate: {
        document() {
          return at('seen', setIfMissing(true))
        },
      },
      title: 'Add seen flag',
    })

    const docs = [{_id: 'post-1', _type: 'post'}]
    const mutations = []
    for await (const mutation of collectMigrationMutations(migration, () => docs, context)) {
      if (mutation) mutations.push(mutation)
    }

    expect(mutations).toHaveLength(1)
  })
})
```

### Testing Guidelines

- Test both success and error paths
- Prefer asserting on real behavior (produced mutations, parsed documents) over mock call counts
- Use `vi.mocked()` for type-safe mocking; avoid `any` in mock types
- Keep network out of unit tests — drive the runner from in-memory documents or a local export fixture

---

## Pull Request Process

### Before Submitting

- [ ] All tests pass: `pnpm test`
- [ ] TypeScript compiles: `pnpm typecheck`
- [ ] Code is linted: `pnpm lint`
- [ ] Dependencies checked: `pnpm depcheck`
- [ ] Tests added for new functionality
- [ ] Tests updated for modified functionality

### Commit Messages

Use [conventional commits](https://www.conventionalcommits.org/) format:

- `feat:` — new features
- `fix:` — bug fixes
- `refactor:` — code improvements
- `test:` — test additions/changes
- `docs:` — documentation
- `ci:` — CI/CD changes
- `chore:` — maintenance

Breaking changes to the public API use `feat!:` or a `BREAKING CHANGE:` footer (this drives the major version bump via release-please).

### PR Description

Include:

- What changed and why
- How to test the changes
- Any breaking changes
- Related issues

---

## Supported Environments

- **Node.js**: `>=20.19 <22 || >=22.12` (see `engines` in package.json)
- **Platforms**: Linux, macOS, Windows
- **Package manager**: pnpm

---

## Resources

- [Project README](./README.md)
- [Sanity Documentation](https://www.sanity.io/docs)
- [Schema and Content Migrations Guide](https://www.sanity.io/docs/schema-and-content-migrations)
- [Sanity CLI](https://github.com/sanity-io/cli) — home of the `sanity migrations` commands
- [Vitest Documentation](https://vitest.dev/)

---

Thank you for contributing to @sanity/migrate! 🎉
