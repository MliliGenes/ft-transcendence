import assert from "node:assert/strict";
import { test } from "node:test";
import { accountApi, AccountRequestError, profileImageUrl } from "../lib/accounts/client.ts";
import { cropImage, prepareImage, validateImageBytes } from "../lib/accounts/images.ts";

test("image mutations use the signed-in account and accept an empty 204", async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const calls = [];
  globalThis.fetch = async (path, options) => {
    calls.push({ path, options });
    return new Response(null, { status: 204 });
  };
  for (const kind of ["avatar", "banner"]) {
    assert.equal(await accountApi.removeImage("access-token", kind), undefined);
    const { path, options } = calls.at(-1);
    assert.equal(path, `/api/accounts/me/${kind}`);
    assert.equal(options.method, "DELETE");
    assert.equal(options.headers.Authorization, "Bearer access-token");
    assert.equal(options.body, undefined);
    assert.equal(options.cache, "no-store");
  }
  const file = new File(["fixture"], "avatar.webp", { type: "image/webp" });
  await accountApi.uploadAvatar("access-token", file);
  const { path, options } = calls.at(-1);
  assert.equal(path, "/api/accounts/me/avatar");
  assert.equal(options.method, "PUT");
  assert.equal(options.headers["Content-Type"], undefined);
  assert.equal(options.body.get("file").name, "avatar.webp");
});

test("profile updates send only changed fields and preserve API failures", async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (path, options) => {
    assert.equal(path, "/api/accounts/me");
    assert.equal(options.method, "PATCH");
    assert.deepEqual(JSON.parse(options.body), { email: "new@example.com", displayName: null });
    return Response.json({ message: "Email is already in use" }, { status: 409 });
  };
  await assert.rejects(accountApi.updateMe("token", { email: "new@example.com", displayName: null }), error => error instanceof AccountRequestError && error.status === 409);
  globalThis.fetch = async () => new Response(null, { status: 401 });
  await assert.rejects(accountApi.removeImage("expired", "banner"), error => error instanceof AccountRequestError && error.status === 401);
});

test("image URLs refresh managed images and preserve HTTPS OAuth avatars", () => {
  const profile = { id: "owner", avatarUrl: "/accounts/owner/avatar", bannerUrl: null, updatedAt: "revision-2" };
  assert.equal(profileImageUrl(profile, "avatar"), "/api/accounts/owner/avatar?v=revision-2");
  assert.equal(profileImageUrl(profile, "banner"), undefined);
  assert.equal(profileImageUrl({ ...profile, avatarUrl: "https://cdn.example.com/avatar.webp" }, "avatar"), "https://cdn.example.com/avatar.webp");
  for (const url of ["javascript:alert(1)", "data:image/svg+xml,...", "//example.com/image", "/accounts/another-user/avatar"]) {
    assert.equal(profileImageUrl({ ...profile, avatarUrl: url }, "avatar"), undefined);
  }
});

test("rejects unsupported and animated inputs before canvas can flatten them", () => {
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.from([0, 0, 0, 13]), Buffer.from("IHDR"), Buffer.alloc(17)]);
  assert.doesNotThrow(() => validateImageBytes(png));
  const apng = Buffer.concat([png, Buffer.from([0, 0, 0, 8]), Buffer.from("acTL"), Buffer.alloc(12)]);
  assert.throws(() => validateImageBytes(apng), /Animated/);
  assert.doesNotThrow(() => validateImageBytes(Buffer.from([255, 216, 255, 224])));
  const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 "), Buffer.alloc(4)]);
  assert.doesNotThrow(() => validateImageBytes(webp));
  for (const chunk of ["ANIM", "ANMF"]) {
    const animated = Buffer.concat([webp.subarray(0, 12), Buffer.from(chunk), Buffer.alloc(4)]);
    assert.throws(() => validateImageBytes(animated), /Animated/);
  }
  const animatedFlag = Buffer.concat([webp.subarray(0, 12), Buffer.from("VP8X"), Buffer.from([1, 0, 0, 0, 2])]);
  assert.throws(() => validateImageBytes(animatedFlag), /Animated/);
  for (const bytes of [Buffer.from("<svg></svg>"), Buffer.from("GIF89a"), Buffer.alloc(0)]) assert.throws(() => validateImageBytes(bytes), /valid JPEG/);
});

test("crop export produces the API's required dimensions and upload format", async (t) => {
  const originalImage = globalThis.Image;
  const originalDocument = globalThis.document;
  t.after(() => { globalThis.Image = originalImage; globalThis.document = originalDocument; });
  globalThis.Image = class { naturalWidth = 2000; naturalHeight = 1000; async decode() {} };
  const draws = [];
  const canvas = {
    width: 0, height: 0,
    getContext: () => ({ drawImage: (...args) => draws.push(args.slice(1)) }),
    toBlob: (done, format) => done(new Blob(["encoded-image"], { type: format })),
  };
  globalThis.document = { createElement: () => canvas };
  for (const [kind, width, height] of [["avatar", 256, 256], ["banner", 1500, 500]]) {
    const file = await cropImage("blob:fixture", { x: 10, y: 20, width: 600, height: kind === "avatar" ? 600 : 200 }, kind);
    assert.equal(file.type, "image/webp");
    assert.equal(file.name, `${kind}.webp`);
    assert.equal(canvas.width, width);
    assert.equal(canvas.height, height);
    assert.deepEqual(draws.at(-1), [10, 20, 600, kind === "avatar" ? 600 : 200, 0, 0, width, height]);
  }
  canvas.getContext = () => null;
  await assert.rejects(cropImage("blob:fixture", { x: 0, y: 0, width: 100, height: 100 }, "avatar"), /isn't available/);
});

test("file preparation enforces type, size, and pixel limits and revokes failed previews", async (t) => {
  await assert.rejects(prepareImage(new File(["svg"], "image.svg", { type: "image/svg+xml" }), "avatar"), /JPEG, PNG, or WebP/);
  await assert.rejects(prepareImage(new File([Buffer.alloc(1024 * 1024 + 1)], "large.png", { type: "image/png" }), "avatar"), /1 MiB/);
  const originalImage = globalThis.Image;
  t.after(() => { globalThis.Image = originalImage; });
  globalThis.Image = class { naturalWidth = 5000; naturalHeight = 4001; async decode() {} };
  const revoke = t.mock.method(URL, "revokeObjectURL");
  await assert.rejects(prepareImage(new File([Buffer.from([255, 216, 255])], "image.jpg", { type: "image/jpeg" }), "banner"), /20 megapixels/);
  assert.equal(revoke.mock.callCount(), 1);
});
