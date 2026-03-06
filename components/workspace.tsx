"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { BrainCircuit, FolderTree, GitGraph, LayoutDashboard, SearchCode, Settings, Sparkles, FolderCode, Loader2 } from "lucide-react";
import { ReactFlow, MiniMap, Controls, Background, useNodesState, useEdgesState, type Node, type Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { FileTree } from "./file-tree";
import { CodeViewer } from "./code-viewer";
import { CommandPalette, useCommandPalette } from "./command-palette";
import { ImpactAnalysis } from "./impact-analysis";
import { ArchitectureOverview } from "./architecture-overview";
import { MarkdownRenderer } from "./markdown-renderer";

type NavItem = "Dashboard" | "Architecture" | "Graph Explorer" | "AI Chat" | "Impact Analyzer" | "File Explorer" | "Settings";

const navItems: { label: NavItem; icon: React.ElementType }[] = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "File Explorer", icon: FolderCode },
  { label: "Architecture", icon: FolderTree },
  { label: "Graph Explorer", icon: GitGraph },
  { label: "AI Chat", icon: BrainCircuit },
  { label: "Impact Analyzer", icon: SearchCode },
  { label: "Settings", icon: Settings }
];

type FlowNodeData = {
  label: string;
  complexity?: number;
  size?: number;
};

type FlowNode = Node<FlowNodeData>;
type FlowEdge = Edge;

type AnalyzerGraphNode = {
  id: string;
  label: string;
  type: 'file' | 'function' | 'external';
  group?: string;
  complexity?: number;
  size?: number;
};

type AnalyzerGraphEdge = {
  id: string;
  source: string;
  target: string;
  type: 'imports' | 'calls';
  weight: number;
};

const generateGraphLayout = (nodes: AnalyzerGraphNode[], edges: AnalyzerGraphEdge[]): FlowNode[] => {
  // Group nodes by directory for better clustering  
  const nodesByGroup = nodes.reduce<Record<string, AnalyzerGraphNode[]>>((acc, node) => {
    const group = node.group || 'root';
    if (!acc[group]) acc[group] = [];
    acc[group].push(node);
    return acc;
  }, {});
  
  let globalY = 0;
  const positioned: FlowNode[] = [];

  Object.entries(nodesByGroup).forEach(([group, groupNodes]) => {
    groupNodes.forEach((node: AnalyzerGraphNode, idx: number) => {
      const isExternal = node.type === 'external';
      const complexity = node.complexity ?? 0;
      positioned.push({
        ...node,
        data: { 
          label: node.label || node.id.split('/').pop() || node.id,
          complexity: node.complexity,
          size: node.size
        },
        position: { 
          x: (idx % 4) * 220 + Math.random() * 15,
          y: globalY + Math.floor(idx / 4) * 100 + Math.random() * 15
        },
        style: {
          background: isExternal ? '#374151' : complexity > 10 ? '#dc2626' : complexity > 5 ? '#f59e0b' : '#1e293b',
          color: '#e2e8f0',
          border: isExternal ? '1px solid #6b7280' : '1px solid #334155',
          borderRadius: '6px',
          padding: '6px 10px',
          fontSize: '10px',
          minWidth: '120px'
        },
        className: isExternal ? 'external-node' : 'file-node'
      });
    });
    globalY += Math.ceil(groupNodes.length / 4) * 100 + 60;
  });
  
  return positioned;
};

