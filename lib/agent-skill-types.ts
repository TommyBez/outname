/**
 * Shared, dependency-light types for the skills feature. Lives in its
 * own module so server-only ingest paths and client-side forms can both
 * import the source-type union without dragging the DB or sandbox.
 */

export type AgentSkillSourceType = 'markdown' | 'zip' | 'github'

export interface SkillFrontmatter {
  description: string
  name: string
}

export interface ParsedSkillBundle {
  /** All files belonging to the skill, keyed by posix-relative path. */
  files: ParsedSkillFile[]
  /** Frontmatter from `SKILL.md`. */
  metadata: SkillFrontmatter
}

export interface ParsedSkillFile {
  content: string
  /** True when the source file declared executable bits. */
  executable: boolean
  /** Posix path relative to the skill root (e.g. `SKILL.md`, `scripts/run.sh`). */
  path: string
}

export interface SkillIngestResult {
  error?: string
  /** Slug of the skill that was created or updated. */
  name?: string
  ok: boolean
}
