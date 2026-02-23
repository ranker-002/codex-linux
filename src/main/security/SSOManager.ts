import { EventEmitter } from 'events';
import log from 'electron-log';
import fetch from 'node-fetch';

export interface SSOConfig {
  provider: 'okta' | 'azure-ad' | 'google' | 'custom';
  clientId: string;
  clientSecret?: string;
  tenantId?: string;
  domain?: string;
  redirectUri: string;
  scopes: string[];
}

export interface SSOUser {
  id: string;
  email: string;
  name: string;
  groups: string[];
  roles: string[];
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
}

export interface AuthResult {
  success: boolean;
  user?: SSOUser | null;
  error?: string;
}

export class SSOManager extends EventEmitter {
  private config: SSOConfig | null = null;
  private currentUser: SSOUser | null = null;
  private tokenEndpoint = '';
  private userEndpoint = '';

  constructor() {
    super();
  }

  configure(config: SSOConfig): void {
    this.config = config;
    
    // Set endpoints based on provider
    switch (config.provider) {
      case 'okta':
        this.tokenEndpoint = `${config.domain}/oauth2/v1/token`;
        this.userEndpoint = `${config.domain}/oauth2/v1/userinfo`;
        break;
      case 'azure-ad':
        this.tokenEndpoint = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;
        this.userEndpoint = 'https://graph.microsoft.com/v1.0/me';
        break;
      case 'google':
        this.tokenEndpoint = 'https://oauth2.googleapis.com/token';
        this.userEndpoint = 'https://www.googleapis.com/oauth2/v2/userinfo';
        break;
      default:
        if (config.domain) {
          this.tokenEndpoint = `${config.domain}/oauth/token`;
          this.userEndpoint = `${config.domain}/oauth/userinfo`;
        }
    }

    log.info('SSO configured', { provider: config.provider });
  }

  getAuthorizationUrl(state: string): string {
    if (!this.config) throw new Error('SSO not configured');

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: this.config.scopes.join(' '),
      state,
    });

    switch (this.config.provider) {
      case 'okta':
        return `${this.config.domain}/oauth2/v1/authorize?${params}`;
      case 'azure-ad':
        return `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/authorize?${params}`;
      case 'google':
        return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
      default:
        return `${this.config?.domain}/oauth/authorize?${params}`;
    }
  }

  async handleCallback(code: string): Promise<AuthResult> {
    if (!this.config) return { success: false, error: 'SSO not configured' };

    try {
      const tokens = await this.exchangeCodeForTokens(code);
      const user = await this.fetchUserInfo(tokens.access_token);
      
      this.currentUser = {
        id: user.id || '',
        email: user.email || '',
        name: user.name || '',
        groups: user.groups || [],
        roles: user.roles || [],
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      };

      this.emit('user:loggedIn', this.currentUser);
      return { success: true, user: this.currentUser };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.error('SSO callback error:', error);
      return { success: false, error: message };
    }
  }

  private async exchangeCodeForTokens(code: string): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  }> {
    const params = new URLSearchParams({
      code,
      client_id: this.config!.clientId,
      client_secret: this.config!.clientSecret || '',
      redirect_uri: this.config!.redirectUri,
      grant_type: 'authorization_code',
    });

    const response = await fetch(this.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`);
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };
    return data;
  }

  private async fetchUserInfo(accessToken: string): Promise<Partial<SSOUser>> {
    const response = await fetch(this.userEndpoint, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`User info fetch failed: ${response.statusText}`);
    }

    const data = await response.json() as {
      sub?: string;
      id?: string;
      email?: string;
      mail?: string;
      userPrincipalName?: string;
      name?: string;
      groups?: string[];
      roles?: string[];
    };

    return {
      id: data.sub || data.id || '',
      email: data.email || data.mail || data.userPrincipalName || '',
      name: data.name || '',
      groups: data.groups || [],
      roles: data.roles || [],
    };
  }

  async refreshToken(): Promise<boolean> {
    if (!this.currentUser?.refreshToken) return false;

    try {
      const params = new URLSearchParams({
        refresh_token: this.currentUser.refreshToken,
        client_id: this.config!.clientId,
        client_secret: this.config!.clientSecret || '',
        grant_type: 'refresh_token',
      });

      const response = await fetch(this.tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const tokens = await response.json() as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
      };
      
      this.currentUser.accessToken = tokens.access_token;
      this.currentUser.refreshToken = tokens.refresh_token || this.currentUser.refreshToken;
      this.currentUser.expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

      this.emit('token:refreshed', this.currentUser);
      return true;
    } catch (error) {
      log.error('Token refresh error:', error);
      return false;
    }
  }

  logout(): void {
    this.currentUser = null;
    this.emit('user:loggedOut');
  }

  getCurrentUser(): SSOUser | null {
    return this.currentUser;
  }

  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  getAccessToken(): string | null {
    return this.currentUser?.accessToken || null;
  }

  cleanup(): void {
    this.currentUser = null;
    this.removeAllListeners();
  }
}

export default SSOManager;
