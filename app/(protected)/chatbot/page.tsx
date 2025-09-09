"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChatbotSidebar } from "@/components/ChatbotSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Mic, MicOff, Plus, Paperclip, Image as ImageIcon, X, Sparkles, Send } from "lucide-react";
import TextToSpeech from "@/components/TextToSpeech";


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

  // Attachments state
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Voice state
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Autocomplete state
  const [isAutoCompleting, setIsAutoCompleting] = useState(false);

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
    setAttachments([]);
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
    if ((!trimmed && attachments.length === 0) || isSending) return;
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

    const contentWithAttachmentNote =
      attachments.length > 0
        ? `${trimmed}${trimmed ? "\n\n" : ""}(Attached ${attachments.length} file${attachments.length > 1 ? "s" : ""})`
        : trimmed;

    const userMsg: ChatMessage = {
      id: generateId("msg"),
      role: "user",
      content: contentWithAttachmentNote,
      createdAt: Date.now(),
    };

    setInput("");
    setIsSending(true);
    setAttachments([]);
    setConversations(prev =>
      prev.map(c =>
        c.id === convId
          ? {
              ...c,
              title: c.messages.length === 0 ? contentWithAttachmentNote.slice(0, 30) || c.title : c.title,
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
      content: `Pretend AI: ${trimmed || "Received your attachments."}`,
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

  // Attachments handlers
  function onClickAddFiles() {
    fileInputRef.current?.click();
  }

  function onFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setAttachments(prev => [...prev, ...files].slice(0, 10));
    e.target.value = ""; // reset so same file can be re-selected
  }

  function removeAttachment(index: number) {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }

  // Voice handlers
  function drawWaveform() {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      const dpr = (window as any).devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const desiredWidth = Math.floor(rect.width * dpr);
      const desiredHeight = Math.floor(rect.height * dpr);
      if (canvas.width !== desiredWidth || canvas.height !== desiredHeight) {
        canvas.width = desiredWidth;
        canvas.height = desiredHeight;
      }

      analyser.getByteTimeDomainData(dataArray);
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      // background: solid white
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      // waveform
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#374151"; // gray-700
      ctx.beginPath();

      const sliceWidth = (width * 1.0) / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0; // 0..2
        const y = (v * height) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.stroke();

      animationFrameRef.current = requestAnimationFrame(render);
    };
    animationFrameRef.current = requestAnimationFrame(render);
  }

  async function startAudioVisualization() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;
      source.connect(analyser);
      drawWaveform();
    } catch {
      // ignore
    }
  }

  function stopAudioVisualization() {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch {}
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    analyserRef.current = null;
  }

  function toggleRecording() {
    const SpeechRecognition: any =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    if (!isRecording) {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.interimResults = true;
      recognition.continuous = true;

      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            transcript += event.results[i][0].transcript;
          }
        }
        if (transcript.trim()) {
          setInput(prev => (prev ? prev + " " : "") + transcript.trim());
        }
      };
      recognition.onerror = () => {
        setIsRecording(false);
      };
      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsRecording(true);
      // start visualizer
      startAudioVisualization();
    } else {
      try {
        recognitionRef.current?.stop();
      } catch {}
      setIsRecording(false);
      stopAudioVisualization();
    }
  }

  // Autocomplete handler (client-side heuristic)
  function onAutocomplete() {
    if (isAutoCompleting) return;
    setIsAutoCompleting(true);

    const base = input.trim();
    let suggestion = "";

    if (!base) {
      // If no input, suggest from starter prompts (cycle pick)
      const index = Math.floor(Date.now() / 1000) % starterPrompts.length;
      suggestion = starterPrompts[index];
    } else {
      // Simple heuristic completion
      const suffix =
        " Please include any relevant context (industry, size, region) so I can tailor the response.";
      suggestion = base.endsWith(".") ? base + suffix : base + "." + suffix;
    }

    // Simulate small latency
    setTimeout(() => {
      setInput(suggestion);
      setIsAutoCompleting(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }, 150);
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
        <main className="flex min-w-0 flex-1 flex-col ml-4">
          <div className="flex items-center justify-between border-b pl-16 pr-4 py-2 bg-gradient-to-r from-background to-muted/30">
            <div className="flex items-center gap-6">
              <SidebarTrigger className="h-10 w-10" />
              <div className="text-xl font-semibold tracking-tight">Chatbot</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-full border px-2 py-1 text-[10px] font-medium text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Model: Default
              </div>
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
                          <div className="flex items-start gap-2">
                            <div className={cn(
                              "prose prose-sm max-w-[80%] rounded-2xl border bg-accent px-4 py-3 text-sm leading-relaxed shadow-sm dark:prose-invert",
                            )}>
                              {msg.content}
                            </div>
                            <TextToSpeech text={msg.content} />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className={cn(
                            "prose prose-sm max-w-[80%] rounded-2xl border px-4 py-3 text-sm leading-relaxed text-primary-foreground shadow-sm dark:prose-invert",
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
                  {isSending && (
                    <div className="flex w-full items-start gap-3 justify-start">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>AI</AvatarFallback>
                      </Avatar>
                      <div className="flex items-start gap-2">
                        <div className="rounded-2xl border bg-accent px-4 py-3 text-sm shadow-sm">
                          <div className="flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-foreground/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                            <span className="h-1.5 w-1.5 rounded-full bg-foreground/60 animate-bounce" style={{ animationDelay: "120ms" }} />
                            <span className="h-1.5 w-1.5 rounded-full bg-foreground/60 animate-bounce" style={{ animationDelay: "240ms" }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mx-auto max-w-3xl py-16 flex min-h-[60vh] flex-col items-center justify-center">
                  <div className="mb-10 text-center">
                    <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">How can I help you today?</h1>
                    <p className="mt-2 text-lg text-muted-foreground">Try one of these to get started</p>
                  </div>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    {starterPrompts.map((p, idx) => (
                      <button
                        key={idx}
                        onClick={() => setInput(p)}
                        className="group rounded-2xl border p-6 text-left text-lg transition-colors hover:bg-accent/60"
                      >
                        <div className="flex items-start gap-3">
                          <div className="rounded-md bg-primary/10 p-2.5 text-primary">
                            <Sparkles className="h-5 w-5" />
                          </div>
                          <div className="flex-1 leading-relaxed text-foreground/90">
                            {p}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="sticky bottom-6 border-t-0 bg-transparent px-3 pb-4">
            <div className="mx-auto w-full max-w-3xl space-y-2">
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {attachments.map((file, i) => (
                    <div key={`${file.name}-${i}`} className="flex items-center gap-2 rounded-md border px-2 py-1 text-xs">
                      <Paperclip className="h-3 w-3" />
                      <span className="max-w-[200px] truncate">{file.name}</span>
                      <button className="opacity-70 hover:opacity-100" onClick={() => removeAttachment(i)} aria-label="Remove attachment">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="mx-auto flex w-full items-center gap-4 rounded-full border p-4 shadow-md bg-card/70">
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={onClickAddFiles} aria-label="Add attachments">
                    <Plus className="h-5 w-5" />
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf,.txt,.doc,.docx"
                    multiple
                    className="hidden"
                    onChange={onFilesSelected}
                  />
                </div>

                {isRecording ? (
                  <div className="relative flex-1 overflow-hidden rounded-md">
                    <canvas
                      ref={canvasRef}
                      className="h-[56px] w-full"
                    />
                  </div>
                ) : (
                  <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me anything..."
                  className="min-h-[56px] max-h-56 resize-none border-0 bg-transparent px-2 text-lg shadow-none focus:shadow-none focus-visible:ring-0 focus:ring-0 focus-visible:outline-none"
                  rows={1}
                />
                )}

                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={onAutocomplete} aria-label="Autocomplete" disabled={isAutoCompleting}>
                    <Sparkles className="h-5 w-5" />
                  </Button>
                  <div className="flex items-center">
                    <div className="relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleRecording}
                        aria-label="Toggle voice"
                      >
                        {isRecording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                      </Button>
                      {isRecording && (
                        <span className="pointer-events-none absolute -inset-1 rounded-full ring-2 ring-primary/40 animate-pulse" />
                      )}
                    </div>
                    {/* no text chip while recording */}
                  </div>
                  <Button
                    onClick={sendMessage}
                    disabled={(!!input.trim() === false && attachments.length === 0) || isSending}
                    className="shrink-0 rounded-full h-11 w-11"
                  >
                    <Send className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}