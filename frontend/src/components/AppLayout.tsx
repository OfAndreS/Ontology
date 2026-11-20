import { useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  FileCheck2,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  PanelLeft,
  PlusCircle,
  Scale,
  X,
} from "lucide-react";
import { useAuth } from "@/context/auth";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type NavItem = {
  title: string;
  to: string;
  icon: typeof Home;
  badgeKey?: "variables" | "laws";
};

const knowledgeItems: NavItem[] = [
  { title: "Catálogo de Variáveis", to: "/", icon: Home, badgeKey: "variables" },
  { title: "Normas e Leis", to: "/laws", icon: Scale, badgeKey: "laws" },
  { title: "Conceitos Schema.org", to: "/concepts", icon: Network },
];

const govItems: NavItem[] = [
  { title: "Nova Variável", to: "/variables/new", icon: PlusCircle },
  { title: "Relatório Preventivo", to: "/report", icon: FileCheck2 },
  { title: "Painel de Controle", to: "/admin", icon: LayoutDashboard },
];

function getInitials(name?: string | null): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, isAdmin, logout } = useAuth();

  const varsQ = useQuery({ queryKey: ["variables"], queryFn: api.getVariables });
  const lawsQ = useQuery({ queryKey: ["laws"], queryFn: api.getLaws });

  const isActive = (to: string) => {
    if (to === "/") {
      return (
        pathname === "/" ||
        (pathname.startsWith("/variables/") && !pathname.startsWith("/variables/new"))
      );
    }
    return pathname === to || pathname.startsWith(`${to}/`);
  };

  const badgeCounts: Record<NonNullable<NavItem["badgeKey"]>, number | undefined> = {
    variables: varsQ.data?.length,
    laws: lawsQ.data?.length,
  };

  const renderGroup = (label: string, items: NavItem[], compact: boolean) => (
    <div>
      {!compact && (
        <p className="mb-2 px-2 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/50">
          {label}
        </p>
      )}
      <ul className="space-y-1">
        {items.map((item) => {
          const active = isActive(item.to);
          const count = item.badgeKey ? badgeCounts[item.badgeKey] : undefined;
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                title={item.title}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center rounded-md py-2 text-sm transition-colors",
                  compact ? "justify-center px-2" : "justify-between gap-2 px-2.5",
                  active
                    ? "bg-sidebar-primary font-medium text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <span className={cn("flex min-w-0 items-center", compact ? "" : "gap-3")}>
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!compact && <span className="truncate">{item.title}</span>}
                </span>
                {!compact && count !== undefined && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 font-mono text-[0.65rem] font-semibold",
                      active
                        ? "bg-sidebar-primary-foreground/20 text-sidebar-primary-foreground"
                        : "bg-sidebar-accent text-sidebar-foreground/75",
                    )}
                  >
                    {count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );

  const renderSidebarContent = (compact: boolean, showCloseButton = false) => (
    <>
      <div className="flex items-center justify-between border-b border-sidebar-border p-3">
        <Link
          to="/"
          onClick={() => setMobileOpen(false)}
          className={cn("flex items-center gap-3 px-1 py-1", compact && "mx-auto")}
        >
          {compact ? (
            <span className="flex h-8 items-center justify-center rounded-md bg-primary px-1.5 text-[0.65rem] font-bold tracking-wider text-primary-foreground">
              ICTi
            </span>
          ) : (
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="text-[0.65rem] tracking-[0.18em] text-sidebar-foreground/60">
                ICTi
              </span>
              <span className="truncate text-sm font-semibold text-sidebar-foreground">
                Feature Governance
              </span>
            </div>
          )}
        </Link>
        {showCloseButton && (
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent md:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto p-3">
        {renderGroup("Base de Conhecimento", knowledgeItems, compact)}
        {renderGroup("Governança & Gestão", govItems, compact)}
      </nav>

      <div className="space-y-2.5 border-t border-sidebar-border p-3">
        {user &&
          (compact ? (
            <div className="flex flex-col items-center gap-2">
              <div
                title={`${user.name} (${isAdmin ? "Administrador" : "Analista"})`}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-primary/20 text-xs font-bold text-sidebar-primary"
              >
                {getInitials(user.name)}
              </div>
              <button
                type="button"
                onClick={logout}
                title="Sair"
                className="flex h-8 w-8 items-center justify-center rounded-md border border-sidebar-border text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-sidebar-border/80 bg-sidebar-accent/40 px-2.5 py-2 text-xs">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/20 font-bold text-sidebar-primary">
                  {getInitials(user.name)}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-sidebar-foreground">{user.name}</p>
                  <p className="text-[0.65rem] uppercase tracking-wider text-sidebar-primary">
                    {isAdmin ? "Administrador" : "Analista"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={logout}
                title="Sair"
                className="rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ))}

        {!showCloseButton && (
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-sidebar-border py-1.5 text-xs text-sidebar-foreground/75 hover:bg-sidebar-accent"
          >
            <PanelLeft className="h-3.5 w-3.5" />
            {!compact && <span>Recolher</span>}
          </button>
        )}
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground md:flex-row">
      {/* Barra superior apenas em telas pequenas */}
      <div className="no-print flex items-center justify-between border-b border-sidebar-border bg-sidebar px-4 py-2.5 text-sidebar-foreground md:hidden">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="text-sm font-semibold">Feature Governance</span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-md border border-sidebar-border p-1.5 text-sidebar-foreground/80 hover:bg-sidebar-accent"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Drawer mobile */}
      {mobileOpen && (
        <div className="no-print fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
            {renderSidebarContent(false, true)}
          </aside>
        </div>
      )}

      {/* Sidebar fixa em desktop */}
      <aside
        className={cn(
          "no-print sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-200 md:flex",
          collapsed ? "w-16" : "w-64",
        )}
      >
        {renderSidebarContent(collapsed)}
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
