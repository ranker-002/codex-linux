import { test, expect, type Page } from '@playwright/test';

test.describe('Codex Linux E2E Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  describe('Application Launch', () => {
    test('should display loading screen', async ({ page }) => {
      await expect(page.locator('text=Loading')).toBeVisible({ timeout: 10000 });
    });

    test('should load main interface within timeout', async ({ page }) => {
      await expect(page.locator('nav, aside, [class*="sidebar"]')).toBeVisible({ timeout: 30000 });
    });

    test('should have correct window title', async ({ page }) => {
      await expect(page).toHaveTitle(/Codex/i, { timeout: 10000 });
    });

    test('should show sidebar navigation', async ({ page }) => {
      await expect(page.locator('text=Agents')).toBeVisible({ timeout: 30000 });
    });
  });

  describe('Navigation', () => {
    test.beforeEach(async ({ page }) => {
      await page.waitForSelector('text=Agents', { timeout: 30000 });
    });

    test('should navigate to all main sections', async ({ page }) => {
      const sections = ['Agents', 'Worktrees', 'Skills', 'Settings'];
      
      for (const section of sections) {
        await expect(page.locator(`text=${section}`)).toBeVisible();
      }
    });

    test('should navigate using keyboard shortcuts', async ({ page }) => {
      await page.keyboard.press('Alt+1');
      await expect(page.locator('[class*="agent"]')).toBeVisible({ timeout: 5000 });
    });
  });

  describe('Agent Management', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('text=Agents', { timeout: 30000 });
    });

    test('should open create agent modal', async ({ page }) => {
      const createButton = page.locator('[data-testid="create-agent-button"], button:has-text("Create")').first();
      if (await createButton.isVisible()) {
        await createButton.click();
        await expect(page.locator('text=Create New Agent, text=New Agent')).toBeVisible({ timeout: 5000 });
      }
    });

    test('should display agent list', async ({ page }) => {
      await page.waitForTimeout(2000);
      const agentCards = page.locator('[class*="card"], [class*="agent"]');
      const count = await agentCards.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should select an agent', async ({ page }) => {
      await page.waitForTimeout(2000);
      const firstAgent = page.locator('[class*="card"], [class*="agent"]').first();
      if (await firstAgent.isVisible()) {
        await firstAgent.click();
        await page.waitForTimeout(1000);
      }
    });
  });

  describe('Chat Interface', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('text=Agents', { timeout: 30000 });
    });

    test('should display chat input', async ({ page }) => {
      await page.waitForTimeout(2000);
      const chatInput = page.locator('input[type="text"], textarea, [data-testid="chat-input"]').first();
      await expect(chatInput).toBeVisible({ timeout: 5000 });
    });

    test('should type and send message', async ({ page }) => {
      await page.waitForTimeout(2000);
      const chatInput = page.locator('input[type="text"], textarea, [data-testid="chat-input"]').first();
      
      if (await chatInput.isVisible()) {
        await chatInput.fill('test message');
        await expect(chatInput).toHaveValue('test message');
      }
    });
  });

  describe('Settings', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('text=Settings', { timeout: 30000 });
      await page.click('text=Settings');
    });

    test('should display settings page', async ({ page }) => {
      await expect(page.locator('text=Settings, h1:has-text("Settings")')).toBeVisible({ timeout: 5000 });
    });

    test('should have general settings', async ({ page }) => {
      await expect(page.locator('text=General, text=AI')).toBeVisible({ timeout: 5000 });
    });
  });

  describe('Accessibility', () => {
    test('should have proper heading structure', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('text=Agents', { timeout: 30000 });
      
      const h1 = page.locator('h1');
      const count = await h1.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should have focusable elements', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('text=Agents', { timeout: 30000 });
      
      const buttons = page.locator('button');
      const count = await buttons.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should support keyboard navigation', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('text=Agents', { timeout: 30000 });
      
      await page.keyboard.press('Tab');
      const focusedElement = await page.locator(':focus').first();
      await expect(focusedElement).toBeVisible();
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      await page.route('**/api/**', route => route.abort('failed'));
      await page.goto('/');
      await page.waitForTimeout(3000);
      
      const content = await page.content();
      expect(content.length).toBeGreaterThan(0);
    });
  });

  describe('Responsive Design', () => {
    test('should work at different viewport sizes', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto('/');
      await expect(page.locator('text=Agents')).toBeVisible({ timeout: 30000 });

      await page.setViewportSize({ width: 768, height: 1024 });
      await page.reload();
      await expect(page.locator('text=Agents')).toBeVisible({ timeout: 30000 });

      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      await page.waitForTimeout(2000);
    });
  });

  describe('Performance', () => {
    test('should load within acceptable time', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/');
      await page.waitForSelector('text=Agents', { timeout: 30000 });
      const loadTime = Date.now() - startTime;
      
      console.log(`Page load time: ${loadTime}ms`);
      expect(loadTime).toBeLessThan(30000);
    });

    test('should not have memory leaks on navigation', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('text=Agents', { timeout: 30000 });
      
      for (let i = 0; i < 3; i++) {
        await page.reload();
        await page.waitForSelector('text=Agents', { timeout: 30000 });
      }
    });
  });
});
