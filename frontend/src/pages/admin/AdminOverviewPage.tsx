import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FolderTree, Scale, ShieldAlert, Users, Variable } from "lucide-react";
import { useAuth } from "@/context/auth";
import { api } from "@/lib/api";

export function AdminOverviewPage() {
  const { isAdmin } = useAuth();
  const varsQ = useQuery({ queryKey: ["variables"], queryFn: api.getVariables });
  const lawsQ = useQuery({ queryKey: ["laws"], queryFn: api.getLaws });
  const catsQ = useQuery({ queryKey: ["categories"], queryFn: api.getCategories });
  const usersQ = useQuery({
    queryKey: ["users"],
    queryFn: api.listUsers,
    enabled: isAdmin,
  });

  const variables = varsQ.data ?? [];
  const sensitiveCount = variables.filter((v) => v.sensivel).length;

  const cards = [
    {
      label: "Variáveis cadastradas",
      value: variables.length,
      icon: Variable,
      to: "/admin/variables",
      show: true,
    },
    {
      label: "Normas e Regulamentos",
      value: lawsQ.data?.length ?? 0,
      icon: Scale,
      to: "/admin/laws",
      show: true,
    },
    {
      label: "Potencialmente Sensíveis",
      value: sensitiveCount,
      icon: ShieldAlert,
      to: "/admin/variables",
      show: true,
    },
    {
      label: "Categorias Temáticas",
      value: catsQ.data?.length ?? 0,
      icon: FolderTree,
      to: "/admin/categories",
      show: isAdmin,
    },
    {
      label: "Usuários Ativos",
      value: usersQ.data?.filter((u) => u.is_active).length ?? 0,
      icon: Users,
      to: "/admin/users",
      show: isAdmin,
    },
  ].filter((c) => c.show);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <Link
          key={c.label}
          to={c.to}
          className="group rounded-xl border border-rule bg-surface p-6 shadow-xs transition-all hover:border-primary/50 hover:bg-surface-muted/50"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {c.label}
            </span>
            <div className="rounded-lg bg-surface-muted p-2 text-primary">
              <c.icon className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-4 font-mono text-3xl font-bold text-foreground">{c.value}</p>
        </Link>
      ))}
    </div>
  );
}
