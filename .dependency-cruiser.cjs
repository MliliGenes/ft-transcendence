// @ts-check
// Deep-module enforcement for dependency-cruiser.
//
// Each package under the packages root is a DEEP MODULE: a lot of behaviour
// behind a small interface. A package's PUBLIC SURFACE is its ENTRY POINTS —
// the files at the package source root (src/). Implementation lives in SUBFOLDERS and is
// private — by convention `src/lib/` for implementation and `test/` for tests,
// though any subfolder is private. A package may expose several small entry
// points (index.ts, client.ts, server.ts, …) — prefer that over one giant
// barrel index.
//
// The only thing you should ever need to edit here is PACKAGES_ROOT.

/** Where packages live. One immediate child dir per package (flat, no nesting). */
const PACKAGES_ROOT = "packages";

// --- derived patterns (no need to edit) -------------------------------------
const R = PACKAGES_ROOT;
/**
 * A package's private internals: anything nested inside a package subfolder.
 * The package's source-root files are its entry points and are NOT matched here —
 * they stay importable from outside.
 */
// Existing workspaces expose root files inside src/; dist/ mirrors that interface.
// All deeper paths and every other package subfolder remain private.
const PACKAGE_INTERNALS = `^${R}/[^/]+/(?!(?:src|dist)/[^/]+$)[^/]+/`;
const TESTS = "(?:test|tests)";

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "entrypoint-boundary-from-app",
      comment:
        "App/root code may import a package's entry points (its source-root files), but nothing inside its subfolders.",
      severity: "error",
      from: { pathNot: `^${R}/` }, // importer is NOT inside any package
      to: { path: PACKAGE_INTERNALS },
    },
    {
      name: "entrypoint-boundary-across-packages",
      comment:
        "A package's own files import each other freely, but may reach OTHER packages only through their entry points — never their internals.",
      severity: "error",
      // importer is inside a package ($1), but is not a test file
      from: { path: `^${R}/([^/]+)/`, pathNot: `^${R}/[^/]+/${TESTS}/` },
      to: {
        path: PACKAGE_INTERNALS,
        pathNot: `^${R}/$1/`, // same package → intra-package freedom
      },
    },
    {
      name: "tests-through-entrypoints",
      comment:
        "A package's tests exercise it through its entry points like everyone else: they may import any package's entry points and their own tests/ fixtures, but never any package's internals — not even their own.",
      severity: "error",
      from: { path: `^${R}/([^/]+)/${TESTS}/` }, // a test file, in package $1
      to: {
        path: PACKAGE_INTERNALS,
        pathNot: `^${R}/$1/${TESTS}/`, // own tests/ fixtures → allowed
      },
    },
    {
      name: "tests-folder-is-private",
      comment:
        "A package's tests/ folder is reachable only from tests — nothing else may import fixtures.",
      severity: "error",
      from: { pathNot: `^${R}/[^/]+/${TESTS}/` }, // importer is not itself a test
      to: { path: `^${R}/[^/]+/${TESTS}/` },
    },
    {
      name: "no-circular",
      comment: "No dependency cycles. Scope to `^${R}/` if you want to allow cycles outside packages.",
      severity: "error",
      from: {},
      to: { circular: true },
    },

    {
      name: "no-unresolved",
      comment: "A missing import cannot be checked against a package interface.",
      severity: "error",
      from: { pathNot: "^user-service/" },
      to: { couldNotResolve: true },
    },

    // --- Layering (optional, off by default) ----------------------------------
    // Interface-hiding controls HOW you import (through the entry points).
    // Layering controls WHICH packages may depend on which. Add your own rules
    // here, e.g.:
    //
    // {
    //   name: "ui-may-not-depend-on-billing",
    //   severity: "error",
    //   from: { path: `^${R}/ui/` },
    //   to:   { path: `^${R}/billing/` },
    // },
  ],
  options: {
    doNotFollow: { path: "(^|/)(node_modules|dist)/" },
    // Check type-only imports too; each workspace keeps its own unchanged tsconfig.
    tsPreCompilationDeps: true,
    exclude: { path: "(^|/)(node_modules|test-results|playwright-report)/|user-service/src/generated/" },
    enhancedResolveOptions: {
      extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
      // Workspace source metadata resolves package imports to the checked sources.
      mainFields: ["source", "types", "main"],
      exportsFields: ["exports"],
      conditionNames: ["source", "import", "require", "node", "default", "types"],
    },
  },
};
