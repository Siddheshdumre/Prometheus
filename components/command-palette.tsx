"use client";

import { useState, useEffect, useMemo } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { Search, FileText, Code2, Package, Sparkles, ArrowRight } from "lucide-react";

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    analysisData: any;
    onFileSelect: (file: any) => void;
    onAIQuery: (query: string) => void;
    onNavigateToTab: (tab: string) => void;
}

interface SearchResult {
    type: 'file' | 'function' | 'ai-suggestion' | 'navigation';
    title: string;
    subtitle?: string;
    icon?: React.ElementType;
    action: () => void;
    priority: number;
}

export function CommandPalette({ 
    isOpen, 
    onClose, 
    analysisData, 
    onFileSelect, 
    onAIQuery,
    onNavigateToTab 
}: CommandPaletteProps) {
    const [query, setQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Close palette on Escape
    useHotkeys('escape', onClose, { enabled: isOpen });

    // Navigate with arrow keys
    useHotkeys('up', () => setSelectedIndex(prev => Math.max(0, prev - 1)), { enabled: isOpen });
    useHotkeys('down', () => setSelectedIndex(prev => prev + 1), { enabled: isOpen });

    // Execute selected command on Enter
    useHotkeys('enter', () => {
        if (results.length > 0 && results[selectedIndex]) {
            results[selectedIndex].action();
            onClose();
        }
    }, { enabled: isOpen });

    // Reset state when opening
    useEffect(() => {
        if (isOpen) {
            setQuery("");
            setSelectedIndex(0);
        }
    }, [isOpen]);

    // Generate search results based on query
    const results = useMemo(() => {
        if (!analysisData || query.trim().length === 0) {
            // Show default suggestions when no query
            return [
                {
                    type: 'navigation' as const,
                    title: 'Go to Dashboard',
                    subtitle: 'View repository overview',
                    icon: Package,
                    action: () => onNavigateToTab('Dashboard'),
                    priority: 1
                },
                {
                    type: 'navigation' as const,
                    title: 'Go to Graph Explorer',
                    subtitle: 'Visualize dependencies',
                    icon: Package,
                    action: () => onNavigateToTab('Graph Explorer'),
                    priority: 2
                },
                {
                    type: 'navigation' as const,
                    title: 'Go to AI Chat',
                    subtitle: 'Ask questions about the codebase',
                    icon: Sparkles,
                    action: () => onNavigateToTab('AI Chat'),
                    priority: 3
                },
                {
                    type: 'ai-suggestion' as const,
                    title: 'Ask AI: "What is the main architecture pattern?"',
                    subtitle: 'AI-powered codebase analysis',
                    icon: Sparkles,
                    action: () => {
                        onNavigateToTab('AI Chat');
                        onAIQuery('What is the main architecture pattern?');
                    },
                    priority: 4
                }
            ];
        }

        const searchResults: SearchResult[] = [];
        const lowercaseQuery = query.toLowerCase();

        // If query looks like an AI question (contains question words or is long)
        const isAIQuery = /\b(what|how|why|when|where|explain|show|find|tell)\b/i.test(query) || query.length > 20;
        
        if (isAIQuery) {
            searchResults.push({
                type: 'ai-suggestion',
                title: `Ask AI: "${query}"`,
                subtitle: 'Get AI-powered insights about your codebase',
                icon: Sparkles,
                action: () => {
                    onNavigateToTab('AI Chat');
                    onAIQuery(query);
                },
                priority: 0
            });
        }

        // Search files
        if (analysisData.files) {
            analysisData.files
                .filter((file: any) => file.path.toLowerCase().includes(lowercaseQuery))
                .slice(0, 8)
                .forEach((file: any) => {
                    searchResults.push({
                        type: 'file',
                        title: file.path.split('/').pop() || file.path,
                        subtitle: `${file.path} • ${file.functions?.length || 0} functions`,
                        icon: FileText,
                        action: () => {
                            onNavigateToTab('File Explorer');
                            onFileSelect(file);
                        },
                        priority: file.path.toLowerCase().indexOf(lowercaseQuery) === 0 ? 1 : 2
                    });
                });
        }

        // Search functions across all files
        if (analysisData.files) {
            const functionResults: SearchResult[] = [];
            analysisData.files.forEach((file: any) => {
                if (file.functions) {
                    file.functions
                        .filter((func: any) => func.name.toLowerCase().includes(lowercaseQuery))
                        .slice(0, 6)
                        .forEach((func: any) => {
                            functionResults.push({
                                type: 'function',
                                title: func.name,
                                subtitle: `in ${file.path} • Lines ${func.startLine}-${func.endLine}`,
                                icon: Code2,
                                action: () => {
                                    onNavigateToTab('File Explorer');
                                    onFileSelect(file);
                                },
                                priority: func.name.toLowerCase().indexOf(lowercaseQuery) === 0 ? 1 : 3
                            });
                        });
                }
            });
            searchResults.push(...functionResults.slice(0, 8));
        }

        // Sort by priority and relevance
        return searchResults
            .sort((a, b) => a.priority - b.priority)
            .slice(0, 12);
    }, [query, analysisData, onFileSelect, onNavigateToTab, onAIQuery]);

    // Update selected index when results change
    useEffect(() => {
        setSelectedIndex(0);
    }, [results]);

    // Limit selected index to available results
    useEffect(() => {
        if (selectedIndex >= results.length && results.length > 0) {
            setSelectedIndex(results.length - 1);
        }
    }, [selectedIndex, results.length]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-32">
            <div className="bg-[#0d1117] border border-white/10 rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
                {/* Search Input */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
                    <Search size={20} className="text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search files, functions, or ask AI..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="flex-1 bg-transparent text-white placeholder:text-slate-500 focus:outline-none"
                        autoFocus
                    />
                    <div className="flex gap-2">
                        <kbd className="px-2 py-1 bg-white/5 text-slate-400 text-xs rounded">↑↓</kbd>
                        <kbd className="px-2 py-1 bg-white/5 text-slate-400 text-xs rounded">⏎</kbd>
                        <kbd className="px-2 py-1 bg-white/5 text-slate-400 text-xs rounded">esc</kbd>
                    </div>
                </div>

                {/* Results */}
                <div className="max-h-96 overflow-y-auto">
                    {results.length === 0 ? (
                        <div className="px-4 py-8 text-center text-slate-500">
                            {query.trim() ? 'No results found' : 'Start typing to search...'}
                        </div>
                    ) : (
                        <div>
                            {results.map((result, index) => (
                                <div
                                    key={`${result.type}-${result.title}-${index}`}
                                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                                        index === selectedIndex 
                                            ? 'bg-cyan-500/10 border-l-2 border-cyan-400' 
                                            : 'hover:bg-white/5'
                                    }`}
                                    onClick={() => {
                                        result.action();
                                        onClose();
                                    }}
                                >
                                    {result.icon && (
                                        <result.icon 
                                            size={16} 
                                            className={
                                                result.type === 'file' ? 'text-green-400' :
                                                result.type === 'function' ? 'text-blue-400' :
                                                result.type === 'ai-suggestion' ? 'text-purple-400' :
                                                'text-slate-400'
                                            }
                                        />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-white text-sm font-medium truncate">
                                            {result.title}
                                        </div>
                                        {result.subtitle && (
                                            <div className="text-slate-400 text-xs truncate">
                                                {result.subtitle}
                                            </div>
                                        )}
                                    </div>
                                    {index === selectedIndex && (
                                        <ArrowRight size={14} className="text-cyan-400 shrink-0" />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-2 border-t border-white/5 bg-white/[0.02] text-xs text-slate-500 flex items-center justify-between">
                    <div>
                        {query.trim().length > 0 ? (
                            `${results.length} results`
                        ) : (
                            'Type to search files, functions, or ask AI questions'
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <span>powered by</span>
                        <Sparkles size={12} className="text-cyan-400" />
                        <span className="text-cyan-400">Prometheus</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Hook for global command palette
export function useCommandPalette() {
    const [isOpen, setIsOpen] = useState(false);
    
    useHotkeys('cmd+k, ctrl+k', (e) => {
        e.preventDefault();
        setIsOpen(true);
    }, { enableOnFormTags: true });
    
    return {
        isOpen,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false)
    };
}