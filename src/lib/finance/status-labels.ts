import type { AffordabilityStatus } from "./engine";
import type { BadgeTone } from "@/components/ui/Badge";

export const AFFORDABILITY_STATUS_LABELS: Record<AffordabilityStatus, string> = {
  comfortable: "Comfortable",
  caution: "Caution",
  risky: "Risky",
  not_recommended: "Not recommended",
  cannot_afford: "Can't afford",
};

export const AFFORDABILITY_STATUS_TONES: Record<AffordabilityStatus, BadgeTone> = {
  comfortable: "brand",
  caution: "caution",
  risky: "caution",
  not_recommended: "warn",
  cannot_afford: "warn",
};
