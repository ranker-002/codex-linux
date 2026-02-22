import type { PluginContext } from '../../../src/main/plugins/PluginManager';

export default class SamplePlugin {
  private context: PluginContext;
  private disposables: Array<() => void> = [];

  constructor(context: PluginContext) {
    this.context = context;
  }

  async activate(): Promise<void> {
    this.context.log.info('Sample plugin activated');

    // Register commands
    this.context.registerCommand('sample.hello', () => {
      this.showHello();
    });

    this.context.registerCommand('sample.showInfo', () => {
      this.showInfo();
    });

    // Subscribe to events
    this.context.subscribe('agent:created', (data: any) => {
      this.context.log.info(`Agent created: ${data.agentId}`);
    });

    this.context.subscribe('agent:message', (data: any) => {
      this.context.log.debug(`New message in agent ${data.agentId}`);
    });

    // Add menu items
    this.context.registerMenu('agent:context', [
      {
        command: 'sample.hello',
        group: 'sample',
      },
    ]);
  }

  async deactivate(): Promise<void> {
    this.context.log.info('Sample plugin deactivated');
    
    // Clean up disposables
    this.disposables.forEach(dispose => dispose());
    this.disposables = [];
  }

  private showHello(): void {
    this.context.emit('notification:show', {
      title: 'Sample Plugin',
      body: 'Hello from the sample plugin! 👋',
    });
  }

  private showInfo(): void {
    const info = {
      name: 'Codex Sample Plugin',
      version: '1.0.0',
      features: [
        'Command registration',
        'Event subscription',
        'Menu contributions',
        'Notifications',
      ],
    };

    this.context.log.info('Plugin info:', info);
    
    this.context.emit('notification:show', {
      title: 'Plugin Info',
      body: `Sample Plugin v${info.version}\nFeatures: ${info.features.join(', ')}`,
    });
  }
}