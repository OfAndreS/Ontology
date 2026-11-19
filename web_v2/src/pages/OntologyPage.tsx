import { useQuery } from "@tanstack/react-query";
import { BookOpen, FileText, Gavel, Loader2, Network, Scale, ShieldAlert } from "lucide-react";
import { api } from "@/lib/api";

export function OntologyPage() {
  const overviewQ = useQuery({
    queryKey: ["ontology-overview"],
    queryFn: api.getOntologyOverview,
  });

  if (overviewQ.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (overviewQ.isError || !overviewQ.data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-destructive">
        <p>Não foi possível carregar o esquema da ontologia V2.</p>
      </div>
    );
  }

  const data = overviewQ.data;

  return (
    <div className="min-h-full bg-background">
      <section className="border-b border-rule bg-surface">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <span>Esquema OWL / RDF</span>
            <span>·</span>
            <span>Versão {data.version}</span>
          </div>
          <h1 className="mt-2 text-3xl font-semibold">{data.label}</h1>
          <p className="mt-2 max-w-4xl text-sm leading-relaxed text-muted-foreground">
            {data.comment}
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Variáveis Catalogadas" value={data.stats.variaveis} />
            <StatCard label="Nós de Risco (myont:Risco)" value={data.stats.riscos} highlight />
            <StatCard
              label="Instrumentos / Dispositivos"
              value={`${data.stats.instrumentos} / ${data.stats.dispositivos}`}
            />
            <StatCard
              label="Classes · ObjProps · DataProps"
              value={`${data.stats.classes} · ${data.stats.objectProperties} · ${data.stats.datatypeProperties}`}
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl space-y-8 px-6 py-10">
        {/* Diagrama Arquitetural Visual da V2 */}
        <div className="rounded-xl border border-rule bg-surface p-6 shadow-xs">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">
                Arquitetura Visual do Grafo — MyOnt V2
              </h2>
              <p className="text-xs text-muted-foreground">
                Separação entre autorização de uso na Variável, múltiplos Riscos desmembrados e
                estrutura jurídica em Instrumento Normativo + Dispositivo Legal.
              </p>
            </div>
            <span className="rounded-full border border-rule bg-surface-muted px-3 py-1 font-mono text-xs text-muted-foreground">
              Decisões 05, 06 e 07
            </span>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {/* Coluna 1: Camada Externa e Variável */}
            <div className="space-y-4">
              <div className="rounded-xl border border-rule bg-surface-muted/70 p-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <Network className="h-4 w-4 text-primary" />
                  Camada Externa (1:N)
                </div>
                <p className="mt-2 font-mono text-sm font-bold text-foreground">
                  myont:ConceitoExterno
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Recorte Schema.org ({data.stats.conceitosExternos} termos). Extensível a FIBO e
                  W3C DPV sem atrito.
                </p>
                <p className="mt-2 font-mono text-[0.7rem] text-primary">
                  ← equivalenteAConceitoExterno / baseadaEmConceitoExterno
                </p>
              </div>

              <div className="rounded-xl border-2 border-primary/60 bg-background p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
                    Núcleo Central
                  </span>
                  <span className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[0.65rem] text-muted-foreground">
                    ⊑ dpv:PersonalData
                  </span>
                </div>
                <p className="mt-1 font-mono text-base font-bold text-foreground">
                  myont:Variavel
                </p>
                <p className="mt-0.5 text-[0.7rem] text-muted-foreground">
                  Subclasses: <code className="font-mono">VariavelSensivel</code> ·{" "}
                  <code className="font-mono">VariavelProxy</code> (inferida)
                </p>
                <ul className="mt-3 space-y-1 border-t border-rule pt-2.5 text-xs text-muted-foreground">
                  <li>
                    • <code className="font-mono text-foreground">descricaoOrigem</code>{" "}
                    <span className="opacity-70">(xsd:string)</span>
                  </li>
                  <li>
                    • <code className="font-mono text-foreground">descricaoJustificativaLegal</code>{" "}
                    <span className="opacity-70">(xsd:string)</span>
                  </li>
                  <li>
                    • <code className="font-mono text-foreground">descricaoExplicabilidade</code>{" "}
                    <span className="opacity-70">(xsd:string)</span>
                  </li>
                  <li>
                    • <code className="font-mono text-foreground">descricaoAtuacaoProxy</code>{" "}
                    <span className="opacity-70">(xsd:string)</span>
                  </li>
                </ul>
                <div className="mt-3 space-y-1 border-t border-rule pt-2.5 font-mono text-[0.7rem] text-foreground/85">
                  <div>→ atuaComoProxyDe → Variavel (N:M)</div>
                  <div>→ derivadaDe → Variavel (N:M)</div>
                  <div>→ temStatusCuradoria → StatusCuradoria</div>
                </div>
              </div>
            </div>

            {/* Coluna 2: Riscos Desmembrados */}
            <div className="flex flex-col justify-center space-y-4">
              <div className="rounded-xl border-2 border-[oklch(0.75_0.14_35)] bg-[oklch(0.98_0.02_35)] p-4 dark:bg-surface-muted">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[oklch(0.42_0.16_35)]">
                    <ShieldAlert className="h-4 w-4" />
                    Nó Desmembrado (N:M)
                  </span>
                  <span className="font-mono text-[0.7rem] text-muted-foreground">
                    ← myont:possuiRisco
                  </span>
                </div>
                <p className="mt-1 font-mono text-base font-bold text-foreground">
                  myont:Risco
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Uma variável possui múltiplos riscos; o nível global da variável é derivado do
                  maior nível entre seus riscos.
                </p>
                <ul className="mt-3 space-y-1.5 border-t border-rule pt-2.5 text-xs">
                  <li>
                    <code className="font-mono font-semibold text-foreground">
                      temNivelRisco → NivelRisco
                    </code>
                    <p className="text-[0.7rem] text-muted-foreground">
                      Baixo · Médio · Alto · Máximo · Veto
                    </p>
                  </li>
                  <li>
                    <code className="font-mono font-semibold text-foreground">
                      descricaoDemandaGovernanca
                    </code>{" "}
                    <span className="text-muted-foreground">(xsd:string)</span>
                  </li>
                  <li>
                    <code className="font-mono font-semibold text-foreground">
                      descricaoImplicacaoLegal
                    </code>{" "}
                    <span className="text-muted-foreground">(xsd:string)</span>
                  </li>
                  <li>
                    <code className="font-mono font-semibold text-primary">
                      acionaBaseLegal → BaseLegal (N:M)
                    </code>
                    <p className="text-[0.7rem] text-muted-foreground">
                      Normas que restringem, vedam ou sancionam este risco
                    </p>
                  </li>
                </ul>
              </div>

              <div className="rounded-lg border border-dashed border-rule bg-surface-muted/50 p-3 text-xs text-muted-foreground">
                <strong className="text-foreground">Exemplo real (Gender):</strong>
                <div className="mt-1 space-y-1">
                  <div>
                    ✓ <span className="font-medium text-foreground">Autorizada por:</span> LGPD
                    Art. 7º, II (apenas identificação cadastral)
                  </div>
                  <div>
                    ✕ <span className="font-medium text-foreground">Risco [Veto] aciona:</span>{" "}
                    CF/88 Art. 5º, I e LGPD Art. 11 (proibido na decisão)
                  </div>
                </div>
              </div>
            </div>

            {/* Coluna 3: Camada Normativa */}
            <div className="space-y-4">
              <div className="rounded-xl border border-rule bg-surface-muted/70 p-4">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
                    <Scale className="h-4 w-4" />
                    Camada Normativa
                  </span>
                  <span className="rounded bg-surface px-1.5 py-0.5 font-mono text-[0.65rem] text-muted-foreground">
                    ⊑ dpv:LegalBasis
                  </span>
                </div>
                <p className="mt-1 font-mono text-base font-bold text-foreground">
                  myont:BaseLegal
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Recebe duas conexões de papéis jurídicos distintos:
                </p>
                <div className="mt-2 space-y-1 text-xs">
                  <div className="rounded border border-rule bg-background px-2.5 py-1.5">
                    <span className="font-mono font-semibold text-foreground">
                      Variavel → autorizadaPorBaseLegal
                    </span>
                    <p className="text-[0.7rem] text-muted-foreground">
                      Fundamento que legitima a coleta/uso
                    </p>
                  </div>
                  <div className="rounded border border-rule bg-background px-2.5 py-1.5">
                    <span className="font-mono font-semibold text-foreground">
                      Risco → acionaBaseLegal
                    </span>
                    <p className="text-[0.7rem] text-muted-foreground">
                      Norma violada, restritiva ou sancionadora
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-rule bg-background p-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <Gavel className="h-4 w-4 text-primary" />
                  Subclasses Citáveis
                </div>
                <div className="mt-2 space-y-2.5 text-xs">
                  <div className="rounded-lg border border-rule bg-surface-muted/40 p-2.5">
                    <p className="font-mono font-bold text-foreground">
                      myont:InstrumentoNormativo
                    </p>
                    <p className="mt-0.5 text-muted-foreground">
                      Constituição, Lei, Resolução CMN/BACEN, Súmula/Jurisprudência, Autorregulação.
                    </p>
                  </div>
                  <div className="rounded-lg border border-rule bg-surface-muted/40 p-2.5">
                    <p className="font-mono font-bold text-foreground">myont:DispositivoLegal</p>
                    <p className="mt-0.5 text-muted-foreground">
                      Artigo, Parágrafo (§), Inciso (I, X…), Alínea, Princípio. Liga-se ao pai via{" "}
                      <code className="font-mono text-foreground">pertenceAInstrumento</code>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Instrumentos Normativos e Dispositivos */}
        <div className="rounded-xl border border-rule bg-surface p-6 shadow-xs">
          <div className="mb-4 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">
              Instrumentos Normativos e Dispositivos Carregados ({data.stats.instrumentos}{" "}
              instrumentos · {data.stats.dispositivos} dispositivos)
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {data.instrumentos.map((inst) => (
              <div
                key={inst.id}
                className="rounded-lg border border-rule bg-background p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span className="rounded bg-surface-muted px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-primary">
                      {inst.tipo}
                    </span>
                    <h3 className="mt-1.5 text-sm font-semibold text-foreground">{inst.label}</h3>
                    <p className="font-mono text-[0.7rem] text-muted-foreground">myont:{inst.id}</p>
                  </div>
                </div>

                {inst.dispositivos.length > 0 ? (
                  <ul className="mt-3 space-y-1.5 border-t border-rule pt-3">
                    {inst.dispositivos.map((disp) => (
                      <li
                        key={disp.id}
                        className="flex items-start justify-between gap-2 text-xs"
                      >
                        <span className="text-foreground">{disp.label}</span>
                        <span className="shrink-0 rounded border border-rule bg-surface-muted px-1.5 py-0.5 text-[0.65rem] text-muted-foreground">
                          {disp.tipo}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 border-t border-rule pt-2 text-xs text-muted-foreground">
                    Referenciado diretamente como instrumento normativo completo.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tabelas de Classes e Propriedades do myont_v2.ttl */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-rule bg-surface p-6 shadow-xs">
            <div className="mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold">Classes OWL ({data.classes.length})</h2>
            </div>
            <div className="divide-y divide-rule">
              {data.classes.map((cls) => (
                <div key={cls.id} className="py-2.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <code className="font-mono font-semibold text-foreground">myont:{cls.id}</code>
                    <span className="font-mono text-[0.7rem] text-muted-foreground">
                      ⊑ {cls.parent}
                    </span>
                  </div>
                  <p className="mt-0.5 font-medium text-foreground/90">{cls.label}</p>
                  {cls.comment && (
                    <p className="mt-0.5 text-muted-foreground">{cls.comment}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-rule bg-surface p-6 shadow-xs">
            <div className="mb-3 flex items-center gap-2">
              <Network className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold">
                Object Properties ({data.objectProperties.length})
              </h2>
            </div>
            <div className="divide-y divide-rule">
              {data.objectProperties.map((prop) => (
                <div key={prop.id} className="py-2.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <code className="font-mono font-semibold text-foreground">
                      myont:{prop.id}
                    </code>
                    <span className="font-mono text-[0.7rem] text-primary">
                      {prop.domain} → {prop.range}
                    </span>
                  </div>
                  <p className="mt-0.5 text-foreground/90">{prop.label}</p>
                  {prop.comment && (
                    <p className="mt-0.5 text-muted-foreground">{prop.comment}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border border-rule bg-background p-4">
      <p className="text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 font-mono text-2xl font-bold ${highlight ? "text-primary" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}
