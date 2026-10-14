// tools/commit/config.mjs — per-repo settings for commit.mjs.
// Hooks: a shell string, or { name, run, optional } where run is a string or a function(ctx).
//   pre  runs before anything is staged or committed. A failure aborts (unless optional: true).
//   post runs after the commit. A failure is printed and ignored.
// ctx: { root, branch, subject, sha }. Shell hooks also get COMMIT_BRANCH, COMMIT_SUBJECT, COMMIT_SHA.

export default {
  // Replaces {{date}} and {{branch}} and any key below inside messages.
  vars: {},

  // Refuse to commit on branches that do not match. null = any branch.
  allowedBranches: null, // e.g. /^(main|feat\/.+)$/

  // Appended to every message unless already present.
  trailers: [
    'Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>',
    'Claude-Session: https://claude.ai/code/session_019TnqbVJ2Gjbc3BG2jv1bHR',
  ],

  hooks: {
    pre: [
      // { name: 'cct tests', run: 'npm run cct:test' },
      // { name: 'typecheck', run: 'npm run typecheck:dist' },
    ],
    post: [
      // { name: 'push reminder', run: 'echo "Push when ready: git push origin $COMMIT_BRANCH"' },
    ],
  },
};
