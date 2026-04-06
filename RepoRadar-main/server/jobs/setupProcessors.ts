import { jobQueue } from './JobQueue';
import { BatchAnalysisProcessor } from './processors/BatchAnalysisProcessor';
import { ExportProcessor } from './processors/ExportProcessor';

/**
 * Setup and register all job processors
 */
export async function setupJobProcessors(): Promise<void> {
  console.log('Setting up job processors...');

  // Initialize the job queue
  await jobQueue.initialize();

  // Register batch analysis processor
  const batchAnalysisProcessor = new BatchAnalysisProcessor();
  jobQueue.registerProcessor('batch-analysis', batchAnalysisProcessor);
  console.log('Registered batch-analysis processor');

  // Register export processor
  const exportProcessor = new ExportProcessor();
  jobQueue.registerProcessor('export', exportProcessor);
  console.log('Registered export processor');

  console.log('Job processors setup complete');
}

/**
 * Cleanup job processors on shutdown
 */
export async function cleanupJobProcessors(): Promise<void> {
  console.log('Cleaning up job processors...');
  await jobQueue.close();
  console.log('Job processors cleanup complete');
}
