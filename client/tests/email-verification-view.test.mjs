import assert from "node:assert/strict";
import test from "node:test";
import { button, componentHarness, flush, nodes, text } from "./component-harness.mjs";

class AuthRequestError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "AuthRequestError";
    this.status = status;
  }
}

function createHarness({ search = "", verifyResult, requestResult } = {}) {
  const window = {
    location: { search, pathname: "/verify-email" },
    history: { replaceState: () => {}, state: null },
  };

  const calls = {
    verifyEmail: [],
    requestEmailVerification: [],
  };

  const authApi = {
    verifyEmail: async (token) => {
      calls.verifyEmail.push(token);
      if (typeof verifyResult === "function") return verifyResult(token);
      if (verifyResult instanceof Error) throw verifyResult;
      return verifyResult ?? { verified: true };
    },
    requestEmailVerification: async (email) => {
      calls.requestEmailVerification.push(email);
      if (typeof requestResult === "function") return requestResult(email);
      if (requestResult instanceof Error) throw requestResult;
      return requestResult ?? { requested: true };
    },
  };

  const ui = componentHarness("../components/auth/verify-email-view.tsx", "VerifyEmailView", {
    "@/lib/auth/client": { authApi, AuthRequestError },
  }, { window });

  return { ui, calls, window };
}

test("missing token displays alert and renders resend link form", async (t) => {
  const { ui } = createHarness({ search: "" });
  t.after(() => ui.cleanup());

  ui.render();
  await flush();
  const tree = ui.render();

  assert.match(text(tree), /This verification link is missing its token\./);
  const input = nodes(tree).find((n) => n.type === "input" && n.props?.id === "verification-email");
  assert.ok(input, "email input should be present for resending link");
  assert.ok(button(tree, "Send new link"));
});

test("invalid or expired token displays explanatory alert and renders resend form", async (t) => {
  const { ui, calls } = createHarness({
    search: "?token=expired-or-used",
    verifyResult: new AuthRequestError("Invalid token", 401),
  });
  t.after(() => ui.cleanup());

  ui.render();
  await flush();
  const tree = ui.render();

  assert.deepEqual(calls.verifyEmail, ["expired-or-used"]);
  assert.match(text(tree), /This verification link is invalid, has expired, or was already used\./);
  const form = nodes(tree).find((n) => n.type === "form");
  assert.ok(form, "resend form must be available on invalid token");
});

test("unexpected verification error displays graceful error without exposing raw details", async (t) => {
  const rawError = new Error("Database connection timed out at 10.0.0.1:5432");
  const { ui, calls } = createHarness({
    search: "?token=any-token",
    verifyResult: rawError,
  });
  t.after(() => ui.cleanup());

  ui.render();
  await flush();
  const tree = ui.render();

  assert.deepEqual(calls.verifyEmail, ["any-token"]);
  assert.match(text(tree), /Something went wrong while verifying your email\. Please try the link again in a moment\./);
  assert.ok(!text(tree).includes(rawError.message), "raw error messages must not be exposed");
});

test("resend request flow disables submit, surfaces graceful error, and recovers on success", async (t) => {
  let failResend = true;
  let resolveSend;
  const { ui, calls } = createHarness({
    search: "",
    requestResult: (email) => new Promise((resolve, reject) => {
      resolveSend = () => {
        if (failResend) reject(new Error("SMTP service unavailable"));
        else resolve({ requested: true });
      };
    }),
  });
  t.after(() => ui.cleanup());

  ui.render();
  await flush();
  let tree = ui.render();

  const input = nodes(tree).find((n) => n.type === "input" && n.props?.id === "verification-email");
  input.props.onChange({ target: { value: "user@example.com" } });

  const form = nodes(ui.render()).find((n) => n.type === "form");
  const pendingSubmission = form.props.onSubmit({ preventDefault() {} });

  const busyTree = ui.render();
  const busyButton = button(busyTree, "Sending…");
  assert.equal(busyButton.props.disabled, true);

  resolveSend();
  await assert.doesNotReject(pendingSubmission);

  tree = ui.render();
  assert.match(text(tree), /We couldn’t process that request\. Please try again shortly\./);
  assert.ok(!text(tree).includes("SMTP service unavailable"));

  // Typing in the input clears the error state
  input.props.onChange({ target: { value: "user@example.com" } });
  tree = ui.render();
  assert.ok(!text(tree).includes("We couldn’t process that request"));

  // Retry with success
  failResend = false;
  const retrySubmission = form.props.onSubmit({ preventDefault() {} });
  resolveSend();
  await assert.doesNotReject(retrySubmission);

  tree = ui.render();
  assert.match(text(tree), /If that address has an unverified account, a new link will be sent/);
  assert.deepEqual(calls.requestEmailVerification, ["user@example.com", "user@example.com"]);
});

test("valid token completes verification successfully", async (t) => {
  const { ui, calls } = createHarness({
    search: "?token=valid-token",
    verifyResult: { verified: true },
  });
  t.after(() => ui.cleanup());

  ui.render();
  await flush();
  const tree = ui.render();

  assert.deepEqual(calls.verifyEmail, ["valid-token"]);
  assert.match(text(tree), /Email verified/);
  assert.match(text(tree), /Thanks! Your email address is confirmed\./);
});
