import * as fs from 'fs/promises';
import * as path from 'path';
import log from 'electron-log';
import { ClaudeMdConfig, PermissionMode } from '../../shared/types';

const CLAUDE_MD_FILES = ['CLAUDE.md', 'claude.md', '.claude.md'];

export class ClaudeMdParser {
  private config: ClaudeMdConfig | null = null;
  private filePath: string | null = null;

  async load(projectPath: string): Promise<ClaudeMdConfig | null> {
    for (const fileName of CLAUDE_MD_FILES) {
      const fullPath = path.join(projectPath, fileName);
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        this.config = this.parse(content);
        this.filePath = fullPath;
        log.info(`Loaded CLAUDE.md from ${fullPath}`);
        return this.config;
      } catch (error) {
        // File doesn't exist, try next
        continue;
      }
    }
    log.debug(`No CLAUDE.md found in ${projectPath}`);
    return null;
  }

  parse(content: string): ClaudeMdConfig {
    const config: Partial<ClaudeMdConfig> = {
      version: '1.0',
      project: { name: 'Unnamed Project' },
      codingStandards: {},
      architecture: {},
      libraries: {},
      reviewChecklist: {},
      tools: {},
      customPrompts: {},
      agents: {},
      mcp: {},
      hooks: {},
      ignore: [],
      metadata: {}
    };

    // Parse sections
    const sections = this.extractSections(content);

    for (const [sectionName, sectionContent] of Object.entries(sections)) {
      switch (sectionName.toLowerCase()) {
        case 'project':
          config.project = this.parseProject(sectionContent);
          break;
        case 'coding standards':
        case 'codingstandards':
          config.codingStandards = this.parseCodingStandards(sectionContent);
          break;
        case 'architecture':
          config.architecture = this.parseArchitecture(sectionContent);
          break;
        case 'libraries':
        case 'dependencies':
          config.libraries = this.parseLibraries(sectionContent);
          break;
        case 'review checklist':
        case 'reviewchecklist':
          config.reviewChecklist = this.parseReviewChecklist(sectionContent);
          break;
        case 'tools':
          config.tools = this.parseTools(sectionContent);
          break;
        case 'custom prompts':
        case 'customprompts':
          config.customPrompts = this.parseCustomPrompts(sectionContent);
          break;
        case 'agents':
          config.agents = this.parseAgents(sectionContent);
          break;
        case 'mcp':
          config.mcp = this.parseMcp(sectionContent);
          break;
        case 'hooks':
          config.hooks = this.parseHooks(sectionContent);
          break;
        case 'ignore':
          config.ignore = this.parseIgnore(sectionContent);
          break;
        default:
          // Store unknown sections in metadata
          if (!config.metadata) config.metadata = {};
          config.metadata[sectionName] = sectionContent.trim();
      }
    }

    return config as ClaudeMdConfig;
  }

  private extractSections(content: string): Record<string, string> {
    const sections: Record<string, string> = {};
    const lines = content.split('\n');
    let currentSection: string | null = null;
    let currentContent: string[] = [];

    for (const line of lines) {
      // Match headers (## or ###)
      const headerMatch = line.match(/^(#{2,3})\s+(.+)$/);
      if (headerMatch) {
        // Save previous section
        if (currentSection) {
          sections[currentSection] = currentContent.join('\n').trim();
        }
        currentSection = headerMatch[2].trim();
        currentContent = [];
      } else if (currentSection) {
        currentContent.push(line);
      }
    }

    // Save last section
    if (currentSection) {
      sections[currentSection] = currentContent.join('\n').trim();
    }

    return sections;
  }

  private parseProject(content: string): ClaudeMdConfig['project'] {
    const project: ClaudeMdConfig['project'] = { name: '' };
    
    const nameMatch = content.match(/\*\*Name:\*\*\s*(.+)/i) || content.match(/Name:\s*(.+)/i);
    if (nameMatch) project.name = nameMatch[1].trim();

    const descMatch = content.match(/\*\*Description:\*\*\s*(.+)/i) || content.match(/Description:\s*(.+)/i);
    if (descMatch) project.description = descMatch[1].trim();

    const langMatch = content.match(/\*\*Language:\*\*\s*(.+)/i) || content.match(/Language:\s*(.+)/i);
    if (langMatch) project.language = langMatch[1].trim();

    const fwMatch = content.match(/\*\*Framework:\*\*\s*(.+)/i) || content.match(/Framework:\s*(.+)/i);
    if (fwMatch) project.framework = fwMatch[1].trim();

    return project;
  }

  private parseCodingStandards(content: string): ClaudeMdConfig['codingStandards'] {
    const standards: ClaudeMdConfig['codingStandards'] = {};

    const styleMatch = content.match(/\*\*Style:\*\*\s*(.+)/i) || content.match(/Style:\s*(.+)/i);
    if (styleMatch) standards.style = styleMatch[1].trim();

    const linterMatch = content.match(/\*\*Linter:\*\*\s*(.+)/i) || content.match(/Linter:\s*(.+)/i);
    if (linterMatch) standards.linter = linterMatch[1].trim();

    const formatterMatch = content.match(/\*\*Formatter:\*\*\s*(.+)/i) || content.match(/Formatter:\s*(.+)/i);
    if (formatterMatch) standards.formatter = formatterMatch[1].trim();

    const lineLengthMatch = content.match(/\*\*Max Line Length:\*\*\s*(\d+)/i) || content.match(/Max Line Length:\s*(\d+)/i);
    if (lineLengthMatch) standards.maxLineLength = parseInt(lineLengthMatch[1], 10);

    const indentMatch = content.match(/\*\*Indent Size:\*\*\s*(\d+)/i) || content.match(/Indent Size:\s*(\d+)/i);
    if (indentMatch) standards.indentSize = parseInt(indentMatch[1], 10);

    const tabsMatch = content.match(/\*\*Use Tabs:\*\*\s*(yes|no|true|false)/i) || content.match(/Use Tabs:\s*(yes|no|true|false)/i);
    if (tabsMatch) standards.useTabs = ['yes', 'true'].includes(tabsMatch[1].toLowerCase());

    return standards;
  }

  private parseArchitecture(content: string): ClaudeMdConfig['architecture'] {
    const arch: ClaudeMdConfig['architecture'] = {};

    // Parse patterns list
    const patternsMatch = content.match(/\*\*Patterns:\*\*\s*([\s\S]*?)(?=\*\*|\n\n|\n#|$)/i);
    if (patternsMatch) {
      arch.patterns = patternsMatch[1]
        .split('\n')
        .map((line: string) => line.replace(/^[-*]\s*/, '').trim())
        .filter((line: string) => line.length > 0);
    }

    // Parse conventions list
    const conventionsMatch = content.match(/\*\*Conventions:\*\*\s*([\s\S]*?)(?=\*\*|\n\n|\n#|$)/i);
    if (conventionsMatch) {
      arch.conventions = conventionsMatch[1]
        .split('\n')
        .map((line: string) => line.replace(/^[-*]\s*/, '').trim())
        .filter((line: string) => line.length > 0);
    }

    // Parse design principles
    const principlesMatch = content.match(/\*\*Design Principles:\*\*\s*([\s\S]*?)(?=\*\*|\n\n|\n#|$)/i);
    if (principlesMatch) {
      arch.designPrinciples = principlesMatch[1]
        .split('\n')
        .map((line: string) => line.replace(/^[-*]\s*/, '').trim())
        .filter((line: string) => line.length > 0);
    }

    const folderMatch = content.match(/\*\*Folder Structure:\*\*\s*(.+)/i) || content.match(/Folder Structure:\s*(.+)/i);
    if (folderMatch) arch.folderStructure = folderMatch[1].trim();

    return arch;
  }

  private parseLibraries(content: string): ClaudeMdConfig['libraries'] {
    const libs: ClaudeMdConfig['libraries'] = {};

    // Parse preferred
    const preferredMatch = content.match(/\*\*Preferred:\*\*\s*([\s\S]*?)(?=\*\*|\n\n|\n#|$)/i);
    if (preferredMatch) {
      libs.preferred = preferredMatch[1]
        .split('\n')
        .map((line: string) => line.replace(/^[-*]\s*/, '').trim())
        .filter((line: string) => line.length > 0);
    }

    // Parse avoid
    const avoidMatch = content.match(/\*\*Avoid:\*\*\s*([\s\S]*?)(?=\*\*|\n\n|\n#|$)/i);
    if (avoidMatch) {
      libs.avoid = avoidMatch[1]
        .split('\n')
        .map((line: string) => line.replace(/^[-*]\s*/, '').trim())
        .filter((line: string) => line.length > 0);
    }

    // Parse testing
    const testingMatch = content.match(/\*\*Testing:\*\*\s*([\s\S]*?)(?=\*\*|\n\n|\n#|$)/i);
    if (testingMatch) {
      libs.testing = testingMatch[1]
        .split('\n')
        .map((line: string) => line.replace(/^[-*]\s*/, '').trim())
        .filter((line: string) => line.length > 0);
    }

    // Parse utilities
    const utilsMatch = content.match(/\*\*Utilities:\*\*\s*([\s\S]*?)(?=\*\*|\n\n|\n#|$)/i);
    if (utilsMatch) {
      libs.utilities = utilsMatch[1]
        .split('\n')
        .map((line: string) => line.replace(/^[-*]\s*/, '').trim())
        .filter((line: string) => line.length > 0);
    }

    return libs;
  }

  private parseReviewChecklist(content: string): ClaudeMdConfig['reviewChecklist'] {
    const checklist: ClaudeMdConfig['reviewChecklist'] = {};

    // Parse required
    const requiredMatch = content.match(/\*\*Required:\*\*\s*([\s\S]*?)(?=\*\*|\n\n|\n#|$)/i);
    if (requiredMatch) {
      checklist.required = requiredMatch[1]
        .split('\n')
        .map((line: string) => line.replace(/^[-*]\s*/, '').trim())
        .filter((line: string) => line.length > 0);
    }

    // Parse recommended
    const recommendedMatch = content.match(/\*\*Recommended:\*\*\s*([\s\S]*?)(?=\*\*|\n\n|\n#|$)/i);
    if (recommendedMatch) {
      checklist.recommended = recommendedMatch[1]
        .split('\n')
        .map((line: string) => line.replace(/^[-*]\s*/, '').trim())
        .filter((line: string) => line.length > 0);
    }

    // Parse security
    const securityMatch = content.match(/\*\*Security:\*\*\s*([\s\S]*?)(?=\*\*|\n\n|\n#|$)/i);
    if (securityMatch) {
      checklist.security = securityMatch[1]
        .split('\n')
        .map((line: string) => line.replace(/^[-*]\s*/, '').trim())
        .filter((line: string) => line.length > 0);
    }

    // Parse performance
    const perfMatch = content.match(/\*\*Performance:\*\*\s*([\s\S]*?)(?=\*\*|\n\n|\n#|$)/i);
    if (perfMatch) {
      checklist.performance = perfMatch[1]
        .split('\n')
        .map((line: string) => line.replace(/^[-*]\s*/, '').trim())
        .filter((line: string) => line.length > 0);
    }

    return checklist;
  }

  private parseTools(content: string): ClaudeMdConfig['tools'] {
    const tools: ClaudeMdConfig['tools'] = {};

    const buildMatch = content.match(/\*\*Build:\*\*\s*(.+)/i) || content.match(/Build:\s*(.+)/i);
    if (buildMatch) tools.build = buildMatch[1].trim();

    const testMatch = content.match(/\*\*Test:\*\*\s*(.+)/i) || content.match(/Test:\s*(.+)/i);
    if (testMatch) tools.test = testMatch[1].trim();

    const lintMatch = content.match(/\*\*Lint:\*\*\s*(.+)/i) || content.match(/Lint:\s*(.+)/i);
    if (lintMatch) tools.lint = lintMatch[1].trim();

    const typecheckMatch = content.match(/\*\*Typecheck:\*\*\s*(.+)/i) || content.match(/Typecheck:\s*(.+)/i);
    if (typecheckMatch) tools.typecheck = typecheckMatch[1].trim();

    return tools;
  }

  private parseCustomPrompts(content: string): ClaudeMdConfig['customPrompts'] {
    const prompts: ClaudeMdConfig['customPrompts'] = {};

    const systemMatch = content.match(/\*\*System Prompt:\*\*\s*([\s\S]*?)(?=\*\*|\n\n|\n#|$)/i);
    if (systemMatch) prompts.systemPrompt = systemMatch[1].trim();

    const beforeMatch = content.match(/\*\*Before Action:\*\*\s*([\s\S]*?)(?=\*\*|\n\n|\n#|$)/i);
    if (beforeMatch) prompts.beforeAction = beforeMatch[1].trim();

    const afterMatch = content.match(/\*\*After Action:\*\*\s*([\s\S]*?)(?=\*\*|\n\n|\n#|$)/i);
    if (afterMatch) prompts.afterAction = afterMatch[1].trim();

    const commitMatch = content.match(/\*\*Commit Message:\*\*\s*([\s\S]*?)(?=\*\*|\n\n|\n#|$)/i);
    if (commitMatch) prompts.commitMessage = commitMatch[1].trim();

    const prMatch = content.match(/\*\*PR Description:\*\*\s*([\s\S]*?)(?=\*\*|\n\n|\n#|$)/i);
    if (prMatch) prompts.prDescription = prMatch[1].trim();

    return prompts;
  }

  private parseAgents(content: string): ClaudeMdConfig['agents'] {
    const agents: ClaudeMdConfig['agents'] = {};

    const modelMatch = content.match(/\*\*Default Model:\*\*\s*(.+)/i) || content.match(/Default Model:\s*(.+)/i);
    if (modelMatch) agents.defaultModel = modelMatch[1].trim();

    const providerMatch = content.match(/\*\*Default Provider:\*\*\s*(.+)/i) || content.match(/Default Provider:\s*(.+)/i);
    if (providerMatch) agents.defaultProvider = providerMatch[1].trim();

    const skillsMatch = content.match(/\*\*Skills:\*\*\s*([\s\S]*?)(?=\*\*|\n\n|\n#|$)/i);
    if (skillsMatch) {
      agents.skills = skillsMatch[1]
        .split('\n')
        .map(line => line.replace(/^[-*]\s*/, '').trim())
        .filter(line => line.length > 0);
    }

    const permMatch = content.match(/\*\*Permission Mode:\*\*\s*(.+)/i) || content.match(/Permission Mode:\s*(.+)/i);
    if (permMatch) {
      const mode = permMatch[1].trim().toLowerCase();
      if (['ask', 'auto_accept_edits', 'plan', 'bypass'].includes(mode)) {
        agents.permissionMode = mode as PermissionMode;
      }
    }

    return agents;
  }

  private parseMcp(content: string): ClaudeMdConfig['mcp'] {
    const mcp: ClaudeMdConfig['mcp'] = {};
    mcp.servers = [];

    // Parse server definitions
    const serverBlocks = content.match(/#{3,4}\s+(.+?)\n([\s\S]*?)(?=#{3,4}|\n#{2}|$)/g);
    if (serverBlocks) {
      for (const block of serverBlocks) {
        const nameMatch = block.match(/#{3,4}\s+(.+)/);
        if (!nameMatch) continue;

        const name = nameMatch[1].trim();
        const commandMatch = block.match(/\*\*Command:\*\*\s*(.+)/i) || block.match(/Command:\s*(.+)/i);
        const urlMatch = block.match(/\*\*URL:\*\*\s*(.+)/i) || block.match(/URL:\s*(.+)/i);

        const server: any = { name };
        if (commandMatch) server.command = commandMatch[1].trim();
        if (urlMatch) server.url = urlMatch[1].trim();

        // Parse env vars
        const envMatch = block.match(/\*\*Environment:\*\*\s*([\s\S]*?)(?=\*\*|\n\n|\n#{2}|$)/i);
        if (envMatch) {
          server.env = {};
          const envLines = envMatch[1].split('\n');
          for (const line of envLines) {
            const envVarMatch = line.match(/^[-*]\s*(\w+)=\s*(.+)/);
            if (envVarMatch) {
              server.env[envVarMatch[1]] = envVarMatch[2].trim();
            }
          }
        }

        mcp.servers!.push(server);
      }
    }

    return mcp;
  }

  private parseHooks(content: string): ClaudeMdConfig['hooks'] {
    const hooks: ClaudeMdConfig['hooks'] = {};

    const preEditMatch = content.match(/\*\*Pre-Edit:\*\*\s*(.+)/i) || content.match(/Pre-Edit:\s*(.+)/i);
    if (preEditMatch) hooks.preEdit = preEditMatch[1].trim();

    const postEditMatch = content.match(/\*\*Post-Edit:\*\*\s*(.+)/i) || content.match(/Post-Edit:\s*(.+)/i);
    if (postEditMatch) hooks.postEdit = postEditMatch[1].trim();

    const preCommitMatch = content.match(/\*\*Pre-Commit:\*\*\s*(.+)/i) || content.match(/Pre-Commit:\s*(.+)/i);
    if (preCommitMatch) hooks.preCommit = preCommitMatch[1].trim();

    const postCommitMatch = content.match(/\*\*Post-Commit:\*\*\s*(.+)/i) || content.match(/Post-Commit:\s*(.+)/i);
    if (postCommitMatch) hooks.postCommit = postCommitMatch[1].trim();

    return hooks;
  }

  private parseIgnore(content: string): string[] {
    return content
      .split('\n')
      .map((line: string) => line.replace(/^[-*]\s*/, '').trim())
      .filter((line: string) => line.length > 0 && !line.startsWith('#'));
  }

  getConfig(): ClaudeMdConfig | null {
    return this.config;
  }

  getFilePath(): string | null {
    return this.filePath;
  }

  generateSystemPrompt(): string {
    if (!this.config) return '';

    const parts: string[] = [];

    // Project context
    if (this.config.project) {
      parts.push(`# Project: ${this.config.project.name}`);
      if (this.config.project.description) {
        parts.push(`Description: ${this.config.project.description}`);
      }
      if (this.config.project.language) {
        parts.push(`Language: ${this.config.project.language}`);
      }
      if (this.config.project.framework) {
        parts.push(`Framework: ${this.config.project.framework}`);
      }
    }

    // Coding standards
    if (this.config.codingStandards && Object.keys(this.config.codingStandards).length > 0) {
      parts.push('\n## Coding Standards');
      if (this.config.codingStandards.style) {
        parts.push(`- Follow ${this.config.codingStandards.style} style guide`);
      }
      if (this.config.codingStandards.maxLineLength) {
        parts.push(`- Max line length: ${this.config.codingStandards.maxLineLength}`);
      }
      if (this.config.codingStandards.useTabs !== undefined) {
        parts.push(`- Use ${this.config.codingStandards.useTabs ? 'tabs' : 'spaces'} for indentation`);
      }
    }

    // Architecture
    if (this.config.architecture?.patterns?.length) {
      parts.push('\n## Architecture Patterns');
      this.config.architecture.patterns.forEach(pattern => {
        parts.push(`- ${pattern}`);
      });
    }

    if (this.config.architecture?.conventions?.length) {
      parts.push('\n## Conventions');
      this.config.architecture.conventions.forEach(convention => {
        parts.push(`- ${convention}`);
      });
    }

    // Libraries
    if (this.config.libraries?.preferred?.length) {
      parts.push('\n## Preferred Libraries');
      this.config.libraries.preferred.forEach(lib => {
        parts.push(`- ${lib}`);
      });
    }

    if (this.config.libraries?.avoid?.length) {
      parts.push('\n## Libraries to Avoid');
      this.config.libraries.avoid.forEach(lib => {
        parts.push(`- ${lib}`);
      });
    }

    // Review checklist
    if (this.config.reviewChecklist?.required?.length) {
      parts.push('\n## Required Review Checklist');
      this.config.reviewChecklist.required.forEach(item => {
        parts.push(`- [ ] ${item}`);
      });
    }

    // Custom system prompt
    if (this.config.customPrompts?.systemPrompt) {
      parts.push('\n## Additional Instructions');
      parts.push(this.config.customPrompts.systemPrompt);
    }

    return parts.join('\n');
  }

  async executeHook(hookName: keyof ClaudeMdConfig['hooks'], cwd: string): Promise<{ success: boolean; output?: string; error?: string }> {
    if (!this.config?.hooks?.[hookName]) {
      return { success: true };
    }

    const command = this.config.hooks[hookName];
    if (!command) return { success: true };

    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      log.info(`Executing hook ${String(hookName)}: ${command}`);
      const { stdout, stderr } = await execAsync(command, { cwd });
      
      return {
        success: true,
        output: stdout || stderr
      };
    } catch (error: any) {
      log.error(`Hook ${String(hookName)} failed:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export const claudeMdParser = new ClaudeMdParser();
