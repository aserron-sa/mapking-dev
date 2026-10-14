feat(tools): add commit script (flag, pipe, template or file)

Adds tools/commit/ to commit with one command:
- commit.mjs reads the message from -m, a pipe, -t <template>, or current_msg.md.
- config.mjs holds pre and post hooks, trailers and an optional branch rule.
- tpls/ has starting templates for feat, fix, docs and chore.

Pre hooks run before staging and abort on failure. Post hooks run after the commit and only warn.
Node 22 or later, no dependencies.
