import { Link, useRouterState } from "@tanstack/react-router";
import {
  MessageSquare,
  CheckSquare,
  Calendar as CalendarIcon,
  StickyNote,
  FileText,
  Coins,
  Settings as SettingsIcon,
  TerminalSquare,
} from "lucide-react";
import logoUrl from "@/assets/jpa-logo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: TerminalSquare },
  { title: "Chat", url: "/chat", icon: MessageSquare },
  { title: "Tasks", url: "/tasks", icon: CheckSquare },
  { title: "Calendar", url: "/calendar", icon: CalendarIcon },
  { title: "Notes", url: "/notes", icon: StickyNote },
  { title: "Documents", url: "/documents", icon: FileText },
  { title: "Credits", url: "/credits", icon: Coins },
  { title: "Settings", url: "/settings", icon: SettingsIcon },
];

export function AppSidebar() {
  const { state, setOpen, setOpenMobile, isMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });

  const handleNavigate = () => {
    if (isMobile) setOpenMobile(false);
    else setOpen(false);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-2">
          <img
            src={logoUrl}
            alt="J.P.A. OS"
            className="h-8 w-8 object-contain"
            style={{ imageRendering: "pixelated", filter: "drop-shadow(0 0 6px rgba(78,245,138,0.6))" }}
          />
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-[0.18em]">J.P.A. OS</span>
              <span className="text-[10px] text-muted-foreground tracking-widest">TERMINAL v1.0</span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active =
                  item.url === "/"
                    ? path === "/"
                    : path.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link to={item.url} onClick={handleNavigate}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}