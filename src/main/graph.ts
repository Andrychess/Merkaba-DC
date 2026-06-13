import path from 'path';
import type { GraphData } from '../shared/types';
import { type FileSystem, extractTitle } from './file-system';
import { getSpaceForPath } from '../shared/spaces';

export class GraphBuilder {
  async buildGraph(fs: FileSystem): Promise<GraphData> {
    const files = await fs.getAllMdFiles();
    const nodes: GraphData['nodes'] = [];
    const edges: GraphData['edges'] = [];

    // Карта имён файлов для разрешения wiki-ссылок
    const fileMap = new Map<string, string>();
    for (const file of files) {
      const baseName = path.basename(file, '.md');
      fileMap.set(baseName.toLowerCase(), file);
      fileMap.set(file.toLowerCase(), file);
      fileMap.set(file.replace(/\.md$/, '').toLowerCase(), file);
    }

    for (const file of files) {
      const content = await fs.readFile(file);
      const title = extractTitle(content) || path.basename(file, '.md');
      const links = this.extractWikiLinks(content);

      const space = getSpaceForPath(file);

      nodes.push({ id: file, label: title, group: space, links: links.length });

      for (const link of links) {
        const resolved = this.resolveLink(link, fileMap);
        if (resolved) {
          edges.push({ source: file, target: resolved });
        } else {
          // Внешняя (битая) ссылка — всё равно показываем
          edges.push({ source: file, target: link });
        }
      }
    }

    return { nodes, edges };
  }

  extractWikiLinks(content: string): string[] {
    const regex = /\[\[([^\]]+)\]\]/g;
    const links: string[] = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
      links.push(match[1]);
    }
    return links;
  }

  private resolveLink(link: string, fileMap: Map<string, string>): string | null {
    const normalized = link.replace(/\.md$/, '').toLowerCase();
    return fileMap.get(normalized) || fileMap.get(`${normalized}.md`) || null;
  }
}
