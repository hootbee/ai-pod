export interface IRendererService {
  renderToFile(html: string, outputPath: string): Promise<string>;
}
