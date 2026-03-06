import { NextResponse } from "next/server";
import { analyzeRepository } from "@/lib/analyzer";
import fs from "fs";
import path from "path";
import os from "os";
import { createGunzip } from "zlib";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

// ── GitHub URL parsing ──────────────────────────────────────────────────────

function parseGitHubUrl(url: string): { owner: string; repo: string; branch?: string } | null {
    // Handles:  https://github.com/owner/repo  or  https://github.com/owner/repo.git
    //           https://github.com/owner/repo/tree/branch
    const m = url.match(
        /^https?:\/\/github\.com\/([^/]+)\/([^/.]+?)(?:\.git)?(?:\/tree\/([^/]+))?(?:\/)?$/
    );
    if (!m) return null;
    return { owner: m[1], repo: m[2], branch: m[3] };
}

// ── Minimal tar extraction (pax/ustar, handles GitHub tarballs) ─────────────

async function extractTarGz(buffer: Buffer, destDir: string) {
    fs.mkdirSync(destDir, { recursive: true });

    // Decompress gzip
    const decompressed = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Uint8Array[] = [];
        const gunzip = createGunzip();
        gunzip.on("data", (chunk: Uint8Array) => chunks.push(chunk));
        gunzip.on("end", () => resolve(Buffer.concat(chunks)));
        gunzip.on("error", reject);
        const readable = new Readable();
        readable.push(buffer);
        readable.push(null);
        readable.pipe(gunzip);
    });

    // Parse tar (512-byte blocks)
    let offset = 0;
    let stripPrefix = ""; // GitHub tarballs nest files under owner-repo-sha/

    while (offset + 512 <= decompressed.length) {
        const header = decompressed.subarray(offset, offset + 512);
        // All-zero block means end of archive
        if (header.every(b => b === 0)) break;

        // Read file name from header (bytes 0-99, extended by prefix at 345-499)
        let name = header.subarray(0, 100).toString("utf8").replace(/\0+$/, "");
        const prefix = header.subarray(345, 500).toString("utf8").replace(/\0+$/, "");
        if (prefix) name = prefix + "/" + name;

        // Type flag (byte 156): '0' or '\0' = regular file, '5' = directory
        const typeFlag = String.fromCharCode(header[156]);

        // File size (bytes 124-135, octal)
        const sizeStr = header.subarray(124, 136).toString("utf8").replace(/\0+$/, "").trim();
        const size = parseInt(sizeStr, 8) || 0;

        // Handle pax extended headers (type 'x' or 'g') — skip them
        if (typeFlag === "x" || typeFlag === "g") {
            const blocks = Math.ceil(size / 512);
            offset += 512 + blocks * 512;
            continue;
        }

        // Detect the strip prefix from the first entry
        if (!stripPrefix && name.includes("/")) {
            stripPrefix = name.split("/")[0] + "/";
        }

        // Strip the GitHub prefix directory
        const relative = stripPrefix && name.startsWith(stripPrefix)
            ? name.slice(stripPrefix.length)
            : name;

        const dataStart = offset + 512;
        const dataEnd = dataStart + size;

        if (relative && relative !== "." && relative !== "/") {
            const fullPath = path.join(destDir, relative);
            if (typeFlag === "5" || relative.endsWith("/")) {
                fs.mkdirSync(fullPath, { recursive: true });
            } else if (typeFlag === "0" || typeFlag === "\0" || typeFlag === "") {
                fs.mkdirSync(path.dirname(fullPath), { recursive: true });
                fs.writeFileSync(fullPath, new Uint8Array(decompressed.subarray(dataStart, dataEnd)));
            }
        }

        // Advance to next 512-byte-aligned block
        const blocks = Math.ceil(size / 512);
        offset += 512 + blocks * 512;
    }
}

// ── Download GitHub repo as tarball (no git binary required) ────────────────

async function downloadGitHubRepo(owner: string, repo: string, branch?: string): Promise<string> {
    const ref = branch || "HEAD";
    const tarballUrl = `https://api.github.com/repos/${owner}/${repo}/tarball/${ref}`;

    const res = await fetch(tarballUrl, {
        headers: {
            "Accept": "application/vnd.github+json",
            "User-Agent": "Prometheus-Codebase-Intelligence",
        },
        redirect: "follow",
    });

    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`GitHub API error ${res.status}: ${body || res.statusText}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "prometheus-repo-"));
    console.log(`Extracting ${owner}/${repo} into ${tempDir}...`);

    await extractTarGz(buffer, tempDir);
    return tempDir;
}

// Allow up to 60 seconds for repo download + analysis on Vercel
export const maxDuration = 60;

// ── Route handler ───────────────────────────────────────────────────────────

export async function POST(req: Request) {
    let tempDir: string | null = null;

    try {
        const body = await req.json();
        const { repoPath } = body;

        if (!repoPath) {
            return NextResponse.json({ error: "repoPath is required" }, { status: 400 });
        }

        let pathToAnalyze = repoPath;

        // Check if the input is a URL
        if (repoPath.startsWith("http://") || repoPath.startsWith("https://")) {
            const parsed = parseGitHubUrl(repoPath);
            if (!parsed) {
                return NextResponse.json(
                    { error: "Only public GitHub repository URLs are supported (e.g. https://github.com/owner/repo)" },
                    { status: 400 }
                );
            }

            tempDir = await downloadGitHubRepo(parsed.owner, parsed.repo, parsed.branch);
            pathToAnalyze = tempDir;
        } else {
            // Local path — works in dev, NOT on Vercel
            if (!fs.existsSync(repoPath)) {
                return NextResponse.json({ error: "Local directory does not exist" }, { status: 404 });
            }
        }

        const analysis = await analyzeRepository(pathToAnalyze);

        return NextResponse.json({ success: true, data: analysis });
    } catch (error: any) {
        console.error("Analysis Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        if (tempDir && fs.existsSync(tempDir)) {
            try {
                fs.rmSync(tempDir, { recursive: true, force: true });
                console.log(`Cleaned up temporary directory: ${tempDir}`);
            } catch (e) {
                console.error(`Failed to clean up temp dir ${tempDir}`, e);
            }
        }
    }
}
