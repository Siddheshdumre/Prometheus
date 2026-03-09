"use client";

import { useState, useEffect } from "react";
import { GitCommit, Users, TrendingUp } from "lucide-react";

interface GitHistoryData {
    isGitRepo: boolean;
    timeline?: Array<{ date: string; count: number }>;
    recentCommits?: Array<{ message: string; author: string; timeAgo: string }>;
    totalCommits?: number;
    contributors?: number;
}

export function GitHistory({ repoPath }: { repoPath: string }) {
    const [data, setData] = useState<GitHistoryData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!repoPath) { setLoading(false); return; }
        setLoading(true);
        setData(null);
        fetch("/api/git/history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ repoPath }),
        })
            .then(r => r.json())
            .then(setData)
            .catch(() => setData({ isGitRepo: false }))
            .finally(() => setLoading(false));
    }, [repoPath]);

    if (loading) {
        return (
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5 mb-8 animate-pulse">
                <div className="h-3 w-32 bg-white/5 rounded mb-4" />
                <div className="h-10 bg-white/[0.03] rounded mb-3" />
                <div className="space-y-2">
                    <div className="h-3 bg-white/[0.03] rounded w-3/4" />
                    <div className="h-3 bg-white/[0.03] rounded w-1/2" />
                </div>
            </div>
        );
    }

    if (!data?.isGitRepo) return null;

    const { timeline = [], recentCommits = [], totalCommits = 0, contributors = 0 } = data;
    const maxCount = Math.max(...timeline.map(d => d.count), 1);

    return (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5 mb-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <TrendingUp size={13} className="text-orange-400" />
                    Commit Activity
                    <span className="text-xs text-slate-600 font-normal">— last 30 days</span>
                </h2>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                        <GitCommit size={11} />
                        {totalCommits}{totalCommits === 100 ? "+" : ""} commits
                    </span>
                    <span className="flex items-center gap-1.5">
                        <Users size={11} />
                        {contributors} contributor{contributors !== 1 ? "s" : ""}
                    </span>
                </div>
            </div>

            {/* Sparkline bars */}
            <div className="flex items-end gap-px h-10 mb-4">
                {timeline.map(({ date, count }) => (
                    <div
                        key={date}
                        title={`${date}: ${count} commit${count !== 1 ? "s" : ""}`}
                        className="flex-1 rounded-[1px] cursor-default transition-opacity hover:opacity-75"
                        style={{
                            height: count === 0 ? "2px" : `${Math.max(14, Math.round((count / maxCount) * 100))}%`,
                            backgroundColor: count === 0
                                ? "rgba(255,255,255,0.04)"
                                : `rgba(249,115,22,${0.25 + (count / maxCount) * 0.65})`,
                            minHeight: "2px",
                        }}
                    />
                ))}
            </div>

            {/* Recent commits */}
            {recentCommits.length > 0 && (
                <div>
                    {recentCommits.slice(0, 5).map((c, i) => (
                        <div key={i} className="flex items-baseline gap-2 py-1.5 border-b border-white/[0.03] last:border-0">
                            <div className="h-1 w-1 rounded-full bg-orange-400/40 shrink-0 translate-y-0.5" />
                            <span className="text-xs text-slate-300 flex-1 truncate">{c.message}</span>
                            <span className="text-xs text-slate-600 shrink-0 hidden sm:block">
                                {c.author.split(" ")[0]}
                            </span>
                            <span className="text-xs text-slate-700 shrink-0 font-mono w-14 text-right">{c.timeAgo}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
