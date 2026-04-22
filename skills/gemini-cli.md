# Cairn — Gemini CLI

> Add this file to `GEMINI.md` at your project root (or `~/.gemini/GEMINI.md` for global scope).
> Gemini CLI loads `GEMINI.md` from the global home directory, the project root, and any parent directories up to the filesystem root.

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
