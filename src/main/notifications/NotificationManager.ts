import { Notification } from 'electron';
import log from 'electron-log';

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  actions?: Array<{
    text: string;
    type: 'button';
  }>;
  onClick?: () => void;
  onClose?: () => void;
}

export class NotificationManager {
  private notificationHistory: Array<{
    id: string;
    title: string;
    body: string;
    timestamp: Date;
    read: boolean;
  }> = [];

  show(options: NotificationOptions): void {
    if (!Notification.isSupported()) {
      log.warn('Notifications not supported on this platform');
      return;
    }

    try {
      const notification = new Notification({
        title: options.title,
        body: options.body,
        icon: options.icon,
        actions: options.actions
      });

      notification.on('click', () => {
        options.onClick?.();
      });

      notification.on('close', () => {
        options.onClose?.();
      });

      notification.show();

      // Add to history
      this.notificationHistory.push({
        id: Math.random().toString(36).substr(2, 9),
        title: options.title,
        body: options.body,
        timestamp: new Date(),
        read: false
      });

      // Keep only last 100 notifications
      if (this.notificationHistory.length > 100) {
        this.notificationHistory = this.notificationHistory.slice(-100);
      }

    } catch (error) {
      log.error('Failed to show notification:', error);
    }
  }

  getHistory(): Array<{
    id: string;
    title: string;
    body: string;
    timestamp: Date;
    read: boolean;
  }> {
    return [...this.notificationHistory].reverse();
  }

  markAsRead(id: string): void {
    const notification = this.notificationHistory.find(n => n.id === id);
    if (notification) {
      notification.read = true;
    }
  }

  markAllAsRead(): void {
    this.notificationHistory.forEach(n => n.read = true);
  }

  clearHistory(): void {
    this.notificationHistory = [];
  }

  getUnreadCount(): number {
    return this.notificationHistory.filter(n => !n.read).length;
  }
}