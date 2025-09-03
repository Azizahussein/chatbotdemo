"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { BellIcon, Clock, TrendingUp, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import React, {
  useEffect,
  useState,
  useTransition,
  useCallback,
  useRef,
} from "react";
import { ScrollArea } from "./ui/scroll-area";

type PendingDeal = {
  id: string;
  title: string;
  ebitda: number;
  status: string;
};

type WebSocketMessage = {
  type: string;
  productId?: string;
  status?: string;
  userId?: string;
};

const NotificationPopover = ({ userId }: { userId: string }) => {
  const [open, setOpen] = useState(false);
  const [deals, setDeals] = useState<PendingDeal[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [isPending, startTransition] = useTransition();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef(false);

  const fetchDeals = useCallback(async () => {
    try {
      const res = await fetch("/api/deals/pending");
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data: PendingDeal[] = await res.json();
      console.log("📊 Fetched deals:", data);
      setDeals(data);
    } catch (error) {
      console.error("❌ Error fetching deals:", error);
    }
  }, []);

  const fetchAndTransition = useCallback(() => {
    startTransition(() => {
      fetchDeals();
    });
  }, [fetchDeals]);

  useEffect(() => {
    fetchAndTransition();
  }, [open, fetchAndTransition]);

  const formatEbitda = (ebitda: number) => {
    if (ebitda >= 1000000) {
      return `$${(ebitda / 1000000).toFixed(1)}M`;
    } else if (ebitda >= 1000) {
      return `$${(ebitda / 1000).toFixed(1)}K`;
    }
    return `$${ebitda.toLocaleString()}`;
  };

  // Create a ref to store the connect function to avoid dependency issues
  const connectWebSocketRef = useRef<() => void>();

  const connectWebSocket = useCallback(() => {
    // Prevent multiple simultaneous connection attempts
    if (
      isConnectingRef.current ||
      wsRef.current?.readyState === WebSocket.OPEN
    ) {
      return;
    }

    isConnectingRef.current = true;

    // Get WebSocket URL from environment or use default
    const wsUrl =
      process.env.NEXT_PUBLIC_WEBSOCKET_URL || "ws://localhost:8080";

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("✅ WebSocket connected");
        setWsConnected(true);
        isConnectingRef.current = false;

        // Clear any existing reconnect timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }

        // Register the user
        ws.send(
          JSON.stringify({
            type: "register",
            userId,
          }),
        );
      };

      ws.onmessage = (e) => {
        console.log("📨 Received WebSocket message:", e.data);

        try {
          const msg: WebSocketMessage = JSON.parse(e.data);

          // Validate message structure
          if (!msg || typeof msg.type !== "string") {
            console.warn("⚠️ Invalid WebSocket message format:", msg);
            return;
          }

          if (msg.type === "registered") {
            console.log("✅ User registered with WebSocket server");
          }

          if (msg.type === "new_screen_call") {
            console.log("🆕 New screen call received");
            fetchAndTransition();
          }

          if (msg.type === "problem_done" && msg.productId) {
            console.log("✅ Problem done received:", msg);
            setDeals((prev) => {
              const dealExists = prev.some((d) => d.id === msg.productId);
              if (dealExists) {
                console.log(
                  `Deal ${msg.productId} completed with status: ${msg.status || "unknown"}`,
                );
                return prev.filter((d) => d.id !== msg.productId);
              }
              return prev;
            });
          }
        } catch (error) {
          console.error("❌ Error parsing WebSocket message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("❌ WebSocket error:", error);
        setWsConnected(false);
        isConnectingRef.current = false;
      };

      ws.onclose = (event) => {
        console.log(
          "🔌 WebSocket connection closed:",
          event.code,
          event.reason,
        );
        setWsConnected(false);
        isConnectingRef.current = false;

        // Attempt to reconnect after 3 seconds, but only if not a normal closure
        if (event.code !== 1000 && event.code !== 1001) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log("🔄 Attempting to reconnect WebSocket...");
            // Use the ref to avoid dependency issues
            connectWebSocketRef.current?.();
          }, 3000);
        }
      };
    } catch (error) {
      console.error("❌ Failed to create WebSocket connection:", error);
      setWsConnected(false);
      isConnectingRef.current = false;

      // Attempt to reconnect after 5 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log("🔄 Attempting to reconnect WebSocket...");
        // Use the ref to avoid dependency issues
        connectWebSocketRef.current?.();
      }, 5000);
    }
  }, [userId, fetchAndTransition]);

  // Store the function in the ref
  useEffect(() => {
    connectWebSocketRef.current = connectWebSocket;
  }, [connectWebSocket]);

  useEffect(() => {
    if (userId) {
      connectWebSocket();
    }

    return () => {
      // Cleanup WebSocket connection
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounting");
        wsRef.current = null;
      }

      // Clear reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Reset connection state
      isConnectingRef.current = false;
    };
  }, [userId, connectWebSocket]); // Added connectWebSocket dependency

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="relative rounded-full p-2 transition-colors duration-200 hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
            <BellIcon className="size-5 text-foreground" />
            {deals.length > 0 && (
              <Badge
                variant="destructive"
                className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full p-0 text-xs font-medium"
              >
                {deals.length > 99 ? "99+" : deals.length}
              </Badge>
            )}
            <div
              className={cn(
                "absolute -bottom-0 -right-0 size-2 rounded-full",
                wsConnected ? "bg-green-500" : "bg-red-500",
              )}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center justify-between">
              <h5 className="flex items-center gap-2 font-semibold text-foreground">
                <FileText className="size-4" />
                Your Deals Queue
              </h5>
              <div className="flex items-center gap-2">
                {deals.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {deals.length} pending
                  </Badge>
                )}
                <div
                  className={cn(
                    "size-2 rounded-full",
                    wsConnected ? "bg-green-500" : "bg-red-500",
                  )}
                />
              </div>
            </div>
          </div>

          <ScrollArea className="h-[300px] px-4">
            {isPending && (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-primary"></div>
                  <span className="text-sm">Loading deals...</span>
                </div>
              </div>
            )}

            {!wsConnected && !isPending && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-3 size-12 rounded-full bg-red-100 p-2 dark:bg-red-900/20">
                  <div className="size-8 rounded-full bg-red-500"></div>
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  Connection lost
                </p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Attempting to reconnect...
                </p>
              </div>
            )}

            {deals.length === 0 && !isPending && wsConnected && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Clock className="mb-3 size-12 text-muted-foreground/50" />
                <p className="text-sm font-medium text-muted-foreground">
                  No pending deals
                </p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Your deals will appear here when they&apos;re ready
                </p>
              </div>
            )}

            {deals.length > 0 && !isPending && (
              <div className="space-y-2 py-2">
                {deals.map((deal) => (
                  <div
                    key={deal.id}
                    className="group relative cursor-pointer rounded-lg border border-border p-3 transition-all duration-200 hover:border-ring hover:bg-accent/50"
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <h5 className="truncate text-sm font-medium text-foreground">
                          {deal.title || `Deal #${deal.id}`}
                        </h5>
                        <p className="mt-1 text-xs text-muted-foreground">
                          ID: {deal.id}
                        </p>
                      </div>
                      <div className="ml-3 flex items-center gap-2">
                        <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                          <TrendingUp className="size-3" />
                          <span className="font-medium">
                            {formatEbitda(deal.ebitda)}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "px-2 py-0.5 text-xs",
                            deal.status === "Pending" &&
                              "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950/20 dark:text-yellow-300",
                          )}
                        >
                          {deal.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default NotificationPopover;
