import crypto from 'crypto';
import os from 'os';

/**
 * Instance Identification
 * Generates and manages unique instance identifiers for logging and monitoring
 */

class InstanceIdentifier {
  private instanceId: string;
  private hostname: string;
  private pid: number;
  private startTime: Date;

  constructor() {
    // Generate unique instance ID
    this.instanceId = this.generateInstanceId();
    this.hostname = os.hostname();
    this.pid = process.pid;
    this.startTime = new Date();
  }

  /**
   * Generate unique instance ID
   */
  private generateInstanceId(): string {
    // Use environment variable if provided (useful for container orchestration)
    if (process.env.INSTANCE_ID) {
      return process.env.INSTANCE_ID;
    }

    // Generate ID from hostname, PID, and random bytes
    const hostname = os.hostname();
    const pid = process.pid;
    const random = crypto.randomBytes(4).toString('hex');
    
    return `${hostname}-${pid}-${random}`;
  }

  /**
   * Get instance ID
   */
  getId(): string {
    return this.instanceId;
  }

  /**
   * Get hostname
   */
  getHostname(): string {
    return this.hostname;
  }

  /**
   * Get process ID
   */
  getPid(): number {
    return this.pid;
  }

  /**
   * Get instance start time
   */
  getStartTime(): Date {
    return this.startTime;
  }

  /**
   * Get instance uptime in seconds
   */
  getUptime(): number {
    return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
  }

  /**
   * Get instance metadata for logging
   */
  getMetadata(): {
    instanceId: string;
    hostname: string;
    pid: number;
    startTime: string;
    uptime: number;
  } {
    return {
      instanceId: this.instanceId,
      hostname: this.hostname,
      pid: this.pid,
      startTime: this.startTime.toISOString(),
      uptime: this.getUptime(),
    };
  }

  /**
   * Format log message with instance information
   */
  formatLog(message: string, level: 'info' | 'warn' | 'error' = 'info'): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] [${this.instanceId}] ${message}`;
  }
}

// Export singleton instance
export const instanceId = new InstanceIdentifier();

/**
 * Enhanced logger with instance identification
 */
export const logger = {
  info: (message: string, ...args: any[]) => {
    console.log(instanceId.formatLog(message, 'info'), ...args);
  },
  
  warn: (message: string, ...args: any[]) => {
    console.warn(instanceId.formatLog(message, 'warn'), ...args);
  },
  
  error: (message: string, ...args: any[]) => {
    console.error(instanceId.formatLog(message, 'error'), ...args);
  },
  
  debug: (message: string, ...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(instanceId.formatLog(message, 'info'), ...args);
    }
  },
};
