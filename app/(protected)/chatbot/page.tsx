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

const STORAGE_KEY = "chatbot.conversations";
const ACTIVE_KEY = "chatbot.activeId";

function generateId(prefix: string = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

export default function ChatbotPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const starterPrompts = useMemo(
    () => [
      "Summarize this product: AI CRM for sales teams",
      "Give me 5 marketing ideas for a B2B fintech startup",
      "Draft a polite follow-up email to a potential client",
      "Explain EBITDA margin like I'm new to finance",
    ],
    [],
  );

  // Load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Conversation[]) : [];
      setConversations(parsed);
      const savedActive = localStorage.getItem(ACTIVE_KEY);
      if (savedActive && parsed.find(c => c.id === savedActive)) {
        setActiveId(savedActive);
      } else if (parsed[0]) {
        setActiveId(parsed[0].id);
      }
    } catch {
      // ignore
    }
  }, []);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch {
      // ignore
    }
  }, [conversations]);

  useEffect(() => {
    if (activeId) {
      try {
        localStorage.setItem(ACTIVE_KEY, activeId);
      } catch {
        // ignore
      }
    }
  }, [activeId]);

  const activeConversation = useMemo(
    () => conversations.find(c => c.id === activeId) || null,
    [conversations, activeId],
  );

  function handleNewChat() {
    const id = generateId("conv");
    const newConv: Conversation = {
      id,
      title: "New chat",
      createdAt: Date.now(),
      messages: [],
    };
    setConversations(prev => [newConv, ...prev]);
    setActiveId(id);
    setInput("");
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleDeleteConversation(id: string) {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeId === id) {
      const remaining = conversations.filter(c => c.id !== id);
      setActiveId(remaining[0]?.id ?? null);
    }
  }

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;
    let convId = activeId;
    // Create a conversation if none exists
    if (!convId) {
      const id = generateId("conv");
      const newConv: Conversation = {
        id,
        title: trimmed.slice(0, 30) || "New chat",
        createdAt: Date.now(),
        messages: [],
      };
      setConversations(prev => [newConv, ...prev]);
      setActiveId(id);
      convId = id;
    }

    const userMsg: ChatMessage = {
      id: generateId("msg"),
      role: "user",
      content: trimmed,
      createdAt: Date.now(),
    };

    setInput("");
    setIsSending(true);
    setConversations(prev =>
      prev.map(c =>
        c.id === convId
          ? {
              ...c,
              title: c.messages.length === 0 ? trimmed.slice(0, 30) || c.title : c.title,
              messages: [...c.messages, userMsg],
            }
          : c,
      ),
    );

    // Simulate assistant reply locally (no backend calls)
    await new Promise(r => setTimeout(r, 400));
    const assistantMsg: ChatMessage = {
      id: generateId("msg"),
      role: "assistant",
      content: `Pretend AI: ${trimmed}`,
      createdAt: Date.now(),
    };
    setConversations(prev =>
      prev.map(c => (c.id === convId ? { ...c, messages: [...c.messages, assistantMsg] } : c)),
    );
    setIsSending(false);
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
          onSelectConversation={setActiveId}
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
              Stored locally • Enter to send, Shift+Enter for newline
            </div>
          </div>

        <ScrollArea className="flex-1 p-4">
          <div className="mx-auto w-full max-w-3xl">
            {activeConversation?.messages.length ? (
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
                        <div className={cn(
                          "prose prose-sm max-w-none rounded-md border bg-accent px-4 py-3 text-sm leading-relaxed dark:prose-invert",
                        )}>
                          {msg.content}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className={cn(
                          "prose prose-sm max-w-none rounded-md border px-4 py-3 text-sm leading-relaxed text-primary-foreground dark:prose-invert",
                          "bg-primary",
                        )}>
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