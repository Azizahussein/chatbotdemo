"use client"

import { Button } from "@/components/ui/button"
import { Plus, Trash2, MessageSquare, ChevronDown } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

type Conversation = {
  id: string;
  title: string;
  createdAt: number;
  messages: any[];
};

type ChatbotSidebarProps = {
  conversations: Conversation[];
  activeId: string | null;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
}

export function ChatbotSidebar({
  conversations,
  activeId,
  onNewChat,
  onSelectConversation,
  onDeleteConversation
}: ChatbotSidebarProps) {
  return (
    <Sidebar className="border-r h-full min-w-[280px]">
      <SidebarHeader className="border-b p-4 bg-background border-b-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Conversations</h2>
          <Button onClick={onNewChat} size="sm" variant="outline" className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-5 w-5" />
            <span className="text-sm font-medium">New Chat</span>
          </Button>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="flex-1">
        <SidebarGroup>
          <Collapsible defaultOpen className="group/collapsible">
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between">
                  <span>Recent Chats</span>
                  <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                </div>
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {conversations.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground px-4">
                      <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">No conversations yet</p>
                      <p className="text-xs">Start a new chat to begin</p>
                    </div>
                  ) : (
                    conversations.map((conv) => (
                      <SidebarMenuItem key={conv.id}>
                        <div className="flex items-center justify-between w-full group">
                          <SidebarMenuButton 
                            asChild 
                            isActive={activeId === conv.id}
                            className="flex-1"
                          >
                            <button
                              onClick={() => onSelectConversation(conv.id)}
                              className="text-left w-full"
                            >
                              <div className="truncate">
                                {conv.title || "Untitled"}
                              </div>
                            </button>
                          </SidebarMenuButton>
                          <button
                            className="opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-100 p-1 ml-2"
                            onClick={() => onDeleteConversation(conv.id)}
                            aria-label="Delete conversation"
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                          </button>
                        </div>
                      </SidebarMenuItem>
                    ))
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
