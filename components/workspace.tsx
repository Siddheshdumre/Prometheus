"use client";

import { useState, useCallback, useEffect } from "react";
import { BrainCircuit, FolderTree, Network, LayoutDashboard, SearchCode, Settings, Sparkles, FolderCode, Loader2, Copy, Check, RefreshCw, Flame, FileCode2, Braces, Layers, GitBranch, CheckCircle2, Zap, FileDown } from "lucide-react";
import { exportReportAsPdf } from "../lib/pdf-export";
import { FileTree } from "./file-tree";
import { CodeViewer } from "./code-viewer";
import { CommandPalette, useCommandPalette } from "./command-palette";
import { ImpactAnalysis } from "./impact-analysis";
import { ArchitectureOverview } from "./architecture-overview";
import { MarkdownRenderer } from "./markdown-renderer";
import { ProjectTree } from "./project-tree";
import { PrometheusIllustration } from "./prometheus-illustration";
import { motion, AnimatePresence, type Variants } from "framer-motion";

type NavItem = "Dashboard" | "Architecture" | "Project Structure" | "AI Chat" | "Impact Analyzer" | "File Explorer" | "Settings";

const navItems: { label: NavItem; icon: React.ElementType }[] = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "File Explorer", icon: FolderCode },
  { label: "Architecture", icon: FolderTree },
  { label: "Project Structure", icon: Network },
  { label: "AI Chat", icon: BrainCircuit },
  { label: "Impact Analyzer", icon: SearchCode },
  { label: "Settings", icon: Settings }
];

const METRIC_CARDS = [
  { key: "files",         label: "Files",       icon: FileCode2,    color: "blue",    border: "border-blue-500/20",    bg: "bg-blue-500/[0.07]",    iconColor: "text-blue-400",    topBar: "from-blue-500/40" },
  { key: "functions",     label: "Functions",   icon: Braces,       color: "purple",  border: "border-purple-500/20",  bg: "bg-purple-500/[0.07]",  iconColor: "text-purple-400",  topBar: "from-purple-500/40" },
  { key: "classes",       label: "Classes",     icon: Layers,       color: "amber",   border: "border-amber-500/20",   bg: "bg-amber-500/[0.07]",   iconColor: "text-amber-400",   topBar: "from-amber-500/40" },
  { key: "dependencies",  label: "Imports",     icon: GitBranch,    color: "cyan",    border: "border-cyan-500/20",    bg: "bg-cyan-500/[0.07]",    iconColor: "text-cyan-400",    topBar: "from-cyan-500/40" },
  { key: "resolvedImports",label: "Resolved",   icon: CheckCircle2, color: "emerald", border: "border-emerald-500/20", bg: "bg-emerald-500/[0.07]", iconColor: "text-emerald-400", topBar: "from-emerald-500/40" },
  { key: "functionCalls", label: "Call Graph",  icon: Zap,          color: "rose",    border: "border-rose-500/20",    bg: "bg-rose-500/[0.07]",    iconColor: "text-rose-400",    topBar: "from-rose-500/40" },
] as const;

const SUGGESTED_PROMPTS = [
  "What are the most complex files?",
  "Explain the data flow",
  "Which functions are called the most?",
  "Find potential circular dependencies",
];

const TAB_VARIANTS: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.18, ease: [0.4, 0, 0.2, 1] } },
  exit:    { opacity: 0, y: -6, transition: { duration: 0.12, ease: [0.4, 0, 1, 1] } },
};





