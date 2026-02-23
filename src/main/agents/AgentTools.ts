import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';
import log from 'electron-log';

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface ViewToolParams {
  file_path: string;
  offset?: number;
  limit?: number;
}

export interface EditToolParams {
  file_path: string;
  old_string: string;
  new_string: string;
}

export interface BashToolParams {
  command: string;
  timeout?: number;
  cwd?: string;
}

export interface GlobToolParams {
  pattern: string;
  path?: string;
}

export interface GrepToolParams {
  pattern: string;
  path?: string;
  include?: string;
}

export interface LsToolParams {
  path: string;
}

export class AgentTools {
  private worktreePath: string;

  constructor(worktreePath: string) {
    this.worktreePath = worktreePath;
  }

  private resolvePath(filePath: string): string {
    const resolved = path.resolve(this.worktreePath, filePath);
    const resolvedRoot = path.resolve(this.worktreePath);
    if (!resolved.startsWith(resolvedRoot + path.sep) && resolved !== resolvedRoot) {
      throw new Error('Path traversal detected: ' + filePath);
    }
    return resolved;
  }

  async view(params: ViewToolParams): Promise<ToolResult> {
    try {
      const fullPath = this.resolvePath(params.file_path);
      const content = await fs.readFile(fullPath, 'utf-8');
      const lines = content.split('\n');
      
      const offset = params.offset || 1;
      const limit = params.limit || 200;
      const startLine = Math.max(0, offset - 1);
      const endLine = Math.min(lines.length, startLine + limit);
      
      const selectedLines = lines.slice(startLine, endLine);
      const lineNumbers = selectedLines.map((_, idx) => startLine + idx + 1);
      
      const output = selectedLines
        .map((line, idx) => `${lineNumbers[idx]}${' '.repeat(6 - String(lineNumbers[idx]).length)}|${line}`)
        .join('\n');

      return {
        success: true,
        output: output + (endLine < lines.length ? '\n... (truncated)' : '')
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async edit(params: EditToolParams): Promise<ToolResult> {
    try {
      const fullPath = this.resolvePath(params.file_path);
      const content = await fs.readFile(fullPath, 'utf-8');
      
      if (!content.includes(params.old_string)) {
        return {
          success: false,
          output: '',
          error: `String not found in file: "${params.old_string.slice(0, 50)}..."`
        };
      }

      const occurrences = content.split(params.old_string).length - 1;
      if (occurrences > 1) {
        return {
          success: false,
          output: '',
          error: `Multiple occurrences found (${occurrences}). Be more specific.`
        };
      }

      const newContent = content.replace(params.old_string, params.new_string);
      await fs.writeFile(fullPath, newContent, 'utf-8');

      return {
        success: true,
        output: `File edited successfully: ${params.file_path}`
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async bash(params: BashToolParams): Promise<ToolResult> {
    return new Promise((resolve) => {
      const cwd = params.cwd ? this.resolvePath(params.cwd) : this.worktreePath;
      const timeout = params.timeout || 120000;
      
      const [cmd, ...args] = params.command.split(' ');
      
      const child = spawn(cmd, args, {
        cwd,
        shell: true,
        env: { ...process.env, FORCE_COLOR: '1' }
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      const timeoutId = setTimeout(() => {
        child.kill();
        resolve({
          success: false,
          output: stdout,
          error: `Command timed out after ${timeout}ms`
        });
      }, timeout);

      child.on('close', (code) => {
        clearTimeout(timeoutId);
        resolve({
          success: code === 0,
          output: stdout || stderr,
          error: code !== 0 ? `Exit code ${code}${stderr ? ': ' + stderr : ''}` : undefined
        });
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          output: '',
          error: error.message
        });
      });
    });
  }

  async glob(params: GlobToolParams): Promise<ToolResult> {
    try {
      const searchPath = params.path ? this.resolvePath(params.path) : this.worktreePath;
      const pattern = params.pattern;
      
      // Simple glob implementation using native fs
      const files: string[] = [];
      
      async function walk(dir: string, relativeDir: string) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = relativeDir ? path.join(relativeDir, entry.name) : entry.name;
          
          if (entry.isDirectory()) {
            if (!entry.name.startsWith('.') && 
                entry.name !== 'node_modules' && 
                entry.name !== 'dist' && 
                entry.name !== 'build') {
              await walk(fullPath, relativePath);
            }
          } else if (entry.isFile()) {
            // Simple pattern matching
            if (pattern.includes('*')) {
              const regex = new RegExp('^' + pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$');
              if (regex.test(relativePath)) {
                files.push(relativePath);
              }
            } else if (relativePath.endsWith(pattern) || relativePath.includes(pattern)) {
              files.push(relativePath);
            }
          }
        }
      }
      
      await walk(searchPath, '');

      return {
        success: true,
        output: files.join('\n') || 'No files found'
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async grep(params: GrepToolParams): Promise<ToolResult> {
    try {
      const searchPath = params.path ? this.resolvePath(params.path) : this.worktreePath;
      const { pattern, include } = params;
      
      const result = await this.bash({
        command: `grep -r -n ${include ? `--include="${include}"` : ''} "${pattern}" .`,
        cwd: searchPath
      });

      return result;
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async ls(params: LsToolParams): Promise<ToolResult> {
    try {
      const fullPath = this.resolvePath(params.path);
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      
      const output = entries
        .map(entry => {
          const type = entry.isDirectory() ? 'd' : entry.isFile() ? 'f' : '?';
          return `${type} ${entry.name}`;
        })
        .join('\n');

      return {
        success: true,
        output: output || '(empty directory)'
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  getToolDefinitions(): Array<{ name: string; description: string; parameters: object }> {
    return [
      {
        name: 'view',
        description: 'View the contents of a file. Use offset and limit for large files.',
        parameters: {
          type: 'object',
          properties: {
            file_path: { type: 'string', description: 'Path to the file' },
            offset: { type: 'number', description: 'Start line number (1-based)' },
            limit: { type: 'number', description: 'Number of lines to show (max 200)' }
          },
          required: ['file_path']
        }
      },
      {
        name: 'edit',
        description: 'Edit a file by replacing a specific string. The old_string must match exactly and uniquely.',
        parameters: {
          type: 'object',
          properties: {
            file_path: { type: 'string', description: 'Path to the file' },
            old_string: { type: 'string', description: 'Exact string to replace' },
            new_string: { type: 'string', description: 'Replacement string' }
          },
          required: ['file_path', 'old_string', 'new_string']
        }
      },
      {
        name: 'bash',
        description: 'Execute a bash command in the worktree. Use for running tests, builds, git commands, etc.',
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'Command to execute' },
            timeout: { type: 'number', description: 'Timeout in milliseconds (default 120000)' }
          },
          required: ['command']
        }
      },
      {
        name: 'glob',
        description: 'Find files matching a glob pattern (e.g., "**/*.ts").',
        parameters: {
          type: 'object',
          properties: {
            pattern: { type: 'string', description: 'Glob pattern' },
            path: { type: 'string', description: 'Directory to search in' }
          },
          required: ['pattern']
        }
      },
      {
        name: 'grep',
        description: 'Search for a pattern in file contents using grep.',
        parameters: {
          type: 'object',
          properties: {
            pattern: { type: 'string', description: 'Search pattern' },
            path: { type: 'string', description: 'Directory to search in' },
            include: { type: 'string', description: 'File pattern to include (e.g., "*.ts")' }
          },
          required: ['pattern']
        }
      },
      {
        name: 'ls',
        description: 'List the contents of a directory.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Directory path' }
          },
          required: ['path']
        }
      }
    ];
  }

  async executeTool(name: string, params: any): Promise<ToolResult> {
    switch (name) {
      case 'view':
        return this.view(params);
      case 'edit':
        return this.edit(params);
      case 'bash':
        return this.bash(params);
      case 'glob':
        return this.glob(params);
      case 'grep':
        return this.grep(params);
      case 'ls':
        return this.ls(params);
      default:
        return {
          success: false,
          output: '',
          error: `Unknown tool: ${name}`
        };
    }
  }
}
