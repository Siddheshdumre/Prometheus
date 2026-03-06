"use client";

import React from "react";

interface MarkdownRendererProps {
  content: string;
}

/**
 * Lightweight markdown-to-JSX renderer for AI-generated content.
 * Handles: headings, bold, italic, inline code, code blocks, lists, links, horizontal rules.
 */
export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code blocks (``` ... ```)
    if (line.trimStart().startsWith("```")) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <div key={key++} className="my-3 rounded-lg border border-white/10 bg-black/60 overflow-hidden">
          {lang && (
            <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/5 bg-white/[0.02]">
              {lang}
            </div>
          )}
          <pre className="p-3 text-xs leading-relaxed overflow-x-auto">
            <code className="text-emerald-300/90">{codeLines.join("\n")}</code>
          </pre>
        </div>
      );
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
      elements.push(<hr key={key++} className="my-4 border-white/10" />);
      i++;
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,4})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const className = level === 1
        ? "text-lg font-semibold text-white mt-6 mb-3"
        : level === 2
        ? "text-base font-semibold text-slate-100 mt-5 mb-2"
        : level === 3
        ? "text-sm font-semibold text-slate-200 mt-4 mb-2"
        : "text-sm font-medium text-slate-300 mt-3 mb-1";
      elements.push(
        <div key={key++} className={className}>{renderInline(text)}</div>
      );
      i++;
      continue;
    }

    // Unordered list items (-, *, or numbered list)
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const listItems: { indent: number; text: string }[] = [];
      while (i < lines.length && (/^\s*[-*]\s+/.test(lines[i]) || /^\s*\d+\.\s+/.test(lines[i]))) {
        const match = lines[i].match(/^(\s*)(?:[-*]|\d+\.)\s+(.*)/);
        if (match) {
          listItems.push({ indent: match[1].length, text: match[2] });
        }
        i++;
      }
      elements.push(
        <ul key={key++} className="my-2 space-y-1.5">
          {listItems.map((item, idx) => (
            <li key={idx} className="flex gap-2 text-sm text-slate-300 leading-relaxed" style={{ paddingLeft: Math.min(item.indent, 12) * 4 }}>
              <span className="text-cyan-500/60 mt-1.5 shrink-0">•</span>
              <span>{renderInline(item.text)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Blank line
    if (!line.trim()) {
      i++;
      continue;
    }

    // Regular paragraph — collect consecutive non-empty, non-special lines
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trimStart().startsWith("```") &&
      !lines[i].match(/^#{1,4}\s+/) &&
      !(/^\s*[-*]\s+/.test(lines[i])) &&
      !(/^\s*\d+\.\s+/.test(lines[i])) &&
      !(/^---+$/.test(lines[i].trim()))
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      elements.push(
        <p key={key++} className="text-sm text-slate-300 leading-relaxed my-2">
          {renderInline(paraLines.join(" "))}
        </p>
      );
    }
  }

  return <div className="space-y-0.5">{elements}</div>;
}

/** Render inline markdown: bold, italic, inline code, links */
function renderInline(text: string): React.ReactNode {
  // Split on inline patterns and build inline nodes
  const parts: React.ReactNode[] = [];
  // Regex matches: **bold**, *italic*, `code`, [text](url)
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`([^`]+?)`)|(\[([^\]]+?)\]\(([^)]+?)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let inlineKey = 0;

  while ((match = regex.exec(text)) !== null) {
    // Text before this match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[1]) {
      // **bold**
      parts.push(<strong key={inlineKey++} className="font-semibold text-slate-100">{match[2]}</strong>);
    } else if (match[3]) {
      // *italic*
      parts.push(<em key={inlineKey++} className="italic text-slate-200">{match[4]}</em>);
    } else if (match[5]) {
      // `inline code`
      parts.push(
        <code key={inlineKey++} className="rounded bg-white/10 px-1.5 py-0.5 text-xs font-mono text-cyan-300">
          {match[6]}
        </code>
      );
    } else if (match[7]) {
      // [text](url)
      parts.push(
        <span key={inlineKey++} className="text-cyan-400 underline underline-offset-2">
          {match[8]}
        </span>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}
