import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";

test("profile bio renders standard Markdown", () => {
  const html = renderToStaticMarkup(React.createElement(ReactMarkdown, null, "**Hello** [Nook](https://nook.social)"));
  assert.match(html, /<strong>Hello<\/strong>/);
  assert.match(html, /<a href="https:\/\/nook\.social">Nook<\/a>/);
});

test("profile bio does not render raw HTML", () => {
  const html = renderToStaticMarkup(React.createElement(ReactMarkdown, null, "<script>alert(1)</script><b>plain text</b>"));
  assert.doesNotMatch(html, /<script>|<b>/);
  assert.match(html, /&lt;script&gt;/);
});
