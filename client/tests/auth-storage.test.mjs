import assert from 'node:assert/strict';
import test from 'node:test';
import {
  button,
  componentHarness,
  flush,
  nodes,
  text,
} from './component-harness.mjs';

const blockedStorage = {
  get sessionStorage() {
    throw new Error('Storage blocked');
  },
};

test('login remains usable with blocked session storage', () => {
  const ui = componentHarness(
    '../components/auth/auth-form.tsx',
    'AuthForm',
    {
      'next/navigation': { useRouter: () => ({}) },
      '@/components/auth/auth-provider': { useAuth: () => ({}) },
      '@/lib/auth/client': {},
      '@/lib/auth/validation': {},
      '@/lib/auth/oauth': { takeOAuthNotice: () => null },
    },
    blockedStorage,
  );
  assert.doesNotThrow(() => ui.render({ mode: 'login' }));
  assert.equal(
    button(ui.render({ mode: 'login' }), 'Log in').props.disabled,
    false,
  );
});

for (const success of [true, false]) {
  test(`password reset ${success ? 'success navigates' : 'failure preserves the form'} when storage is blocked`, async () => {
    const routes = [];
    let cleared = 0;
    const requests = [];
    class AuthRequestError extends Error {}
    const ui = componentHarness(
      '../components/auth/password-recovery-forms.tsx',
      'ResetPasswordForm',
      {
        'next/navigation': {
          useRouter: () => ({ replace: (route) => routes.push(route) }),
        },
        '@/components/auth/auth-provider': {
          useAuth: () => ({
            clearSession: () => {
              cleared++;
            },
          }),
        },
        '@/lib/auth/client': {
          AuthRequestError,
          authApi: {
            confirmPasswordReset: async (...args) => {
              requests.push(args);
              if (!success) throw new Error('private request details');
            },
          },
        },
        '@/lib/auth/validation': { validateNewPassword: () => undefined },
      },
      {
        get sessionStorage() {
          return blockedStorage.sessionStorage;
        },
        window: {
          location: {
            search: '?token=reset-test-token',
            pathname: '/reset-password',
          },
          history: { replaceState() {} },
        },
      },
    );
    ui.render();
    await flush();
    for (const input of nodes(ui.render()).filter(
      (node) => node.type === 'input',
    )) {
      input.props.onChange({ target: { value: 'valid-password' } });
    }
    const form = nodes(ui.render()).find((node) => node.type === 'form');
    await assert.doesNotReject(form.props.onSubmit({ preventDefault() {} }));
    const tree = ui.render();
    assert.deepEqual(requests, [['reset-test-token', 'valid-password']]);
    assert.equal(button(tree, 'Reset password').props.disabled, false);
    assert.deepEqual(routes, success ? ['/login'] : []);
    assert.equal(cleared, success ? 1 : 0);
    if (success) assert.ok(!text(tree).includes('Unable to reset'));
    else {
      assert.match(text(tree), /Unable to reset your password/);
      assert.equal(
        nodes(tree).find((node) => node.props.id === 'new-password').props
          .value,
        'valid-password',
      );
    }
  });
}
