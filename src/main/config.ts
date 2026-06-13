import fs from 'fs/promises';
import path from 'path';
import type { Config } from '../shared/types';
import { defaultConfig } from '../shared/types';
import { normalizeThemeId } from '../shared/themes';
export class ConfigManager {
  private configPath: string;
  private config: Config;

  constructor(merkabaRoot: string) {
    this.configPath = path.join(merkabaRoot, '.merkaba', 'config.json');
    this.config = { ...defaultConfig, rootPath: merkabaRoot };
  }

  async load(): Promise<Config> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      const parsed = JSON.parse(data) as Partial<Config> & { theme?: string };
      this.config = {
        ...defaultConfig,
        ...parsed,
        theme: normalizeThemeId(parsed.theme),
      }; 
    } catch {
      await this.save();
    }
    return this.config;
  }

  async save(): Promise<void> {
    await fs.mkdir(path.dirname(this.configPath), { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
  }

  get(): Config {
    return this.config;
  }

  async set(partial: Partial<Config>): Promise<Config> {
    const next = { ...partial };
    if (partial.theme) {
      next.theme = normalizeThemeId(partial.theme);
    }
    this.config = { ...this.config, ...next };
    await this.save();
    return this.config;
  }
}
