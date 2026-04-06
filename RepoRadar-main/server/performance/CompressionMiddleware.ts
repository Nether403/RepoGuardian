import { gzip, brotliCompress, deflate } from 'zlib';
import { promisify } from 'util';
import type { Request, Response, NextFunction } from 'express';
import { ICompressionMiddleware, CompressionConfig, CompressionStats } from './interfaces';

const gzipAsync = promisify(gzip);
const brotliCompressAsync = promisify(brotliCompress);
const deflateAsync = promisify(deflate);

/**
 * Compression middleware for HTTP responses
 * Supports gzip, brotli, and deflate compression with automatic algorithm selection
 */
export class CompressionMiddleware implements ICompressionMiddleware {
  private config: CompressionConfig = {
    threshold: 1024, // 1KB minimum
    algorithms: ['brotli', 'gzip', 'deflate'],
    level: 6, // Balanced compression level
    chunkSize: 16384, // 16KB chunks
    memLevel: 8, // Default memory level for gzip
  };

  private stats: CompressionStats = {
    totalRequests: 0,
    compressedRequests: 0,
    compressionRatio: 0,
    algorithmUsage: {},
    bytesSaved: 0,
    processingTime: 0,
  };

  private compressionTimes: number[] = [];
  private compressionRatios: number[] = [];

  constructor(config?: Partial<CompressionConfig>) {
    if (config) {
      this.configure(config);
    }
  }

