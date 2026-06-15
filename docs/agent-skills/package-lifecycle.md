# Package Lifecycle

Import sources:
- Install accepts `skill_md`, `zip`, GitHub URL, or `skills_sh` id.
- Root `SKILL.md` must have YAML `name` and `description`; body is instructions.
- Names normalize with trim, NFC, and lowercase for conflict checks.
- Limits: 25 MiB package, 10 MiB file, 256 KiB `SKILL.md`, 200 files, 512-char paths.
- ZIP packages may be at archive root or one enclosing directory.
- ZIP entries reject absolute paths, traversal, NUL, duplicates, and non-regular entries.
- GitHub import accepts repo, tree, or blob `SKILL.md` URLs and filters archive to source path.
- `HEAD` GitHub imports resolve default branch before downloading from codeload.
- `skills.sh` import fetches OIDC-authenticated snapshots; shebang files become executable.

Install/replace:
- Install verifies agent ownership, prepares package, and checks normalized-name conflict.
- Existing name requires replace; replacing keeps the slug.
- New slug collisions suffix from content hash.
- Files are written under `/vercel/sandbox/skills/<slug>`.
- Replace writes temp, moves current to backup, activates temp, and restores on failure.
- Discovery scans depth-2 `SKILL.md`, skipping dot slugs, invalid files, and duplicate names.
- Runtime exposes `skill` and `bash` only when discovery returns at least one skill.

Source anchors: `packages/shared/agents/server/skills.ts`, `packages/ai/agent-runtime/skills/package.ts`, `packages/ai/agent-runtime/skills/github-import.ts`, `packages/ai/agent-runtime/skills/discovery.ts`, `packages/ai/agent-runtime/workflows/session/tools/skill-tools.ts`.
Test anchors: `packages/ai/agent-runtime/skills/package.test.ts`, `packages/ai/agent-runtime/skills/github-import.test.ts`, `packages/ai/agent-runtime/skills/discovery.test.ts`, `packages/ai/agent-runtime/skills/skill-md.test.ts`.
