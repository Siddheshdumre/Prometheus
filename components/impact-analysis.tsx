"use client";

import { useState, useMemo, useEffect } from "react";
import { Search, AlertTriangle, TrendingUp, FileText, Code2, Target, Zap, GitCommit, Users } from "lucide-react";

interface ImpactAnalysisProps {
    analysisData: any;
    repoPath?: string;
}

interface ImpactResult {
    entity: {
        name: string;
        type: 'file' | 'function';
        path: string;
    };
    directImpacts: Array<{
        name: string;
        path: string;
        type: 'file' | 'function';
        impactType: 'breaking' | 'risky' | 'safe';
        reason: string;
        complexity?: number;
    }>;
    indirectImpacts: Array<{
        name: string;
        path: string;
        type: 'file' | 'function';
        depth: number;
        impactType: 'breaking' | 'risky' | 'safe';
        reason: string;
    }>;
    riskLevel: 'low' | 'medium' | 'high';
    riskScore: number;
    riskFactors: string[];
    centrality: number;
    summary: {
        totalAffected: number;
        filesAffected: number;
        functionsAffected: number;
    };
}

// ─── Dependency graph helpers ───────────────────────────────────────────────

function buildDependencyIndex(data: any) {
    // reverseIndex[file] = set of files that import `file`
    // forwardIndex[file] = set of files that `file` imports
    const reverseIndex = new Map<string, Set<string>>();
    const forwardIndex = new Map<string, Set<string>>();

    if (data.graph?.edges) {
        for (const edge of data.graph.edges) {
            if (edge.type !== 'imports') continue;
            if (edge.target.startsWith('external:')) continue;
            // edge.source imports edge.target
            if (!reverseIndex.has(edge.target)) reverseIndex.set(edge.target, new Set());
            reverseIndex.get(edge.target)!.add(edge.source);
            if (!forwardIndex.has(edge.source)) forwardIndex.set(edge.source, new Set());
            forwardIndex.get(edge.source)!.add(edge.target);
        }
    }
    return { reverseIndex, forwardIndex };
}

/** BFS outward through reverseIndex. Returns map of file→depth reached. */
function bfsImpact(startFile: string, reverseIndex: Map<string, Set<string>>, maxDepth = 5) {
    const result = new Map<string, number>(); // file → depth
    let frontier = new Set(reverseIndex.get(startFile) || []);
    let depth = 1;
    while (frontier.size > 0 && depth <= maxDepth) {
        const next = new Set<string>();
        for (const f of frontier) {
            if (result.has(f) || f === startFile) continue;
            result.set(f, depth);
            for (const importer of (reverseIndex.get(f) || [])) {
                if (!result.has(importer) && importer !== startFile) next.add(importer);
            }
        }
        frontier = next;
        depth++;
    }
    return result;
}

// ─── analyzeFileImpact ───────────────────────────────────────────────────────

