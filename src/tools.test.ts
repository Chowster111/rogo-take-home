import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeTool } from "./tools.ts";

async function runDelayedTool(name: string, input: unknown) {
  const result = executeTool(name, input);
  await vi.runAllTimersAsync();
  return result;
}

describe("executeTool", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves a company by ticker", async () => {
    const result = await runDelayedTool("getFinancials", { company: "glbx" });

    expect(result).toMatchObject({
      company: "Globex Inc",
      ticker: "GLBX",
    });
  });

  it("prioritizes an exact uppercase ticker over ambiguous name matches", async () => {
    const result = await runDelayedTool("getCompanyProfile", { company: "ACME" });

    expect(result).toMatchObject({ name: "Acme Corp", ticker: "ACME" });
  });

  it("cancels an in-flight tool call", async () => {
    const controller = new AbortController();
    const result = executeTool(
      "getFinancials",
      { company: "GLBX" },
      controller.signal,
    );
    const rejection = expect(result).rejects.toMatchObject({ name: "AbortError" });

    controller.abort();

    await rejection;
  });

  it("matches company names case-insensitively and ignores punctuation", async () => {
    const result = await runDelayedTool("getCompanyProfile", {
      company: "gLoBeX, Inc.",
    });

    expect(result).toMatchObject({ name: "Globex Inc", ticker: "GLBX" });
  });

  it("accepts a unique partial company name", async () => {
    const result = await runDelayedTool("getCompanyProfile", {
      company: "Umbrella",
    });

    expect(result).toMatchObject({ name: "Umbrella Health", ticker: "UMBR" });
  });

  it("searches company names and tickers", async () => {
    const result = await runDelayedTool("searchCompanies", { query: "glb" });

    expect(result).toEqual([
      {
        name: "Globex Inc",
        ticker: "GLBX",
        sector: "Diversified Industrials",
      },
    ]);
  });

  it("rejects ambiguous partial company names", async () => {
    await expect(
      executeTool("getCompanyProfile", { company: "Acme" }),
    ).rejects.toThrow(
      'company "Acme" is ambiguous; use one of: Acme Corp (ACME), Acme Robotics (ACMR)',
    );
  });

  it.each([
    ["searchCompanies", {}, '"query" must be a non-empty string'],
    ["getFinancials", { company: 42 }, '"company" must be a non-empty string'],
    [
      "searchDocuments",
      { query: "risk", company: 42 },
      '"company" must be a non-empty string when provided',
    ],
  ])("validates arguments for %s", async (name, input, expectedMessage) => {
    await expect(executeTool(name, input)).rejects.toThrow(expectedMessage);
  });
});
