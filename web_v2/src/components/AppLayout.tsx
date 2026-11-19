import { useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  FileCheck2,
  Home,
  Moon,
  Network,
  PanelLeft,
  PlusCircle,
  Share2,
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
  { title: "Modelo da Ontologia V2", to: "/ontology", icon: Share2 },
  { title: "Conceitos Schema.org", to: "/concepts", icon: Network },
  { title: "Relatório Preventivo V2", to: "/report", icon: FileCheck2 },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);

  const varsQ = useQuery({ queryKey: ["variables"], queryFn: api.getVariables });
  const conceptsQ = useQuery({ queryKey: ["concepts"], queryFn: api.getConcepts });
  const overviewQ = useQuery({ queryKey: ["ontology-overview"], queryFn: api.getOntologyOverview });

  const isActive = (to: string) => {
    if (to === "/") return pathname === "/";
    return pathname.startsWith(to);
  };

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  };

  const totalRiscos = varsQ.data
    ? varsQ.data.reduce((acc, v) => acc + v.riscos.length, 0)
    : undefined;

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
                  MyOnt · Vitrine V2
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
                Grafo RDF V2 ({overviewQ.data?.version ?? "2.0.0"})
              </div>
              <div className="mt-2 space-y-1 font-mono text-[0.7rem] text-sidebar-foreground/70">
                <div className="flex justify-between">
                  <span>Variáveis</span>
                  <span>{varsQ.data?.length ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Nós de Risco</span>
                  <span>{totalRiscos ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Instrumentos</span>
                  <span>{overviewQ.data?.stats.instrumentos ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Dispositivos</span>
                  <span>{overviewQ.data?.stats.dispositivos ?? "—"}</span>
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
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              title="Recolher menu"
            >
              <PanelLeft className="h-4 w-4" />
              {!collapsed && <span>Recolher</span>}
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              title={dark ? "Modo claro" : "Modo escuro"}
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex h-12 items-center justify-between border-b border-rule bg-surface/90 px-6 backdrop-blur-xs">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono font-semibold text-foreground">myont_v2.ttl</span>
            <span>·</span>
            <span>Vitrine da Ontologia V2 (Variável → Risco → Normas & Dispositivos)</span>
          </div>
          <Link
            to="/ontology"
            className="text-xs font-medium text-primary hover:underline"
          >
            Ver Diagrama & Esquema V2
          </Link>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
