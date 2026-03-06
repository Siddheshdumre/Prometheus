"use client";

import { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import { FileText, Code2, Package } from "lucide-react";

export interface FileNode {
    path: string;
    functions: Array<{
        name: string;
        startLine: number;
        endLine: number;
        complexity: number;
        parameters: string[];
        isExported: boolean;
    }>;
    classes: string[];
    imports: Array<{
        original: string;
        resolved: string | null;
        isExternal: boolean;
        isResolved: boolean;
        importedMembers: string[];
    }>;
    exports: string[];
    complexity: number;
    size: number;
}

interface CodeViewerProps {
    file: FileNode | null;
    repoPath: string;
}

export function CodeViewer({ file, repoPath }: CodeViewerProps) {
    const [fileContent, setFileContent] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!file) {
            setFileContent(null);
            return;
        }

        const loadFileContent = async () => {
            setLoading(true);
            try {
                // Fetch actual file content from the API
                const response = await fetch('/api/file/content', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ 
                        repoPath: repoPath,
                        filePath: file.path 
                    }),
                });

                if (!response.ok) {
                    throw new Error(`Failed to load file: ${response.statusText}`);
                }

                const data = await response.json();
                if (data.success) {
                    setFileContent(data.content);
                } else {
                    setFileContent(`// Error: ${data.error}`);
                }
            } catch (error) {
                console.error('Failed to load file content:', error);
                setFileContent(`// Error loading file: ${error}`);
            } finally {
                setLoading(false);
            }
        };

        loadFileContent();
    }, [file]);

    const getLanguageFromPath = (path: string): string => {
        const ext = path.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'ts': return 'typescript';
            case 'tsx': return 'typescript';
            case 'js': return 'javascript';
            case 'jsx': return 'javascript';
            case 'json': return 'json';
            case 'md': return 'markdown';
            case 'css': return 'css';
            case 'html': return 'html';
            case 'yml':
            case 'yaml': return 'yaml';
            default: return 'plaintext';
        }
    };

    if (!file) {
        return (
            <div className="flex-1 flex items-center justify-center text-slate-600 bg-[#0d1117] rounded-lg">
                <div className="text-center">
                    <FileText size={48} className="mx-auto mb-4 opacity-50" />
                    <p>Select a file to view its content</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-[#0d1117] rounded-lg border border-white/5">
            {/* File Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#161b22]">
                <div className="flex items-center gap-3">
                    <FileText size={16} className="text-emerald-400" />
                    <span className="text-sm font-mono text-slate-200">{file.path}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                        <Code2 size={12} />
                        <span>{file.functions.length} functions</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Package size={12} />
                        <span>{file.imports.length} imports</span>
                    </div>
                    <span className={`px-2 py-1 rounded ${
                        file.complexity > 20 ? 'bg-red-500/20 text-red-400' :
                        file.complexity > 10 ? 'bg-amber-500/20 text-amber-400' :
                        'bg-green-500/20 text-green-400'
                    }`}>
                        Complexity: {file.complexity}
                    </span>
                </div>
            </div>

            {/* File Content */}
            <div className="flex-1">
                {loading ? (
                    <div className="flex items-center justify-center h-full text-slate-500">
                        Loading file content...
                    </div>
                ) : (
                    <Editor
                        height="100%"
                        language={getLanguageFromPath(file.path)}
                        value={fileContent || ''}
                        theme="vs-dark"
                        options={{
                            readOnly: true,
                            minimap: { enabled: true },
                            fontSize: 13,
                            lineNumbers: 'on',
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            padding: { top: 16 },
                            renderWhitespace: 'selection',
                            folding: true,
                            glyphMargin: true,
                            lineDecorationsWidth: 10,
                        }}
                    />
                )}
            </div>
            
            {/* File Analysis Panel */}
            <div className="border-t border-white/5 bg-[#161b22] p-4">
                <div className="grid grid-cols-3 gap-6 text-sm">
                    {/* Functions */}
                    <div>
                        <h4 className="text-cyan-400 font-medium mb-2 flex items-center gap-2">
                            <Code2 size={14} />
                            Functions ({file.functions.length})
                        </h4>
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                            {file.functions.slice(0, 5).map((func, i) => (
                                <div key={i} className="flex items-center justify-between text-xs">
                                    <span className="text-slate-300 font-mono">{func.name}</span>
                                    <span className={`px-1.5 py-0.5 rounded ${
                                        func.complexity > 10 ? 'bg-red-500/20 text-red-400' :
                                        func.complexity > 5 ? 'bg-amber-500/20 text-amber-400' :
                                        'bg-green-500/20 text-green-400'
                                    }`}>
                                        C{func.complexity}
                                    </span>
                                </div>
                            ))}
                            {file.functions.length > 5 && (
                                <div className="text-xs text-slate-500 italic">
                                    +{file.functions.length - 5} more functions
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Imports */}
                    <div>
                        <h4 className="text-emerald-400 font-medium mb-2 flex items-center gap-2">
                            <Package size={14} />
                            Imports ({file.imports.length})
                        </h4>
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                            {file.imports.slice(0, 4).map((imp, i) => (
                                <div key={i} className="text-xs">
                                    <span className="text-slate-400 font-mono">{imp.original}</span>
                                    <div className="flex gap-1 mt-1">
                                        {imp.isResolved && (
                                            <span className="bg-green-500/20 text-green-400 px-1 py-0.5 rounded text-[10px]">
                                                ✓
                                            </span>
                                        )}
                                        {imp.isExternal && (
                                            <span className="bg-blue-500/20 text-blue-400 px-1 py-0.5 rounded text-[10px]">
                                                EXT
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Exports */}
                    <div>
                        <h4 className="text-purple-400 font-medium mb-2">
                            Exports ({file.exports.length})
                        </h4>
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                            {file.exports.slice(0, 6).map((exp, i) => (
                                <span key={i} className="inline-block bg-purple-500/20 text-purple-300 px-2 py-1 rounded text-xs font-mono mr-1 mb-1">
                                    {exp}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Helper function to create file content API endpoint
export async function fetchFileContent(repoPath: string, filePath: string): Promise<string> {
    // This would be implemented as an API endpoint that reads the actual file content
    // from the server side where file system access is available
    const response = await fetch('/api/file/content', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ repoPath, filePath }),
    });
    
    if (!response.ok) {
        throw new Error(`Failed to fetch file content: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.content;
}