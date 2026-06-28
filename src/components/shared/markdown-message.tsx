"use client";

import { cn } from "@/lib/utils";

// Renders inline markdown: **bold**, `code`, plain text
function Inline({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code key={i} className="bg-slate-100 px-1 py-0.5 rounded text-[0.8em] font-mono">
              {part.slice(1, -1)}
            </code>
          );
        }
        return part;
      })}
    </span>
  );
}

type Block =
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "h4"; text: string }
  | { type: "ol"; items: string[] }
  | { type: "ul"; items: string[] }
  | { type: "table"; rows: string[][]; hasHeader: boolean }
  | { type: "p"; text: string };

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    if (!trimmed) { i++; continue; }

    // Headings
    if (trimmed.startsWith("#### ")) {
      blocks.push({ type: "h4", text: trimmed.slice(5) });
      i++; continue;
    }
    if (trimmed.startsWith("### ")) {
      blocks.push({ type: "h3", text: trimmed.slice(4) });
      i++; continue;
    }
    if (trimmed.startsWith("## ")) {
      blocks.push({ type: "h2", text: trimmed.slice(3) });
      i++; continue;
    }

    // Tables: collect consecutive | lines
    if (trimmed.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && (lines[i] ?? "").trim().startsWith("|")) {
        tableLines.push(lines[i] ?? "");
        i++;
      }
      const rows: string[][] = [];
      let hasHeader = false;
      for (const tl of tableLines) {
        const cells = tl
          .split("|")
          .slice(1, -1)
          .map((c) => c.trim());
        // Skip separator lines like | :--- | --- |
        if (cells.every((c) => /^:?-+:?$/.test(c))) {
          hasHeader = true;
          continue;
        }
        rows.push(cells);
      }
      if (rows.length > 0) {
        blocks.push({ type: "table", rows, hasHeader });
      }
      continue;
    }

    // Ordered list: collect consecutive numbered lines
    if (/^\d+\.\s/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test((lines[i] ?? "").trim())) {
        items.push((lines[i] ?? "").replace(/^\s*\d+\.\s/, ""));
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    // Unordered list: collect consecutive - or * lines
    if (/^[-*]\s/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s/.test((lines[i] ?? "").trim())) {
        items.push((lines[i] ?? "").replace(/^\s*[-*]\s/, ""));
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    // Paragraph: accumulate until blank line or block-starting line
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? "").trim() &&
      !/(^#+\s|^\||\d+\.\s|^[-*]\s)/.test((lines[i] ?? "").trim())
    ) {
      paraLines.push(lines[i] ?? "");
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: "p", text: paraLines.join(" ") });
    }
  }

  return blocks;
}

interface MarkdownMessageProps {
  content: string;
  className?: string;
}

export function MarkdownMessage({ content, className }: MarkdownMessageProps) {
  const blocks = parseBlocks(content);

  return (
    <div className={cn("text-sm leading-relaxed", className)}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case "h2":
            return (
              <p key={idx} className="text-base font-bold text-slate-800 mt-3 mb-1 first:mt-0">
                <Inline text={block.text} />
              </p>
            );
          case "h3":
            return (
              <p key={idx} className="text-sm font-bold text-slate-800 mt-3 mb-1 first:mt-0 border-b border-slate-100 pb-0.5">
                <Inline text={block.text} />
              </p>
            );
          case "h4":
            return (
              <p key={idx} className="text-sm font-semibold text-slate-700 mt-2 mb-0.5">
                <Inline text={block.text} />
              </p>
            );
          case "ol":
            return (
              <ol key={idx} className="list-decimal list-inside space-y-1 my-1.5 pl-1">
                {block.items.map((item, j) => (
                  <li key={j} className="text-slate-700">
                    <Inline text={item} />
                  </li>
                ))}
              </ol>
            );
          case "ul":
            return (
              <ul key={idx} className="list-disc list-inside space-y-1 my-1.5 pl-1">
                {block.items.map((item, j) => (
                  <li key={j} className="text-slate-700">
                    <Inline text={item} />
                  </li>
                ))}
              </ul>
            );
          case "table": {
            const [headerRow, ...bodyRows] = block.hasHeader
              ? block.rows
              : [[], ...block.rows];
            return (
              <div key={idx} className="my-2 overflow-x-auto rounded-md border border-slate-200">
                <table className="w-full text-xs border-collapse">
                  {block.hasHeader && headerRow && headerRow.length > 0 && (
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        {headerRow.map((cell, j) => (
                          <th key={j} className="px-3 py-1.5 text-left font-semibold text-slate-600 whitespace-nowrap">
                            <Inline text={cell} />
                          </th>
                        ))}
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    {(block.hasHeader ? bodyRows : block.rows).map((row, j) => (
                      <tr key={j} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                        {row.map((cell, k) => (
                          <td key={k} className="px-3 py-1.5 text-slate-700 align-top">
                            <Inline text={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
          case "p":
            return (
              <p key={idx} className="text-slate-700 my-1">
                <Inline text={block.text} />
              </p>
            );
        }
      })}
    </div>
  );
}