function analyzeFileImpact(filePath: string, data: any): ImpactResult {
    const { reverseIndex } = buildDependencyIndex(data);
    const fileInfo = data.files?.find((f: any) => f.path === filePath);

    // Direct importers (depth-1 dependents)
    const directImporterSet = reverseIndex.get(filePath) || new Set<string>();
    const directImpacts: ImpactResult['directImpacts'] = [];

    for (const importer of directImporterSet) {
        const importerInfo = data.files?.find((f: any) => f.path === importer);
        directImpacts.push({
            name: importer.split('/').pop() || importer,
            path: importer,
            type: 'file',
            impactType: 'breaking',
            reason: `Directly imports ${filePath.split('/').pop()}`,
            complexity: importerInfo?.complexity ?? 0,
        });
    }

    // Also surface files that call functions in this file but don't import it
    // (edge case: re-exported via barrel)
    if (data.functionCalls) {
        for (const call of data.functionCalls) {
            if (call.targetFile === filePath && call.callerFile !== filePath) {
                if (!directImpacts.find(d => d.path === call.callerFile)) {
                    directImpacts.push({
                        name: call.callerFile.split('/').pop() || call.callerFile,
                        path: call.callerFile,
                        type: 'file',
                        impactType: 'breaking',
                        reason: `Calls \`${call.target}\` defined here`,
                    });
                }
            }
        }
    }

    // Indirect impacts (depth 2–5 via BFS)
    const allImpacted = bfsImpact(filePath, reverseIndex, 5);
    const indirectImpacts: ImpactResult['indirectImpacts'] = [];
    for (const [impFile, depth] of allImpacted) {
        if (directImporterSet.has(impFile)) continue; // already in direct
        indirectImpacts.push({
            name: impFile.split('/').pop() || impFile,
            path: impFile,
            type: 'file',
            depth,
            impactType: depth <= 2 ? 'risky' : 'safe',
            reason: `Transitive dependent — ${depth} hops from change`,
        });
    }

    // Risk scoring
    const centrality = directImporterSet.size;
    const totalAffected = directImpacts.length + indirectImpacts.length;
    const complexity = fileInfo?.complexity ?? 0;
    const exportsCount = fileInfo?.exports?.length ?? 0;
    const isSharedLib =
        filePath.includes('lib/') ||
        filePath.includes('utils/') ||
        filePath.includes('hooks/') ||
        filePath.includes('helpers/') ||
        filePath.includes('shared/');
    const isConfig = filePath.includes('config') || filePath.includes('constants');

    let riskScore = 0;
    riskScore += centrality * 5;          // each direct dependent = 5 pts
    riskScore += Math.min(totalAffected, 25);  // indirect capped at 25 pts
    riskScore += complexity > 20 ? 6 : complexity > 10 ? 3 : 0;
    riskScore += isSharedLib ? 8 : 0;
    riskScore += isConfig ? 5 : 0;
    riskScore += exportsCount > 5 ? 5 : exportsCount > 2 ? 2 : 0;

    const riskLevel: ImpactResult['riskLevel'] =
        riskScore >= 25 ? 'high' : riskScore >= 8 ? 'medium' : 'low';

    const riskFactors: string[] = [];
    if (centrality === 0) riskFactors.push('No direct importers — leaf file');
    if (centrality > 0) riskFactors.push(`${centrality} file${centrality > 1 ? 's' : ''} directly import this`);
    if (totalAffected > centrality) riskFactors.push(`${totalAffected - centrality} additional transitive dependents`);
    if (isSharedLib) riskFactors.push('Shared library / utility file');
    if (isConfig) riskFactors.push('Configuration / constants file');
    if (exportsCount > 2) riskFactors.push(`Exports ${exportsCount} public symbols`);
    if (complexity > 10) riskFactors.push(`Cyclomatic complexity ${complexity}`);

    return {
        entity: { name: filePath.split('/').pop() || filePath, type: 'file', path: filePath },
        directImpacts,
        indirectImpacts,
        riskLevel,
        riskScore,
        riskFactors,
        centrality,
        summary: { totalAffected, filesAffected: countAffectedFiles(directImpacts, indirectImpacts), functionsAffected: 0 },
    };
}

// Small helper to count unique files
function countAffectedFiles(direct: any[], indirect: any[]) {
    return new Set([...direct.map(d => d.path), ...indirect.map(d => d.path)]).size;
}

// ─── analyzeFunctionImpact ───────────────────────────────────────────────────

