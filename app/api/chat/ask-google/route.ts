import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { uploadFileToGCS } from "@/lib/gcs";
import { readFileFromGCS } from "@/lib/gcs";

export async function POST(req: NextRequest) {
  try {
    const userSession = await auth();

    if (!userSession?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: userSession.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const formData = await req.formData();
    const userMessage = formData.get("message")?.toString() || "";
    const conversationId = formData.get("conversationId")?.toString() || null;
    const file = formData.get("file");

    if (!userMessage || userMessage.trim() === "") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    let uploadedFileUrl: string | undefined = undefined;
    let fullUserMessage = userMessage;

    if (file && file instanceof Blob) {
      const buffer = Buffer.from(await file.arrayBuffer());

      const timestamp = Date.now();
      const originalName = (file as any).name || "uploaded-file";
      const filename = `uploads/${user.id}-${timestamp}-${originalName}`;

      const contentType = file.type || "application/octet-stream";

      uploadedFileUrl = await uploadFileToGCS(buffer, filename, contentType);

      // Read back the file content to include in the prompt
      const fileContent = await readFileFromGCS(filename);

      // Append file content to user message, or alternatively append URL only
      fullUserMessage += `\n\n[Uploaded file content]:\n${fileContent}`;
    }

    const API_KEY = process.env.GOOGLE_AI_API_KEY;
    if (!API_KEY) {
      console.error("❌ Missing GOOGLE_AI_API_KEY");
      return NextResponse.json(
        { error: "Missing Google API key" },
        { status: 500 }
      );
    }

    // Fetch previous messages for the conversation (if conversationId provided)
    let previousMessages: { author: string; content: string }[] = [];

    if (conversationId) {
      const conversation = await prisma.chatConversation.findUnique({
        where: { id: conversationId },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });

      if (!conversation) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 }
        );
      }

      // Optional: ensure this conversation belongs to current user
      if (conversation.userId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      previousMessages = conversation.messages.map((msg) => ({
        author: msg.role === "user" ? "user" : "assistant",
        content: msg.content,
      }));
    }

    // Build prompt messages with all previous messages + current user message
    const promptMessages = [
      ...previousMessages,
      { author: "user", content: fullUserMessage },
    ];

    // Call Google API
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: promptMessages.map((msg) => ({
        role: msg.author === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      })),
      }),
    });

    const raw = await response.text();
    //console.log("🔍 Raw response from Google:", raw);
    console.log("📦 Status code:", response.status);

    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      console.error("❌ Failed to parse JSON from Google:", err);
      return NextResponse.json(
        {
          error: "Invalid JSON returned by Google AI",
          raw,
        },
        { status: 500 }
      );
    }

    if (!data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.error("⚠️ Google response missing candidates:", data);
      return NextResponse.json(
        { error: "No valid candidates in Google response", raw: data },
        { status: 500 }
      );
    }

    const aiReply = data.candidates[0].content.parts[0].text.trim();

    // Quick cleanup of AI reply to remove unwanted prefixes/labels and extra spaces
    function cleanAIReply(text: string) {
      // Remove common user/assistant labels or short prefixes at start (e.g. "U\nAI", "AI\n", "hi\n")
      const cleaned = text
        .replace(/^(U|AI|User|Assistant|Hi|Hello)[\n\s]*/i, '') // remove single labels at start
        .replace(/\n{2,}/g, '\n') // reduce multiple newlines to one
        .trim();

      return cleaned;
    }

    const filteredReply = cleanAIReply(aiReply);

    // Save user message and AI reply back to DB
    let conversation;

    if (!conversationId) {
      // Create new conversation with both messages
      conversation = await prisma.chatConversation.create({
        data: {
          userId: user.id,
          title: "New Chat",
          messages: {
            create: [
              {
                role: "user",
                content: fullUserMessage,
                createdAt: new Date(), // 🕒 now
              },
              {
                role: "assistant",
                content: filteredReply,
                createdAt: new Date(Date.now() + 5), // 🕒 +5ms to ensure it appears after
              },
            ],
          },
        },
        include: { messages: true },
      });
    } else {
      // Append messages to existing conversation
      conversation = await prisma.chatConversation.update({
        where: { id: conversationId },
        data: {
          messages: {
            create: [
              {
                role: "user",
                content: fullUserMessage,
                createdAt: new Date(), // 🕒 now
              },
              {
                role: "assistant",
                content: filteredReply,
                createdAt: new Date(Date.now() + 5), // 🕒 +5ms
              },
            ],
          },
        },
        include: { messages: true },
      });
    }

    return NextResponse.json({ message: filteredReply, conversation });
  } catch (error) {
    console.error("❌ General error in /api/chat/ask-google:", error);
    return NextResponse.json({ error: "Server error: " + error }, { status: 500 });
  }
}
