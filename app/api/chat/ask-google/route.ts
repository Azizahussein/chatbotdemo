import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";

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

    const { conversationId, message: userMessage } = await req.json();

    if (!userMessage || userMessage.trim() === "") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
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
      { author: "user", content: userMessage },
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
          parts: [{ text: msg.content }],
        })),
      }),
    });

    const raw = await response.text();
    console.log("🔍 Raw response from Google:", raw);
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
              { role: "user", content: userMessage },
              { role: "assistant", content: aiReply },
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
              { role: "user", content: userMessage },
              { role: "assistant", content: aiReply },
            ],
          },
        },
        include: { messages: true },
      });
    }

    return NextResponse.json({ message: aiReply, conversation });
  } catch (error) {
    console.error("❌ General error in /api/chat/ask-google:", error);
    return NextResponse.json({ error: "Server error: " + error }, { status: 500 });
  }
}
