import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import ictiLogo from "@/assets/icti-logo.svg";
import { useAuth } from "@/context/auth";

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast.error("Informe usuário e senha.");
      return;
    }
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      toast.success("Sessão iniciada.");
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao autenticar.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-rule bg-surface p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <img src={ictiLogo} alt="ICTi" className="h-11 w-auto" />
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-primary">
              ICTi · MyOnt V2
            </p>
            <h1 className="text-xl font-bold text-foreground">Governança de Variáveis</h1>
          </div>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">
          Acesse a plataforma para consultar o catálogo semântico de variáveis de crédito, normas e relatórios preventivos.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block space-y-1.5 text-xs">
            <span className="font-semibold text-foreground">Usuário ou e-mail</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              autoComplete="username"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>

          <label className="block space-y-1.5 text-xs">
            <span className="font-semibold text-foreground">Senha</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-xs hover:opacity-95 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
