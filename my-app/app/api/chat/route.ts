import { handleChat } from "@/lib/chat-ai";
import { realChatDeps } from "@/lib/chat-ai-data";

// Maya's AI engine. It only does anything while the admin has picked the AI engine and the
// server has ANTHROPIC_API_KEY; every other case answers {fallback: true}.
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handleChat(request, realChatDeps(request));
}
