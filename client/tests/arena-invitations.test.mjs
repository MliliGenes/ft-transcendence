import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function loadInvitations() {
  const source = readFileSync(
    new URL('../lib/arena/invitations.ts', import.meta.url),
    'utf8',
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports = {};
  const context = {
    exports,
    module: { exports },
    require(name) {
      if (name.endsWith('/lobby') || name === './lobby')
        return { LobbyClient: class {} };
      if (name.includes('chat/client')) return { chatApi: {} };
      throw new Error(`Unexpected import ${name}`);
    },
  };
  runInNewContext(compiled, context);
  return context.module.exports;
}

let invitations;
try {
  invitations = loadInvitations();
} catch {
  invitations = undefined;
}

test('Code Arena invite cards parse only their own six-character lobby links', () => {
  assert.ok(invitations, 'Code Arena invitation helpers should be available');
  const content = invitations.formatCodeArenaInvite('AB12CD');
  assert.equal(invitations.parseCodeArenaInvite(content)?.code, 'AB12CD');
  assert.equal(
    invitations.parseCodeArenaInvite('[Join](https://attacker.example/)'),
    null,
  );
  assert.equal(
    invitations.parseCodeArenaInvite(
      '🎮 Code Arena challenge\n\n[Accept & Join](/play/lobby/TOOLONG7)',
    ),
    null,
  );
  assert.throws(() => invitations.formatCodeArenaInvite('../../'));
});
