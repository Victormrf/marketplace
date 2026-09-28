# Project Agent Instructions

## Code readability and formatting

- Write production code in a readable, conventionally formatted style.
- Use consistent indentation in every modified or created file.
- For JavaScript and TypeScript, use two spaces per indentation level.
- Do not collapse non-trivial functions, methods, classes, conditionals, callbacks, object literals, or transaction bodies into a single line.
- Prefer one statement per line.
- Break long function calls and argument lists across multiple lines.
- Preserve clear visual separation between imports, helpers, classes, and exported declarations.
- Follow the formatter and lint configuration defined by each application.
- Before completing a change, format every modified source and test file.
- Do not reformat unrelated files or generate large formatting-only diffs outside the requested scope.
- Readability takes priority over minimizing the number of lines.

## Implementation handoff report

- At the end of every implementation handoff, include a concise Markdown table with the columns `Arquivo` and `Responsabilidade`.
- List every file created or modified in the handoff, using paths relative to the project root, and summarize each file's role in one clear sentence.
- Include source, test, configuration, and documentation files when changed. Do not list unchanged files.
- Keep validation results and remaining limitations brief and separate from the file table.
- For responses that do not change files, state that no files were changed instead of adding an empty table.
