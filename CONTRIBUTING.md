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

`@sanity/migrate` provides tooling for running data migrations on [Sanity.io](https://www.sanity.io/) projects. It's built as an [oclif](https://oclif.io/) CLI with commands for creating, listing, and running migrations.

### Directory Structure

```
src/
├── _exports/          # Public API exports
├── actions/           # Business logic (migration templates, resolution)
│   └── migration/     # Migration-specific actions
│       └── templates/ # Built-in migration templates
├── commands/          # oclif command definitions
│   └── migration/     # migration:create, migration:list, migration:run
├── fetch-utils/       # HTTP request utilities
├── fs-webstream/      # File-based stream buffering
├── it-utils/          # Async iterator utilities
├── mutations/         # Mutation building and batching
├── runner/            # Migration execution engine (dry run + live)
├── sources/           # Data sources (API, export archives)
├── tar-webstream/     # Tar archive streaming (for dataset exports)
├── uint8arrays/       # Binary data utilities
└── utils/             # Shared utilities (constants, formatting, etc.)
```

### Separation of Concerns

```
┌─────────────────────────────────────┐
│  Commands (CLI Interface)           │  Parse args, orchestrate flow
├─────────────────────────────────────┤
│  Actions (Business Logic)           │  Templates, migration resolution
├─────────────────────────────────────┤
│  Runner (Execution Engine)          │  Dry run, live run, batching
├─────────────────────────────────────┤
│  Sources & Utilities                │  Data sources, streams, iterators
└─────────────────────────────────────┘
```

**Commands** (`commands/`) parse CLI arguments and flags, then orchestrate the flow. Keep these thin.

**Actions** (`actions/`) contain business logic — migration templates, project root resolution, migration script discovery.

**Runner** (`runner/`) handles the actual migration execution — dry runs, live runs, mutation batching, and progress reporting.

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

| Script | Description |
|--------|-------------|
| `pnpm build` | Build with SWC + generate type declarations |
| `pnpm watch` | Watch mode (rebuilds on changes) |
| `pnpm test` | Run tests with Vitest |
| `pnpm coverage` | Run tests with coverage report |
| `pnpm lint` | Lint with ESLint |
| `pnpm lint:fix` | Lint and auto-fix |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm depcheck` | Check for unused dependencies (Knip) |
| `pnpm format` | Format with Prettier |

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
import myFunction from './utils/myUtil'  // Missing extension
const x = require('./x')                 // No CommonJS
```

### TypeScript

- Never use `any` — use `unknown` and narrow appropriately
- Use `satisfies` for type assertions where possible
- Enable all strict TypeScript flags

### Error Handling

```typescript
try {
  const result = await operation()
  return result
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  this.error(`User-facing message: ${message}`, {exit: 1})
}
```

### Cross-Platform Compatibility

Tests run on both **Ubuntu and Windows**. Keep these in mind:

- Use `path.join()` for constructing file paths — never hardcode `/` separators
- In test assertions, use `path.join()` or `expect.stringContaining()` with platform-aware values
- Be aware that `styleText()` wraps values in ANSI codes — don't assert contiguous strings that span styled boundaries
- File operations may behave differently on Windows (e.g., `EPERM` instead of `ENOENT` for locked files)

---

## Testing

### Stack

- **Vitest** for test runner
- **`@sanity/cli-test`** for command testing utilities
- **`vi.mock()`** for module mocking

### Test Structure

```typescript
import {describe, test, expect, afterEach, vi} from 'vitest'
import {testCommand} from '@sanity/cli-test'
import {MyCommand} from '../my-command.js'

describe('#migration:my-command', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  test('success case', async () => {
    // 1. Set up mocks
    mockDependency.mockResolvedValue(mockData)

    // 2. Execute command
    const {stdout, stderr, error} = await testCommand(MyCommand, ['args'], {
      mocks: defaultMocks,
    })

    // 3. Assert
    expect(error).toBeUndefined()
    expect(stdout).toContain('expected output')
  })

  test('error case', async () => {
    const {error} = await testCommand(MyCommand, ['args'], {
      mocks: defaultMocks,
    })

    expect(error?.message).toContain('Expected error')
    expect(error?.oclif?.exit).toBe(1)
  })
})
```

### Mocking Patterns

Use `vi.hoisted()` for mock functions and `vi.mock()` at module level:

```typescript
const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  input: vi.fn(),
  select: vi.fn(),
}))

vi.mock('@sanity/cli-core/ux', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sanity/cli-core/ux')>()
  return {
    ...actual,
    confirm: mocks.confirm,
    input: mocks.input,
    select: mocks.select,
  }
})
```

### Testing Guidelines

- Always clear mocks in `afterEach()`
- Test both success and error paths
- Use `testCommand()` helper for command execution
- Use `vi.mocked()` for type-safe mocking
- Avoid `any` in mock types

---

## Command Implementation

### Basic Structure

Commands extend `SanityCommand` from `@sanity/cli-core`:

```typescript
import {Args, Flags} from '@oclif/core'
import {SanityCommand} from '@sanity/cli-core'

export class MyCommand extends SanityCommand<typeof MyCommand> {
  static override args = {
    id: Args.string({
      description: 'Migration ID',
      required: false,
    }),
  }

  static override description = 'What this command does'

  static override flags = {
    'dry-run': Flags.boolean({
      allowNo: true,
      default: true,
      description: 'Run in dry mode',
    }),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(MyCommand)
    // Implementation
  }
}
```

### Interactive Prompts

Use `@sanity/cli-core/ux` for consistent prompts:

```typescript
import {confirm, input, select} from '@sanity/cli-core/ux'

const title = await input({
  message: 'Title of migration',
  validate: (value) => value.trim() ? true : 'Title cannot be empty',
})

const confirmed = await confirm({
  message: 'Are you sure?',
  default: false,
})
```

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
- [oclif Documentation](https://oclif.io/docs)
- [Vitest Documentation](https://vitest.dev/)

---

Thank you for contributing to @sanity/migrate! 🎉
