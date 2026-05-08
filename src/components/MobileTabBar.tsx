import { Link, useRouterState } from "@tanstack/react-router";
import {
  MessageSquare,
  CheckSquare,
  Calendar as CalendarIcon,
  StickyNote,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { title: "Chat", url: "/chat", icon: MessageSquare },
  { title: "Tasks", url: "/tasks", icon: CheckSquare },
  { title: "Calendar", url: "/calendar", icon: CalendarIcon },
  { title: "Notes", url: "/notes", icon: StickyNote },
  { title: "More", url: "/settings", icon: MoreHorizontal },
];

export function MobileTabBar() {
  const path = useRouterState({ select: (r) => r.location.pathname });

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/85 backdrop-blur-xl pb-safe md:hidden"
      role="navigation"
      aria-label="Primary"
    >
      <ul className="mx-auto flex max-w-xl items-stretch justify-around px-1 pt-1">
        {tabs.map((tab) => {
          const active =
            tab.url === "/"
              ? path === "/"
              : path.startsWith(tab.url);
          const Icon = tab.icon;
          return (
            <li key={tab.title} className="flex-1">
              <Link
                to={tab.url}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1.5 text-[10px] font-medium transition-colors active:scale-95 active:bg-accent/60",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className={cn("h-[22px] w-[22px]", active && "stroke-[2.4]")} />
                <span className="leading-tight">{tab.title}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}