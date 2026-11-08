import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

// Mirrors the plugin set in components/app/chat/chat-markdown.tsx.
const render = text => renderToStaticMarkup(React.createElement(ReactMarkdown, { remarkPlugins: [remarkGfm, remarkBreaks] }, text));

test("chat markdown keeps single line breaks", () => {
  assert.match(render("first\nsecond"), /first<br\/?>\s*second/);
});

test("chat markdown supports GitHub extensions", () => {
  assert.match(render("~~gone~~"), /<del>gone<\/del>/);
  assert.match(render("see https://nook.social"), /<a href="https:\/\/nook\.social">/);
  assert.match(render("| a | b |\n| - | - |\n| 1 | 2 |"), /<table>/);
  assert.match(render("- [x] done"), /type="checkbox"/);
});

test("chat markdown still escapes raw HTML", () => {
  const html = render("<img src=x onerror=alert(1)>");
  assert.doesNotMatch(html, /<img/);
});
