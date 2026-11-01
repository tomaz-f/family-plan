declare module '@edusites/icons/core' {
  export interface SvgIconeOptions {
    nome: string;
    cor?: string;
    tamanho?: number | string;
    className?: string;
  }

  export function svgIcone(options: SvgIconeOptions): string | null;
  export function svgIconeAsync(options: SvgIconeOptions): Promise<string | null>;
  export function temIcone(nome: string): boolean;
  export function listarIcones(): string[];
  export function listarCategorias(): string[];
  export function categoriaDoIcone(nome: string): string;
  export function descricaoDoIcone(nome: string): string;
  export function precarregar(nomes: string | string[]): Promise<void>;
  export function resolverBruto(nome: string): Promise<string | null>;
}

declare module '@edusites/icons/vite' {
  export interface EdusitesIconsViteOptions {
    raiz?: string | null;
    incluir?: string[];
  }
  export function edusitesIconsVite(opcoes?: EdusitesIconsViteOptions): any;
  export default edusitesIconsVite;
}
