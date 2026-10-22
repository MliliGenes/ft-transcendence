# Local repository visualization

Run from the repository root:

```sh
npx @agent-native/core@latest visualize-repo --open
npx @agent-native/core@latest visualize-repo check
```

Start at `visual-docs/repo-overview/plan.mdx`. Its first section lists remaining work, completion conditions and source evidence. The manifest is `agent-native.json` at the repository root.

The MDX and manifest can be checked in. Keep `.plan-url`, `.plan-state.json` and `comments.json` local; the folder ignore rules cover them. A bridge URL works only on the machine that serves it. The hosted Plan UI reads local files; this workflow does not publish the guide. Do not run hosted `verify` or hosted write tools with private source. Use a local Plan app for strict verification, or offline `check` plus direct browser inspection.

After a code change, update the affected visual section and its evidence. Local review comments are a feedback inbox, not a claim that the requested work is already done. Resolve source/document conflicts explicitly.
