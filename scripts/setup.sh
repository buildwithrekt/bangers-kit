#!/usr/bin/env bash
# Installs the always-on rules and the design watch into the Claude config
# directory, and adds one import line to the user-level CLAUDE.md.
# Idempotent: safe to run again after each plugin update.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
DEST="$CONFIG/bangers"

# Path as written inside the markdown files.
if [ "$CONFIG" = "$HOME/.claude" ]; then
  SHOWN="~/.claude/bangers"
else
  SHOWN="$DEST"
fi

mkdir -p "$DEST"

render() { sed "s|~/.claude/bangers|$SHOWN|g" "$1"; }

# Rules belong to the kit: refreshed on every run, previous copy kept if edited.
NEW_RULES="$(render "$ROOT/rules/rules.md")"
if [ -f "$DEST/rules.md" ] && [ "$(cat "$DEST/rules.md")" != "$NEW_RULES" ]; then
  cp "$DEST/rules.md" "$DEST/rules.md.bak"
  echo "updated  $DEST/rules.md (previous version saved as rules.md.bak)"
elif [ ! -f "$DEST/rules.md" ]; then
  echo "created  $DEST/rules.md"
else
  echo "current  $DEST/rules.md"
fi
printf '%s\n' "$NEW_RULES" > "$DEST/rules.md"

# The design watch belongs to the user once installed: never overwritten.
if [ -f "$DEST/design-references.md" ]; then
  echo "kept     $DEST/design-references.md (yours; refresh it with /bangers:scout)"
else
  cp "$ROOT/rules/design-references.md" "$DEST/design-references.md"
  echo "created  $DEST/design-references.md"
fi

# One import line in the user-level CLAUDE.md.
IMPORT="@$SHOWN/rules.md"
MEMORY="$CONFIG/CLAUDE.md"
if [ -f "$MEMORY" ] && grep -qxF "$IMPORT" "$MEMORY"; then
  echo "current  $MEMORY already imports the rules"
else
  [ -f "$MEMORY" ] && [ -n "$(tail -c1 "$MEMORY")" ] && printf '\n' >> "$MEMORY"
  printf '\n# Bangers kit\n%s\n' "$IMPORT" >> "$MEMORY"
  echo "added    import line to $MEMORY"
fi

echo "done. Start a new session to load the rules."
