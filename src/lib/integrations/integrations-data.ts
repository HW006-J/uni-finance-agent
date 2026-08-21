/**
 * Content for the Integrations page - a hackathon-honesty page, not a
 * feature. Every entry here is either:
 *
 * - a CONCEPT: a future product idea Runway could build, inspired by a
 *   real organisation's real public capabilities. No API is called, no
 *   data is exchanged, nothing is "connected" - see the `status` literal
 *   type, which intentionally excludes words like "Connected"/"Live".
 * - a RESOURCE: a real, external, official link a student can open today.
 *   No advice here is generated or paraphrased loosely - each `url` is the
 *   organisation's own official page, verified reachable when this file
 *   was written.
 *
 * This file is pure content - no calculation, no Gemini involvement, no
 * Supabase, no secrets. It exists so the page component stays simple.
 */

export type IntegrationStatus = "Concept" | "Resource";

export interface ConceptIntegration {
  id: string;
  name: string;
  /** What this concept would do for Runway, e.g. "Automatic bank sync". */
  purpose: string;
  description: string;
  /** Optional one-line clarification of the real-world mechanism this concept is inspired by (e.g. "Open Banking"). Never a claim that it's built. */
  secondaryLine?: string;
  status: "Concept";
}

export interface ResourceIntegration {
  id: string;
  name: string;
  /** What kind of resource this is, e.g. "Financial education". */
  purpose: string;
  description: string;
  buttonLabel: string;
  /** The organisation's own official page - never a third-party aggregator. */
  url: string;
  status: "Resource";
}

export const CONCEPT_INTEGRATIONS: ConceptIntegration[] = [
  {
    id: "natwest",
    name: "NatWest",
    purpose: "Automatic bank sync",
    description: "Automatically keep your balance and spending up to date instead of telling Runway about every purchase.",
    secondaryLine: "Future Open Banking / bank-data integration - not connected today.",
    status: "Concept",
  },
  {
    id: "payabl",
    name: "payabl.",
    purpose: "Spending controls",
    description: "Turn your safe weekly spend into a spending limit or controlled payment experience.",
    secondaryLine: "A future concept using payments infrastructure like payabl.'s card issuing and spend caps - no card exists today.",
    status: "Concept",
  },
  {
    id: "ipushpull",
    name: "ipushpull",
    purpose: "Real-time financial data",
    description: "Bring updates from different financial systems into Runway automatically.",
    secondaryLine: "A future real-time data/workflow concept inspired by ipushpull's data-delivery platform - not integrated today.",
    status: "Concept",
  },
];

export const RESOURCE_INTEGRATIONS: ResourceIntegration[] = [
  {
    id: "hg-foundation",
    name: "The Hg Foundation",
    purpose: "Education & opportunities",
    description: "Programmes supporting young people from under-represented backgrounds into tech education and careers.",
    buttonLabel: "Explore resources →",
    url: "https://www.thehgfoundation.com/partnerships",
    status: "Resource",
  },
  {
    id: "lfbf",
    name: "London Foundation for Banking & Finance",
    purpose: "Financial education",
    description: "See LFBF's UK-wide research on young people, money habits and financial education.",
    buttonLabel: "Explore resources →",
    url: "https://www.lfbf.org.uk/research-report/young-persons-money-index-2025-2026/",
    status: "Resource",
  },
  {
    id: "harrington-starr",
    name: "Harrington Starr",
    purpose: "Fintech jobs & careers",
    description: "Explore fintech roles and career opportunities.",
    buttonLabel: "Explore opportunities →",
    url: "https://www.harringtonstarr.com/candidates/job-search/",
    status: "Resource",
  },
];
