# Cairn — OpenCode

> Append this file to `AGENTS.md` at your project root.
> OpenCode also supports `CLAUDE.md` as a fallback if `AGENTS.md` is not present.

<!-- cairn:start -->
## Cairn (path-dependent constraint memory)

If this project contains `.cairn/`:

1. Read `.cairn/output.md` at session start to load the constraint frame.
2. Read `.cairn/SKILL.md` for the full operating protocol — when to load
   domains, when to read history, and when to write history/domain/output
   updates yourself using your file tools.
3. There is no CLI ceremony. You maintain the memory directly with
   Write/Edit. End your response with `cairn: recorded <N> event(s): ...`
   or `cairn: no event recorded` so the user can verify and git-review.
<!-- cairn:end -->
