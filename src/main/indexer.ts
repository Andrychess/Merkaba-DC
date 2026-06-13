import Fuse from 'fuse.js';
import path from 'path';
import type { SearchResult } from '../shared/types';
import { type FileSystem, extractTitle } from './file-system';

interface SearchDoc {
  path: string;
  title: string;
  content: string;
}

export class SearchIndexer {
  private fuse: Fuse<SearchDoc> | null = null;

  async buildIndex(fs: FileSystem): Promise<void> {
    const docs: SearchDoc[] = [];
    const files = await fs.getAllMdFiles();

    for (const file of files) {
      const content = await fs.readFile(file);
      const title = extractTitle(content) || path.basename(file, '.md');
      docs.push({ path: file, title, content });
    }

    this.fuse = new Fuse(docs, {
      keys: ['title', 'content'],
      threshold: 0.4,
      includeMatches: true,
    });
  }

  search(query: string): SearchResult[] {
    if (!this.fuse || !query.trim()) return [];
    return this.fuse.search(query).map((r) => ({
      path: r.item.path,
      title: r.item.title,
      matches: r.matches,
    }));
  }
}
