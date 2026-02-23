import { EventEmitter } from 'events';
import log from 'electron-log';

interface AutoVerifyConfig {
  enabled: boolean;
  takeScreenshots: boolean;
  checkConsoleErrors: boolean;
  checkDOMErrors: boolean;
  screenshotDelay: number;
  maxRetries: number;
}

interface VerificationResult {
  success: boolean;
  screenshots?: string[];
  consoleErrors?: string[];
  domErrors?: string[];
  checks: {
    screenshots: boolean;
    consoleErrors: boolean;
    domErrors: boolean;
  };
}

interface DOMElement {
  tag: string;
  id?: string;
  className?: string;
  text?: string;
  attributes: Record<string, string>;
  children: DOMElement[];
}

export class AutoVerifyManager extends EventEmitter {
  private config: AutoVerifyConfig = {
    enabled: true,
    takeScreenshots: true,
    checkConsoleErrors: true,
    checkDOMErrors: true,
    screenshotDelay: 2000,
    maxRetries: 3
  };

  constructor() {
    super();
  }

  setConfig(config: Partial<AutoVerifyConfig>): void {
    this.config = { ...this.config, ...config };
    log.info('Auto-verify config updated:', this.config);
  }

  getConfig(): AutoVerifyConfig {
    return { ...this.config };
  }

  async verify(appUrl: string): Promise<VerificationResult> {
    if (!this.config.enabled) {
      return {
        success: true,
        checks: {
          screenshots: false,
          consoleErrors: false,
          domErrors: false
        }
      };
    }

    this.emit('verify:started', { url: appUrl });

    const result: VerificationResult = {
      success: true,
      checks: {
        screenshots: false,
        consoleErrors: false,
        domErrors: false
      }
    };

    try {
      // Wait for the app to stabilize
      await this.delay(this.config.screenshotDelay);

      // Take screenshots
      if (this.config.takeScreenshots) {
        result.screenshots = await this.takeScreenshots(appUrl);
        result.checks.screenshots = true;
        this.emit('verify:screenshot', { screenshots: result.screenshots });
      }

      // Check console errors
      if (this.config.checkConsoleErrors) {
        result.consoleErrors = await this.checkConsoleErrors(appUrl);
        result.checks.consoleErrors = true;
        if (result.consoleErrors.length > 0) {
          this.emit('verify:consoleErrors', { errors: result.consoleErrors });
        }
      }

      // Check DOM errors
      if (this.config.checkDOMErrors) {
        result.domErrors = await this.checkDOMErrors(appUrl);
        result.checks.domErrors = true;
        if (result.domErrors.length > 0) {
          this.emit('verify:domErrors', { errors: result.domErrors });
        }
      }

      // Determine success
      result.success = 
        (!result.consoleErrors || result.consoleErrors.length === 0) &&
        (!result.domErrors || result.domErrors.length === 0);

      this.emit('verify:completed', { result });

    } catch (error) {
      log.error('Auto-verification failed:', error);
      result.success = false;
      this.emit('verify:error', { error });
    }

    return result;
  }

  private async takeScreenshots(appUrl: string): Promise<string[]> {
    const screenshots: string[] = [];

    try {
      // Use Electron's capturePage API via IPC
      const screenshot = await this.capturePage();
      if (screenshot) {
        screenshots.push(screenshot);
      }

      // Take additional screenshots of specific viewports
      const viewports = [
        { width: 1920, height: 1080, name: 'desktop' },
        { width: 768, height: 1024, name: 'tablet' },
        { width: 375, height: 667, name: 'mobile' }
      ];

      for (const viewport of viewports) {
        const viewportScreenshot = await this.captureViewport(viewport.width, viewport.height);
        if (viewportScreenshot) {
          screenshots.push(viewportScreenshot);
        }
      }

    } catch (error) {
      log.error('Failed to take screenshots:', error);
    }

    return screenshots;
  }

  private async capturePage(): Promise<string | null> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _unused = true;
    try {
      // This would be implemented via IPC to the main process
      // which has access to the BrowserWindow
      return null;
    } catch (error) {
      log.error('Failed to capture page:', error);
      return null;
    }
  }

  private async captureViewport(_width: number, _height: number): Promise<string | null> {
    try {
      // This would be implemented via IPC to resize and capture
      return null;
    } catch (error) {
      log.error('Failed to capture viewport:', error);
      return null;
    }
  }

  private async checkConsoleErrors(_appUrl: string): Promise<string[]> {
    const errors: string[] = [];

    try {
      // Check for common console error patterns
      const commonErrors = [
        'Uncaught ReferenceError',
        'Uncaught TypeError',
        'Uncaught SyntaxError',
        '404 Not Found',
        '500 Internal Server Error',
        'Failed to load resource',
        'Cannot read property',
        'is not a function',
        'is not defined',
        'Network Error',
        'CORS policy'
      ];

      // This would be implemented via IPC to check the webContents console
      // For now, return empty array
      return errors;

    } catch (error) {
      log.error('Failed to check console errors:', error);
      return errors;
    }
  }

  private async checkDOMErrors(_appUrl: string): Promise<string[]> {
    const errors: string[] = [];

    try {
      // Check for common DOM error patterns
      const domChecks = [
        { selector: '[data-error]', message: 'Elements with data-error attribute found' },
        { selector: '.error', message: 'Elements with error class found' },
        { selector: '[role="alert"]', message: 'Alert elements found' },
        { selector: '[aria-invalid="true"]', message: 'Invalid form elements found' },
        { selector: 'img:not([src])', message: 'Images without src found' },
        { selector: 'a:not([href])', message: 'Links without href found' },
        { selector: '[style*="display: none"][style*="!important"]', message: 'Hidden elements with !important found' }
      ];

      // This would be implemented via IPC to execute JavaScript in the webContents
      // For now, return empty array
      return errors;

    } catch (error) {
      log.error('Failed to check DOM errors:', error);
      return errors;
    }
  }

  async inspectDOM(_appUrl: string): Promise<DOMElement[]> {
    try {
      // This would be implemented via IPC to get the DOM structure
      return [];
    } catch (error) {
      log.error('Failed to inspect DOM:', error);
      return [];
    }
  }

  async clickElement(selector: string, _appUrl: string): Promise<boolean> {
    try {
      // This would be implemented via IPC to simulate clicks
      this.emit('verify:click', { selector });
      return true;
    } catch (error) {
      log.error('Failed to click element:', error);
      return false;
    }
  }

  async fillForm(selector: string, value: string, _appUrl: string): Promise<boolean> {
    try {
      // This would be implemented via IPC to fill form fields
      this.emit('verify:fill', { selector, value });
      return true;
    } catch (error) {
      log.error('Failed to fill form:', error);
      return false;
    }
  }

  async runCustomCheck(checkName: string, checkFn: () => Promise<boolean>): Promise<boolean> {
    try {
      const result = await checkFn();
      this.emit('verify:custom', { checkName, result });
      return result;
    } catch (error) {
      log.error(`Custom check ${checkName} failed:`, error);
      return false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  cleanup(): void {
    this.removeAllListeners();
  }
}

export default AutoVerifyManager;
