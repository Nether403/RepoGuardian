/**
 * Configuration Module
 * Central export point for all configuration functionality
 */

export {
  // Types
  type Environment,
  type EnvironmentConfig,
  type ValidationResult,
  
  // Functions
  loadEnvironmentConfig,
  validateEnvironmentConfig,
  logConfigurationSummary,
  getFeatureStatus,
  initializeConfiguration,
  
  // Configuration Manager
  ConfigurationManager,
  config,
} from './environment';

export {
  // Legacy validation functions (for backward compatibility)
  validateConfiguration,
  logConfigurationSummary as logConfigSummary,
  getFeatureStatus as getFeatures,
  initializeConfiguration as initConfig,
} from './validation';

// Re-export performance config for convenience
export {
  type PerformanceConfig,
  type DatabaseConfig,
  type CacheConfig,
  type CompressionConfig,
  type GitHubConfig,
  type FrontendConfig,
  type MonitoringConfig,
  type FallbackConfig,
  PerformanceConfigManager,
  performanceConfig,
  defaultPerformanceConfig,
} from '../../config/performance.config';
