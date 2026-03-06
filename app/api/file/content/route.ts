import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req: Request) {
    try {
        const { repoPath, filePath } = await req.json();

        if (!repoPath || !filePath) {
            return NextResponse.json({ error: "repoPath and filePath are required" }, { status: 400 });
        }

        const fullPath = path.join(repoPath, filePath);
        
        // Security check - ensure the file is within the repo directory
        const resolvedRepoPath = path.resolve(repoPath);
        const resolvedFilePath = path.resolve(fullPath);
        
        if (!resolvedFilePath.startsWith(resolvedRepoPath)) {
            return NextResponse.json({ error: "Access denied - file outside repository" }, { status: 403 });
        }

        // Check if file exists
        if (!fs.existsSync(resolvedFilePath)) {
            return NextResponse.json({ error: "File not found" }, { status: 404 });
        }

        // Check if it's a file (not directory)
        const stats = fs.statSync(resolvedFilePath);
        if (!stats.isFile()) {
            return NextResponse.json({ error: "Path is not a file" }, { status: 400 });
        }

        // Read file content
        const content = fs.readFileSync(resolvedFilePath, 'utf-8');

        return NextResponse.json({ 
            success: true, 
            content,
            size: stats.size,
            lastModified: stats.mtime
        });

    } catch (error: any) {
        console.error("File content error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}