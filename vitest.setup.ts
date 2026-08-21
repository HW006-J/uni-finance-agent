import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement Element.scrollTo - harmless no-op polyfill so
// components that scroll a container on update (e.g. ChatPanel) don't throw.
if (typeof Element !== "undefined" && !Element.prototype.scrollTo) {
  Element.prototype.scrollTo = () => {};
}
