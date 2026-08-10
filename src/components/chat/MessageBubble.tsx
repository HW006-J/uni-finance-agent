import { cx } from "@/lib/cx";
import { Badge } from "@/components/ui/Badge";
import { AFFORDABILITY_STATUS_LABELS, AFFORDABILITY_STATUS_TONES } from "@/lib/finance/status-labels";
import type { AffordabilityResult, AffordabilityStatus } from "@/lib/finance/engine";
import type { AssistantAction } from "@/lib/ai/provider";
import type { DisplayMessage } from "./types";

function isAffordabilityStatus(value: unknown): value is AffordabilityStatus {
  return typeof value === "string" && value in AFFORDABILITY_STATUS_LABELS;
}

function getAffordabilityResult(action: AssistantAction): AffordabilityResult | null {
  if (action.toolName !== "check_affordability") return null;
  const result = (action.data as { result?: unknown } | undefined)?.result;
  if (result && typeof result === "object" && "status" in result && isAffordabilityStatus((result as { status: unknown }).status)) {
    return result as AffordabilityResult;
  }
  return null;
}

function ActionChip({ action }: { action: AssistantAction }) {
  const affordability = getAffordabilityResult(action);
  if (affordability) {
    return (
      <Badge tone={AFFORDABILITY_STATUS_TONES[affordability.status]}>
        {AFFORDABILITY_STATUS_LABELS[affordability.status]}
      </Badge>
    );
  }
  return (
    <span className="animate-pop-in rounded-full bg-brand-light px-3 py-1 text-xs font-bold text-brand-dark">
      {action.message}
    </span>
  );
}

export function MessageBubble({ message }: { message: DisplayMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={cx("flex flex-col gap-2", isUser ? "items-end" : "items-start")}>
      <div
        className={cx(
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm font-medium",
          isUser && "bg-brand text-white",
          !isUser && !message.error && "bg-cream-dark text-ink",
          !isUser && message.error && "bg-warn-light text-warn-dark",
          message.pending && "animate-pulse",
        )}
      >
        {message.content}
      </div>
      {message.actions && message.actions.length > 0 ? (
        <div className="flex max-w-[85%] flex-wrap gap-1.5">
          {message.actions.map((action, i) => (
            <ActionChip key={`${action.toolName}-${i}`} action={action} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
