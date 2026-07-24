import pkg from "../package.json";

/**
 * What's actually running. Shown in the footer so a bug report ("it's still
 * doing X") can be pinned to a build instead of guessing whether the deploy
 * landed. Vercel injects the commit SHA at build time.
 */
const sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);

export const BUILD_LABEL = sha ? `v${pkg.version}+${sha}` : `v${pkg.version} (dev)`;
