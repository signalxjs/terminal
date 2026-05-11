# Releasing

Releases are cut by pushing a `v*.*.*` tag from `main`. The `Release` workflow:

1. Installs deps, lints, typechecks, builds, tests and verifies pack.
2. Publishes every public package in `scripts/publish.js` (in dependency order) using **npm trusted publishing** (OIDC) with provenance.
3. Promotes the matching draft GitHub release to `latest`, or creates one if none exists.

## Cutting a release

```bash
# 1. Bump versions across the workspace
pnpm version:patch    # or version:minor / version:major / version:set 0.5.0

# 2. Update CHANGELOG.md (move [Unreleased] → new version section)

# 3. Commit
git add -A
git commit -m "release: vX.Y.Z"

# 4. Tag and push
git tag vX.Y.Z
git push origin main --follow-tags
```

The workflow does the rest.

## npm trusted publishing

Each public package on npm must have a Trusted Publisher rule pointing at
`signalxjs/terminal` and workflow `.github/workflows/release.yml` on the `Release`
environment. Without it, `npm publish` will fail with an OIDC error.

## Local dry-run

```bash
pnpm publish:dry
```

This runs `scripts/publish.js --dry-run` which prints what `npm publish` would do for every package without contacting the registry.
