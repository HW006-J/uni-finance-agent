import { AppHeader } from "@/components/nav/AppHeader";
import { Card } from "@/components/ui/Card";
import { cx } from "@/lib/cx";
import {
  CONCEPT_INTEGRATIONS,
  RESOURCE_INTEGRATIONS,
  type ConceptIntegration,
  type ResourceIntegration,
} from "@/lib/integrations/integrations-data";

function OrgMark({ name }: { name: string }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cream-dark text-sm font-extrabold text-ink-soft">
      {name.trim().charAt(0)}
    </div>
  );
}

function StatusBadge({ status }: { status: "Concept" | "Resource" }) {
  return (
    <span
      data-testid="status-badge"
      className={cx(
        "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide",
        status === "Concept" ? "bg-accent-light text-accent-dark" : "bg-brand-light text-brand-dark",
      )}
    >
      {status}
    </span>
  );
}

function ConceptCard({ item }: { item: ConceptIntegration }) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <OrgMark name={item.name} />
          <div>
            <p className="text-sm font-extrabold text-ink">{item.name}</p>
            <p className="text-xs font-bold text-ink-soft">{item.purpose}</p>
          </div>
        </div>
        <StatusBadge status={item.status} />
      </div>
      <p className="text-sm font-medium text-ink-soft">{item.description}</p>
      {item.secondaryLine ? <p className="text-xs font-medium text-ink-faint">{item.secondaryLine}</p> : null}
    </Card>
  );
}

function ResourceCard({ item }: { item: ResourceIntegration }) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <OrgMark name={item.name} />
          <div>
            <p className="text-sm font-extrabold text-ink">{item.name}</p>
            <p className="text-xs font-bold text-ink-soft">{item.purpose}</p>
          </div>
        </div>
        <StatusBadge status={item.status} />
      </div>
      <p className="text-sm font-medium text-ink-soft">{item.description}</p>
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-bold text-brand-dark underline underline-offset-2 hover:text-brand"
      >
        {item.buttonLabel}
      </a>
    </Card>
  );
}

const ARCHITECTURE_STEPS = [
  { label: "Today", copy: "You tell Runway what happened" },
  { label: "Tomorrow", copy: "Connections keep it updated automatically" },
  { label: "Then", copy: "Safe-spend guidance becomes actionable" },
] as const;

export function IntegrationsShell() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <AppHeader />

      <div className="mt-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">Integrations</h1>
        <p className="mt-1 text-sm font-semibold text-ink-soft">Runway works better when it&rsquo;s connected.</p>
        <p className="mt-1 text-sm font-medium text-ink-faint">
          Connect your financial life automatically, and find useful support when you need it.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 rounded-2xl bg-cream-dark px-4 py-3 text-xs font-medium text-ink-soft">
        {ARCHITECTURE_STEPS.map((step, i) => (
          <span key={step.label} className="flex items-center gap-2">
            {i > 0 ? <span className="text-ink-faint" aria-hidden="true">→</span> : null}
            <span>
              <span className="font-bold text-ink">{step.label}:</span> {step.copy}
            </span>
          </span>
        ))}
      </div>

      <section className="mt-8">
        <h2 className="text-xs font-bold uppercase tracking-wide text-ink-soft">Connect your finances</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CONCEPT_INTEGRATIONS.map((item) => (
            <ConceptCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xs font-bold uppercase tracking-wide text-ink-soft">Resources for students</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {RESOURCE_INTEGRATIONS.map((item) => (
            <ResourceCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      <p className="mx-auto mt-8 max-w-3xl text-center text-xs text-ink-faint">
        <span className="font-bold">Concept</span> - an integration Runway could support in the future.{" "}
        <span className="font-bold">Resource</span> - an external service or resource students can use today.
      </p>
    </main>
  );
}