  configure(config: Partial<CompressionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  async compress(data: Buffer | string, acceptedEncodings: string[]): Promise<{
    data: Buffer;
    encoding: string;
    originalSize: number;
    compressedSize: number;
    compressionTime: number;
  }> {
    const startTime = Date.now();
    const inputBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    const originalSize = inputBuffer.length;

    const algorithm = this.getBestAlgorithm(acceptedEncodings);
    if (!algorithm) {
      return {
        data: inputBuffer,
        encoding: 'identity',
        originalSize,
        compressedSize: originalSize,
        compressionTime: 0,
      };
    }

    let compressedData: Buffer;
    
    try {
      switch (algorithm) {
        case 'brotli':
          compressedData = await brotliCompressAsync(inputBuffer, {
            params: {
              [require('zlib').constants.BROTLI_PARAM_QUALITY]: this.config.level,
            },
          });
          break;
        case 'gzip':
          compressedData = await gzipAsync(inputBuffer, {
            level: this.config.level,
            memLevel: this.config.memLevel,
            chunkSize: this.config.chunkSize,
          });
          break;
        case 'deflate':
          compressedData = await deflateAsync(inputBuffer, {
            level: this.config.level,
            memLevel: this.config.memLevel,
            chunkSize: this.config.chunkSize,
          });
          break;
        default:
          throw new Error(`Unsupported compression algorithm: ${algorithm}`);
      }
    } catch (error) {
      // Fallback to uncompressed data if compression fails
      return {
        data: inputBuffer,
        encoding: 'identity',
        originalSize,
        compressedSize: originalSize,
        compressionTime: Date.now() - startTime,
      };
    }

    const compressionTime = Date.now() - startTime;
    const compressedSize = compressedData.length;

    // Update statistics
    this.updateStats(originalSize, compressedSize, compressionTime, algorithm);

    return {
      data: compressedData,
      encoding: algorithm,
      originalSize,
      compressedSize,
      compressionTime,
    };
  }

  shouldCompress(size: number, contentType?: string): boolean {
    // Don't compress if below threshold
    if (size < this.config.threshold) {
      return false;
    }

    // Don't compress already compressed content
    if (contentType) {
      const compressedTypes = [
        'image/', 'video/', 'audio/',
        'application/zip', 'application/gzip', 'application/x-gzip',
        'application/x-compress', 'application/x-compressed',
        'application/x-bzip2', 'application/x-7z-compressed',
      ];
      
      if (compressedTypes.some(type => contentType.toLowerCase().includes(type))) {
        return false;
      }
    }

    return true;
  }

  getBestAlgorithm(acceptedEncodings: string[]): string | null {
    const encodings = acceptedEncodings.map(e => e.toLowerCase().trim());
    
    // Check for supported algorithms in order of preference
    for (const algorithm of this.config.algorithms) {
      if (encodings.includes(algorithm)) {
        return algorithm;
      }
    }

    return null;
  }

  getStats(): CompressionStats {
    return {
      ...this.stats,
      compressionRatio: this.calculateAverageCompressionRatio(),
      processingTime: this.calculateAverageProcessingTime(),
    };
  }

  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      compressedRequests: 0,
      compressionRatio: 0,
      algorithmUsage: {},
      bytesSaved: 0,
      processingTime: 0,
    };
    this.compressionTimes = [];
    this.compressionRatios = [];
  }

  /**
   * Express middleware function
   */
  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      this.stats.totalRequests++;

      // Store original methods
      const originalSend = res.send;
      const originalJson = res.json;

      // Override res.send
      res.send = function(this: Response, body: any) {
        return handleResponse.call(this, body, originalSend, false);
      };

      // Override res.json
      res.json = function(this: Response, body: any) {
        return handleResponse.call(this, body, originalJson, true);
      };

      const compressionMiddleware = this;

      async function handleResponse(
        this: Response,
        body: any,
        originalMethod: Function,
        isJson: boolean
      ) {
        try {
          // Convert body to string/buffer
          let data: string | Buffer;
          if (isJson) {
            data = JSON.stringify(body);
          } else if (Buffer.isBuffer(body)) {
            data = body;
          } else {
            data = String(body);
          }

          const contentType = this.get('Content-Type') || '';
          const size = Buffer.byteLength(data);

          // Check if we should compress
          if (!compressionMiddleware.shouldCompress(size, contentType)) {
            return originalMethod.call(this, body);
          }

          // Get accepted encodings
          const acceptEncoding = req.get('Accept-Encoding') || '';
          const acceptedEncodings = acceptEncoding.split(',').map(e => e.trim());

          // Compress the data
          const result = await compressionMiddleware.compress(data, acceptedEncodings);

          if (result.encoding !== 'identity') {
            // Set compression headers
            this.set('Content-Encoding', result.encoding);
            this.set('Content-Length', result.compressedSize.toString());
            this.set('Vary', 'Accept-Encoding');

            // Send compressed data
            return this.end(result.data);
          } else {
            // Send uncompressed data
            return originalMethod.call(this, body);
          }
        } catch (error) {
          // Fallback to original method if compression fails
          console.error('Compression middleware error:', error);
          return originalMethod.call(this, body);
        }
      }

      next();
    };
  }

  private updateStats(
    originalSize: number,
    compressedSize: number,
    compressionTime: number,
    algorithm: string
  ): void {
    this.stats.compressedRequests++;
    this.stats.bytesSaved += (originalSize - compressedSize);
    
    // Track algorithm usage
    this.stats.algorithmUsage[algorithm] = (this.stats.algorithmUsage[algorithm] || 0) + 1;
    
    // Track compression ratios and times for averaging
    const ratio = compressedSize / originalSize;
    this.compressionRatios.push(ratio);
    this.compressionTimes.push(compressionTime);
    
    // Keep only recent measurements (last 1000) to prevent memory growth
    if (this.compressionRatios.length > 1000) {
      this.compressionRatios = this.compressionRatios.slice(-1000);
    }
    if (this.compressionTimes.length > 1000) {
      this.compressionTimes = this.compressionTimes.slice(-1000);
    }
  }

  private calculateAverageCompressionRatio(): number {
    if (this.compressionRatios.length === 0) return 0;
    const sum = this.compressionRatios.reduce((a, b) => a + b, 0);
    return sum / this.compressionRatios.length;
  }

  private calculateAverageProcessingTime(): number {
    if (this.compressionTimes.length === 0) return 0;
    const sum = this.compressionTimes.reduce((a, b) => a + b, 0);
    return sum / this.compressionTimes.length;
  }
}

/**
 * Factory function to create compression middleware
 */
export function createCompressionMiddleware(config?: Partial<CompressionConfig>): CompressionMiddleware {
  return new CompressionMiddleware(config);
}