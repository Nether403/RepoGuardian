#!/usr/bin/env node

const RENDER_API_KEY = 'rnd_bZVrNjy3LUBaANIjGFh6UtCmGCR8';
const RENDER_API_BASE = 'https://api.render.com/v1';

async function fetchRenderAPI(endpoint) {
  const response = await fetch(`${RENDER_API_BASE}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${RENDER_API_KEY}`,
      'Accept': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Render API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

async function main() {
  try {
    console.log('Fetching your Render services...\n');
    
    const services = await fetchRenderAPI('/services');
    
    if (services.length === 0) {
      console.log('No services found.');
      return;
    }
    
    for (const service of services) {
      console.log(`\n📦 Service: ${service.service.name}`);
      console.log(`   Type: ${service.service.type}`);
      console.log(`   Status: ${service.service.suspended}`);
      console.log(`   URL: ${service.service.serviceDetails?.url || 'N/A'}`);
      
      // Get latest deploy
      const deploys = await fetchRenderAPI(`/services/${service.service.id}/deploys?limit=1`);
      if (deploys.length > 0) {
        const latest = deploys[0].deploy;
        console.log(`   Latest Deploy: ${latest.status} (${latest.createdAt})`);
        
        if (latest.status === 'build_failed' || latest.status === 'deploy_failed') {
          console.log(`   ❌ FAILED - Fetching logs...`);
          // You can add log fetching here if needed
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