function analyzeFunctionImpact(filePath: string, functionName: string, data: any): ImpactResult {
    const { reverseIndex } = buildDependencyIndex(data);
    const fileInfo = data.files?.find((f: any) => f.path === filePath);
    const funcInfo = fileInfo?.functions?.find((fn: any) => fn.name === functionName);
    const isExported = fileInfo?.exports?.includes(functionName) ?? false;

    const directImpacts: ImpactResult['directImpacts'] = [];
    const seen = new Set<string>(); // deduplicate by caller+path key

    // 1. Direct call-graph callers
    if (data.functionCalls) {
        for (const call of data.functionCalls) {
            if (call.target !== functionName || call.targetFile !== filePath) continue;
            const key = `${call.caller}@${call.callerFile}`;
            if (seen.has(key)) continue;
            seen.add(key);
            directImpacts.push({
                name: call.caller,
                path: call.callerFile,
                type: 'function',
                impactType: 'breaking',
                reason: `Calls \`${functionName}\` in ${call.callerFile.split('/').pop()}`,
            });
        }
    }

    // 2. Files that import this function by name
    if (isExported) {
        for (const importer of (reverseIndex.get(filePath) || [])) {
            if (!directImpacts.find(d => d.path === importer)) {
                const importerInfo = data.files?.find((f: any) => f.path === importer);
                const namedImport = importerInfo?.imports?.some(
                    (imp: any) => imp.importedMembers?.includes(functionName)
                );
                if (namedImport) {
                    directImpacts.push({
                        name: importer.split('/').pop() || importer,
                        path: importer,
                        type: 'file',
                        impactType: 'breaking',
                        reason: `Imports \`${functionName}\` by name`,
                    });
                }
            }
        }
    }

    // 3. Indirect: files that import the callers (1 extra hop)
    const indirectImpacts: ImpactResult['indirectImpacts'] = [];
    const directPaths = new Set(directImpacts.map(d => d.path));
    for (const callerPath of directPaths) {
        for (const transitive of (reverseIndex.get(callerPath) || [])) {
            if (!directPaths.has(transitive) && transitive !== filePath) {
                if (!indirectImpacts.find(i => i.path === transitive)) {
                    indirectImpacts.push({
                        name: transitive.split('/').pop() || transitive,
                        path: transitive,
                        type: 'file',
                        depth: 2,
                        impactType: 'risky',
                        reason: `Imports a file that calls \`${functionName}\``,
                    });
                }
            }
        }
    }

    // Risk scoring
    const directCallerCount = directImpacts.filter(d => d.type === 'function').length;
    const directFileCount = directImpacts.filter(d => d.type === 'file').length;
    const complexity = funcInfo?.complexity ?? 0;
    const totalAffected = directImpacts.length + indirectImpacts.length;

    let riskScore = 0;
    riskScore += directCallerCount * 4;
    riskScore += directFileCount * 5;
    riskScore += Math.min(indirectImpacts.length, 15);
    riskScore += isExported ? 6 : 0;
    riskScore += complexity > 15 ? 5 : complexity > 7 ? 2 : 0;

    const riskLevel: ImpactResult['riskLevel'] =
        riskScore >= 20 ? 'high' : riskScore >= 7 ? 'medium' : 'low';

    const riskFactors: string[] = [];
    if (isExported) riskFactors.push('Exported function — public API surface');
    if (directCallerCount > 0) riskFactors.push(`Called directly by ${directCallerCount} function${directCallerCount > 1 ? 's' : ''}`);
    if (directFileCount > 0) riskFactors.push(`Imported by name in ${directFileCount} file${directFileCount > 1 ? 's' : ''}`);
    if (indirectImpacts.length > 0) riskFactors.push(`${indirectImpacts.length} transitive downstream files`);
    if (complexity > 7) riskFactors.push(`Cyclomatic complexity ${complexity}`);
    if (directCallerCount === 0 && !isExported) riskFactors.push('Private function — no external callers detected');

    return {
        entity: { name: functionName, type: 'function', path: filePath },
        directImpacts,
        indirectImpacts,
        riskLevel,
        riskScore,
        riskFactors,
        centrality: directCallerCount + directFileCount,
        summary: {
            totalAffected,
            filesAffected: new Set([...directImpacts.filter(d => d.type === 'file').map(d => d.path), ...indirectImpacts.map(d => d.path)]).size,
            functionsAffected: directCallerCount,
        },
    };
}

