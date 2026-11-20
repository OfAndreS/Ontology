import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, type LawCreatePayload, type LawDeviceInput } from "@/lib/api";

export function LawFormPage() {
  const { slug } = useParams<{ slug: string }>();
  const isEdit = Boolean(slug);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const vocabQ = useQuery({ queryKey: ["vocabularies"], queryFn: api.getVocabularies });
  const lawQ = useQuery({
    queryKey: ["law", slug],
    queryFn: () => api.getLaw(slug!),
    enabled: isEdit,
  });

  const [label, setLabel] = useState("");
  const [tipoInstrumento, setTipoInstrumento] = useState("Lei");
  const [descricao, setDescricao] = useState("");
  const [urlFonte, setUrlFonte] = useState("");
  const [dataPublicacao, setDataPublicacao] = useState("");
  const [dispositivos, setDispositivos] = useState<LawDeviceInput[]>([]);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const routeKey = isEdit ? `edit:${slug}` : "new";

  useEffect(() => {
    if (loadedKey === routeKey) return;
    if (isEdit) {
      if (!lawQ.data) return;
      const l = lawQ.data;
      setLabel(l.label);
      setTipoInstrumento(l.tipo_instrumento);
      setDescricao(l.descricao);
      setUrlFonte(l.url_fonte ?? "");
      setDataPublicacao(l.data_publicacao ?? "");
      setDispositivos(
        l.dispositivos.map((d) => ({
          id: d.id,
          label: d.label,
          tipo_dispositivo: d.tipo_dispositivo,
          descricao: d.descricao,
        })),
      );
      setLoadedKey(routeKey);
    } else {
      setLabel("");
      setTipoInstrumento("Lei");
      setDescricao("");
      setUrlFonte("");
      setDataPublicacao("");
      setDispositivos([]);
      setPdfFile(null);
      setLoadedKey(routeKey);
    }
  }, [routeKey, loadedKey, isEdit, lawQ.data]);

  const mutation = useMutation({
    mutationFn: async (payload: LawCreatePayload) => {
      const saved = isEdit
        ? await api.updateLaw(slug!, payload)
        : await api.createLaw(payload);
      if (pdfFile) {
        return api.uploadLawPdf(saved.slug, pdfFile);
      }
      return saved;
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["laws"] });
      queryClient.invalidateQueries({ queryKey: ["vocabularies"] });
      queryClient.setQueryData(["law", saved.slug], saved);
      toast.success(isEdit ? "Norma atualizada." : "Norma cadastrada.");
      navigate(`/laws/${encodeURIComponent(saved.slug)}`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao salvar norma."),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      toast.error("Informe o nome da norma.");
      return;
    }
    mutation.mutate({
      label: label.trim(),
      tipo_instrumento: tipoInstrumento,
      descricao: descricao.trim(),
      url_fonte: urlFonte.trim() || null,
      data_publicacao: dataPublicacao.trim() || null,
      dispositivos: dispositivos.filter((d) => d.label.trim().length > 0),
    });
  };

  return (
    <div className="min-h-full">
      <header className="border-b border-rule bg-surface">
        <div className="mx-auto max-w-4xl px-6 py-7">
          <Link
            to={isEdit ? `/laws/${encodeURIComponent(slug!)}` : "/laws"}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar
          </Link>
          <h1 className="mt-3 text-2xl font-bold">
            {isEdit ? `Editar Norma: ${lawQ.data?.label ?? slug}` : "Cadastrar Nova Norma"}
          </h1>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        <section className="space-y-4 rounded-xl border border-rule bg-surface p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-primary">
            1. Dados do Instrumento Normativo
          </h2>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="block space-y-1 text-xs md:col-span-2">
              <span className="font-semibold">Nome da Norma / Instrumento *</span>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex.: Resolução BCB nº 303/2023"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>

            <label className="block space-y-1 text-xs">
              <span className="font-semibold">Tipo</span>
              <select
                value={tipoInstrumento}
                onChange={(e) => setTipoInstrumento(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              >
                {(
                  vocabQ.data?.tipos_instrumento ?? [
                    "Constituição",
                    "Lei",
                    "Decreto",
                    "Resolução",
                    "Regulação Setorial",
                    "Súmula/Jurisprudência",
                    "Guia/Autorregulação",
                  ]
                ).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block space-y-1 text-xs">
            <span className="font-semibold">Ementa / Descrição</span>
            <textarea
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="block space-y-1 text-xs md:col-span-2">
              <span className="font-semibold">URL Oficial</span>
              <input
                type="url"
                value={urlFonte}
                onChange={(e) => setUrlFonte(e.target.value)}
                placeholder="https://www.planalto.gov.br/..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>

            <label className="block space-y-1 text-xs">
              <span className="font-semibold">Data de Publicação</span>
              <input
                type="text"
                value={dataPublicacao}
                onChange={(e) => setDataPublicacao(e.target.value)}
                placeholder="Ex.: 14/08/2018"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>
          </div>

          <label className="block space-y-1 text-xs">
            <span className="font-semibold">Anexar PDF (Opcional)</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
              className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border file:border-rule file:bg-background file:px-3 file:py-1.5 file:text-xs file:font-semibold"
            />
          </label>
        </section>

        <section className="space-y-4 rounded-xl border border-rule bg-surface p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-primary">
              2. Dispositivos Legais (Artigos, Incisos, Parágrafos)
            </h2>
            <button
              type="button"
              onClick={() =>
                setDispositivos((prev) => [
                  ...prev,
                  { label: "", tipo_dispositivo: "Artigo", descricao: "" },
                ])
              }
              className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/15"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar Dispositivo
            </button>
          </div>

          {dispositivos.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhum dispositivo específico adicionado.
            </p>
          ) : (
            <div className="space-y-3">
              {dispositivos.map((dev, idx) => (
                <div key={idx} className="space-y-2 rounded-lg border border-rule bg-background p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">Dispositivo #{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => setDispositivos((prev) => prev.filter((_, i) => i !== idx))}
                      className="inline-flex items-center gap-1 text-xs text-destructive hover:underline"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remover
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="block space-y-1 text-xs md:col-span-2">
                      <span className="font-semibold">Identificação / Título *</span>
                      <input
                        value={dev.label}
                        onChange={(e) =>
                          setDispositivos((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, label: e.target.value } : item,
                            ),
                          )
                        }
                        placeholder="Ex.: Art. 7º, X - Proteção ao Crédito"
                        className="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                    </label>

                    <label className="block space-y-1 text-xs">
                      <span className="font-semibold">Tipo</span>
                      <select
                        value={dev.tipo_dispositivo}
                        onChange={(e) =>
                          setDispositivos((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, tipo_dispositivo: e.target.value } : item,
                            ),
                          )
                        }
                        className="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                      >
                        {(
                          vocabQ.data?.tipos_dispositivo ?? [
                            "Artigo",
                            "Parágrafo",
                            "Inciso",
                            "Alínea",
                            "Enunciado",
                            "Princípio",
                          ]
                        ).map((td) => (
                          <option key={td} value={td}>
                            {td}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="block space-y-1 text-xs">
                    <span className="font-semibold">Resumo / Conteúdo</span>
                    <textarea
                      rows={2}
                      value={dev.descricao}
                      onChange={(e) =>
                        setDispositivos((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, descricao: e.target.value } : item,
                          ),
                        )
                      }
                      className="w-full rounded-md border border-input bg-surface px-3 py-2 text-xs outline-none focus:border-primary"
                    />
                  </label>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="flex justify-end gap-3">
          <Link
            to="/laws"
            className="rounded-md border border-rule bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-muted"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-xs hover:opacity-95 disabled:opacity-60"
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isEdit ? "Salvar Alterações" : "Cadastrar Norma"}
          </button>
        </div>
      </form>
    </div>
  );
}
