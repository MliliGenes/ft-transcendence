# Issue tracker: Local Markdown

Issues and specs live as markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`.
- The feature spec is `.scratch/<feature-slug>/spec.md`.
- Keep one ticket per file under `.scratch/<feature-slug>/issues/`.
- Number tickets from `01` and use the existing `TICKET-NN-<slug>.md` format.
- Put a `Status:` line near the top of each ticket; use the role names in `triage-labels.md`.
- Append discussion under a `## Comments` heading.

## When a skill says “publish to the issue tracker”

Create a markdown file in the matching feature directory, creating the directory if needed.

## When a skill says “fetch the relevant ticket”

Read the referenced local file. The user will normally provide its path or ticket number.
