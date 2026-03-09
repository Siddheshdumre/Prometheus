"use client";

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

// ─── Section colour palette ──────────────────────────────────────────────────
const SECTION_PALETTE: Record<string, { border: string; headerBg: string; bodyBg: string; chevron: string }> = {
  "📋": { border: "border-blue-500/25",   headerBg: "bg-blue-500/[0.08]",   bodyBg: "bg-blue-500/[0.03]",   chevron: "text-blue-400" },
  "🛠": { border: "border-amber-500/25",  headerBg: "bg-amber-500/[0.08]",  bodyBg: "bg-amber-500/[0.03]",  chevron: "text-amber-400" },
  "🏗": { border: "border-purple-500/25", headerBg: "bg-purple-500/[0.08]", bodyBg: "bg-purple-500/[0.03]", chevron: "text-purple-400" },
  "📁": { border: "border-green-500/25",  headerBg: "bg-green-500/[0.08]",  bodyBg: "bg-green-500/[0.03]",  chevron: "text-green-400" },
  "🔄": { border: "border-cyan-500/25",   headerBg: "bg-cyan-500/[0.08]",   bodyBg: "bg-cyan-500/[0.03]",   chevron: "text-cyan-400" },
  "📦": { border: "border-orange-500/25", headerBg: "bg-orange-500/[0.08]", bodyBg: "bg-orange-500/[0.03]", chevron: "text-orange-400" },
  "⚡": { border: "border-yellow-500/25", headerBg: "bg-yellow-500/[0.08]", bodyBg: "bg-yellow-500/[0.03]", chevron: "text-yellow-400" },
  "🔍": { border: "border-rose-500/25",   headerBg: "bg-rose-500/[0.08]",   bodyBg: "bg-rose-500/[0.03]",   chevron: "text-rose-400" },
};
const DEFAULT_PALETTE = {
  border: "border-white/10", headerBg: "bg-white/[0.04]", bodyBg: "bg-white/[0.02]", chevron: "text-slate-400",
};

function getPalette(text: string) {
  for (const [emoji, p] of Object.entries(SECTION_PALETTE)) {
    if (text.includes(emoji)) return p;
  }
  return DEFAULT_PALETTE;
}

// ─── Parse content into sections by ## headings ──────────────────────────────
interface Section { heading: string | null; lines: string[] }

function parseSections(content: string): Section[] {
  const sections: Section[] = [];
  let current: Section = { heading: null, lines: [] };
  for (const line of content.split("\n")) {
    const h2 = line.match(/^##\s+(.+)/);
    if (h2) { sections.push(current); current = { heading: h2[1], lines: [] }; }
    else current.lines.push(line);
  }
  sections.push(current);
  return sections;
}

/** Extract a short plain-text preview from section body lines */
function getPreview(lines: string[]): string {
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("#") || t.startsWith("```")) continue;
    const isList = /^\s*[-*]\s+/.test(t) || /^\s*\d+\.\s+/.test(t);
    const plain = t
      .replace(/^\s*[-*\d.]+\s+/, "")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/`([^`]+?)`/g, "$1");
    if (plain.length > 12) return plain.slice(0, 105) + (plain.length > 105 ? "…" : "");
    if (isList) continue; // skip lone-word list items, keep looking
  }
  return "";
}

// ─── Inline markdown renderer ────────────────────────────────────────────────
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`([^`]+?)`)|(\[([^\]]+?)\]\(([^)]+?)\))/g;
  let last = 0; let match: RegExpExecArray | null; let k = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[1])      parts.push(<strong key={k++} className="font-semibold text-slate-100">{match[2]}</strong>);
    else if (match[3]) parts.push(<em key={k++} className="italic text-slate-300">{match[4]}</em>);
    else if (match[5]) parts.push(<code key={k++} className="rounded bg-white/[0.07] px-1.5 py-0.5 text-[11px] font-mono text-cyan-300/90 border border-white/5">{match[6]}</code>);
    else if (match[7]) parts.push(<span key={k++} className="text-cyan-400 underline underline-offset-2 decoration-cyan-400/30">{match[8]}</span>);
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

