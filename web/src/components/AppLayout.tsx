import { useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  FileCheck2,
  Home,
  Network,
  PanelLeft,
  PlusCircle,
  Moon,
  Sun,
} from "lucide-react";
import ictiLogo from "@/assets/icti-logo.svg";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "Catálogo de Variáveis", to: "/", icon: Home },
  { title: "Cadastrar Variável", to: "/variables/new", icon: PlusCircle },
];

const govItems = [
  { title: "Conceitos Schema.org", to: "/concepts", icon: Network },
  { title: "Relatório Preventivo V1", to: "/report", icon: FileCheck2 },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);

  const varsQ = useQuery({ queryKey: ["variables"], queryFn: api.getVariables });
  const conceptsQ = useQuery({ queryKey: ["concepts"], queryFn: api.getConcepts });

  const isActive = (to: string) => {
    if (to === "/") return pathname === "/";
    return pathname.startsWith(to);
  };

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  };

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <aside
        className={cn(
          "no-print flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-200",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <div className="border-b border-sidebar-border p-3">
          <Link to="/" className="flex items-center gap-3 px-1 py-1">
            <img
              src={ictiLogo}
              alt="Instituto de Ciência e Tecnologia Itaú"
              className={cn("shrink-0 object-contain", collapsed ? "h-8 w-8" : "h-10 w-auto")}
            />
            {!collapsed && (
              <div className="flex min-w-0 flex-col leading-tight">
                <span className="text-[0.65rem] tracking-[0.18em] text-sidebar-foreground/60">
                  ICTi · MyOnt
                </span>
                <span className="truncate text-sm font-semibold text-sidebar-foreground">
                  Feature Governance
                </span>
              </div>
            )}
          </Link>
        </div>

        <nav className="flex-1 space-y-6 p-3">
          <div>
            {!collapsed && (
              <p className="mb-2 px-2 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/50">
                Navegação
              </p>
            )}
            <ul className="space-y-1">
              {navItems.map((item) => {
                const active = isActive(item.to);
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      title={item.title}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors",
                        active
                          ? "bg-sidebar-primary font-medium text-sidebar-primary-foreground"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="truncate">{item.title}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            {!collapsed && (
              <p className="mb-2 px-2 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/50">
                Ontologia & Auditoria
              </p>
            )}
            <ul className="space-y-1">
              {govItems.map((item) => {
                const active = isActive(item.to);
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      title={item.title}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors",
                        active
                          ? "bg-sidebar-primary font-medium text-sidebar-primary-foreground"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="truncate">{item.title}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {!collapsed && (
            <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/60 p-3 text-xs text-sidebar-foreground/80">
              <div className="flex items-center gap-1.5 font-semibold text-sidebar-foreground">
                <BookOpen className="h-3.5 w-3.5 text-sidebar-primary" />
                Grafo RDF V1
              </div>
              <div className="mt-2 space-y-1 font-mono text-[0.7rem] text-sidebar-foreground/70">
                <div className="flex justify-between">
                  <span>Variáveis</span>
                  <span>{varsQ.data?.length ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Schema.org</span>
                  <span>{conceptsQ.data?.length ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Proxies</span>
                  <span>{varsQ.data ? varsQ.data.filter((v) => v.isProxy).length : "—"}</span>
                </div>
              </div>
            </div>
          )}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          {!collapsed && (
            <p className="px-1 text-[0.65rem] text-sidebar-foreground/50">
              MyOnt V1 · RDF/OWL + Schema.org
            </p>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex h-12 items-center justify-between border-b border-rule bg-surface/95 px-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground"
              aria-label="Alternar barra lateral"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-medium text-muted-foreground">
              Governança Algorítmica Preventiva Baseada em Web Semântica
            </span>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center gap-1.5 rounded-md border border-rule bg-surface px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-surface-muted hover:text-foreground"
          >
            {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            {dark ? "Claro" : "Escuro"}
          </button>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
