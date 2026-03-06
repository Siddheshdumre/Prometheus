import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

interface ContextCodeChunk {
    content: string;
    filePath: string;
    functionName?: string;
}

interface AnalysisContext {
    codeChunks?: ContextCodeChunk[];
    metrics?: {
        files?: number;
        functions?: number;
        classes?: number;
        dependencies?: number;
        resolvedImports?: number;
        functionCalls?: number;
    };
}

interface ChatRequestBody {
    message?: string;
    context?: AnalysisContext;
    stream?: boolean;
}

// Initialize the Google Gen AI client. 
// It will automatically use the GEMINI_API_KEY environment variable.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

function buildPrompt(message: string, context: AnalysisContext, relevantContext: string): string {
    return `
You are Prometheus, an expert AI developer assistant specializing in codebase analysis and understanding.

CODEBASE METRICS:
- Files: ${context.metrics?.files || 0}
- Functions: ${context.metrics?.functions || 0}  
- Classes: ${context.metrics?.classes || 0}
- Dependencies: ${context.metrics?.dependencies || 0}
- Resolved Imports: ${context.metrics?.resolvedImports || 0} (${Math.round(((context.metrics?.resolvedImports || 0) / Math.max(context.metrics?.dependencies || 1, 1)) * 100)}% resolution rate)
- Function Calls: ${context.metrics?.functionCalls || 0}

${relevantContext}

USER QUESTION: ${message}

Please provide a helpful, detailed answer based on the codebase analysis. When referencing specific files or functions, use the exact names from the context. If you mention specific code locations, format them as [filename:function] or [filename]. Focus on practical insights that would help a developer understand or work with this codebase.

If the available context doesn't fully answer the question, explain what you can infer from the analysis and suggest what additional information might be helpful.
`;
}

function buildRelevantContext(context: AnalysisContext, message: string): string {
    let relevantContext = "";
    if (context.codeChunks) {
        const keywords = message.toLowerCase().split(' ').filter((word: string) => word.length > 2);
        const relevantChunks = context.codeChunks.filter((chunk: ContextCodeChunk) => {
            const content = chunk.content.toLowerCase();
            return keywords.some((keyword: string) => 
                content.includes(keyword) || 
                chunk.functionName?.toLowerCase().includes(keyword) ||
                chunk.filePath.toLowerCase().includes(keyword)
            );
        }).slice(0, 6);
        
        if (relevantChunks.length > 0) {
            relevantContext = "\n\nRELEVANT CODE CONTEXT:\n" + 
                relevantChunks.map((chunk: ContextCodeChunk) => 
                    `[${chunk.filePath}${chunk.functionName ? ':' + chunk.functionName : ''}]\n${chunk.content}`
                ).join('\n\n---\n\n');
        }
    }
    return relevantContext;
}

export async function POST(req: Request) {
    try {
        const { message, context, stream: useStreaming } = (await req.json()) as ChatRequestBody;

        if (!message) {
            return NextResponse.json({ error: "Message is required" }, { status: 400 });
        }

        if (!context) {
            return NextResponse.json({ error: "Analysis context is required" }, { status: 400 });
        }

        const relevantContext = buildRelevantContext(context, message);
        const prompt = buildPrompt(message, context, relevantContext);

        // ── Streaming mode ──────────────────────────────────────────────
        if (useStreaming) {
            const response = await ai.models.generateContentStream({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });

            const encoder = new TextEncoder();
            const readable = new ReadableStream({
                async start(controller) {
                    try {
                        for await (const chunk of response) {
                            const text = chunk.text || '';
                            if (text) {
                                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
                            }
                        }
                        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                        controller.close();
                    } catch (err: any) {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`));
                        controller.close();
                    }
                },
            });

            return new Response(readable, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                },
            });
        }

        // ── Non-streaming mode ──────────────────────────────────────────
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        return NextResponse.json({
            success: true,
            reply: response.text
        });

    } catch (error: any) {
        console.error("AI Chat Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
