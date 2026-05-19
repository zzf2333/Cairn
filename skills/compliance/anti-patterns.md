# Dangerous Behaviors (Anti-Patterns)

These are behaviors that violate the Cairn cognitive lifecycle. If you catch yourself doing any of these, stop and correct.

---

## Passive Memory Usage

Wrong:

```
Only call Cairn tools when the user explicitly asks.
```

Cairn is not passive memory. It is an active cognitive protocol. You must call tools proactively during the lifecycle, not wait for the user to remind you.

---

## Skipping Context

Wrong:

```
Start coding immediately without calling cairn_context.
```

No cairn_context = no technical recommendation. This is the most common and most damaging violation. Every technical response must be informed by project cognition.

---

## Skipping Recovery

Wrong:

```
Continue working despite blocked_by_unclosed_session.
```

An unclosed session means the previous session's maintenance pipeline never ran. Git commits were not scanned, decay did not run, calibration was skipped. Recover first, then proceed.

---

## Silent Constraint Ignoring

Wrong:

```
Recommend historically rejected paths without surfacing the challenge.
```

When your recommendation conflicts with a no_go or historical rejection, you must surface the conflict. The user needs to know they are revisiting a previously rejected direction.

---

## Silent Signal Dropping

Wrong:

```
Acknowledge a user's constraint verbally but not capture it via cairn_signal.
```

If the user says "we never use Redis" and you respond "understood" without calling cairn_signal, that constraint is lost forever. Future sessions will suggest Redis again.

---

## Auto-Accepting Staged Entries

Wrong:

```
Automatically accept all staged entries without presenting to user.
```

Staged entries exist precisely because they need human judgment. Auto-accepting bypasses the governance system.

---

## Over-Conservative Reasoning

Wrong:

```
Treat all historical cognition as permanent, immutable truth.
```

Historical cognition informs reasoning — it does not replace it. When environment, team, or capabilities have changed, the system should favor reevaluation over dogma. Use the governance flow to propose changes.

---

## Dogmatic DNA Enforcement

Wrong:

```
Reject new paradigms solely because of old identity traits.
```

DNA traits are emergent patterns, not laws. When reevaluation_mode is active, DNA challenges become advisory. Even outside reevaluation, DNA should influence, not dictate.

---

## Skipping Session End

Wrong:

```
End the conversation without calling cairn_session_end.
```

Every started session must be closed. The session_end pipeline is where most of Cairn's value is generated: git scanning, decay, calibration, compression, and view regeneration.

---

## Fixing Accepted Debt

Wrong:

```
"Improve" code that is deliberately suboptimal because it was accepted as technical debt.
```

Accepted debt is a deliberate choice. Before touching it, check the `revisit_when` conditions. If they are not met, leave it alone.
