# Sandbox-backed Agent Skills

This project supports dynamic user-provided skills stored in the Vercel Sandbox filesystem (not in repo files).

## Example: Markdown skill upload

Call `add_skill_markdown` with:

```json
{
  "slug": "csv-helper",
  "markdown": "---\nname: csv-helper\ndescription: Analyze CSV files\n---\n# csv-helper\nUse bash to run ./parse.sh"
}
```

Then call `skill`:

```json
{ "skillName": "csv-helper" }
```

## Example: ZIP skill upload

1. Create ZIP containing `SKILL.md` and optional scripts/resources.
2. Base64 encode ZIP and send to `add_skill_zip`:

```json
{ "filename": "my-skill.zip", "zipBase64": "<base64>" }
```

ZIP extraction validates entries and rejects traversal paths like `../evil.sh`.

## Example: GitHub skill upload

Call `add_skill_github`:

```json
{ "repoUrl": "https://github.com/acme/agent-skill", "branch": "main" }
```

The loader downloads the GitHub zipball and ingests it through the same ZIP validation path.

## Discovery & invocation

- `list_skills`: returns all registered sandbox skills.
- `skill`: loads the selected `SKILL.md` instructions.
- Agent can then run companion scripts through existing `bash` tool in the same sandbox.
