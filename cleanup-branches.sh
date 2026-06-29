#!/usr/bin/env bash
#
# cleanup-branches.sh — delete remote branches that are fully merged into main.
#
# Generated 2026-06-27. Run from a local clone with normal GitHub credentials.
# (This could NOT be run from the Claude web sandbox: its git proxy rejects
#  ref deletions — it only permits pushes to the assigned working branch.)
#
# "Fully merged" was verified with `git cherry origin/main <branch>` (patch-id
# equivalence), so squash/rebase merges that look "ahead" are correctly treated
# as merged. Deleting these loses NO work — each is fully contained in main.
#
# Usage:
#   git fetch --all --prune        # refresh first
#   bash cleanup-branches.sh       # review, then run

set -euo pipefail

git fetch --all --prune

# --- Fully merged into main (safe to delete) ---
MERGED=(
  claude/mobile-ux-hidbdz
  claude/todo-implementation-hidbdz
  firepit-baked-overlay-decision
  firepit-embers
  firepit-stash-edit-fix
  mobile-responsive
  # forge-output-ux            # <-- fully merged, BUT it's the documented
  #                            #     integration trunk (CLAUDE.md). Uncomment
  #                            #     only if you're sure you want it gone.
)

# --- Re-verify each branch is truly merged before deleting (safety belt) ---
for b in "${MERGED[@]}"; do
  if [ "$(git cherry origin/main "origin/$b" 2>/dev/null | grep -c '^+')" -eq 0 ]; then
    echo "Deleting origin/$b (fully merged)…"
    git push origin --delete "$b"
  else
    echo "SKIP origin/$b — has unmerged commits after all; not deleting."
  fi
done

# --- Deliberately NOT deleted: real unmerged work exists on these ---
#   claude/version-tier-roadmap-l3nzhu   (1 unmerged commit)
#   design-system                        (3 unmerged commits)
#   tracking-v2-phase3                   (1 unmerged commit)
# Merge these to main (or confirm abandoned) before removing them.

echo "Done."
