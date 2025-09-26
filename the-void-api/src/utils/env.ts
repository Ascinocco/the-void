import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

export class EnvConfig {
  /**
   * Get a required environment variable
   * Throws an error if the variable is not set
   */
  static getRequired(key: string): string {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Required environment variable ${key} is not set`);
    }
    return value;
  }

  /**
   * Get an optional environment variable with a default value
   */
  static get(key: string, defaultValue: string = ""): string {
    return process.env[key] || defaultValue;
  }

  /**
   * Get an environment variable as a number
   */
  static getNumber(key: string, defaultValue?: number): number {
    const value = process.env[key];
    if (!value) {
      if (defaultValue === undefined) {
        throw new Error(`Required environment variable ${key} is not set`);
      }
      return defaultValue;
    }
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      throw new Error(
        `Environment variable ${key} is not a valid number: ${value}`
      );
    }
    return parsed;
  }

  /**
   * Get an environment variable as a boolean
   */
  static getBoolean(key: string, defaultValue?: boolean): boolean {
    const value = process.env[key];
    if (!value) {
      if (defaultValue === undefined) {
        throw new Error(`Required environment variable ${key} is not set`);
      }
      return defaultValue;
    }
    return value.toLowerCase() === "true" || value === "1";
  }

  /**
   * Check if we're in development mode
   */
  static isDevelopment(): boolean {
    return this.get("NODE_ENV", "development") === "development";
  }

  /**
   * Check if we're in production mode
   */
  static isProduction(): boolean {
    return this.get("NODE_ENV") === "production";
  }
}