export function ImpactAnalysis({ analysisData, repoPath }: ImpactAnalysisProps) {
    const [selectedEntity, setSelectedEntity] = useState<string>("");
    const [searchQuery, setSearchQuery] = useState("");
    const [fileGitData, setFileGitData] = useState<any>(null);
    const [isFileGitLoading, setIsFileGitLoading] = useState(false);

    // Fetch per-file git history when entity changes
    useEffect(() => {
        if (!selectedEntity || !repoPath) { setFileGitData(null); return; }
        const parts = selectedEntity.split(":");
        const filePath = parts[1];
        if (!filePath) return;
        setIsFileGitLoading(true);
        setFileGitData(null);
        fetch("/api/git/history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ repoPath, filePath }),
        })
            .then(r => r.json())
            .then(d => d?.isGitRepo ? setFileGitData(d) : null)
            .catch(() => null)
            .finally(() => setIsFileGitLoading(false));
    }, [selectedEntity, repoPath]);

    // Create searchable list of all entities (files + functions)
    const searchableEntities = useMemo(() => {
        if (!analysisData) return [];

        const entities: Array<{ id: string; name: string; type: 'file' | 'function'; path: string; }> = [];

        // Add files
        if (analysisData.files) {
            analysisData.files.forEach((file: any) => {
                entities.push({
                    id: `file:${file.path}`,
                    name: file.path.split('/').pop() || file.path,
                    type: 'file',
                    path: file.path
                });

                // Add functions from this file
                if (file.functions) {
                    file.functions.forEach((func: any) => {
                        entities.push({
                            id: `function:${file.path}:${func.name}`,
                            name: func.name,
                            type: 'function',
                            path: file.path
                        });
                    });
                }
            });
        }

        return entities.filter(entity => 
            entity.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            entity.path.toLowerCase().includes(searchQuery.toLowerCase())
        ).slice(0, 20);
    }, [analysisData, searchQuery]);

    // Pre-ranked suggestions: top 5 files by number of importers
    const suggestions = useMemo(() => {
        if (!analysisData?.files) return [];
        const { reverseIndex } = buildDependencyIndex(analysisData);
        return [...analysisData.files]
            .sort((a: any, b: any) => (reverseIndex.get(b.path)?.size ?? 0) - (reverseIndex.get(a.path)?.size ?? 0))
            .slice(0, 5)
            .map((file: any) => ({
                id: `file:${file.path}`,
                name: file.path.split('/').pop() || file.path,
                path: file.path,
                importerCount: reverseIndex.get(file.path)?.size ?? 0,
            }));
    }, [analysisData]);

    // Calculate impact analysis for selected entity
    const impactResult = useMemo(() => {
        if (!selectedEntity || !analysisData) return null;

        const parts = selectedEntity.split(':');
        const entityType = parts[0];
        const entityPath = parts[1];
        const entityName = parts[2];
        
        if (entityType === 'file') {
            return analyzeFileImpact(entityPath, analysisData);
        } else if (entityType === 'function') {
            return analyzeFunctionImpact(entityPath, entityName, analysisData);
        }

        return null;
    }, [selectedEntity, analysisData]);

    if (!analysisData) {
        return (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <h1 className="text-2xl font-light tracking-tight text-white mb-2">Impact Analysis</h1>
                <p className="text-sm text-slate-500 mb-8">Analyze change impact across your codebase</p>

                <div className="flex items-center justify-center p-12 rounded-xl border border-white/5 bg-[#050505] text-slate-600">
                    Import a repository to analyze change impacts.
                </div>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <h1 className="text-2xl font-light tracking-tight text-white mb-2">Impact Analysis</h1>
            <p className="text-sm text-slate-500 mb-8">See what breaks downstream when you change a file or function</p>

            <div className="space-y-6">
                {/* Entity Selection */}
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6">
                    <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                        <Target size={20} className="text-cyan-400" />
                        Select Entity to Analyze
                    </h2>
                    
                    <div className="space-y-4">
                        {/* Active selection banner */}
                        {selectedEntity && impactResult && (
                            <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-cyan-400">
                                    {impactResult.entity.type === 'file' ? <FileText size={14} /> : <Code2 size={14} />}
                                    <span className="font-medium text-sm">Analyzing: {impactResult.entity.name}</span>
                                    {impactResult.entity.type === 'function' && (
                                        <span className="text-xs text-slate-400">in {impactResult.entity.path}</span>
                                    )}
                                </div>
                                <button
                                    onClick={() => { setSelectedEntity(""); setSearchQuery(""); }}
                                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-2 py-0.5 rounded border border-white/10 hover:border-white/20"
                                >
                                    Change
                                </button>
                            </div>
                        )}

                        {/* Suggestions or search when no entity selected */}
                        {!selectedEntity && (
                            <>
                                {/* Pre-populated suggestions */}
                                {!searchQuery && (
                                    <div className="rounded-lg border border-white/5 overflow-hidden">
                                        <div className="px-3 py-2 bg-white/[0.02] border-b border-white/5">
                                            <span className="text-xs text-slate-500 uppercase tracking-wider">Top files by dependency impact</span>
                                        </div>
                                        {suggestions.map((entity) => (
                                            <button
                                                key={entity.id}
                                                onClick={() => setSelectedEntity(entity.id)}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5 transition-colors border-b border-white/[0.03] last:border-0"
                                            >
                                                <FileText size={14} className="text-green-400 shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm text-white truncate">{entity.name}</div>
                                                    <div className="text-xs text-slate-500 truncate">{entity.path}</div>
                                                </div>
                                                {entity.importerCount > 0 && (
                                                    <span className="text-xs text-slate-600 shrink-0">{entity.importerCount} dep{entity.importerCount !== 1 ? 's' : ''}</span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Search box */}
                                <div className="relative">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                    <input
                                        type="text"
                                        placeholder="Search all files and functions..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
                                    />
                                </div>

                                {/* Search results */}
                                {searchQuery && (
                                    <div className="max-h-48 overflow-y-auto rounded-lg border border-white/5 bg-white/[0.02]">
                                        {searchableEntities.map((entity) => (
                                            <button
                                                key={entity.id}
                                                onClick={() => {
                                                    setSelectedEntity(entity.id);
                                                    setSearchQuery("");
                                                }}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5 transition-colors border-b border-white/[0.03] last:border-0"
                                            >
                                                {entity.type === 'file' ? (
                                                    <FileText size={14} className="text-green-400 shrink-0" />
                                                ) : (
                                                    <Code2 size={14} className="text-blue-400 shrink-0" />
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm text-white truncate">{entity.name}</div>
                                                    <div className="text-xs text-slate-500 truncate">{entity.path}</div>
                                                </div>
                                            </button>
                                        ))}
                                        {searchableEntities.length === 0 && (
                                            <div className="px-3 py-4 text-center text-slate-500 text-sm">
                                                No entities found
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Impact Results */}
                {impactResult && (
                    <div className="space-y-6">
                        {/* Summary */}
                        <div className="grid grid-cols-5 gap-4">
                            <div className={`rounded-xl border p-4 ${
                                impactResult.riskLevel === 'high' ? 'border-red-500/30 bg-red-500/10' :
                                impactResult.riskLevel === 'medium' ? 'border-amber-500/30 bg-amber-500/10' :
                                'border-green-500/30 bg-green-500/10'
                            }`}>
                                <div className="flex items-center gap-2 mb-2">
                                    <Zap size={16} className={
                                        impactResult.riskLevel === 'high' ? 'text-red-400' :
                                        impactResult.riskLevel === 'medium' ? 'text-amber-400' :
                                        'text-green-400'
                                    } />
                                    <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Risk</span>
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <span className={`text-2xl font-light ${
                                        impactResult.riskLevel === 'high' ? 'text-red-400' :
                                        impactResult.riskLevel === 'medium' ? 'text-amber-400' :
                                        'text-green-400'
                                    }`}>
                                        {impactResult.riskLevel.toUpperCase()}
                                    </span>
                                    <span className="text-xs text-slate-600">score {impactResult.riskScore}</span>
                                </div>
                            </div>

                            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                                <span className="text-xs font-medium uppercase tracking-wider text-slate-500 block mb-2">Direct Deps</span>
                                <span className="text-2xl font-light text-slate-200">{impactResult.centrality}</span>
                            </div>

                            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                                <span className="text-xs font-medium uppercase tracking-wider text-slate-500 block mb-2">Total Affected</span>
                                <span className="text-2xl font-light text-slate-200">{impactResult.summary.totalAffected}</span>
                            </div>

                            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                                <span className="text-xs font-medium uppercase tracking-wider text-slate-500 block mb-2">Files</span>
                                <span className="text-2xl font-light text-slate-200">{impactResult.summary.filesAffected}</span>
                            </div>

                            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                                <span className="text-xs font-medium uppercase tracking-wider text-slate-500 block mb-2">Functions</span>
                                <span className="text-2xl font-light text-slate-200">{impactResult.summary.functionsAffected}</span>
                            </div>
                        </div>

                        {/* Risk Factor Breakdown */}
                        {impactResult.riskFactors.length > 0 && (
                            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
                                <h3 className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wider">Why this risk level?</h3>
                                <div className="flex flex-wrap gap-2">
                                    {impactResult.riskFactors.map((factor, i) => (
                                        <span
                                            key={i}
                                            className={`px-3 py-1 text-xs rounded-full border ${
                                                impactResult.riskLevel === 'high'
                                                    ? 'border-red-500/30 bg-red-500/10 text-red-300'
                                                    : impactResult.riskLevel === 'medium'
                                                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                                                    : 'border-green-500/30 bg-green-500/10 text-green-300'
                                            }`}
                                        >
                                            {factor}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Commit History */}
                        {(isFileGitLoading || fileGitData) && (
                            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
                                <h3 className="text-sm font-medium text-slate-400 mb-4 uppercase tracking-wider flex items-center gap-2">
                                    <GitCommit size={13} className="text-orange-400" />
                                    Commit History
                                </h3>
                                {isFileGitLoading ? (
                                    <div className="animate-pulse space-y-2">
                                        <div className="h-3 bg-white/5 rounded w-1/4" />
                                        <div className="h-3 bg-white/5 rounded w-1/2" />
                                    </div>
                                ) : fileGitData ? (
                                    <div className="space-y-4">
                                        {/* Churn stat */}
                                        <div className="flex items-baseline gap-3">
                                            <span className="text-2xl font-light text-slate-200">{fileGitData.fileCommits}</span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full border ${
                                                fileGitData.fileCommits >= 20
                                                    ? 'border-red-500/30 bg-red-500/10 text-red-300'
                                                    : fileGitData.fileCommits >= 5
                                                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                                                    : 'border-green-500/30 bg-green-500/10 text-green-300'
                                            }`}>
                                                {fileGitData.fileCommits >= 20 ? 'high churn' : fileGitData.fileCommits >= 5 ? 'medium churn' : 'stable'}
                                            </span>
                                            <span className="text-xs text-slate-600">commits to this file</span>
                                        </div>

                                        {/* Top contributors bar chart */}
                                        {fileGitData.authors?.length > 0 && (
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-1 text-xs text-slate-600 mb-1">
                                                    <Users size={11} />
                                                    <span className="uppercase tracking-wider">Top contributors</span>
                                                </div>
                                                {fileGitData.authors.map((a: any, i: number) => (
                                                    <div key={i} className="flex items-center gap-2">
                                                        <span className="text-xs text-slate-400 w-28 truncate">{a.name}</span>
                                                        <div className="flex-1 h-1 rounded bg-white/5 overflow-hidden">
                                                            <div
                                                                className="h-full bg-orange-400/50 rounded"
                                                                style={{ width: `${(a.count / fileGitData.authors[0].count) * 100}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-xs text-slate-600 w-6 text-right">{a.count}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Last commit */}
                                        {fileGitData.lastCommit && (
                                            <div className="text-xs text-slate-500 pt-3 border-t border-white/5">
                                                <span className="text-slate-400">Last commit:</span>{" "}
                                                &ldquo;{fileGitData.lastCommit.message}&rdquo;
                                                <span className="text-slate-600"> — {fileGitData.lastCommit.author} · {fileGitData.lastCommit.timeAgo}</span>
                                            </div>
                                        )}
                                    </div>
                                ) : null}
                            </div>
                        )}

                        {/* Direct Impacts */}
                        {impactResult.directImpacts.length > 0 && (
                            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6">
                                <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                                    <AlertTriangle size={18} className="text-amber-400" />
                                    Direct Impacts ({impactResult.directImpacts.length})
                                </h3>
                                <div className="space-y-3">
                                    {impactResult.directImpacts.map((impact, index) => (
                                        <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5">
                                            {impact.type === 'file' ? (
                                                <FileText size={14} className="text-green-400 shrink-0" />
                                            ) : (
                                                <Code2 size={14} className="text-blue-400 shrink-0" />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm text-white font-medium">{impact.name}</div>
                                                <div className="text-xs text-slate-400">{impact.reason}</div>
                                                <div className="text-xs text-slate-500 font-mono truncate">{impact.path}</div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                {impact.complexity != null && impact.complexity > 0 && (
                                                    <span className="text-xs text-slate-600">complexity {impact.complexity}</span>
                                                )}
                                                <span className={`px-2 py-1 text-xs rounded ${
                                                    impact.impactType === 'breaking' ? 'bg-red-500/20 text-red-400' :
                                                    impact.impactType === 'risky' ? 'bg-amber-500/20 text-amber-400' :
                                                    'bg-green-500/20 text-green-400'
                                                }`}>
                                                    {impact.impactType}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Indirect Impacts */}
                        {impactResult.indirectImpacts.length > 0 && (
                            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6">
                                <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                                    <TrendingUp size={18} className="text-blue-400" />
                                    Indirect Impacts ({impactResult.indirectImpacts.length})
                                </h3>
                                <div className="space-y-3">
                                    {impactResult.indirectImpacts.slice(0, 10).map((impact, index) => (
                                        <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5">
                                            {impact.type === 'file' ? (
                                                <FileText size={14} className="text-green-400" />
                                            ) : (
                                                <Code2 size={14} className="text-blue-400" />
                                            )}
                                            <div className="flex-1">
                                                <div className="text-sm text-white font-medium">{impact.name}</div>
                                                <div className="text-xs text-slate-400">{impact.reason}</div>
                                                <div className="text-xs text-slate-500 font-mono">{impact.path}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-slate-500">L{impact.depth}</span>
                                                <span className={`px-2 py-1 text-xs rounded ${
                                                    impact.impactType === 'breaking' ? 'bg-red-500/20 text-red-400' :
                                                    impact.impactType === 'risky' ? 'bg-amber-500/20 text-amber-400' :
                                                    'bg-green-500/20 text-green-400'
                                                }`}>
                                                    {impact.impactType}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                    {impactResult.indirectImpacts.length > 10 && (
                                        <div className="text-center text-sm text-slate-500 py-2">
                                            +{impactResult.indirectImpacts.length - 10} more indirect impacts
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* No Impacts */}
                        {impactResult.directImpacts.length === 0 && impactResult.indirectImpacts.length === 0 && (
                            <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-6 text-center">
                                <div className="text-green-400 mb-2">
                                    <Target size={48} className="mx-auto opacity-50" />
                                </div>
                                <h3 className="text-lg font-medium text-green-300 mb-2">Low Impact</h3>
                                <p className="text-green-400/80">
                                    No significant dependencies found. This {impactResult.entity.type} appears to be safe to modify.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}