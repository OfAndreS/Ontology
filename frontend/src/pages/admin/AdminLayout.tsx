import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { FolderTree, LayoutDashboard, Scale, Users, Variable } from "lucide-react";
import { useAuth } from "@/context/auth";

const TABS = [
  { to: "/admin", label: "Visão Geral", icon: LayoutDashboard, exact: true, adminOnly: false },
  { to: "/admin/variables", label: "Variáveis", icon: Variable, adminOnly: false },
  { to: "/admin/laws", label: "Normas", icon: Scale, adminOnly: false },
  { to: "/admin/categories", label: "Categorias", icon: FolderTree, adminOnly: true },
  { to: "/admin/users", label: "Usuários", icon: Users, adminOnly: true },
];

export function AdminLayout() {
  const { pathname } = useLocation();
  const { isAdmin } = useAuth();

  const visibleTabs = isAdmin ? TABS : TABS.filter((t) => !t.adminOnly);

  if (!isAdmin && (pathname.startsWith("/admin/categories") || pathname.startsWith("/admin/users"))) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="min-h-full bg-background">
      <header className="border-b border-rule bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-primary">
            {isAdmin ? "Administrador" : "Analista"}
          </p>
          <h1 className="mt-1 text-2xl font-bold leading-tight">Painel de Controle</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
            Gerencie variáveis, normas{isAdmin ? ", categorias temáticas e usuários" : ""} da plataforma.
          </p>

          <nav className="mt-5 flex flex-wrap gap-1.5">
            {visibleTabs.map((t) => {
              const active = t.exact
                ? pathname === t.to
                : pathname === t.to || pathname.startsWith(`${t.to}/`);
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors ${
                    active
                      ? "border-primary bg-primary font-medium text-primary-foreground"
                      : "border-rule bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <t.icon className="h-4 w-4" />
                  {t.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </div>
    </div>
  );
}
