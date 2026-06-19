# docs/reports

Status reports for **brief-studio** — styled PDF, one file per date.

## Format (always the same)

Every report has three sections:

1. **Being Deployed Today**
2. **Currently Working On — Local / Staging**
3. **Next in the Pipeline**

Same template/styling as the creative-hub status reports (A4, gradient rule,
numbered section headers, status tags).

## How it was generated

A filled HTML (template from `creative-hub/.claude/skills/report/template.html`)
rendered to PDF via headless Microsoft Edge:

```
msedge --headless=new --no-pdf-header-footer --print-to-pdf=<out.pdf> <report.html>
```

Saved here as `brief-studio-status-YYYY-MM-DD.pdf`.

## Notes

- Reports are point-in-time snapshots — do not edit a dated PDF after the fact; generate a new one.
- Never include secrets (passwords, tokens, connection strings) in a report.
