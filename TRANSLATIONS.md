# Translations

Cairn documentation is available in English (primary) and Chinese (Simplified).

## File Naming Convention

Chinese translations use the `.zh.md` suffix:

| English source           | Chinese translation         |
| ------------------------ | --------------------------- |
| `README.md`              | `README.zh.md`              |
| `spec/FORMAT.md`         | `spec/FORMAT.zh.md`         |
| `spec/DESIGN.md`         | `spec/DESIGN.zh.md`         |
| `spec/adoption-guide.md` | `spec/adoption-guide.zh.md` |
| `spec/vs-adr.md`         | `spec/vs-adr.zh.md`         |
| `mcp/README.md`          | `mcp/README.zh.md`          |

## Keeping Translations in Sync

When an English source file is updated:

1. Open the corresponding `.zh.md` file
2. Add a comment at the top if it is out of date: `<!-- STALE: source updated YYYY-MM-DD -->`
3. Update the translated content to match

## Contributing Translations

Translations of user-facing documents are welcome. Before contributing:

- Read `spec/glossary.md` for standardized terminology
- Match the structure of the English source exactly
- Keep all code blocks, file paths, and format contract strings (field names, section headers) in English
