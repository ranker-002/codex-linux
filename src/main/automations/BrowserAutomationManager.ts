import { EventEmitter } from 'events';
import log from 'electron-log';

export interface BrowserAutomationConfig {
  headless?: boolean;
  slowMo?: number;
  viewport?: { width: number; height: number };
  timeout?: number;
}

export interface BrowserAction {
  type: 'goto' | 'click' | 'type' | 'screenshot' | 'evaluate' | 'wait' | 'select' | 'hover' | 'scroll';
  selector?: string;
  value?: string;
  options?: Record<string, any>;
}

export interface BrowserSession {
  id: string;
  url: string;
  title: string;
  createdAt: Date;
}

export class BrowserAutomationManager extends EventEmitter {
  private config: BrowserAutomationConfig;
  private sessions: Map<string, any> = new Map();
  private browser: any = null;

  constructor() {
    super();
    this.config = {
      headless: false,
      slowMo: 0,
      viewport: { width: 1280, height: 720 },
      timeout: 30000,
    };
  }

  async configure(config: Partial<BrowserAutomationConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    log.info('Browser automation configured', this.config);
  }

  async launch(): Promise<void> {
    try {
      const { chromium } = await import('playwright');
      this.browser = await chromium.launch({
        headless: this.config.headless,
        slowMo: this.config.slowMo,
      });
      log.info('Browser launched');
      this.emit('browser:launched');
    } catch (error) {
      log.error('Failed to launch browser:', error);
      throw error;
    }
  }

  async createSession(sessionId: string): Promise<BrowserSession> {
    if (!this.browser) {
      await this.launch();
    }

    const context = await this.browser.newContext({
      viewport: this.config.viewport,
    });

    const page = await context.newPage();

    this.sessions.set(sessionId, { page, context, browser: 'chromium' });

    const session: BrowserSession = {
      id: sessionId,
      url: '',
      title: '',
      createdAt: new Date(),
    };

    this.emit('session:created', session);
    return session;
  }

  async executeActions(sessionId: string, actions: BrowserAction[]): Promise<any[]> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const { page } = session;
    const results: any[] = [];

    for (const action of actions) {
      try {
        const result = await this.executeAction(page, action);
        results.push({ action, result, success: true });
      } catch (error: any) {
        results.push({ action, error: error.message, success: false });
      }
    }

    return results;
  }

  private async executeAction(page: any, action: BrowserAction): Promise<any> {
    switch (action.type) {
      case 'goto':
        await page.goto(action.value!, { timeout: this.config.timeout });
        return { url: page.url(), title: await page.title() };

      case 'click':
        await page.click(action.selector!, action.options);
        return { clicked: true };

      case 'type':
        await page.fill(action.selector!, action.value!);
        return { typed: action.value };

      case 'screenshot':
        return await page.screenshot({ fullPage: action.options?.fullPage });

      case 'evaluate':
        return await page.evaluate(action.value!);

      case 'wait':
        if (action.selector) {
          await page.waitForSelector(action.selector, { timeout: this.config.timeout });
        } else {
          await page.waitForTimeout(parseInt(action.value!) || 1000);
        }
        return { waited: true };

      case 'select':
        await page.selectOption(action.selector!, action.value!);
        return { selected: action.value };

      case 'hover':
        await page.hover(action.selector!);
        return { hovered: true };

      case 'scroll':
        await page.evaluate((_) => window.scrollTo(0, document.body.scrollHeight));
        return { scrolled: true };

      default:
        throw new Error(`Unknown action: ${action.type}`);
    }
  }

  async getPageContent(sessionId: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    return session.page.content();
  }

  async takeScreenshot(sessionId: string, fullPage: boolean = false): Promise<Buffer> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    return session.page.screenshot({ fullPage });
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    await session.context.close();
    this.sessions.delete(sessionId);
    this.emit('session:closed', sessionId);
  }

  async closeAll(): Promise<void> {
    for (const sessionId of this.sessions.keys()) {
      await this.closeSession(sessionId);
    }

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }

    this.emit('browser:closed');
  }

  getActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  getConfig(): BrowserAutomationConfig {
    return { ...this.config };
  }

  cleanup(): void {
    this.closeAll();
    this.removeAllListeners();
  }
}

export default BrowserAutomationManager;
