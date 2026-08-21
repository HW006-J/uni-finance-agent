// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ChatPanel } from "./ChatPanel";

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
