#!/usr/bin/env node

/**
 * Lighthouse Audit Script
 * Runs Lighthouse audits for mobile and accessibility
 * Requirements: 3.6, 4.7
 */

import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const APP_URL = process.env.APP_URL || 'http://localhost:5000';
const OUTPUT_DIR = path.join(__dirname, '../lighthouse-reports');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Run Lighthouse audit
 */
async function runLighthouseAudit(url, config) {
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
  const options = {
    logLevel: 'info',
    output: ['html', 'json'],
    port: chrome.port,
    ...config,
  };

  const runnerResult = await lighthouse(url, options);

  // Try to kill Chrome, but don't fail if cleanup has permission issues (Windows)
  try {
    await chrome.kill();
  } catch (error) {
    if (error.code === 'EPERM') {
      console.log('\n⚠️  Warning: Could not clean up Chrome temp files (permission denied). This is a known Windows issue and does not affect results.');
    } else {
      throw error;
    }
  }

  return runnerResult;
}

/**
 * Save report to file
 */
function saveReport(report, filename) {
  const htmlPath = path.join(OUTPUT_DIR, `${filename}.html`);
  const jsonPath = path.join(OUTPUT_DIR, `${filename}.json`);

  fs.writeFileSync(htmlPath, report.report[0]);
  fs.writeFileSync(jsonPath, report.report[1]);

  console.log(`\n📄 Reports saved:`);
  console.log(`   HTML: ${htmlPath}`);
  console.log(`   JSON: ${jsonPath}`);
}

/**
 * Extract and display scores
 */
function displayScores(lhr, auditType) {
  const categories = lhr.categories;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${auditType.toUpperCase()} AUDIT RESULTS`);
  console.log(`${'='.repeat(60)}`);
  
  const scores = {
    performance: categories.performance?.score * 100 || 0,
    accessibility: categories.accessibility?.score * 100 || 0,
    bestPractices: categories['best-practices']?.score * 100 || 0,
    seo: categories.seo?.score * 100 || 0,
  };

  console.log(`\n📊 Scores:`);
  console.log(`   Performance:     ${scores.performance.toFixed(1)} / 100`);
  console.log(`   Accessibility:   ${scores.accessibility.toFixed(1)} / 100`);
  console.log(`   Best Practices:  ${scores.bestPractices.toFixed(1)} / 100`);
  console.log(`   SEO:             ${scores.seo.toFixed(1)} / 100`);

  return scores;
}

/**
 * Display key issues
 */
function displayIssues(lhr) {
  const audits = lhr.audits;
  const issues = [];

  // Check for failed audits
  Object.entries(audits).forEach(([key, audit]) => {
    if (audit.score !== null && audit.score < 0.9 && audit.score !== 1) {
      issues.push({
        id: key,
        title: audit.title,
        score: audit.score,
        description: audit.description,
      });
    }
  });

  if (issues.length > 0) {
    console.log(`\n⚠️  Issues Found (${issues.length}):`);
    issues.slice(0, 10).forEach((issue, index) => {
      console.log(`\n   ${index + 1}. ${issue.title}`);
      console.log(`      Score: ${(issue.score * 100).toFixed(1)}`);
      console.log(`      ${issue.description.substring(0, 100)}...`);
    });

    if (issues.length > 10) {
      console.log(`\n   ... and ${issues.length - 10} more issues`);
    }
  } else {
    console.log(`\n✅ No significant issues found!`);
  }

  return issues;
}

/**
 * Check if scores meet requirements
 */
function checkRequirements(scores, auditType) {
  const requirements = {
    mobile: {
      performance: 90,
      accessibility: 95,
    },
    desktop: {
      performance: 90,
      accessibility: 95,
    },
  };

  const required = requirements[auditType] || requirements.mobile;
  const passed = {
    performance: scores.performance >= required.performance,
    accessibility: scores.accessibility >= required.accessibility,
  };

  console.log(`\n📋 Requirements Check:`);
  console.log(`   Performance >= ${required.performance}:   ${passed.performance ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Accessibility >= ${required.accessibility}: ${passed.accessibility ? '✅ PASS' : '❌ FAIL'}`);

  return passed.performance && passed.accessibility;
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting Lighthouse Audits...');
  console.log(`   URL: ${APP_URL}`);
  console.log(`   Output: ${OUTPUT_DIR}`);

  try {
    // Mobile Audit
    console.log('\n📱 Running Mobile Audit...');
    const mobileResult = await runLighthouseAudit(APP_URL, {
      formFactor: 'mobile',
      screenEmulation: {
        mobile: true,
        width: 375,
        height: 667,
        deviceScaleFactor: 2,
      },
    });

    saveReport(mobileResult, 'mobile-audit');
    const mobileScores = displayScores(mobileResult.lhr, 'mobile');
    const mobileIssues = displayIssues(mobileResult.lhr);
    const mobilePass = checkRequirements(mobileScores, 'mobile');

    // Desktop Audit
    console.log('\n\n💻 Running Desktop Audit...');
    const desktopResult = await runLighthouseAudit(APP_URL, {
      formFactor: 'desktop',
      screenEmulation: {
        mobile: false,
        width: 1350,
        height: 940,
        deviceScaleFactor: 1,
      },
    });

    saveReport(desktopResult, 'desktop-audit');
    const desktopScores = displayScores(desktopResult.lhr, 'desktop');
    const desktopIssues = displayIssues(desktopResult.lhr);
    const desktopPass = checkRequirements(desktopScores, 'desktop');

    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('SUMMARY');
    console.log(`${'='.repeat(60)}`);
    console.log(`\n📱 Mobile: ${mobilePass ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`💻 Desktop: ${desktopPass ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`\n📊 Total Issues: ${mobileIssues.length + desktopIssues.length}`);
    console.log(`\n📁 Reports saved to: ${OUTPUT_DIR}`);

    // Exit with appropriate code
    if (mobilePass && desktopPass) {
      console.log('\n✅ All audits passed!');
      process.exit(0);
    } else {
      console.log('\n❌ Some audits failed. Please review the reports.');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Error running Lighthouse audits:', error);
    process.exit(1);
  }
}

// Run if called directly
main();

export { runLighthouseAudit, displayScores, checkRequirements };
