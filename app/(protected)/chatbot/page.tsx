"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChatbotSidebar } from "@/components/ChatbotSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import ReactMarkdown from "react-markdown";


type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
};

type Conversation = {
  id: string;
  title: string;
  createdAt: number;
  messages: ChatMessage[];
};

function generateId(prefix: string = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

export default function ChatbotPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const starterPrompts = useMemo(
    () => [
      "Summarize this product: AI CRM for sales teams",
      "Give me 5 marketing ideas for a B2B fintech startup",
      "Draft a polite follow-up email to a potential client",
      "Explain EBITDA margin like I'm new to finance",
    ],
    [],
  );

  

  useEffect(() => {
    const loadConversations = async () => {
      try {
        const res = await fetch("/api/chat/conversations");
        // Tell TypeScript what the expected shape of the data is
        const data: { conversations: Conversation[] } = await res.json();

        if (data?.conversations) {
          const fixedConversations = data.conversations.map(conv => ({
            ...conv,
            title:
              conv.title === "New Chat" &&
              Array.isArray(conv.messages) &&
              conv.messages.length > 0 &&
              conv.messages[0]?.content
                ? conv.messages[0].content.slice(0, 30)
                : conv.title,
          }));

          setConversations(fixedConversations);
          setActiveId(fixedConversations[0]?.id ?? null);
        }
      } catch (error) {
        console.error("Failed to load conversations from DB:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadConversations();
  }, []);


  const activeConversation = useMemo(() => {
    const conv = conversations.find(c => c.id === activeId);
    if (!conv) return null;
    const sortedMessages = [...conv.messages].sort((a, b) => a.createdAt - b.createdAt);
    return {
      ...conv,
      messages: sortedMessages,
    };
  }, [conversations, activeId]);

  async function handleNewChat() {
    try {
      const defaultTitle = starterPrompts[0] || "New Chat";

      const res = await fetch("/api/chat/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: defaultTitle }),
      });

      const data = await res.json();

      if (res.ok && data.conversation) {
        setConversations(prev => {
          const exists = prev.some(c => c.id === data.conversation.id);
          return exists ? prev : [data.conversation, ...prev];
        });
        setActiveId(data.conversation.id);
        setInput("");
        setTimeout(() => inputRef.current?.focus(), 0);
      } else {
        console.error("Failed to create conversation:", data.error);
      }
    } catch (err) {
      console.error("Error creating conversation:", err);
    }
  }

  async function handleDeleteConversation(id: string) {
  setConversations(prev => prev.filter(c => c.id !== id));
  if (activeId === id) {
    const remaining = conversations.filter(c => c.id !== id);
    setActiveId(remaining[0]?.id ?? null);
  }

  // Delete from DB
  try {
    await fetch("/api/chat/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: id }),
    });
  } catch (error) {
    console.error("Failed to delete conversation:", error);
  }
}

const assistantReplyFromGoogle = async (
  message: string,
  conversationId: string | null
): Promise<Conversation | null> => {
  try {
    const res = await fetch("/api/chat/ask-google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, conversationId }),
    });

    const data = await res.json();

    if (res.ok && data.conversation) {
      return data.conversation;
    } else {
      console.error("Google AI error:", data.error || data);
      return null;
    }
  } catch (err) {
    console.error("Failed to get response from /api/chat/ask-google:", err);
    return null;
  }
};


 async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    setInput("");

    try {
      const updatedConversation = await assistantReplyFromGoogle(trimmed, activeId);

      if (updatedConversation) {
        const sortedMessages = [...(updatedConversation.messages || [])].sort(
          (a, b) => a.createdAt - b.createdAt
        );

        // Extract the first message content to use as the new title
        const firstMessageContent = sortedMessages[0]?.content ?? "New Chat";
        const newTitle = firstMessageContent.slice(0, 30);

        // Update the conversation list with the updated conversation and new title
        setConversations(prev => {
          const others = prev.filter(c => c.id !== updatedConversation.id);
          const updatedConv = { ...updatedConversation, messages: sortedMessages, title: newTitle };
          return [updatedConv, ...others];
        });

        setActiveId(updatedConversation.id);

        // Send a request to update the title in the backend database
        await fetch("/api/chat/update-title", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: updatedConversation.id, title: newTitle }),
        });
      } else {
        console.error("No conversation returned from AI call.");
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsSending(false);
    }
  }




  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <ChatbotSidebar
          conversations={conversations}
          activeId={activeId}
          onNewChat={handleNewChat}
          onSelectConversation={(id) => {
            setActiveId(id);
            setInput("");
          }}
          onDeleteConversation={handleDeleteConversation}
        />

        {/* Main chat area */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <div className="text-sm font-semibold">Chatbot</div>
            </div>
            <div className="text-xs text-muted-foreground">
              Stored in a Database • Enter to send, Shift+Enter for newline
            </div>
          </div>

        <ScrollArea className="flex-1 p-4">
          <div className="mx-auto w-full max-w-3xl">
            {isLoading ? (
              <div className="text-center py-10 text-muted-foreground">
                Loading conversations...
              </div>
            ) : activeConversation?.messages?.length ? (
              <div className="flex flex-col gap-6">
                {[...activeConversation.messages]
                .sort((a, b) => a.createdAt - b.createdAt)
                .map(msg => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex w-full items-start gap-3",
                      msg.role === "user" ? "justify-end" : "justify-start",
                    )}
                  >
                    {msg.role === "assistant" ? (
                      <>
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>AI</AvatarFallback>
                        </Avatar>
                        <div
                          className={cn(
                            "prose prose-sm max-w-none rounded-md border bg-accent px-4 py-3 text-sm leading-relaxed dark:prose-invert",
                          )}
                        >
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      </>
                    ) : (
                      <>
                        <div
                          className={cn(
                            "prose prose-sm max-w-none rounded-md border px-4 py-3 text-sm leading-relaxed text-primary-foreground dark:prose-invert",
                            "bg-primary",
                          )}
                        >
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>U</AvatarFallback>
                        </Avatar>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mx-auto max-w-3xl py-10">
                <div className="mb-6 text-center">
                  <h1 className="text-lg font-semibold">How can I help you today?</h1>
                  <p className="text-sm text-muted-foreground">
                    Try one of these prompts to get started
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {starterPrompts.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => setInput(p)}
                      className="rounded-lg border p-4 text-left text-sm hover:bg-accent"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>



        <div className="sticky bottom-0 border-t bg-background/80 p-3 backdrop-blur">
          <div className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-xl border p-2 shadow-sm">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything..."
              rows={2}
            />
            <Button onClick={sendMessage} disabled={!input.trim() || isSending} className="shrink-0">
              {isSending ? "Sending..." : "Send"}
            </Button>
          </div>
        </div>
      </main>
        </div>
      </SidebarProvider>
    );
    
}