// Helper function to filter and simplify the graph
const filterGraph = (nodes: FlowNode[], edges: FlowEdge[], filter: string, maxConnections: number, showOnlyDirectDeps: boolean): { nodes: FlowNode[]; edges: FlowEdge[] } => {
  let filteredNodes = nodes;
  let filteredEdges = edges;
  
  // Text filter
  if (filter.trim()) {
    filteredNodes = nodes.filter((node: FlowNode) => 
      (node.data?.label || node.id).toLowerCase().includes(filter.toLowerCase())
    );
    const nodeIds = new Set(filteredNodes.map((n: FlowNode) => n.id));
    filteredEdges = edges.filter((edge: FlowEdge) => 
      nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );
  }
  
  // Limit connections per node to reduce visual complexity
  if (maxConnections > 0) {
    const connectionCounts = new Map();
    const limitedEdges: FlowEdge[] = [];
    
    for (const edge of filteredEdges) {
      const sourceCount = connectionCounts.get(edge.source) || 0;
      const targetCount = connectionCounts.get(edge.target) || 0;
      
      if (sourceCount < maxConnections && targetCount < maxConnections) {
        limitedEdges.push(edge);
        connectionCounts.set(edge.source, sourceCount + 1);
        connectionCounts.set(edge.target, targetCount + 1);
      }
    }
    filteredEdges = limitedEdges;
  }
  
  // Remove isolated nodes after filtering edges
  const connectedNodeIds = new Set();
  filteredEdges.forEach((edge: FlowEdge) => {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  });
  
  if (!filter.trim()) { // Only remove isolated nodes if no search filter
    filteredNodes = filteredNodes.filter((node: FlowNode) => connectedNodeIds.has(node.id));
  }
  
  return { nodes: filteredNodes, edges: filteredEdges };
};



