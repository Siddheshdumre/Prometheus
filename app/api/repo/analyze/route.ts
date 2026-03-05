import { NextResponse } from "next/server";
import { analyzeRepository } from "@/lib/analyzer";
import fs from "fs";
import path from "path";
import os from "os";
import simpleGit from "simple-git";

export async function POST(req: Request) {
    let tempDir = null;

    try {
        const body = await req.json();
        const { repoPath } = body;

        if (!repoPath) {
            return NextResponse.json({ error: "repoPath is required" }, { status: 400 });
        }

        let pathToAnalyze = repoPath;

        // Check if the input is a URL (GitHub/GitLab etc)
        if (repoPath.startsWith("http://") || repoPath.startsWith("https://")) {
            const git = simpleGit();
            // Create a unique temporary directory
            tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "prometheus-repo-"));
            console.log(`Cloning ${repoPath} into ${tempDir}...`);

            await git.clone(repoPath, tempDir, ["--depth", "1"]); // Shallow clone for speed
            pathToAnalyze = tempDir;
        } else {
            // Local path validation
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
        // Cleanup temporary cloned directory if it exists
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
