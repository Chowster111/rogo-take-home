/**
 * The agent's tools. These stand in for the real research APIs — same shapes,
 * local data, plus a little latency so the app behaves like the real thing.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { companies, documents, financials } from "./data.ts";

/** Thrown when a tool cannot service a request. */
export class ToolError extends Error {}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function requireInput(input: unknown): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new ToolError("tool input must be an object");
  }
  return input as Record<string, unknown>;
}

function requireString(input: Record<string, unknown>, field: string): string {
  const value = input[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ToolError(`"${field}" must be a non-empty string`);
  }
  return value.trim();
}

function optionalString(
  input: Record<string, unknown>,
  field: string,
): string | undefined {
  const value = input[field];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ToolError(`"${field}" must be a non-empty string when provided`);
  }
  return value.trim();
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function resolveCompany(identifier: string) {
  const needle = normalize(identifier);
  if (!needle) {
    throw new ToolError("company must contain letters or numbers");
  }

  const exactTickerMatch = companies.find(
    (company) => company.ticker === identifier.trim(),
  );
  if (exactTickerMatch) return exactTickerMatch;

  const nameMatch = companies.find((company) => normalize(company.name) === needle);
  if (nameMatch) return nameMatch;

  const partialMatches = companies.filter((company) =>
    normalize(company.name).includes(needle),
  );
  if (partialMatches.length === 1) return partialMatches[0];
  if (partialMatches.length > 1) {
    const choices = partialMatches
      .map((company) => `${company.name} (${company.ticker})`)
      .join(", ");
    throw new ToolError(`company "${identifier}" is ambiguous; use one of: ${choices}`);
  }

  const tickerMatch = companies.find((company) => normalize(company.ticker) === needle);
  if (tickerMatch) return tickerMatch;

  throw new ToolError(`no company found for "${identifier}"`);
}

export const toolSchemas: Anthropic.Tool[] = [
  {
    name: "searchCompanies",
    description:
      "Search the coverage universe for companies matching a name. Returns the company name, ticker and sector for each match.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "A company name, ticker, or part of either.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "getCompanyProfile",
    description:
      "Get a company's profile: description, sector, headquarters, headcount, business segments and the filings we hold.",
    input_schema: {
      type: "object",
      properties: {
        company: { type: "string", description: "The company name or ticker." },
      },
      required: ["company"],
    },
  },
  {
    name: "getFinancials",
    description:
      "Get annual and quarterly financials for a company: revenue, gross margin, operating income, net income and free cash flow.",
    input_schema: {
      type: "object",
      properties: {
        company: { type: "string", description: "The company name or ticker." },
      },
      required: ["company"],
    },
  },
  {
    name: "searchDocuments",
    description:
      "Keyword search over earnings call transcripts, filing excerpts and press releases.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Keywords to search for." },
        company: {
          type: "string",
          description: "Optional. Restrict the search to a company name or ticker.",
        },
      },
      required: ["query"],
    },
  },
];

async function searchCompanies(query: string) {
  const needle = normalize(query);
  if (!needle) throw new ToolError("query must contain letters or numbers");

  await sleep(250);
  const matches = companies.filter(
    (company) =>
      normalize(company.name).includes(needle) ||
      normalize(company.ticker).includes(needle),
  );
  return matches.map((c) => ({
    name: c.name,
    ticker: c.ticker,
    sector: c.sector,
  }));
}

async function getCompanyProfile(company: string) {
  const match = resolveCompany(company);
  await sleep(450);
  return match;
}

async function getFinancials(company: string) {
  const resolvedCompany = resolveCompany(company);
  await sleep(800);
  const record = financials.find((record) => record.company === resolvedCompany.name);
  if (!record) {
    throw new ToolError(`no financials found for "${resolvedCompany.name}"`);
  }
  return record;
}

async function searchDocuments(query: string, company?: string) {
  const resolvedCompany = company ? resolveCompany(company) : undefined;
  await sleep(700);

  const terms = String(query).trim().split(/\s+/).filter(Boolean);
  // The upstream document index rejects long queries.
  if (terms.length > 6) {
    throw new ToolError(
      `document search accepts at most 6 terms (received ${terms.length})`,
    );
  }

  const pool = resolvedCompany
    ? documents.filter((document) => document.company === resolvedCompany.name)
    : documents;

  const scored = pool.map((doc) => {
    const haystack = `${doc.title} ${doc.body}`.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (haystack.includes(term.toLowerCase())) score += 1;
    }
    return { doc, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((s) => s.doc);
}

export async function executeTool(
  name: string,
  input: unknown,
): Promise<unknown> {
  const fields = requireInput(input);

  switch (name) {
    case "searchCompanies":
      return searchCompanies(requireString(fields, "query"));
    case "getCompanyProfile":
      return getCompanyProfile(requireString(fields, "company"));
    case "getFinancials":
      return getFinancials(requireString(fields, "company"));
    case "searchDocuments":
      return searchDocuments(
        requireString(fields, "query"),
        optionalString(fields, "company"),
      );
    default:
      throw new ToolError(`unknown tool "${name}"`);
  }
}
