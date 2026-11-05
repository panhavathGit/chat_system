@AGENTS.md

## Claude Code notes

- Project skills in `.claude/skills/` are symlinks to `.agents/skills/` (edit the originals, never the links),
  plus the Claude-only `verify-changes` skill.
- Prefer the dedicated Read/Edit/Grep tools over shell equivalents; use `pnpm --filter @chat-dashboard/<pkg> <script>` to scope commands.
- Ask before running `pnpm db:migrate` against a database you did not create, or any destructive git/DB command.
