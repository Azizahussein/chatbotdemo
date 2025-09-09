import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const userSession = await auth();

  if (!userSession?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { conversationId, title } = await request.json();

  if (!conversationId || typeof title !== "string") {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Verify user owns the conversation before updating
  const conversation = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  if (conversation.userId !== userSession.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Update the title
  const updatedConversation = await prisma.chatConversation.update({
    where: { id: conversationId },
    data: { title },
  });

  return NextResponse.json({ conversation: updatedConversation });
}
