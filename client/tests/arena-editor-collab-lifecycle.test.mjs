import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { after, test as nodeTest } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const requireCjs = createRequire(import.meta.url);
const cmState = requireCjs("@codemirror/state");
const cmView = requireCjs("@codemirror/view");
const ycodemirror = requireCjs("y-codemirror.next");

const { ySyncFacet } = ycodemirror;

/**
 * Regression coverage for the live 2v2 shared editor.
 *
 * The arena mounts `EditorAdapter` long before the collaboration sidecar
 * resolves, so the editor starts without a Yjs binding and only has to be
 * attached once a `CollabClient` exists. These tests drive the real component
 * (real CodeMirror state, real `y-codemirror.next` extension, real
 * `CollabClient`) and assert that the null -> connected transition actually
 * binds the editor to the team document, keeps teammate edits flowing, and
 * never silently drops what the user typed before collaboration connected.
 */

/* ------------------------------------------------------------------ *
 * Headless CodeMirror view.
 *
 * CodeMirror needs a DOM, which node does not provide. This fake keeps the
 * parts the collaboration lifecycle depends on: real `EditorState`
 * transactions, the real view-plugin lifecycle (so the Yjs sync plugin really
 * runs and really observes the shared document) and the real update-listener
 * facet. Plugins that insist on a real DOM (gutters, decorations) are allowed
 * to fail, exactly like the real editor deactivates a crashing plugin.
 * ------------------------------------------------------------------ */

