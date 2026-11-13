import assert from "node:assert/strict";
import test from "node:test";
import { componentHarness, nodes } from "./component-harness.mjs";

function carousel(reduced = false) {
  const scrolls = [];
  const ui = componentHarness("../components/app/feed/attachment-carousel.tsx", "AttachmentCarousel", {
    "@/components/app/chat/message-list": { MessageAttachment: "MessageAttachment" },
  }, { window: { matchMedia: () => ({ matches: reduced }) } });
  const props = { conversationId: "post", attachments: ["video", "image"] };
  const render = () => ui.render(props);
  const tree = render();
  const track = nodes(tree).find(node => node.props.onScroll);
  const element = { clientWidth: 100, scrollLeft: 0, scrollTo: value => scrolls.push(value) };
  track.props.ref.current = element;
  return { ui, render, track, element, scrolls };
}

test("video arrow keys keep their native behavior inside a Feed carousel", t => {
  const c = carousel();
  t.after(() => c.ui.cleanup());
  let prevented = false;
  c.track.props.onKeyDown({ key: "ArrowRight", target: {}, currentTarget: c.element, preventDefault: () => { prevented = true; } });
  assert.equal(prevented, false);
  assert.equal(c.scrolls.length, 0);
});

for (const reduced of [false, true]) {
  test(`carousel track keyboard navigation respects reduced motion: ${reduced}`, t => {
    const c = carousel(reduced);
    t.after(() => c.ui.cleanup());
    let prevented = false;
    c.track.props.onKeyDown({ key: "ArrowRight", target: c.element, currentTarget: c.element, preventDefault: () => { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(c.scrolls.length, 1);
    assert.equal(c.scrolls[0].left, 100);
    assert.equal(c.scrolls[0].behavior, reduced ? "auto" : "smooth");
  });
}

test("carousel endpoint controls remain mounted for keyboard focus", t => {
  const c = carousel();
  t.after(() => c.ui.cleanup());
  const control = (tree, label) => nodes(tree).find(node => node.props["aria-label"] === label);
  assert.equal(control(c.render(), "Previous attachment")?.props["aria-disabled"], true);
  c.element.scrollLeft = 100;
  c.track.props.onScroll();
  assert.equal(control(c.render(), "Next attachment")?.props["aria-disabled"], true);
});
