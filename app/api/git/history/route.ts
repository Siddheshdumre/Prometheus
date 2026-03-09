import { NextResponse } from "next/server";
import simpleGit from "simple-git";
import fs from "fs";
import path from "path";

function parseGitHubUrl(url: string) {
    const m = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/.]+?)(?:\.git)?(?:\/tree\/([^/]+))?(?:\/)?$/);
    if (!m) return null;
    return { owner: m[1], repo: m[2] };
}

function buildTimeline(commits: Array<{ date: string }>) {
    const now = Date.now();
    const dayMs = 86400000;
    const buckets: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
        buckets[new Date(now - i * dayMs).toISOString().slice(0, 10)] = 0;
    }
    for (const c of commits) {
        try {
            const d = new Date(c.date).toISOString().slice(0, 10);
            if (d in buckets) buckets[d]++;
        } catch {}
    }
    return Object.entries(buckets).map(([date, count]) => ({ date, count }));
}

function relativeTime(dateStr: string): string {
    try {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        if (days < 30) return `${days}d ago`;
        return `${Math.floor(days / 30)}mo ago`;
    } catch {
        return "";
    }
}

const GH_HEADERS = {
    "User-Agent": "Prometheus-Codebase-Intelligence",
    "Accept": "application/vnd.github+json",
};

export async function POST(req: Request) {
    try {
        const { repoPath, filePath } = await req.json() as { repoPath: string; filePath?: string };
        if (!repoPath) return NextResponse.json({ error: "repoPath required" }, { status: 400 });

        const isUrl = repoPath.startsWith("http://") || repoPath.startsWith("https://");

        // ── GitHub URL ──────────────────────────────────────────────────────
        if (isUrl) {
            const parsed = parseGitHubUrl(repoPath);
            if (!parsed) return NextResponse.json({ isGitRepo: false });
            const { owner, repo } = parsed;

            if (filePath) {
                const res = await fetch(
                    `https://api.github.com/repos/${owner}/${repo}/commits?path=${encodeURIComponent(filePath)}&per_page=100`,
                    { headers: GH_HEADERS }
                );
                if (!res.ok) return NextResponse.json({ isGitRepo: true, fileCommits: 0, authors: [], lastCommit: null });
                const commits = await res.json() as any[];
                if (!Array.isArray(commits)) return NextResponse.json({ isGitRepo: true, fileCommits: 0, authors: [], lastCommit: null });

                const authorMap = new Map<string, number>();
                for (const c of commits) {
                    const name: string = c.commit?.author?.name ?? "Unknown";
                    authorMap.set(name, (authorMap.get(name) ?? 0) + 1);
                }
                const authors = [...authorMap.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([name, count]) => ({ name, count }));
                const last = commits[0];
                return NextResponse.json({
                    isGitRepo: true,
                    fileCommits: commits.length,
                    authors,
                    lastCommit: last ? {
                        message: (last.commit?.message ?? "").split("\n")[0].slice(0, 80),
                        timeAgo: relativeTime(last.commit?.author?.date ?? ""),
                        author: last.commit?.author?.name ?? "Unknown",
                    } : null,
                });
            }

            // Overall history
            const res = await fetch(
                `https://api.github.com/repos/${owner}/${repo}/commits?per_page=100`,
                { headers: GH_HEADERS }
            );
            if (!res.ok) return NextResponse.json({ isGitRepo: false });
            const commits = await res.json() as any[];
            if (!Array.isArray(commits)) return NextResponse.json({ isGitRepo: false });

            const authorSet = new Set<string>();
            for (const c of commits) authorSet.add(c.commit?.author?.name ?? "Unknown");
            const recentCommits = commits.slice(0, 8).map((c: any) => ({
                message: (c.commit?.message ?? "").split("\n")[0].slice(0, 72),
                author: c.commit?.author?.name ?? "Unknown",
                timeAgo: relativeTime(c.commit?.author?.date ?? ""),
            }));
            return NextResponse.json({
                isGitRepo: true,
                timeline: buildTimeline(commits.map((c: any) => ({ date: c.commit?.author?.date ?? "" }))),
                recentCommits,
                totalCommits: commits.length,
                contributors: authorSet.size,
            });
        }

        // ── Local path ──────────────────────────────────────────────────────
        const resolvedPath = path.resolve(repoPath);
        if (!fs.existsSync(resolvedPath)) return NextResponse.json({ isGitRepo: false });
        if (!fs.existsSync(path.join(resolvedPath, ".git"))) return NextResponse.json({ isGitRepo: false });

        const git = simpleGit(resolvedPath);

        if (filePath) {
            const safeFilePath = filePath.replace(/\\/g, "/").replace(/^\/+/, "");
            const log = await git.log({ file: safeFilePath, maxCount: 200 });
            const authorMap = new Map<string, number>();
            for (const c of log.all) authorMap.set(c.author_name, (authorMap.get(c.author_name) ?? 0) + 1);
            const authors = [...authorMap.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([name, count]) => ({ name, count }));
            const last = log.latest;
            return NextResponse.json({
                isGitRepo: true,
                fileCommits: log.total,
                authors,
                lastCommit: last ? {
                    message: last.message.slice(0, 80),
                    timeAgo: relativeTime(last.date),
                    author: last.author_name,
                } : null,
            });
        }

        const log = await git.log({ maxCount: 500 });
        const authorSet = new Set<string>();
        for (const c of log.all) authorSet.add(c.author_name);

        let recentCommits: Array<{ message: string; author: string; timeAgo: string }> = [];
        try {
            const raw = await git.raw(["log", "--pretty=format:%an\x1f%ci\x1f%s", "-n", "8"]);
            recentCommits = raw.split("\n").filter(Boolean).map(line => {
                const parts = line.split("\x1f");
                const author = parts[0]?.trim() ?? "";
                const date = parts[1]?.trim() ?? "";
                const message = (parts[2] ?? "").slice(0, 72);
                return { author, message, timeAgo: relativeTime(date) };
            });
        } catch {}

        return NextResponse.json({
            isGitRepo: true,
            timeline: buildTimeline(log.all.map(c => ({ date: c.date }))),
            recentCommits,
            totalCommits: log.total,
            contributors: authorSet.size,
        });
    } catch (e: any) {
        console.error("Git history error:", e);
        return NextResponse.json({ isGitRepo: false });
    }
}