export function Workspace() {
  const [activeTab, setActiveTab] = useState<NavItem>("Dashboard");
  const [repoPathInput, setRepoPathInput] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisData, setAnalysisData] = useState<any>(null);



  // AI Chat State
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai', content: string }[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // File Explorer State
  const [selectedFile, setSelectedFile] = useState<any>(null);

  // Codebase Explanation State
  const [codebaseExplanation, setCodebaseExplanation] = useState<string | null>(null);
  const [isExplanationLoading, setIsExplanationLoading] = useState(false);
  const [explanationLoadingStep, setExplanationLoadingStep] = useState(0);
  const [copiedExplanation, setCopiedExplanation] = useState(false);

  useEffect(() => {
    if (!isExplanationLoading) return;
    const interval = setInterval(() => setExplanationLoadingStep(s => s + 1), 2500);
    return () => clearInterval(interval);
  }, [isExplanationLoading]);
  
  // Command Palette
  const commandPalette = useCommandPalette();

  const generateCodebaseExplanation = useCallback(async (data: any) => {
    setIsExplanationLoading(true);
    setCodebaseExplanation(null);
    try {
      // Build a rich context summary for the explanation prompt
      const topFiles = (data.files || [])
        .slice()
        .sort((a: any, b: any) => (b.complexity || 0) - (a.complexity || 0))
        .slice(0, 20);

      const fileList = topFiles.map((f: any) =>
        `- ${f.path} (${f.functions?.length || 0} functions, complexity ${f.complexity || 0}, exports: ${(f.exports || []).join(', ') || 'none'})`
      ).join('\n');

      const allFunctions = (data.files || []).flatMap((f: any) =>
        (f.functions || []).filter((fn: any) => fn.isExported).map((fn: any) => `${f.path}:${fn.name}`)
      ).slice(0, 40);

      const layers = (data.architecture?.layers || []).map((l: any) =>
        `- ${l.name} (${l.type}): ${l.description} — ${l.files.length} files`
      ).join('\n');

      const archPattern = data.architecture?.pattern;
      const insights = (data.architecture?.insights || []).map((i: any) =>
        `- [${i.type.toUpperCase()}] ${i.title}: ${i.description}`
      ).join('\n');

      const externalDeps = (data.graph?.nodes || [])
        .filter((n: any) => n.type === 'external')
        .map((n: any) => n.label)
        .slice(0, 30);

      const message = `You are generating a comprehensive codebase overview for a developer who has never seen this repository before. Be specific, reference actual file names, function names, and libraries from the analysis data. Write in a professional but approachable tone.

Produce a well-structured markdown document with the following sections. Be detailed and specific to THIS codebase — do NOT give generic advice.

## 📋 Project Summary
What this project is, its purpose, and what problem it solves. Infer from the architecture pattern, file names, and dependencies.

## 🛠 Tech Stack
List every framework, library, and language detected. Group by category (Frontend, Backend, Database, DevTools, etc.).

## 🏗 Architecture Overview
Describe the architecture pattern detected (${archPattern?.type || 'Unknown'}, confidence ${archPattern?.confidence || 0}). Explain how the code is organized into layers, what each layer does, and how they interact.

## 📁 Key Files & What They Do
For each of the most important files, explain its role in 1-2 sentences. Group by purpose (entry points, core logic, utilities, config).

## 🔄 Data Flow
Explain how data moves through the application — from entry point (user request / page load) through business logic to data layer and back. Reference specific files.

## 📦 External Dependencies
List the key third-party packages and what role they play in the project.

## ⚡ Key Patterns & Conventions
Note any naming conventions, module organization patterns, state management approaches, or architectural patterns observed.

## 🔍 Observations & Recommendations
Note any strengths, potential risks, or suggestions based on the analysis data. Reference specific files or metrics.

Here is the analysis data:

ARCHITECTURE PATTERN: ${archPattern?.type || 'Unknown'} (confidence: ${archPattern?.confidence || 0})
Description: ${archPattern?.description || 'N/A'}
Characteristics: ${(archPattern?.characteristics || []).join(', ')}
Primary Language: ${archPattern?.primaryLanguage || 'TypeScript/JavaScript'}

METRICS:
- Total Files: ${data.metrics?.files || 0}
- Total Functions: ${data.metrics?.functions || 0}
- Total Classes: ${data.metrics?.classes || 0}
- Import Dependencies: ${data.metrics?.dependencies || 0}
- Resolved Imports: ${data.metrics?.resolvedImports || 0} (${Math.round(((data.metrics?.resolvedImports || 0) / Math.max(data.metrics?.dependencies || 1, 1)) * 100)}% resolution)
- Cross-file Function Calls: ${data.metrics?.functionCalls || 0}

LAYERS:
${layers || 'No layers detected'}

TOP FILES (by complexity):
${fileList || 'No files'}

KEY EXPORTED FUNCTIONS:
${allFunctions.join(', ') || 'None detected'}

EXTERNAL DEPENDENCIES:
${externalDeps.join(', ') || 'None detected'}

ARCHITECTURE INSIGHTS:
${insights || 'None'}

IMPORTANT: Every section must reference actual file names, function names, and libraries from the data above. Do not make up file names. If information for a section is insufficient, say so honestly and explain what you can infer.`;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, context: data, stream: true }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: 'Unknown error' }));
        setCodebaseExplanation('Failed to generate explanation: ' + (errBody.error || res.statusText));
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setCodebaseExplanation('Streaming not supported by the browser.');
        return;
      }

      const decoder = new TextDecoder();
      let accumulated = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const payload = line.slice(6);
            if (payload === '[DONE]') break;
            try {
              const parsed = JSON.parse(payload);
              if (parsed.text) {
                accumulated += parsed.text;
                setCodebaseExplanation(accumulated);
              }
            } catch { /* skip malformed */ }
          }
        }
      }

      if (!accumulated) {
        setCodebaseExplanation('No response received from AI.');
      }
    } catch (err: any) {
      setCodebaseExplanation('Failed to generate explanation: ' + err.message);
    } finally {
      setIsExplanationLoading(false);
    }
  }, []);

  const handleAIQuery = (query: string) => {
    setChatMessage(query);
    // Auto-submit the query
    if (analysisData) {
      setChatHistory(prev => [...prev, { role: 'user', content: query }]);
      setIsChatLoading(true);
      
      fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query,
          context: analysisData
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setChatHistory(prev => [...prev, { role: 'ai', content: data.reply }]);
        } else {
          setChatHistory(prev => [...prev, { role: 'ai', content: "Error: " + data.error }]);
        }
      })
      .catch(error => {
        setChatHistory(prev => [...prev, { role: 'ai', content: "Error: " + error.message }]);
      })
      .finally(() => {
        setIsChatLoading(false);
        setChatMessage("");
      });
    }
  };



  const handleAnalyze = async () => {
    if (!repoPathInput) return;
    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/repo/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoPath: repoPathInput })
      });
      const data = await res.json();
      if (data.success) {
        setAnalysisData(data.data);

        // Auto-generate codebase explanation in background
        generateCodebaseExplanation(data.data);

        setActiveTab("Dashboard");
      } else {
        alert("Error: " + data.error);
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || !analysisData) return;

    const userMessage = chatMessage;
    setChatMessage("");
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsChatLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          context: analysisData // Send full analysis data including codeChunks
        })
      });
      const data = await res.json();

      if (data.success) {
        setChatHistory(prev => [...prev, { role: 'ai', content: data.reply }]);
      } else {
        setChatHistory(prev => [...prev, { role: 'ai', content: "Error: " + data.error }]);
      }
    } catch (error: any) {
      setChatHistory(prev => [...prev, { role: 'ai', content: "Error: " + error.message }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen grid-cols-[240px_1fr] bg-[#0A0A0A] text-slate-300 selection:bg-cyan-500/30">
      {/* Sidebar */}
      <aside className="flex flex-col border-r border-white/5 bg-black/20 p-4">
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500/30 to-amber-600/20 border border-orange-500/20 shadow-lg shadow-orange-500/10">
            <Flame size={16} className="text-orange-400" />
          </div>
          <div>
            <span className="text-sm font-bold tracking-wider text-white">PROMETHEUS</span>
            <p className="text-[10px] text-slate-500 leading-none mt-0.5">Codebase Intelligence</p>
          </div>
        </div>

        <button
          onClick={() => { setAnalysisData(null); setCodebaseExplanation(null); setActiveTab("Dashboard"); }}
          className="mb-6 flex w-full items-center justify-center gap-2 rounded-lg border border-orange-500/20 bg-orange-500/10 px-3 py-2 text-sm font-medium text-orange-400 transition-all hover:bg-orange-500/20 hover:border-orange-500/35"
        >
          <Flame size={14} /> Import Repository
        </button>

        <nav className="flex-1 space-y-0.5">
          {navItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              onClick={() => setActiveTab(label)}
              className={`relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-all duration-150 ${
                activeTab === label
                  ? "bg-white/[0.06] text-white font-medium before:absolute before:left-0 before:top-1/4 before:h-1/2 before:w-0.5 before:rounded-r-full before:bg-orange-400"
                  : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
              }`}
            >
              <Icon size={15} className={activeTab === label ? "text-orange-400" : "text-slate-600"} />
              {label}
            </button>
          ))}
        </nav>

        <div className="mt-8 rounded-md border border-white/5 bg-white/[0.02] p-3 text-xs text-slate-500">
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-slate-300">Command Palette</span>
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-400">⌘K</kbd>
          </div>
          <p className="leading-relaxed">Search files, functions, navigate, or ask AI about your code.</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <section className="flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-white/5 px-8 py-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">
              {repoPathInput
                ? (repoPathInput.replace(/\\/g, '/').split('/').filter(Boolean).pop() || 'Repository')
                : 'Prometheus'}
            </span>
            <span className="text-slate-700">/</span>
            <span className="text-sm font-medium text-slate-200">{activeTab}</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            {analysisData ? (
              <>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-emerald-500/80"></div>
                  Analysis Complete
                </div>
                <span className="text-slate-700">|</span>
                <span>{analysisData.metrics.files} files · {analysisData.metrics.functions} functions</span>
              </>
            ) : (
              <span>No repository loaded</span>
            )}
          </div>
        </header>

        {/* Dynamic Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-5xl">
            <AnimatePresence mode="wait">
            {activeTab === "Dashboard" && (
              <motion.div key="Dashboard" variants={TAB_VARIANTS} initial="initial" animate="animate" exit="exit">
                {analysisData && (
                  <h1 className="text-2xl font-light tracking-tight text-white mb-8">Repository Overview</h1>
                )}

                {!analysisData ? (
                  <div className="flex items-center gap-8 min-h-[65vh]">
                    {/* Left: text + form */}
                    <div className="w-[400px] flex-shrink-0">
                      <p className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-500/70 mb-3">Codebase Intelligence</p>
                      <h2 className="text-4xl font-bold tracking-tight text-white leading-tight mb-4">
                        Understand any<br />codebase, instantly.
                      </h2>
                      <p className="text-sm text-slate-400 leading-relaxed mb-8">
                        Point Prometheus at any GitHub repo or local folder. Get instant architecture maps, dependency graphs, and an AI that actually knows your code.
                      </p>

                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-1.5 block">Repository URL or Local Path</label>
                          <input
                            type="text"
                            value={repoPathInput}
                            onChange={(e) => setRepoPathInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                            placeholder="https://github.com/user/repo  or  C:\path\to\project"
                            className="w-full rounded-lg border border-white/10 bg-black/50 px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-all"
                          />
                        </div>
                        <button
                          onClick={handleAnalyze}
                          disabled={isAnalyzing || !repoPathInput}
                          className="flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-500/25 bg-cyan-500/15 px-4 py-3 text-sm font-medium text-cyan-400 transition-all hover:bg-cyan-500/25 hover:border-cyan-500/45 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {isAnalyzing ? (
                            <><Loader2 size={16} className="animate-spin" /> Analyzing...</>
                          ) : (
                            <><Sparkles size={16} /> Analyze Repository</>
                          )}
                        </button>
                      </div>

                      {/* Quick-start suggestions */}
                      <div className="mt-8">
                        <p className="text-xs text-slate-600 mb-3">Try with a popular repo:</p>
                        <div className="flex flex-wrap gap-2">
                          {["facebook/react", "vercel/next.js", "tailwindlabs/tailwindcss"].map((repo) => (
                            <button
                              key={repo}
                              onClick={() => setRepoPathInput(`https://github.com/${repo}`)}
                              className="text-xs px-3 py-1.5 rounded-full border border-white/[0.08] text-slate-500 hover:border-cyan-500/35 hover:text-cyan-400 transition-all"
                            >
                              {repo}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right: Prometheus illustration — hidden while analyzing */}
                    {!isAnalyzing && (
                      <div className="hidden lg:block flex-1 self-stretch min-h-[340px]">
                        <PrometheusIllustration className="w-full h-full" />
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-6 gap-4 mb-12">
                      {METRIC_CARDS.map(({ key, label, icon: Icon, border, bg, iconColor, topBar }) => {
                        const raw = key === "functionCalls"
                          ? (analysisData.metrics.functionCalls || 0)
                          : (analysisData.metrics as any)[key] ?? 0;
                        const display = key === "resolvedImports"
                          ? `${Math.round((raw / Math.max(analysisData.metrics.dependencies, 1)) * 100)}%`
                          : raw;
                        return (
                          <div key={key} className={`relative overflow-hidden flex flex-col rounded-xl border ${border} ${bg} p-5 hover:-translate-y-0.5 transition-transform duration-150`}>
                            <div className={`absolute top-0 right-0 h-px w-2/3 bg-gradient-to-l ${topBar} to-transparent`} />
                            <Icon size={16} className={`${iconColor} mb-3 opacity-80`} />
                            <span className="tabular-nums text-3xl font-semibold text-white leading-none">{display}</span>
                            <span className="text-xs text-slate-500 mt-1.5 uppercase tracking-wider">{label}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-medium text-slate-200">Codebase Overview</h2>
                      {codebaseExplanation && !isExplanationLoading && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(codebaseExplanation);
                              setCopiedExplanation(true);
                              setTimeout(() => setCopiedExplanation(false), 2000);
                            }}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 bg-white/5 hover:bg-white/10 transition-colors"
                          >
                            {copiedExplanation ? <Check size={13} /> : <Copy size={13} />}
                            {copiedExplanation ? 'Copied' : 'Copy'}
                          </button>
                          <button
                            onClick={() => analysisData && generateCodebaseExplanation(analysisData)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 bg-white/5 hover:bg-white/10 transition-colors"
                          >
                            <RefreshCw size={13} />
                            Regenerate
                          </button>
                          <button
                            onClick={() =>
                              exportReportAsPdf(
                                codebaseExplanation,
                                repoPathInput,
                                {
                                  files:           analysisData?.files?.length,
                                  functions:       analysisData?.metrics?.totalFunctions,
                                  classes:         analysisData?.metrics?.totalClasses,
                                  dependencies:    analysisData?.metrics?.totalDependencies,
                                  resolvedImports: analysisData?.metrics?.resolvedImports,
                                  functionCalls:   analysisData?.metrics?.totalFunctionCalls,
                                }
                              )
                            }
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-white bg-orange-500/20 hover:bg-orange-500/35 border border-orange-500/30 hover:border-orange-500/50 transition-colors"
                          >
                            <FileDown size={13} />
                            Export PDF
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6">
                      {isExplanationLoading && !codebaseExplanation ? (
                        <div className="space-y-4">
                          <div className="flex items-center gap-3 mb-4">
                            <Loader2 size={16} className="animate-spin text-cyan-400" />
                            <span className="text-sm text-slate-400">
                              {['Analyzing architecture...', 'Mapping dependencies...', 'Identifying key files...', 'Generating overview...'][explanationLoadingStep % 4]}
                            </span>
                          </div>
                          <div className="space-y-3 animate-pulse">
                            <div className="h-4 bg-white/5 rounded w-3/4"></div>
                            <div className="h-4 bg-white/5 rounded w-full"></div>
                            <div className="h-4 bg-white/5 rounded w-5/6"></div>
                            <div className="h-4 bg-white/5 rounded w-2/3"></div>
                          </div>
                        </div>
                      ) : codebaseExplanation ? (
                        <div>
                          <MarkdownRenderer content={codebaseExplanation} />
                          {isExplanationLoading && (
                            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/5">
                              <Loader2 size={14} className="animate-spin text-cyan-400" />
                              <span className="text-xs text-slate-500">Still generating...</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-slate-500 text-center py-4">
                          <p>Overview will be generated automatically after analysis.</p>
                          <button
                            onClick={() => analysisData && generateCodebaseExplanation(analysisData)}
                            className="mt-2 text-cyan-400 hover:text-cyan-300 underline underline-offset-2 text-xs"
                          >
                            Generate now
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {activeTab === "File Explorer" && (
              <motion.div key="File Explorer" variants={TAB_VARIANTS} initial="initial" animate="animate" exit="exit" className="h-[600px] flex">
                <div className="w-80 border-r border-white/5">
                  {!analysisData ? (
                    <div className="p-4 text-slate-600 text-center text-sm">
                      Import a repository first to explore files.
                    </div>
                  ) : (
                    <FileTree 
                      files={analysisData.files}
                      selectedFile={selectedFile?.path || null}
                      onFileSelect={(file) => setSelectedFile(file)}
                    />
                  )}
                </div>
                <div className="flex-1 pl-6">
                  <CodeViewer file={selectedFile} repoPath={repoPathInput} />
                </div>
              </motion.div>
            )}

            {activeTab === "Architecture" && (
              <motion.div key="Architecture" variants={TAB_VARIANTS} initial="initial" animate="animate" exit="exit">
                {!analysisData ? (
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <h1 className="text-2xl font-light tracking-tight text-white mb-2">Architecture Overview</h1>
                    <p className="text-sm text-slate-500 mb-8">Structural layers, coupling heatmap, and complexity distribution.</p>
                    <div className="flex items-center justify-center p-12 rounded-xl border border-white/5 bg-[#050505] text-slate-600">
                      Import a repository to analyze its architecture.
                    </div>
                  </div>
                ) : (
                  <ArchitectureOverview analysisData={analysisData} />
                )}
              </motion.div>
            )}

            {activeTab === "Project Structure" && (
              <motion.div key="Project Structure" variants={TAB_VARIANTS} initial="initial" animate="animate" exit="exit" className="h-[600px] flex flex-col">
                <div className="mb-4">
                  <h1 className="text-2xl font-light tracking-tight text-white mb-2">Project Structure</h1>
                  <p className="text-sm text-slate-500">Working tree with annotations for every file and folder.</p>
                </div>
                <div className="flex-1 min-h-0">
                  <ProjectTree analysisData={analysisData} />
                </div>
              </motion.div>
            )}

            {activeTab === "AI Chat" && (
              <motion.div key="AI Chat" variants={TAB_VARIANTS} initial="initial" animate="animate" exit="exit" className="h-[600px] flex flex-col">
                <h1 className="text-2xl font-light tracking-tight text-white mb-6">Ask Prometheus</h1>

                <div className="flex-1 rounded-xl border border-white/5 bg-[#050505] p-6 mb-4 overflow-y-auto space-y-6">
                  {!analysisData ? (
                    <div className="flex h-full items-center justify-center text-slate-600">
                      Import a repository first to begin chatting about it.
                    </div>
                  ) : chatHistory.length === 0 ? (
                    <div className="flex flex-col h-full items-center justify-center text-center px-8">
                      <p className="text-slate-500 mb-6">I&apos;m Prometheus. I&apos;ve analyzed your {analysisData.metrics.files} files. What would you like to know?</p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {SUGGESTED_PROMPTS.map((p) => (
                          <button
                            key={p}
                            onClick={() => handleAIQuery(p)}
                            className="text-xs px-3 py-2 rounded-full border border-white/10 text-slate-400 hover:border-orange-500/40 hover:text-orange-300 hover:bg-orange-500/5 transition-all"
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    chatHistory.map((msg, idx) => (
                      <div key={idx} className="flex gap-4">
                        <div className={`h-8 w-8 rounded flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-slate-800 text-white' : 'bg-cyan-500/20 text-cyan-400'
                          }`}>
                          {msg.role === 'user' ? 'U' : <Sparkles size={16} />}
                        </div>
                        <div>
                          {msg.role === 'user' ? (
                            <p className="text-sm text-slate-200 mt-1">{msg.content}</p>
                          ) : (
                            <div className="text-sm text-slate-300 leading-relaxed space-y-3 whitespace-pre-wrap">
                              {msg.content}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}

                  {isChatLoading && (
                    <div className="flex gap-4">
                      <div className="h-8 w-8 rounded bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0 flex-shrink-0">
                        <Flame size={14} className="text-orange-400" />
                      </div>
                      <div className="flex items-center gap-1 mt-3">
                        {[0, 1, 2].map((i) => (
                          <div
                            key={i}
                            className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-bounce"
                            style={{ animationDelay: `${i * 0.15}s` }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <form onSubmit={handleChatSubmit} className="relative">
                  <input
                    type="text"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    disabled={!analysisData || isChatLoading}
                    placeholder={analysisData ? "Ask about your codebase..." : "Import repository first..."}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-lg py-4 pl-4 pr-12 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={!analysisData || isChatLoading || !chatMessage.trim()}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-md text-slate-400 hover:text-cyan-400 hover:bg-white/5 disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                  >
                    <Sparkles size={16} />
                  </button>
                </form>
              </motion.div>
            )}

            {activeTab === "Impact Analyzer" && (
              <motion.div key="Impact Analyzer" variants={TAB_VARIANTS} initial="initial" animate="animate" exit="exit">
              <ImpactAnalysis analysisData={analysisData} />
              </motion.div>
            )}

            {activeTab === "Settings" && (
              <motion.div key="Settings" variants={TAB_VARIANTS} initial="initial" animate="animate" exit="exit">
                <h1 className="text-2xl font-light tracking-tight text-white mb-6">Settings</h1>
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6 text-sm text-slate-400">
                  Configuration options will appear here.
                </div>
              </motion.div>
            )}            </AnimatePresence>
          </div>
        </div>
      </section>
      
      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPalette.isOpen}
        onClose={commandPalette.close}
        analysisData={analysisData}
        onFileSelect={(file) => {
          setSelectedFile(file);
          setActiveTab('File Explorer');
        }}
        onAIQuery={handleAIQuery}
        onNavigateToTab={(tab) => setActiveTab(tab as NavItem)}
      />
    </main>
  );
}
