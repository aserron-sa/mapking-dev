# tools/commit

One command to commit with a message from a flag, a pipe, a template, or `current_msg.md`.

    node tools/commit/commit.mjs                    # message from current_msg.md
    node tools/commit/commit.mjs -m "fix(x): y"     # message from a flag
    cat msg.md | node tools/commit/commit.mjs       # message from a pipe
    node tools/commit/commit.mjs -t feat            # start from tpls/feat.md
    node tools/commit/commit.mjs --dry              # preview, change nothing
    node tools/commit/commit.mjs -a                 # git add -A first
    node tools/commit/commit.mjs --add path/to/file # stage one path first

Message precedence: `-m`, then piped stdin, then `-t`, then `current_msg.md` (`-f` to use another file).

Sequential use: edit `current_msg.md`, run the script; repeat. The script refuses an empty message,
a message still starting with `TODO:`, and an empty index (unless you stage with `-a` or `--add`).

Settings and hooks (pre runs before staging and aborts on failure; post runs after and only warns):
edit `config.mjs`. Trailers are added to every message unless already present.

Node 22+, no dependencies.
