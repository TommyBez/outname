# Ultracite Code Standards

This project uses **Ultracite**, a zero-config preset that enforces strict code quality standards through automated formatting and linting.

## Quick Reference

- **Format code**: `pnpm dlx ultracite fix`
- **Check for issues**: `pnpm dlx ultracite check`
- **Diagnose setup**: `pnpm dlx ultracite doctor`

Biome (the underlying engine) provides robust linting and formatting. Most issues are automatically fixable.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- Use proper image components (e.g., Next.js `<Image>`) over `<img>` tags

### Framework-Specific Guidance

**Next.js:**
- Use Next.js `<Image>` component for images
- Use `next/head` or App Router metadata API for head elements
- Use Server Components for async data fetching instead of async Client Components

**React 19+:**
- Use ref as a prop instead of `React.forwardRef`

**Solid/Svelte/Vue/Qwik:**
- Use `class` and `for` attributes (not `className` or `htmlFor`)

---

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

## When Biome Can't Help

Biome's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Biome can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Biome. Run `pnpm dlx ultracite fix` before committing to ensure compliance.

---

## Cursor Cloud specific instructions

### Services overview

This is a single Next.js 16 application (not a monorepo). The dev server is the only service needed locally.

- **Dev server**: `pnpm dev` → http://localhost:3000
- **Database**: Remote Neon Postgres via `DATABASE_URL` (no local DB required)
- **Lint**: `pnpm check` (Ultracite/Biome)
- **Format**: `pnpm fix` (auto-fix lint/format issues)

### Environment variables

Required secrets are injected automatically. A `.env.local` must exist for Next.js to read them at runtime. Create it with:

```
DATABASE_URL=<from env>
BETTER_AUTH_SECRET=<from env>
BETTER_AUTH_URL=http://localhost:3000
CONNECTION_ENCRYPTION_KEY=<from env>
AI_GATEWAY_API_KEY=<from env>
```

### Known caveats

- **Production build (`pnpm build`) fails** with a Turbopack error on `@mongodb-js/zstd` (a transitive native dependency from `just-bash`). The dev server (`pnpm dev`) works fine. This is a known Turbopack limitation with non-ESM native addons.
- **`pnpm approve-builds --all`** is needed after `pnpm install` to allow native packages (esbuild, sharp, @swc/core) to run their postinstall scripts. Without this, the workflow bundle and image processing won't work.
- **`pnpm-workspace.yaml`** is auto-generated by `pnpm approve-builds --all` and lists allowed build scripts. It is not committed upstream but is needed locally.
- **Auth is single-user** with sign-up disabled. The test user is pre-seeded in the database. Use `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` env vars to log in.
- **Vercel Workflow, Sandbox, and AI Gateway** are Vercel platform services. Agent sessions, sandboxes, and heartbeat loops require a Vercel deployment to work fully. Locally, the UI and CRUD operations work but autonomous agent execution does not.
- **`drizzle-kit push`** requires a TTY for confirmation prompts. Use `drizzle-kit push --force` or run interactively if schema changes are needed.
- **No automated test suite** exists in this repo currently. Testing is manual via the UI.
