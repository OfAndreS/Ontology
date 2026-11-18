declare module "n3" {
  export interface Term {
    termType: "NamedNode" | "BlankNode" | "Literal" | "Variable" | "DefaultGraph";
    value: string;
  }

  export interface NamedNode extends Term {
    termType: "NamedNode";
  }

  export interface Literal extends Term {
    termType: "Literal";
    language: string;
    datatype: NamedNode;
  }

  export interface Quad {
    subject: Term;
    predicate: Term;
    object: Term;
    graph: Term;
  }

  export const DataFactory: {
    namedNode(value: string): NamedNode;
    literal(value: string, languageOrDatatype?: string | NamedNode): Literal;
    quad(subject: Term, predicate: Term, object: Term, graph?: Term): Quad;
  };

  export class Parser {
    constructor(options?: { format?: string });
    parse(input: string): Quad[];
  }

  export class Store {
    constructor(quads?: Quad[]);
    addQuads(quads: Quad[]): void;
    removeQuads(quads: Quad[]): void;
    getQuads(
      subject: Term | null,
      predicate: Term | null,
      object: Term | null,
      graph: Term | null,
    ): Quad[];
    getObjects(subject: Term | null, predicate: Term | null, graph: Term | null): Term[];
    getSubjects(predicate: Term | null, object: Term | null, graph: Term | null): Term[];
  }

  export class Writer {
    constructor(options?: { prefixes?: Record<string, string> });
    addQuads(quads: Quad[]): void;
    end(callback: (error: Error | null, result: string) => void): void;
  }
}