export function Workspace() {
  const [activeTab, setActiveTab] = useState<NavItem>("Dashboard");
  const [repoPathInput, setRepoPathInput] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisData, setAnalysisData] = useState<any>(null);

  // ReactFlow state
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([]);
  const [graphFilter, setGraphFilter] = useState('');
  const [maxConnections, setMaxConnections] = useState(3);
  const [showOnlyDirectDeps, setShowOnlyDirectDeps] = useState(true);

  // AI Chat State
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai', content: string }[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // File Explorer State
  const [selectedFile, setSelectedFile] = useState<any>(null);

  // Codebase Explanation State
  const [codebaseExplanation, setCodebaseExplanation] = useState<string | null>(null);
  const [isExplanationLoading, setIsExplanationLoading] = useState(false);
  
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
        body: JSON.stringify({ message, context: data }),
      });
      const result = await res.json();
      if (result.success) {
        setCodebaseExplanation(result.reply);
      } else {
        setCodebaseExplanation('Failed to generate explanation: ' + (result.error || 'Unknown error'));
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

  // Store raw graph data for filtering
  const [rawGraphData, setRawGraphData] = useState<{ nodes: FlowNode[]; edges: FlowEdge[] } | null>(null);

  // Effect to re-filter graph when controls change
  useEffect(() => {
    if (rawGraphData && analysisData) {
      const { nodes: filteredNodes, edges: filteredEdges } = filterGraph(
        rawGraphData.nodes, 
        rawGraphData.edges, 
        graphFilter, 
        maxConnections, 
        showOnlyDirectDeps
      );
      setNodes(filteredNodes);
      setEdges(filteredEdges);
    }
  }, [analysisData, graphFilter, maxConnections, showOnlyDirectDeps, rawGraphData, setNodes, setEdges]);

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

        // Format data for ReactFlow with enhanced layout and filtering
        if (data.data.graph) {
          const rawNodes = generateGraphLayout(data.data.graph.nodes, data.data.graph.edges);
          const rawEdges: FlowEdge[] = (data.data.graph.edges as AnalyzerGraphEdge[]).map((e: AnalyzerGraphEdge) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            animated: e.type === 'calls',
            style: { 
              stroke: e.type === 'calls' ? '#f59e0b' : '#06b6d4',
              strokeWidth: Math.min(e.weight || 1, 3)
            },
            label: e.type === 'calls' ? 'calls' : '',
            labelStyle: { fontSize: '10px', fill: '#94a3b8' }
          }));
          
          // Store raw data for filtering
          setRawGraphData({ nodes: rawNodes, edges: rawEdges });
          
          // Apply initial filtering (limit connections to reduce initial complexity)
          const { nodes: filteredNodes, edges: filteredEdges } = filterGraph(rawNodes, rawEdges, graphFilter, maxConnections, showOnlyDirectDeps);
          setNodes(filteredNodes);
          setEdges(filteredEdges);
        }

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
        <div className="mb-8 flex items-center gap-2 px-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-cyan-500/20 text-cyan-400">
            <Sparkles size={14} />
          </div>
          <span className="text-sm font-medium tracking-wide text-slate-200">PROMETHEUS</span>
        </div>

        <button
          onClick={() => { setAnalysisData(null); setCodebaseExplanation(null); setActiveTab("Dashboard"); }}
          className="mb-6 flex w-full items-center justify-center gap-2 rounded-md bg-white/5 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10"
        >
          <span className="text-lg leading-none">+</span> Import Repository
        </button>

        <nav className="flex-1 space-y-1">
          {navItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              onClick={() => setActiveTab(label)}
              className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-all duration-200 ${activeTab === label
                ? "bg-cyan-500/10 text-cyan-400 font-medium"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
            >
              <Icon size={16} className={activeTab === label ? "text-cyan-400" : "text-slate-500"} />
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
            {activeTab === "Dashboard" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <h1 className="text-2xl font-light tracking-tight text-white mb-8">Repository Overview</h1>

                {!analysisData ? (
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-8 max-w-xl">
                    <h2 className="text-lg font-medium text-slate-200 mb-2">Import Repository</h2>
                    <p className="text-sm text-slate-400 mb-6">Enter a GitHub URL or the absolute path to a local codebase to begin analysis.</p>

                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-1.5 block">Repository URL / Path</label>
                        <input
                          type="text"
                          value={repoPathInput}
                          onChange={(e) => setRepoPathInput(e.target.value)}
                          placeholder="e.g. https://github.com/lucide-icons/lucide or C:\path"
                          className="w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                        />
                      </div>
                      <button
                        onClick={handleAnalyze}
                        disabled={isAnalyzing || !repoPathInput}
                        className="flex w-full items-center justify-center gap-2 rounded-md bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-400 transition-colors hover:bg-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isAnalyzing ? (
                          <><Loader2 size={16} className="animate-spin" /> Analyzing...</>
                        ) : (
                          <><Sparkles size={16} /> Analyze Repository</>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-6 gap-4 mb-12">
                      <div className="flex flex-col rounded-xl border border-white/5 bg-white/[0.02] p-5">
                        <span className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">Files</span>
                        <span className="text-3xl font-light text-slate-200">{analysisData.metrics.files}</span>
                      </div>
                      <div className="flex flex-col rounded-xl border border-white/5 bg-white/[0.02] p-5">
                        <span className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">Functions</span>
                        <span className="text-3xl font-light text-slate-200">{analysisData.metrics.functions}</span>
                      </div>
                      <div className="flex flex-col rounded-xl border border-white/5 bg-white/[0.02] p-5">
                        <span className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">Classes</span>
                        <span className="text-3xl font-light text-slate-200">{analysisData.metrics.classes}</span>
                      </div>
                      <div className="flex flex-col rounded-xl border border-white/5 bg-white/[0.02] p-5">
                        <span className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">Dependencies</span>
                        <span className="text-3xl font-light text-slate-200">{analysisData.metrics.dependencies}</span>
                      </div>
                      <div className="flex flex-col rounded-xl border border-white/5 bg-white/[0.02] p-5">
                        <span className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">Resolved</span>
                        <span className="text-3xl font-light text-slate-200">{analysisData.metrics.resolvedImports}</span>
                        <span className="text-xs text-slate-500">{Math.round((analysisData.metrics.resolvedImports / Math.max(analysisData.metrics.dependencies, 1)) * 100)}%</span>
                      </div>
                      <div className="flex flex-col rounded-xl border border-white/5 bg-white/[0.02] p-5">
                        <span className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">Calls</span>
                        <span className="text-3xl font-light text-slate-200">{analysisData.metrics.functionCalls || 0}</span>
                      </div>
                    </div>

                    <h2 className="text-lg font-medium text-slate-200 mb-4">Codebase Overview</h2>
                    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6">
                      {isExplanationLoading ? (
                        <div className="space-y-4 animate-pulse">
                          <div className="flex items-center gap-3 mb-4">
                            <Loader2 size={16} className="animate-spin text-cyan-400" />
                            <span className="text-sm text-slate-400">Generating codebase overview with AI...</span>
                          </div>
                          <div className="space-y-3">
                            <div className="h-4 bg-white/5 rounded w-3/4"></div>
                            <div className="h-4 bg-white/5 rounded w-full"></div>
                            <div className="h-4 bg-white/5 rounded w-5/6"></div>
                            <div className="h-4 bg-white/5 rounded w-2/3"></div>
                            <div className="h-3 bg-white/5 rounded w-0 mt-4"></div>
                            <div className="h-4 bg-white/5 rounded w-4/5"></div>
                            <div className="h-4 bg-white/5 rounded w-full"></div>
                            <div className="h-4 bg-white/5 rounded w-3/5"></div>
                          </div>
                        </div>
                      ) : codebaseExplanation ? (
                        <MarkdownRenderer content={codebaseExplanation} />
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
              </div>
            )}

            {activeTab === "File Explorer" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 h-[600px] flex">
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
              </div>
            )}

            {activeTab === "Architecture" && (
              <div>
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
              </div>
            )}

            {activeTab === "Graph Explorer" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 h-[600px] flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h1 className="text-2xl font-light tracking-tight text-white mb-2">Dependency Graph</h1>
                    <p className="text-sm text-slate-500">Interactive visualization of module imports and calls.</p>
                  </div>
                  
                  {/* Graph Controls */}
                  {analysisData && (
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <label className="text-slate-400">Filter:</label>
                        <input
                          type="text"
                          value={graphFilter}
                          onChange={(e) => setGraphFilter(e.target.value)}
                          placeholder="Search nodes..."
                          className="px-2 py-1 bg-white/5 border border-white/10 rounded text-white text-xs w-32 focus:outline-none focus:border-cyan-500/50"
                        />
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <label className="text-slate-400">Max connections:</label>
                        <select
                          value={maxConnections}
                          onChange={(e) => setMaxConnections(Number(e.target.value))}
                          className="px-2 py-1 bg-white/5 border border-white/10 rounded text-white text-xs focus:outline-none focus:border-cyan-500/50"
                        >
                          <option value={0}>All</option>
                          <option value={2}>2</option>
                          <option value={3}>3</option>
                          <option value={5}>5</option>
                          <option value={10}>10</option>
                        </select>
                      </div>

                      <button
                        onClick={() => {
                          setGraphFilter('');
                          setMaxConnections(3);
                          setShowOnlyDirectDeps(true);
                        }}
                        className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded transition-colors"
                      >
                        Reset
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex-1 rounded-xl border border-white/5 bg-[#050505] relative overflow-hidden">
                  {!analysisData ? (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-600">
                      Import a repository to view the graph.
                    </div>
                  ) : (
                    <div style={{ width: '100%', height: '100%' }}>
                      <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        fitView
                        colorMode="dark"
                        maxZoom={2}
                        minZoom={0.1}
                      >
                        <Controls style={{ padding: '4px', backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                        <MiniMap
                          nodeColor="#334155"
                          maskColor="rgb(15, 23, 42, 0.7)"
                          style={{ backgroundColor: '#020617', border: '1px solid #1e293b' }}
                        />
                        <Background color="#334155" gap={24} size={1} />
                      </ReactFlow>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "AI Chat" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 h-[600px] flex flex-col">
                <h1 className="text-2xl font-light tracking-tight text-white mb-6">Ask Prometheus</h1>

                <div className="flex-1 rounded-xl border border-white/5 bg-[#050505] p-6 mb-4 overflow-y-auto space-y-6">
                  {!analysisData ? (
                    <div className="flex h-full items-center justify-center text-slate-600">
                      Import a repository first to begin chatting about it.
                    </div>
                  ) : chatHistory.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-slate-500 text-center px-12">
                      <p>I&apos;m Prometheus. I&apos;ve analyzed your {analysisData.metrics.files} files. What would you like to know about this repository?</p>
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
                      <div className="h-8 w-8 rounded bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                        <Loader2 size={16} className="animate-spin" />
                      </div>
                      <div className="text-sm text-slate-500 mt-1 animate-pulse">Thinking...</div>
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
              </div>
            )}

            {activeTab === "Impact Analyzer" && (
              <ImpactAnalysis analysisData={analysisData} />
            )}

            {activeTab === "Settings" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <h1 className="text-2xl font-light tracking-tight text-white mb-6">Settings</h1>
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6 text-sm text-slate-400">
                  Configuration options will appear here.
                </div>
              </div>
            )}

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
