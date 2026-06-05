# Agent Skills Use Dedicated Sandboxes

OUTNA.ME supports Agent Skills as user-installed capability packages that may
include executable scripts. Each skilled agent gets one dedicated persistent
Skill Sandbox, created lazily on first skill install, instead of reusing the
agent system sandbox or the existing maintainer tool sandbox runtime. The Skill
Sandbox is intentionally permissive for script execution and public internet
access, while the system sandbox remains the canonical memory filesystem.

## Consequences

Installed skills live under `skills/<slug>` and agent working files live under
`workspace` inside the Skill Sandbox. The first version mirrors `bash-tool`'s
skill contract: discover installed `SKILL.md` files, expose a `skill` loader
tool with available skill names in its description, load skills by their
declared names, return the selected skill's instructions and file list, and pair
it with bash execution in the Skill Sandbox. Per-skill permission manifests and
credential brokering can be added later if the product needs finer control.
Skill names are unique per agent using case-insensitive comparison so runtime
lookup remains unambiguous for users and models.
Postgres stores an index of installed skills for UI, source metadata, and
collision checks; the Skill Sandbox stores the actual skill files. Runtime skill
discovery mirrors `bash-tool` and reads installed `SKILL.md` files from the
Skill Sandbox rather than trusting the Postgres management index. At runtime,
the Skill Sandbox is the source of truth; Postgres supports UX and recovery.
Skill runtime tools are built-in conditional agent tools named `skill` and
`bash`, added alongside file tools when valid skills exist, not maintainer tool
attachments stored in `agent_tools`. The `bash` tool is scoped to the Skill
Sandbox. Unlike `bash-tool`, OUTNA.ME does not add Skill Sandbox `readFile` or
`writeFile` tools because those names already refer to the system sandbox memory
tools. When skill tools are present, the agent system prompt explains that
`bash` runs only in the Skill Sandbox while system memory files still use the
existing file tools.
Skills are managed in their own agent UI surface rather than inside the
maintainer Tools catalog.
Skill Sandbox command execution mirrors `bash-tool` output truncation and relies
on the sandbox timeout rather than a separate bash-tool timeout. The sandbox
timeout is set for longer script work, closer to repo workspaces than the system
sandbox.
Skill import copies packages into the Skill Sandbox without running automatic
install or build hooks. The first UI surface is `/agents/[agentId]/skills`,
separate from Tools, with install support for one skill at a time from GitHub,
`SKILL.md`, or zip.
