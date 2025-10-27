export class Logger {
  private static formatDate(): string {
    return new Date().toISOString();
  }

  static info(message: string, data?: any): void {
    console.log(`[${this.formatDate()}] INFO: ${message}`, data || '');
  }

  static error(message: string, error?: any): void {
    console.error(`[${this.formatDate()}] ERROR: ${message}`, error || '');
  }

  static warn(message: string, data?: any): void {
    console.warn(`[${this.formatDate()}] WARN: ${message}`, data || '');
  }

  static debug(message: string, data?: any): void {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[${this.formatDate()}] DEBUG: ${message}`, data || '');
    }
  }
}