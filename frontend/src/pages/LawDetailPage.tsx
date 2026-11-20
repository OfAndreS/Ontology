import { useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Clock,
  Download,
  Edit3,
  ExternalLink,
  FileText,
  Scale,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { api, downloadProtectedPdf } from "@/lib/api";

export function LawDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const lawQ = useQuery({
    queryKey: ["law", slug],
    queryFn: () => api.getLaw(slug!),
    enabled: Boolean(slug),
  });

  const deleteMut = useMutation({
    mutationFn: () => api.deleteLaw(slug!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["laws"] });
      queryClient.invalidateQueries({ queryKey: ["vocabularies"] });
      toast.success("Norma excluída.");
      navigate("/laws");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao excluir norma."),
  });

  const uploadPdfMut = useMutation({
    mutationFn: (file: File) => api.uploadLawPdf(slug!, file),
    onSuccess: (updated) => {
      queryClient.setQueryData(["law", slug], updated);
      queryClient.invalidateQueries({ queryKey: ["laws"] });
      toast.success("PDF anexado com sucesso.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao enviar PDF."),
  });

  const removePdfMut = useMutation({
    mutationFn: () => api.deleteLawPdf(slug!),
    onSuccess: (updated) => {
      queryClient.setQueryData(["law", slug], updated);
      queryClient.invalidateQueries({ queryKey: ["laws"] });
      toast.success("PDF removido.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao remover PDF."),
  });

  if (lawQ.isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Carregando norma...</div>;
  }

  const law = lawQ.data;
  if (!law) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <p className="text-sm text-destructive">Norma não encontrada.</p>
        <Link to="/laws" className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Voltar às normas
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <header className="border-b border-rule bg-surface">
        <div className="mx-auto max-w-5xl px-6 py-7">
          <Link
            to="/laws"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar às normas
          </Link>

          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="feature-chip">{law.tipo_instrumento}</span>
                {law.data_publicacao && (
                  <span className="font-mono text-xs text-muted-foreground">
                    Publicação: {law.data_publicacao}
                  </span>
                )}
              </div>
              <h1 className="mt-2 text-2xl font-bold text-foreground">{law.label}</h1>
              <p className="mt-1 font-mono text-xs text-muted-foreground">{law.id}</p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to={`/laws/${encodeURIComponent(law.slug)}/edit`}
                className="inline-flex items-center gap-1.5 rounded-md border border-rule bg-background px-3.5 py-2 text-xs font-semibold hover:bg-surface-muted"
              >
                <Edit3 className="h-3.5 w-3.5" /> Editar
              </Link>
              <button
                type="button"
                disabled={deleteMut.isPending}
                onClick={() => {
                  if (window.confirm(`Deseja excluir "${law.label}" e seus dispositivos?`)) {
                    deleteMut.mutate();
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-3.5 py-2 text-xs font-semibold text-destructive hover:bg-destructive/15"
              >
                <Trash2 className="h-3.5 w-3.5" /> Excluir
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-rule bg-surface p-5">
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Scale className="h-4 w-4 text-primary" /> Ementa / Descrição & Fonte Oficial
            </h2>
            <p className="mt-2 text-sm text-foreground">
              {law.descricao || "Sem ementa descritiva cadastrada."}
            </p>
            {law.url_fonte && (
              <a
                href={law.url_fonte}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Abrir fonte oficial
              </a>
            )}
          </div>

          <div className="rounded-xl border border-rule bg-surface p-5">
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <FileText className="h-4 w-4 text-primary" /> Documento PDF (Opcional)
            </h2>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadPdfMut.mutate(file);
                e.target.value = "";
              }}
            />

            {law.pdf_name && law.pdf_url ? (
              <div className="mt-3 space-y-3">
                <p className="truncate font-mono text-xs text-foreground">{law.pdf_name}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      downloadProtectedPdf(law.pdf_url!, law.pdf_name!).catch((err) =>
                        toast.error(err.message),
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                  >
                    <Download className="h-3.5 w-3.5" /> Baixar PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-md border border-rule bg-background px-3 py-1.5 text-xs font-medium hover:bg-surface-muted"
                  >
                    <Upload className="h-3.5 w-3.5" /> Substituir
                  </button>
                  <button
                    type="button"
                    onClick={() => removePdfMut.mutate()}
                    className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remover PDF
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-muted-foreground">Nenhum PDF anexado a esta norma.</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadPdfMut.isPending}
                  className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/15"
                >
                  <Upload className="h-3.5 w-3.5" /> Anexar PDF
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-rule bg-surface p-6">
          <h2 className="text-base font-bold text-foreground">
            Dispositivos Legais Citáveis ({law.dispositivos.length})
          </h2>
          {law.dispositivos.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Nenhum artigo ou dispositivo específico cadastrado para este instrumento.
            </p>
          ) : (
            <div className="mt-4 divide-y divide-rule rounded-lg border border-rule bg-background">
              {law.dispositivos.map((d) => (
                <div key={d.id} className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground">{d.label}</span>
                    <span className="feature-chip">{d.tipo_dispositivo}</span>
                  </div>
                  {d.descricao && (
                    <p className="mt-1.5 text-xs text-muted-foreground">{d.descricao}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-rule bg-surface p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Variáveis Vinculadas ({law.linked_variables.length})
          </h2>
          {law.linked_variables.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">Nenhuma variável vinculada ainda.</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {law.linked_variables.map((lv) => (
                <Link
                  key={lv.id}
                  to={`/variables/${encodeURIComponent(lv.id)}`}
                  className="rounded-full border border-rule bg-background px-3 py-1 text-xs font-medium text-foreground hover:border-primary hover:text-primary"
                >
                  {lv.label}
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-rule bg-surface p-5">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Clock className="h-4 w-4 text-primary" /> Histórico da Norma
          </h2>
          {law.history.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Nenhum registro operacional após a carga inicial.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-rule text-xs">
              {law.history.map((h) => (
                <li key={h.id} className="flex items-center justify-between py-2">
                  <span>
                    <strong className="text-foreground">{h.action}</strong> — {h.author_name}
                  </span>
                  <span className="font-mono text-muted-foreground">
                    {new Date(h.created_at).toLocaleString("pt-BR")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
