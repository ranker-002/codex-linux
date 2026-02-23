import * as path from 'path';
import * as fs from 'fs/promises';
import * as yaml from 'yaml';
import log from 'electron-log';
import { Skill, SkillFile, SkillConfig, SkillParameter } from '../../shared/types';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_SKILLS_DIR = path.join(__dirname, '../../assets/skills');
const USER_SKILLS_DIR = path.join(process.env.HOME || '~', '.config', 'codex', 'skills');

export class SkillsManager {
  private skills: Map<string, Skill> = new Map();
  private userSkillsPath: string;

  constructor(userSkillsPath?: string) {
    this.userSkillsPath = userSkillsPath || USER_SKILLS_DIR;
  }

  async initialize(): Promise<void> {
    // Ensure user skills directory exists
    await fs.mkdir(this.userSkillsPath, { recursive: true });

    // Load built-in skills
    await this.loadSkillsFromDirectory(DEFAULT_SKILLS_DIR);

    // Load user skills
    await this.loadSkillsFromDirectory(this.userSkillsPath);

    log.info(`Loaded ${this.skills.size} skills`);
  }

  async listSkills(): Promise<Skill[]> {
    return Array.from(this.skills.values()).sort((a, b) => 
      a.name.localeCompare(b.name)
    );
  }

  async getSkill(skillId: string): Promise<Skill | null> {
    return this.skills.get(skillId) || null;
  }

  async createSkill(config: Partial<Skill>): Promise<Skill> {
    const skill: Skill = {
      id: uuidv4(),
      name: config.name || 'Untitled Skill',
      description: config.description || '',
      version: config.version || '1.0.0',
      author: config.author || 'Anonymous',
      tags: config.tags || [],
      files: config.files || [],
      config: config.config || {
        entryPoint: 'index.md',
        parameters: [],
        dependencies: [],
        permissions: []
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.skills.set(skill.id, skill);
    await this.saveSkill(skill);
    
    log.info(`Created skill ${skill.id} (${skill.name})`);
    return skill;
  }

  async updateSkill(skillId: string, updates: Partial<Skill>): Promise<Skill> {
    const skill = this.skills.get(skillId);
    if (!skill) {
      throw new Error(`Skill ${skillId} not found`);
    }

    Object.assign(skill, updates, { updatedAt: new Date() });
    await this.saveSkill(skill);
    
    log.info(`Updated skill ${skillId}`);
    return skill;
  }

  async deleteSkill(skillId: string): Promise<void> {
    const skill = this.skills.get(skillId);
    if (!skill) {
      throw new Error(`Skill ${skillId} not found`);
    }

    // Delete skill directory
    const skillPath = path.join(this.userSkillsPath, skill.name);
    await fs.rmdir(skillPath, { recursive: true }).catch(() => {});

    this.skills.delete(skillId);
    log.info(`Deleted skill ${skillId}`);
  }

  async searchSkills(query: string, tags?: string[]): Promise<Skill[]> {
    let results = Array.from(this.skills.values());

    if (query) {
      const lowerQuery = query.toLowerCase();
      results = results.filter(skill =>
        skill.name.toLowerCase().includes(lowerQuery) ||
        skill.description.toLowerCase().includes(lowerQuery) ||
        skill.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
      );
    }

    if (tags && tags.length > 0) {
      results = results.filter(skill =>
        tags.some(tag => skill.tags.includes(tag))
      );
    }

    return results;
  }

  private async loadSkillsFromDirectory(dir: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          await this.loadSkillFromPath(path.join(dir, entry.name));
        }
      }
    } catch (error) {
      log.warn(`Failed to load skills from ${dir}:`, error);
    }
  }

  private async loadSkillFromPath(skillPath: string): Promise<void> {
    try {
      const configPath = path.join(skillPath, 'skill.yaml');
      let config: any = {};

      try {
        const configContent = await fs.readFile(configPath, 'utf-8');
        config = yaml.parse(configContent);
      } catch {
        // No config file, use defaults
      }

      // Load files
      const files: SkillFile[] = [];
      const entries = await fs.readdir(skillPath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          const filePath = path.join(skillPath, entry.name);
          const content = await fs.readFile(filePath, 'utf-8');
          
          let type: SkillFile['type'] = 'instruction';
          if (entry.name.endsWith('.template')) type = 'template';
          else if (entry.name.endsWith('.tool')) type = 'tool';
          else if (entry.name === 'skill.yaml') type = 'config';

          files.push({
            path: entry.name,
            content,
            type
          });
        }
      }

      const skill: Skill = {
        id: config.id || uuidv4(),
        name: config.name || path.basename(skillPath),
        description: config.description || '',
        version: config.version || '1.0.0',
        author: config.author || 'Unknown',
        tags: config.tags || [],
        files,
        config: {
          entryPoint: config.entryPoint || 'index.md',
          parameters: config.parameters || [],
          dependencies: config.dependencies || [],
          permissions: config.permissions || []
        },
        createdAt: config.createdAt ? new Date(config.createdAt) : new Date(),
        updatedAt: config.updatedAt ? new Date(config.updatedAt) : new Date()
      };

      this.skills.set(skill.id, skill);
    } catch (error) {
      log.error(`Failed to load skill from ${skillPath}:`, error);
    }
  }

  private async saveSkill(skill: Skill): Promise<void> {
    const skillPath = path.join(this.userSkillsPath, skill.name);
    await fs.mkdir(skillPath, { recursive: true });

    // Save config
    const configPath = path.join(skillPath, 'skill.yaml');
    const config = {
      id: skill.id,
      name: skill.name,
      description: skill.description,
      version: skill.version,
      author: skill.author,
      tags: skill.tags,
      entryPoint: skill.config.entryPoint,
      parameters: skill.config.parameters,
      dependencies: skill.config.dependencies,
      permissions: skill.config.permissions,
      createdAt: skill.createdAt,
      updatedAt: skill.updatedAt
    };
    await fs.writeFile(configPath, yaml.stringify(config), 'utf-8');

    // Save files
    for (const file of skill.files) {
      if (file.type !== 'config') {
        const filePath = path.join(skillPath, file.path);
        await fs.writeFile(filePath, file.content, 'utf-8');
      }
    }
  }
}