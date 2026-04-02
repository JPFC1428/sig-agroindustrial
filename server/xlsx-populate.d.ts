declare module "xlsx-populate" {
  const XlsxPopulate: {
    fromBlankAsync(options?: unknown): Promise<any>;
    fromFileAsync(path: string, options?: unknown): Promise<any>;
  };

  export default XlsxPopulate;
}
