import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
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

  const { title } = await req.json();

  const conversation = await prisma.chatConversation.create({
    data: {
      userId: user.id,
      title: title || "New chat",  // Use passed title or fallback
    },
  });

  return NextResponse.json({ conversation });
}
