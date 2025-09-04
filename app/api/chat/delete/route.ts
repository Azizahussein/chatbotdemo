import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
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

  const { conversationId } = await req.json();

  if (!conversationId) {
    return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
  }

  // Ensure the conversation belongs to the user
  const conversation = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation || conversation.userId !== user.id) {
    return NextResponse.json({ error: "Conversation not found or access denied" }, { status: 404 });
  }

  // Delete the conversation and related messages
  await prisma.chatConversation.delete({
    where: { id: conversationId },
  });

  return NextResponse.json({ success: true });
}