function createStubElement() {
  return {
    nodeType: 1,
    className: "",
    style: {},
    textContent: "",
    childNodes: [],
    setAttribute() {},
    removeAttribute() {},
    appendChild(child) {
      this.childNodes.push(child);
      return child;
    },
    removeChild(child) {
      this.childNodes = this.childNodes.filter((entry) => entry !== child);
    },
    insertBefore(child) {
      this.childNodes.push(child);
      return child;
    },
    addEventListener() {},
    removeEventListener() {},
    getBoundingClientRect() {
      return { top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 };
    },
    getClientRects() {
      return [];
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
  };
}

const fakeDocument = {
  createElement: () => createStubElement(),
  createTextNode: (text) => ({ nodeType: 3, textContent: text }),
  createRange: () => ({
    setStart() {},
    setEnd() {},
    getBoundingClientRect: () => ({ top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 }),
    getClientRects: () => [],
  }),
  documentElement: createStubElement(),
  body: createStubElement(),
  addEventListener() {},
  removeEventListener() {},
};

/**
 * The client runner is `node --test --test-isolation=none`, so every test
 * file shares one process and one set of globals. The fake DOM is therefore
 * installed only while this file's own test body runs, and the previous
 * `globalThis.document` descriptor is restored afterwards, so no other test
 * file can observe it.
 */
const originalDocumentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");

function installFakeDocument() {
  Object.defineProperty(globalThis, "document", {
    value: fakeDocument,
    configurable: true,
    enumerable: true,
    writable: true,
  });
}

function restoreDocument() {
  if (originalDocumentDescriptor === undefined) {
    delete globalThis.document;
    return;
  }
  Object.defineProperty(globalThis, "document", originalDocumentDescriptor);
}

/**
 * Register a test that runs with the fake DOM installed.
 *
 * The import order matters and is unchanged: `@codemirror/view` is imported
 * above, before any DOM exists, and it captures `document` once at that
 * moment for browser detection only. Its own DOM calls resolve `document`
 * lazily, when the editor is built, so installing the fake around the test
 * body keeps that capture and the rest of the setup valid.
 */
function test(name, fn) {
  return nodeTest(name, async (t) => {
    installFakeDocument();
    try {
      await fn(t);
    } finally {
      restoreDocument();
    }
  });
}

function viewPluginValues(state) {
  const facets = state.config.facets;
  for (const id of Object.keys(facets)) {
    const providers = facets[id];
    const values = providers.map((provider) => provider.value);
    const isPluginValue = (value) =>
      value && value.plugin && typeof value.plugin.create === "function" && "baseExtensions" in value.plugin;
    if (values.length > 0 && values.every(isPluginValue)) return values;
  }
  return [];
}

function sameSpecs(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

class HeadlessPluginInstance {
  constructor(spec) {
    this.spec = spec;
    this.value = null;
    this.mustUpdate = null;
  }

  update(view) {
    if (!this.value) {
      try {
        this.value = this.spec.plugin.create(view, this.spec.arg);
      } catch {
        // A plugin that needs a real DOM cannot run headlessly; the real
        // editor deactivates crashing plugins the same way.
        this.value = null;
      }
      return;
    }
    if (!this.mustUpdate) return;
    const pending = this.mustUpdate;
    this.mustUpdate = null;
    if (!this.value.update) return;
    try {
      this.value.update(pending);
    } catch {
      this.destroy();
    }
  }

  destroy() {
    if (this.value && this.value.destroy) this.value.destroy();
    this.value = null;
  }
}

class HeadlessEditorView {
  constructor(config) {
    this.state = config.state;
    this.parent = config.parent;
    this.destroyed = false;
    this.pluginSpecs = viewPluginValues(this.state);
    this.plugins = this.pluginSpecs.map((spec) => new HeadlessPluginInstance(spec));
    for (const plugin of this.plugins) plugin.update(this, null);
  }

  dispatch(spec) {
    if (this.destroyed) return;
    const transaction = typeof spec === "function" ? spec(this) : spec;
    this.applyUpdate(transaction.state ? transaction : this.state.update(spec));
  }

  applyUpdate(transaction) {
    const update = {
      view: this,
      state: transaction.state,
      startState: transaction.startState,
      transactions: [transaction],
      changes: transaction.changes,
      selection: transaction.selection,
      docChanged: !transaction.changes.empty,
      selectionSet: transaction.selection !== undefined,
      viewportChanged: false,
      focusChanged: false,
    };
    this.state = transaction.state;
    this.updatePlugins(update);
    for (const listener of this.state.facet(cmView.EditorView.updateListener)) listener(update);
  }

  get viewport() {
    return { from: 0, to: this.state.doc.length };
  }

  get visibleRanges() {
    return [{ from: 0, to: this.state.doc.length }];
  }

  updatePlugins(update) {
    const previousSpecs = this.pluginSpecs;
    const specs = viewPluginValues(this.state);
    if (!sameSpecs(previousSpecs, specs)) {
      const next = [];
      for (const spec of specs) {
        const found = previousSpecs.indexOf(spec);
        if (found < 0) {
          next.push(new HeadlessPluginInstance(spec));
          continue;
        }
        const plugin = this.plugins[found];
        plugin.mustUpdate = update;
        next.push(plugin);
      }
      for (const plugin of this.plugins) if (plugin.mustUpdate !== update) plugin.destroy();
      this.plugins = next;
    } else {
      for (const plugin of this.plugins) plugin.mustUpdate = update;
    }
    for (const plugin of this.plugins) plugin.update(this, update);
    this.pluginSpecs = specs;
  }

  focus() {}

  destroy() {
    this.destroyed = true;
    for (const plugin of this.plugins) plugin.destroy();
    this.plugins = [];
  }
}

function createViewModule() {
  for (const key of Object.getOwnPropertyNames(cmView.EditorView)) {
    if (["prototype", "length", "name", "caller", "arguments"].includes(key)) continue;
    Object.defineProperty(HeadlessEditorView, key, Object.getOwnPropertyDescriptor(cmView.EditorView, key));
  }
  const views = [];
  class TrackedEditorView extends HeadlessEditorView {
    constructor(config) {
      super(config);
      views.push(this);
    }
  }
  for (const key of Object.getOwnPropertyNames(HeadlessEditorView)) {
    if (["prototype", "length", "name", "caller", "arguments"].includes(key)) continue;
    Object.defineProperty(TrackedEditorView, key, Object.getOwnPropertyDescriptor(HeadlessEditorView, key));
  }
  return { module: { ...cmView, EditorView: TrackedEditorView }, views };
}

/* ------------------------------------------------------------------ *
 * Minimal react harness: enough of the hook contract to mount a
 * component, re-render it with new props and flush effects in order.
 * ------------------------------------------------------------------ */

function sameDeps(left, right) {
  if (left === undefined || right === undefined) return false;
  if (left.length !== right.length) return false;
  return left.every((value, index) => Object.is(value, right[index]));
}

function createHarness() {
  const slots = [];
  let cursor = 0;

  function useRef(initial) {
    const index = cursor++;
    if (!slots[index]) {
      // The editor host is the component's first ref; hand it a stub element
      // so the mount effect can proceed without a DOM.
      slots[index] = { current: index === 0 ? { nodeType: 1 } : initial };
    }
    return slots[index];
  }

  function useEffect(fn, deps) {
    const index = cursor++;
    const slot = slots[index] ?? (slots[index] = {});
    slot.kind = "effect";
    slot.pending = !sameDeps(slot.deps, deps);
    slot.deps = deps;
    slot.fn = fn;
  }

  function useImperativeHandle(ref, create, deps) {
    const index = cursor++;
    const slot = slots[index] ?? (slots[index] = {});
    slot.kind = "layout";
    slot.pending = !sameDeps(slot.deps, deps);
    slot.deps = deps;
    slot.create = create;
    slot.ref = ref;
  }

  function flush() {
    const pending = slots.filter((slot) => slot.pending);
    for (const slot of pending) {
      slot.pending = false;
      if (slot.cleanup) {
        slot.cleanup();
        slot.cleanup = undefined;
      }
    }
    for (const slot of pending) {
      if (slot.kind === "layout") {
        if (slot.ref) slot.ref.current = slot.create();
        continue;
      }
      const cleanup = slot.fn();
      slot.cleanup = typeof cleanup === "function" ? cleanup : undefined;
    }
  }

  return {
    react: {
      forwardRef(render) {
        return { $$typeof: Symbol.for("react.forward_ref"), render };
      },
      useRef,
      useEffect,
      useImperativeHandle,
      useState(initial) {
        return [typeof initial === "function" ? initial() : initial, () => {}];
      },
    },
    render(Component, props, ref) {
      cursor = 0;
      Component.render(props, ref);
      flush();
    },
  };
}

/* ------------------------------------------------------------------ *
 * Module loading (typescript -> commonjs inside a vm context).
 * ------------------------------------------------------------------ */

function transpile(relativePath) {
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
}

function loadModule(relativePath, requires) {
  const moduleExports = { exports: {} };
  const sandbox = {
    module: moduleExports,
    exports: moduleExports.exports,
    require(name) {
      if (name in requires) return requires[name];
      throw new Error(`unexpected require: ${name}`);
    },
    console,
    TextEncoder,
    TextDecoder,
    setTimeout,
    clearTimeout,
    atob,
    btoa,
  };
  runInNewContext(transpile(relativePath), sandbox, { filename: relativePath });
  return moduleExports.exports;
}

function createEditorModule() {
  const harness = createHarness();
  const viewModule = createViewModule();
  const requires = {
    react: harness.react,
    "react/jsx-runtime": { jsx: () => null, jsxs: () => null, Fragment: Symbol("Fragment") },
    "@codemirror/state": cmState,
    "@codemirror/view": viewModule.module,
    "@codemirror/commands": requireCjs("@codemirror/commands"),
    "@codemirror/language": requireCjs("@codemirror/language"),
    "@codemirror/lang-cpp": requireCjs("@codemirror/lang-cpp"),
    "@codemirror/lang-python": requireCjs("@codemirror/lang-python"),
    "y-codemirror.next": ycodemirror,
  };
  const mod = loadModule("../components/arena/EditorAdapter.tsx", requires);
  return {
    EditorAdapter: mod.EditorAdapter,
    harness,
    lastView: () => viewModule.views[viewModule.views.length - 1],
  };
}

function createCollabModule() {
  return loadModule("../lib/arena/collab.ts", {
    "socket.io-client": {
      io() {
        throw new Error("socket.io-client is not used in this test");
      },
    },
    yjs: requireCjs("yjs"),
    "y-protocols/awareness": requireCjs("y-protocols/awareness"),
  });
}

const { CollabClient } = createCollabModule();

/* ------------------------------------------------------------------ *
 * Fixtures.
 * ------------------------------------------------------------------ */

const createdClients = [];

function createCollabClient(userId) {
  const client = new CollabClient({ baseUrl: "", userId, matchId: "match-1", displayName: userId });
  createdClients.push(client);
  return client;
}

// `Awareness` keeps a timer alive; release it so the test process can exit.
after(() => {
  for (const client of createdClients) client.awareness.destroy();
});

function relay(left, right) {
  const encode = (bytes) => Buffer.from(bytes).toString("base64");
  left.doc.on("update", (update) => right.applyRemoteUpdate(encode(update)));
  right.doc.on("update", (update) => left.applyRemoteUpdate(encode(update)));
}

function mountEditor(editor, props) {
  const ref = { current: null };
  editor.harness.render(
    editor.EditorAdapter,
    { language: "C++", code: "", readOnly: false, fontSize: 14, onChange: () => {}, ...props },
    ref,
  );
  return { ref, view: editor.lastView() };
}

/* ------------------------------------------------------------------ *
 * Tests.
 * ------------------------------------------------------------------ */

test("the editor binds to the shared document when the collab client connects", () => {
  const editor = createEditorModule();
  const client = createCollabClient("alpha1");
  client.ytext.insert(0, "int main() { return 0; }");

  const { ref } = mountEditor(editor, { code: "" });
  assert.equal(editor.lastView().state.facet(ySyncFacet), undefined, "editor must not be bound before collaboration connects");

  editor.harness.render(
    editor.EditorAdapter,
    { language: "C++", code: "", readOnly: false, fontSize: 14, onChange: () => {}, collab: client },
    ref,
  );

  const view = editor.lastView();
  const bound = view.state.facet(ySyncFacet);
  assert.ok(bound, "editor must bind the collaborative document once the client connects");
  assert.equal(bound.ytext, client.ytext, "editor must be bound to the team's document");
  assert.equal(view.state.doc.toString(), "int main() { return 0; }", "editor must show the authoritative team document");
});

test("an edit made by a teammate reaches the other editor", () => {
  const alpha1 = createEditorModule();
  const alpha2 = createEditorModule();
  const client1 = createCollabClient("alpha1");
  const client2 = createCollabClient("alpha2");
  relay(client1, client2);

  const editor1 = mountEditor(alpha1, { code: "" });
  const editor2 = mountEditor(alpha2, { code: "" });

  const props = { language: "C++", code: "", readOnly: false, fontSize: 14, onChange: () => {} };
  alpha1.harness.render(alpha1.EditorAdapter, { ...props, collab: client1 }, editor1.ref);
  alpha2.harness.render(alpha2.EditorAdapter, { ...props, collab: client2 }, editor2.ref);

  assert.equal(alpha1.lastView().state.doc.toString(), "");
  assert.equal(alpha2.lastView().state.doc.toString(), "");

  alpha2.lastView().dispatch({ changes: { from: 0, insert: "print('hi')" } });

  assert.equal(client2.getSource(), "print('hi')", "a local edit must reach the shared document");
  assert.equal(alpha1.lastView().state.doc.toString(), "print('hi')", "the teammate's edit must reach the other editor");
});

test("text typed before collaboration connects is preserved, not silently dropped", () => {
  const editor = createEditorModule();
  const client = createCollabClient("alpha1");
  client.ytext.insert(0, "int main() {}");

  const props = {
    language: "C++",
    code: "int main() {}",
    readOnly: false,
    fontSize: 14,
    onChange: () => {},
  };
  const { ref } = mountEditor(editor, props);

  editor.lastView().dispatch({ changes: { from: 13, insert: "\n  return 0;" } });

  editor.harness.render(editor.EditorAdapter, { ...props, collab: client }, ref);

  assert.equal(client.getSource(), "int main() {}\n  return 0;", "pre-connection edits must reach the shared document");
  assert.equal(editor.lastView().state.doc.toString(), client.getSource(), "editor must show the merged document");
});

test("an empty team document is seeded with the text typed before collaboration connected", () => {
  const editor = createEditorModule();
  const client = createCollabClient("alpha1");

  const props = { language: "C++", code: "", readOnly: false, fontSize: 14, onChange: () => {} };
  const { ref } = mountEditor(editor, props);

  editor.lastView().dispatch({ changes: { from: 0, insert: "print('hi')" } });
  editor.harness.render(editor.EditorAdapter, { ...props, collab: client }, ref);

  assert.equal(client.getSource(), "print('hi')", "an empty team document must be seeded with the local text");
  assert.equal(editor.lastView().state.doc.toString(), "print('hi')", "the editor must keep showing the local text");
});

test("the team document wins when the pre-connection edit cannot be located in it", () => {
  const editor = createEditorModule();
  const client = createCollabClient("alpha1");
  client.ytext.insert(0, "team version");

  const props = { language: "C++", code: "starter", readOnly: false, fontSize: 14, onChange: () => {} };
  const { ref } = mountEditor(editor, props);

  editor.lastView().dispatch({ changes: { from: 0, to: 7, insert: "mine" } });
  editor.harness.render(editor.EditorAdapter, { ...props, collab: client }, ref);

  assert.equal(client.getSource(), "team version", "a teammate's document must not be overwritten");
  assert.equal(editor.lastView().state.doc.toString(), "team version", "editor must show the authoritative document");
});

test("a local-only 1v1 editor keeps editing and reporting locally", () => {
  const editor = createEditorModule();
  const changes = [];
  const props = {
    language: "C++",
    code: "int main() {}",
    readOnly: false,
    fontSize: 14,
    onChange: (code) => changes.push(code),
  };
  mountEditor(editor, props);

  const view = editor.lastView();
  assert.equal(view.state.facet(ySyncFacet), undefined, "a local-only editor must not bind a collaboration document");

  view.dispatch({ changes: { from: 13, insert: "x" } });

  assert.equal(view.state.doc.toString(), "int main() {}x");
  assert.deepEqual(changes, ["int main() {}x"], "local edits must still be reported");
});

test("a new round re-binds the editor to the new team document", () => {
  const editor = createEditorModule();
  const first = createCollabClient("alpha1");
  const second = createCollabClient("alpha1");
  second.ytext.insert(0, "round two");

  const props = { language: "C++", code: "", readOnly: false, fontSize: 14, onChange: () => {} };
  const { ref } = mountEditor(editor, props);
  editor.harness.render(editor.EditorAdapter, { ...props, collab: first }, ref);
  assert.equal(editor.lastView().state.facet(ySyncFacet).ytext, first.ytext);

  editor.harness.render(editor.EditorAdapter, { ...props, collab: second }, ref);

  const view = editor.lastView();
  assert.equal(view.state.facet(ySyncFacet).ytext, second.ytext, "the editor must follow the new team document");
  assert.equal(view.state.doc.toString(), "round two", "the editor must show the new round's document");

  view.dispatch({ changes: { from: 9, insert: " // edited" } });

  assert.equal(second.getSource(), "round two // edited", "edits must reach the new team document");
  assert.equal(first.getSource(), "", "edits must not leak into the previous round's document");
});
