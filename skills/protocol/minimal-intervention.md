# Minimal Intervention Rules

Cairn exists to protect cognition, not to tax every interaction. These rules define when each lifecycle step can be skipped.

## Skip context when

- Fixing a typo, formatting, or linting issue
- Answering a pure explanation question ("what does this function do?")
- Non-technical conversation (project management, scheduling, chat)
- One-line string/config change with no architectural implication
- User explicitly asks for a quick answer without project context

## Skip plan when

- Change is local to a single function or file
- Isolated utility addition with no cross-module impact
- Tiny dependency bump (patch version, no API change)
- Bug fix with obvious root cause and localized fix
- Implementing a plan that was already validated by `cairn_plan`

## Skip observe when

- Commit contains only whitespace, formatting, or comment changes
- Commit is a docs-only typo fix
- Merge commit with no manual resolution
- Commit was already fully covered by explicit `cairn_signal` calls during the session

## Skip session_end when

- No technical work was done in the session (pure Q&A, explanation only)
- Session consisted of a single trivial fix with no signals captured
- User is explicitly continuing work in the same session (session_end will be called later)

## The test

When unsure, ask: "Would a future AI session benefit from knowing what happened here?"

- Yes → follow the lifecycle
- No → skip safely
