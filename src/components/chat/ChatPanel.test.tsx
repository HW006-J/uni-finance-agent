// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ChatPanel } from "./ChatPanel";
import type { DisplayMessage } from "./types";

afterEach(() => {
  cleanup();
});

describe("ChatPanel - Runway framing", () => {
  it("renames the panel heading to Ask Runway", () => {
    render(<ChatPanel messages={[]} onSend={() => {}} isSending={false} />);
    expect(screen.getByText("Ask Runway")).toBeInTheDocument();
  });

  it("uses a Runway-branded placeholder for the input", () => {
    render(<ChatPanel messages={[]} onSend={() => {}} isSending={false} />);
    expect(screen.getByPlaceholderText("Tell Runway what's changed…")).toBeInTheDocument();
  });
});

describe("ChatPanel - scroll behaviour", () => {
  it("scrolls the conversation to the latest message when new messages arrive", () => {
    const scrollSpy = vi.spyOn(Element.prototype, "scrollTo").mockImplementation(() => {});
    const initial: DisplayMessage[] = [{ id: "1", role: "user", content: "Hi" }];
    const { rerender } = render(<ChatPanel messages={initial} onSend={() => {}} isSending={false} />);
    scrollSpy.mockClear();

    const updated: DisplayMessage[] = [...initial, { id: "2", role: "assistant", content: "Hello!" }];
    rerender(<ChatPanel messages={updated} onSend={() => {}} isSending={false} />);

    expect(scrollSpy).toHaveBeenCalled();
    scrollSpy.mockRestore();
  });

  it("keeps the message list internally scrollable rather than letting the panel grow without bound", () => {
    const manyMessages: DisplayMessage[] = Array.from({ length: 30 }, (_, i) => ({
      id: String(i),
      role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: `Message ${i}`,
    }));
    render(<ChatPanel messages={manyMessages} onSend={() => {}} isSending={false} />);

    const lastMessage = screen.getByText("Message 29");
    const scrollContainer = lastMessage.closest("div.overflow-y-auto")!;
    expect(scrollContainer).toBeInTheDocument();
    expect(scrollContainer.className).toContain("overflow-y-auto");
  });

  it("keeps the input reachable alongside the message list", () => {
    const manyMessages: DisplayMessage[] = Array.from({ length: 30 }, (_, i) => ({
      id: String(i),
      role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: `Message ${i}`,
    }));
    render(<ChatPanel messages={manyMessages} onSend={() => {}} isSending={false} />);

    expect(screen.getByPlaceholderText("Tell Runway what's changed…")).toBeVisible();
    expect(screen.getByRole("button", { name: "Send" })).toBeVisible();
  });
});
