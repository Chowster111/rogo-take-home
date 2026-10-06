import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownMessage } from "./App.tsx";

describe("MarkdownMessage", () => {
  it("renders formatting and GFM tables without rendering raw HTML", () => {
    const markdown = `**Growing faster**

| Company | CAGR |
| --- | --- |
| Acme | 5.3% |

<script>alert("unsafe")</script>`;

    const html = renderToStaticMarkup(<MarkdownMessage text={markdown} />);

    expect(html).toContain("<strong>Growing faster</strong>");
    expect(html).toContain("<table>");
    expect(html).toContain("<th>Company</th>");
    expect(html).not.toContain("<script>");
  });
});
