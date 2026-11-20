import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/auth";
import { api, type RoleType } from "@/lib/api";

export function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const usersQ = useQuery({ queryKey: ["users"], queryFn: api.listUsers });

  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<RoleType>("analista");

  const createMut = useMutation({
    mutationFn: () =>
      api.createUser({
        username: username.trim(),
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        is_active: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Usuário criado.");
      setUsername("");
      setName("");
      setEmail("");
      setPassword("");
      setRole("analista");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao criar usuário."),
  });

  const toggleRoleMut = useMutation({
    mutationFn: ({ publicId, nextRole }: { publicId: string; nextRole: RoleType }) =>
      api.updateUser(publicId, { role: nextRole }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Papel atualizado.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao atualizar papel."),
  });

  const toggleActiveMut = useMutation({
    mutationFn: ({ publicId, isActive }: { publicId: string; isActive: boolean }) =>
      api.updateUser(publicId, { is_active: isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Status atualizado.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao atualizar status."),
  });

  const deleteMut = useMutation({
    mutationFn: (publicId: string) => api.deleteUser(publicId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Usuário removido.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao remover usuário."),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !name.trim() || !email.trim() || password.length < 6) {
      toast.error("Preencha todos os campos (senha com mínimo de 6 caracteres).");
      return;
    }
    createMut.mutate();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <form
        onSubmit={handleSubmit}
        className="space-y-3 rounded-xl border border-rule bg-surface p-5 lg:col-span-4"
      >
        <h2 className="text-sm font-bold text-foreground">Novo Usuário</h2>

        <label className="block space-y-1 text-xs">
          <span className="font-semibold">Username *</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="joao.silva"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>

        <label className="block space-y-1 text-xs">
          <span className="font-semibold">Nome Completo *</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="João Silva"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>

        <label className="block space-y-1 text-xs">
          <span className="font-semibold">E-mail *</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="joao@instituicao.com"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>

        <label className="block space-y-1 text-xs">
          <span className="font-semibold">Senha inicial *</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>

        <label className="block space-y-1 text-xs">
          <span className="font-semibold">Papel</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as RoleType)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="analista">Analista</option>
            <option value="admin">Administrador</option>
          </select>
        </label>

        <button
          type="submit"
          disabled={createMut.isPending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> Criar Usuário
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-rule bg-surface lg:col-span-8">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-rule bg-surface-muted text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Usuário</th>
              <th className="px-4 py-3 font-semibold">Papel</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {(usersQ.data ?? []).map((u) => {
              const isSelf = u.public_id === currentUser?.public_id;
              return (
                <tr key={u.public_id} className="hover:bg-background/60">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-foreground">{u.name}</p>
                    <p className="font-mono text-[0.7rem] text-muted-foreground">
                      @{u.username} · {u.email}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      disabled={isSelf}
                      value={u.role}
                      onChange={(e) =>
                        toggleRoleMut.mutate({
                          publicId: u.public_id,
                          nextRole: e.target.value as RoleType,
                        })
                      }
                      className="rounded border border-input bg-background px-2 py-1 text-xs disabled:opacity-60"
                    >
                      <option value="analista">Analista</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={isSelf}
                      onClick={() =>
                        toggleActiveMut.mutate({
                          publicId: u.public_id,
                          isActive: !u.is_active,
                        })
                      }
                      className={`rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold disabled:opacity-60 ${
                        u.is_active
                          ? "bg-[oklch(0.95_0.05_140)] text-[oklch(0.32_0.12_140)]"
                          : "bg-surface-muted text-muted-foreground"
                      }`}
                    >
                      {u.is_active ? "Ativo" : "Inativo"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!isSelf && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Excluir usuário "${u.name}"?`)) {
                            deleteMut.mutate(u.public_id);
                          }
                        }}
                        className="rounded border border-destructive/30 p-1.5 text-destructive hover:bg-destructive/10"
                        title="Excluir usuário"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
