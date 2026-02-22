import { test, expect } from '@playwright/test';

test.describe('Application Launch', () => {
  test('should display loading screen', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Loading Codex')).toBeVisible();
  });

  test('should load main interface', async ({ page }) => {
    await page.goto('/');
    // Wait for loading to complete
    await page.waitForSelector('text=Agents', { timeout: 30000 });
    await expect(page.locator('text=Agents')).toBeVisible();
    await expect(page.locator('text=Worktrees')).toBeVisible();
    await expect(page.locator('text=Skills')).toBeVisible();
  });

  test('should have correct window title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Codex/);
  });
});

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('text=Agents', { timeout: 30000 });
  });

  test('should navigate to Worktrees', async ({ page }) => {
    await page.click('text=Worktrees');
    await expect(page.locator('h1:has-text("Worktrees")')).toBeVisible();
    await expect(page.locator('text=Isolated Git workspaces')).toBeVisible();
  });

  test('should navigate to Skills', async ({ page }) => {
    await page.click('text=Skills');
    await expect(page.locator('h1:has-text("Skills")')).toBeVisible();
    await expect(page.locator('text=Reusable AI capabilities')).toBeVisible();
  });

  test('should navigate to Automations', async ({ page }) => {
    await page.click('text=Automations');
    await expect(page.locator('h1:has-text("Automations")')).toBeVisible();
    await expect(page.locator('text=Scheduled tasks')).toBeVisible();
  });

  test('should navigate to Settings', async ({ page }) => {
    await page.click('text=Settings');
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible();
  });
});

test.describe('Agent Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('text=Agents', { timeout: 30000 });
  });

  test('should open create agent modal', async ({ page }) => {
    await page.click('[data-testid="create-agent-button"]');
    await expect(page.locator('text=Create New Agent')).toBeVisible();
    await expect(page.locator('text=Agent name')).toBeVisible();
  });

  test('should create a new agent', async ({ page }) => {
    await page.click('[data-testid="create-agent-button"]');
    await page.fill('input[placeholder="My Coding Agent"]', 'Test Agent');
    await page.fill('input[placeholder="/path/to/project"]', '/tmp/test-project');
    await page.click('button:has-text("Create Agent")');
    
    // Should show success or create agent
    await expect(page.locator('text=Test Agent').first()).toBeVisible({ timeout: 5000 });
  });

  test('should send message to agent', async ({ page }) => {
    // Create agent first
    await page.click('[data-testid="create-agent-button"]');
    await page.fill('input[placeholder="My Coding Agent"]', 'Chat Agent');
    await page.fill('input[placeholder="/path/to/project"]', '/tmp/test-project');
    await page.click('button:has-text("Create Agent")');
    
    // Wait for agent creation
    await page.waitForTimeout(2000);
    
    // Click on agent
    await page.click('text=Chat Agent');
    
    // Type message
    await page.fill('[data-testid="chat-input"]', 'Hello!');
    await page.click('[data-testid="send-message-button"]');
    
    // Should show user message
    await expect(page.locator('text=Hello!')).toBeVisible();
  });
});

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('text=Agents', { timeout: 30000 });
    await page.click('text=Settings');
  });

  test('should display settings tabs', async ({ page }) => {
    await expect(page.locator('button:has-text("General")')).toBeVisible();
    await expect(page.locator('button:has-text("AI Providers")')).toBeVisible();
    await expect(page.locator('button:has-text("Appearance")')).toBeVisible();
  });

  test('should switch to AI Providers tab', async ({ page }) => {
    await page.click('button:has-text("AI Providers")');
    await expect(page.locator('text=OpenAI')).toBeVisible();
    await expect(page.locator('text=Anthropic')).toBeVisible();
  });
});