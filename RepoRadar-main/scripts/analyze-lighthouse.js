#!/usr/bin/env node

/**
 * Analyze Lighthouse Results
 * Extracts key failing audits from Lighthouse JSON reports
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPORTS_DIR = path.join(__dirname, '../lighthouse-reports');

function analyzeReport(reportPath, reportName) {
  const data = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${reportName.toUpperCase()} ANALYSIS`);
  console.log(`${'='.repeat(60)}`);
  
  // Get scores
  const categories = data.categories;
  console.log('\n📊 Scores:');
  Object.entries(categories).forEach(([key, cat]) => {
    const score = Math.round((cat.score || 0) * 100);
    const emoji = score >= 90 ? '✅' : score >= 50 ? '⚠️' : '❌';
    console.log(`   ${emoji} ${cat.title}: ${score}/100`);
  });
  
  // Get failing accessibility audits
  console.log('\n🔍 Failing Accessibility Audits:');
  const a11yAudits = categories.accessibility.auditRefs
    .map(ref => ({ ...data.audits[ref.id], weight: ref.weight }))
    .filter(audit => audit.score !== null && audit.score < 1 && audit.weight > 0)
    .sort((a, b) => b.weight - a.weight);
  
  if (a11yAudits.length === 0) {
    console.log('   ✅ All weighted accessibility audits passing!');
  } else {
    a11yAudits.slice(0, 10).forEach(audit => {
      console.log(`\n   • ${audit.title} (weight: ${audit.weight})`);
      console.log(`     Score: ${Math.round((audit.score || 0) * 100)}/100`);
      if (audit.description) {
        const desc = audit.description.replace(/<[^>]*>/g, '').substring(0, 100);
        console.log(`     ${desc}...`);
      }
    });
  }
  
  // Get performance opportunities
  console.log('\n⚡ Top Performance Opportunities:');
  const perfAudits = Object.values(data.audits)
    .filter(audit => audit.details && audit.details.type === 'opportunity')
    .sort((a, b) => (b.details.overallSavingsMs || 0) - (a.details.overallSavingsMs || 0));
  
  if (perfAudits.length === 0) {
    console.log('   ✅ No major performance opportunities identified!');
  } else {
    perfAudits.slice(0, 5).forEach(audit => {
      const savings = audit.details.overallSavingsMs || 0;
      console.log(`\n   • ${audit.title}`);
      console.log(`     Potential savings: ${Math.round(savings)}ms`);
    });
  }
  
  // Get console errors
  const consoleErrors = data.audits['errors-in-console'];
  if (consoleErrors && consoleErrors.details && consoleErrors.details.items) {
    console.log('\n❌ Console Errors:');
    consoleErrors.details.items.slice(0, 5).forEach(item => {
      console.log(`   • ${item.description || item.source}`);
    });
  }
}

// Analyze both reports
try {
  const mobileReport = path.join(REPORTS_DIR, 'mobile-audit.json');
  const desktopReport = path.join(REPORTS_DIR, 'desktop-audit.json');
  
  if (fs.existsSync(mobileReport)) {
    analyzeReport(mobileReport, 'Mobile');
  }
  
  if (fs.existsSync(desktopReport)) {
    analyzeReport(desktopReport, 'Desktop');
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Analysis complete!');
  console.log('='.repeat(60) + '\n');
  
} catch (error) {
  console.error('Error analyzing reports:', error);
  process.exit(1);
}
