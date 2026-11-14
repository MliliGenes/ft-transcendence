import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Exercise component event handlers and their rendered state without a DOM dependency.
export function componentHarness(file, name, dependencies = {}, globals = {}) {
  const slots = [];
  const effects = [];
  const cleanups = [];
  let cursor = 0;
  let mounted = false;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots))
        slots[index] = typeof initial === 'function' ? initial() : initial;
      return [
        slots[index],
        (next) => {
          slots[index] = typeof next === 'function' ? next(slots[index]) : next;
        },
      ];
    },
    useRef(initial) {
      return react.useState(() => ({ current: initial }))[0];
    },
    useCallback(callback) {
      return callback;
    },
    useEffect(effect) {
      if (!mounted) effects.push(effect);
    },
  };
  const jsx = (type, props) => ({ type, props });
  const modules = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'next/link': { default: 'a' },
    '@tabler/icons-react': new Proxy({}, { get: (_, key) => key }),
    '@/components/ui/button': {
      Button: 'Button',
      buttonVariants: () => 'button',
    },
    '@/components/ui/input': { Input: 'input' },
    '@/components/ui/label': { Label: 'label' },
    '@/lib/utils': { cn: (...args) => args.join(' ') },
    ...dependencies,
  };
  const loaded = { exports: {} };
  const context = {
    module: loaded,
    exports: loaded.exports,
    require: (id) => {
      assert.ok(id in modules, `Unexpected import: ${id}`);
      return modules[id];
    },
    console: {
      warn: () => assert.fail('Unexpected console warning'),
      error: () => assert.fail('Unexpected console error'),
    },
    URLSearchParams,
    queueMicrotask,
    setInterval: () => 1,
    clearInterval() {},
    setTimeout: () => 1,
  };
  Object.defineProperties(context, Object.getOwnPropertyDescriptors(globals));
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  runInNewContext(compiled, context);
  return {
    render(props = {}) {
      cursor = 0;
      const tree = loaded.exports[name](props);
      if (!mounted) {
        mounted = true;
        for (const effect of effects) cleanups.push(effect());
      }
      return tree;
    },
    cleanup() {
      for (const cleanup of cleanups) cleanup?.();
    },
  };
}

export function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return tree && typeof tree === 'object'
    ? [tree, ...nodes(tree.props?.children)]
    : [];
}
export function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join('');
  return tree && typeof tree === 'object'
    ? text(tree.props?.children)
    : typeof tree === 'string'
      ? tree
      : '';
}
export function button(tree, label) {
  const found = nodes(tree).find(
    (node) =>
      ['Button', 'button'].includes(node.type) && text(node).includes(label),
  );
  assert.ok(found, `Missing button: ${label}`);
  return found;
}
export const flush = () => new Promise((resolve) => setImmediate(resolve));
