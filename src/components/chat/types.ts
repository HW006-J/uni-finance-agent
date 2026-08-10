import type { AssistantAction } from "@/lib/ai/provider";

export interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: AssistantAction[];
  pending?: boolean;
  error?: boolean;
}
