"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChatbotSidebar } from "@/components/ChatbotSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";


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
      const data = await res.json();
      if (data?.conversations) {
        setConversations(data.conversations);
        setActiveId(data.conversations[0]?.id ?? null);
      }
    } catch (error) {
      console.error("Failed to load conversations from DB:", error);
    } finally {
      setIsLoading(false);
    }
  };

  loadConversations();
}, []);


  const activeConversation = useMemo(
    () => conversations.find(c => c.id === activeId) || null,
    [conversations, activeId],
  );

  async function handleNewChat() {
  try {
    const res = await fetch("/api/chat/create", {
      method: "POST",
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

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const userMsg: ChatMessage = {
      id: generateId("msg"),
      role: "user",
      content: trimmed,
      createdAt: Date.now(),
    };

    const assistantMsg: ChatMessage = {
      id: generateId("msg"),
      role: "assistant",
      content: `Pretend AI: ${trimmed}`,
      createdAt: Date.now(),
    };

    setInput("");
    setIsSending(true);

    try {
      if (!activeId) {
        // Create new conversation with messages
        const res = await fetch("/api/chat/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: null,
            title: trimmed.slice(0, 30),
            messages: [userMsg, assistantMsg],
          }),
        });
        const data = await res.json();

        if (res.ok && data.conversation) {
          setConversations(prev => {
            const exists = prev.some(c => c.id === data.conversation.id);
            return exists ? prev : [data.conversation, ...prev];
          });
          setActiveId(data.conversation.id);
        } else {
          console.error("Failed to create conversation:", data);
        }
      } else {
        // Update existing conversation's messages locally
        setConversations(prev =>
          prev.map(c => {
            if (c.id === activeId) {
              const updatedTitle = c.title === "New Chat" ? trimmed.slice(0, 30) : c.title;
              return {
                ...c,
                title: updatedTitle,
                messages: [...(c.messages ?? []), userMsg, assistantMsg],
              };
            }
            return c;
          })
        );


        // Also send updated messages to server
        await fetch("/api/chat/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: activeId,
            title: trimmed.slice(0, 30),
            messages: [userMsg, assistantMsg],
          }),
        });
      }
    } catch (error) {
      console.error("Failed to save message:", error);
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
                {activeConversation.messages.map(msg => (
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
                          {msg.content}
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
                          {msg.content}
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