// ─── Block renderer ──────────────────────────────────────────────────────────
function renderBlocks(lines: string[], pillMode = false): React.ReactNode[] {
  const els: React.ReactNode[] = [];
  let i = 0; let k = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.trimStart().startsWith("```")) {
      const lang = line.trim().slice(3).trim();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) { code.push(lines[i]); i++; }
      i++;
      els.push(
        <div key={k++} className="my-3 rounded-lg border border-white/10 bg-black/60 overflow-hidden">
          {lang && <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/5 bg-white/[0.02]">{lang}</div>}
          <pre className="p-3 text-xs leading-relaxed overflow-x-auto"><code className="text-emerald-300/90">{code.join("\n")}</code></pre>
        </div>
      );
      continue;
    }

    // H3 / H4
    const hm = line.match(/^(#{3,4})\s+(.+)/);
    if (hm) {
      els.push(
        <p key={k++} className={hm[1].length === 3 ? "text-sm font-semibold text-slate-200 mt-4 mb-1.5" : "text-[11px] font-semibold text-slate-400 uppercase tracking-widest mt-3 mb-1"}>
          {renderInline(hm[2])}
        </p>
      );
      i++; continue;
    }

    // HR
    if (/^---+$/.test(line.trim())) { els.push(<hr key={k++} className="my-4 border-white/[0.06]" />); i++; continue; }

    // List items
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const items: { indent: number; text: string; ordered: boolean; num?: string }[] = [];
      while (i < lines.length && (/^\s*[-*]\s+/.test(lines[i]) || /^\s*\d+\.\s+/.test(lines[i]))) {
        const um = lines[i].match(/^(\s*)[-*]\s+(.*)/);
        const om = lines[i].match(/^(\s*)(\d+)\.\s+(.*)/);
        if (om) items.push({ indent: om[1].length, text: om[3], ordered: true, num: om[2] });
        else if (um) items.push({ indent: um[1].length, text: um[2], ordered: false });
        i++;
      }

      // Pill mode: top-level items as hoverable badge chips w/ tooltip
      if (pillMode && items.every(it => it.indent === 0)) {
        els.push(
          <div key={k++} className="flex flex-wrap gap-1.5 my-2.5">
            {items.map((item, idx) => {
              const colonIdx = item.text.indexOf(":");
              const label = (colonIdx > 0 ? item.text.slice(0, colonIdx) : item.text)
                .replace(/\*\*(.+?)\*\*/g, "$1").replace(/`([^`]+?)`/g, "$1").trim();
              const tooltip = colonIdx > 0
                ? item.text.slice(colonIdx + 1).replace(/\*\*(.+?)\*\*/g, "$1").replace(/`([^`]+?)`/g, "$1").trim()
                : null;
              return (
                <div key={idx} className="group relative">
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-mono text-slate-300 hover:border-white/20 hover:bg-white/[0.09] transition-all cursor-default">
                    {label}
                  </span>
                  {tooltip && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 hidden group-hover:block w-max max-w-[220px] rounded-lg border border-white/10 bg-[#141414] px-2.5 py-1.5 text-[11px] text-slate-300 leading-snug shadow-2xl pointer-events-none">
                      {tooltip}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      } else {
        els.push(
          <ul key={k++} className="my-2 space-y-1.5">
            {items.map((item, idx) => (
              <li key={idx} className="flex gap-2.5 text-sm text-slate-300 leading-relaxed" style={{ paddingLeft: Math.min(item.indent, 12) * 4 }}>
                <span className="text-slate-600 mt-[3px] shrink-0 text-xs font-mono w-3.5 text-right">
                  {item.ordered ? `${item.num}.` : "·"}
                </span>
                <span className="flex-1">{renderInline(item.text)}</span>
              </li>
            ))}
          </ul>
        );
      }
      continue;
    }

    // Blank
    if (!line.trim()) { i++; continue; }

    // Paragraph
    const paras: string[] = [];
    while (
      i < lines.length && lines[i].trim() &&
      !lines[i].trimStart().startsWith("```") &&
      !lines[i].match(/^#{1,4}\s+/) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^---+$/.test(lines[i].trim())
    ) { paras.push(lines[i]); i++; }
    if (paras.length) els.push(
      <p key={k++} className="text-sm text-slate-400 leading-[1.75] my-1.5">
        {renderInline(paras.join(" "))}
      </p>
    );
  }
  return els;
}

// ─── Accordion card ──────────────────────────────────────────────────────────
function AccordionCard({ heading, lines, defaultOpen }: { heading: string; lines: string[]; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const pal = getPalette(heading);
  const preview = getPreview(lines);
  const isTechStack = /tech.?stack|🛠/i.test(heading);

  return (
    <div className={`rounded-xl border ${pal.border} overflow-hidden transition-all duration-150`}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-3 px-4 py-3.5 ${pal.headerBg} hover:brightness-110 transition-all`}
      >
        <span className="text-sm font-semibold tracking-tight text-white flex-1 text-left leading-snug">
          {heading}
        </span>
        {!open && preview && (
          <span className="hidden sm:block text-xs text-slate-500 truncate max-w-[260px] shrink-0">{preview}</span>
        )}
        <ChevronDown
          size={14}
          className={`${pal.chevron} flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className={`px-5 py-4 ${pal.bodyBg} border-t border-white/[0.05]`}>
          {renderBlocks(lines, isTechStack)}
        </div>
      )}
    </div>
  );
}

// ─── Public export ───────────────────────────────────────────────────────────
export function MarkdownRenderer({ content }: { content: string }) {
  const sections = parseSections(content);
  const preamble = sections[0];
  const cards = sections.slice(1).filter(s => s.heading);

  return (
    <div className="space-y-2">
      {preamble.lines.some(l => l.trim()) && (
        <div className="mb-3 text-sm text-slate-500 leading-relaxed px-1">
          {renderBlocks(preamble.lines)}
        </div>
      )}
      {cards.map((s, idx) => (
        <AccordionCard key={idx} heading={s.heading!} lines={s.lines} defaultOpen={idx === 0} />
      ))}
    </div>
  );
}



