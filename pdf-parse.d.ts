
declare module "pdf-parse" {
  interface PdfData {
    text: string;
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: unknown;
    version: string;
  }

  function pdf(data: Buffer): Promise<PdfData>;

  export default pdf;
}
