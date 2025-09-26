export class Logger {
  private static formatTimestamp(): string {
    return new Date().toISOString();
  }

  static info(message: string, meta?: Record<string, unknown>): void {
    console.log(
      `[${this.formatTimestamp()}] INFO: ${message}`,
      meta ? JSON.stringify(meta, null, 2) : ""
    );
  }

  static error(
    message: string,
    error?: Error,
    meta?: Record<string, unknown>
  ): void {
    console.error(
      `[${this.formatTimestamp()}] ERROR: ${message}`,
      error?.stack || "",
      meta ? JSON.stringify(meta, null, 2) : ""
    );
  }

  static warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(
      `[${this.formatTimestamp()}] WARN: ${message}`,
      meta ? JSON.stringify(meta, null, 2) : ""
    );
  }

  static debug(message: string, meta?: Record<string, unknown>): void {
    if (
      process.env.NODE_ENV === "development" ||
      process.env.DEBUG === "true"
    ) {
      console.debug(
        `[${this.formatTimestamp()}] DEBUG: ${message}`,
        meta ? JSON.stringify(meta, null, 2) : ""
      );
    }
  }
}
