import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/redis";

type InMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";

    const { ok, remaining, reset } = await rateLimit(
      `api:get-conversations:${ip}`,
      10,       // max 10 requests
      60_000    // per 1 minute
    );

    if (!ok) {
      return new Response("Too many requests", {
        status: 429,
        headers: {
          "RateLimit-Limit": "10",
          "RateLimit-Remaining": String(remaining),
          "RateLimit-Reset": String(Math.ceil((reset - Date.now()) / 1000)),
        },
      });
    }

    const body = await req.json().catch(() => ({}));
    const messages: InMessage[] = Array.isArray(body?.messages)
      ? body.messages
      : [];
    const lastUser = [...messages].reverse().find(m => m.role === "user");
    const content = lastUser?.content?.trim() || "";
    const reply = content
      ? `You said: ${content}`
      : "Hello! Ask me anything.";
    return NextResponse.json({ message: reply });
  } catch (e) {
    return NextResponse.json({ message: "Server error." }, { status: 500 });
  }
}
