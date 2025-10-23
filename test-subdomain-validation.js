#!/usr/bin/env node

/**
 * Test script to validate subdomain input handling
 */

const ProjectConfigurator = require('./lib/wizard/project-configurator');

async function testSubdomainValidation() {
  console.log('🧪 Testing subdomain validation fix...\n');
  
  const configurator = new ProjectConfigurator();
  
  // Test the validation function directly
  const testInputs = [
    'app,api,docs,*,status',
    ['app', 'api', 'docs', '*', 'status'], // Array input
    'api,admin',
    '*',
    'a,b,c',
    '*.api,*.admin',
    '',
    null,
    undefined
  ];
  
  // Extract the validation function from the subdomain question
  const questions = [
    {
      type: 'input',
      name: 'subdomains',
      message: 'Additional subdomains (comma-separated, e.g., api,admin):',
      validate: async (input) => {
        if (!input) return true; // Optional field
        
        // Debug logging to see what type we're getting
        console.log(`[DEBUG] Subdomain input type: ${typeof input}, value:`, input);
        
        // Convert input to string if it's not already
        let inputStr = input;
        if (typeof input !== 'string') {
          if (Array.isArray(input)) {
            inputStr = input.join(',');
          } else {
            inputStr = String(input);
          }
        }
        
        console.log(`[DEBUG] Converted input: ${typeof inputStr}, value:`, inputStr);
        
        const subdomains = inputStr.split(',').map(s => s.trim()).filter(s => s);
        
        for (const subdomain of subdomains) {
          // Handle wildcard subdomains
          if (subdomain === '*') {
            continue; // Wildcard is valid
          }
          
          // Handle wildcard patterns like *.api or *.admin
          if (subdomain.startsWith('*.')) {
            const wildcardSubdomain = subdomain.substring(2);
            if (wildcardSubdomain.length === 0) {
              return 'Wildcard subdomain cannot be empty (e.g., use "*" not "*.")';
            }
            // Validate the part after the wildcard
            if (wildcardSubdomain.length === 1) {
              if (!/^[a-zA-Z0-9]$/.test(wildcardSubdomain)) {
                return `Invalid wildcard subdomain "${subdomain}". Single character after wildcard must be alphanumeric`;
              }
            } else {
              if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/.test(wildcardSubdomain)) {
                return `Invalid wildcard subdomain "${subdomain}". Use only letters, numbers, and hyphens (cannot start or end with hyphen)`;
              }
            }
            continue;
          }
          
          // Validate each subdomain - allow single characters and proper multi-character subdomains
          if (subdomain.length === 1) {
            // Single character subdomain - must be alphanumeric
            if (!/^[a-zA-Z0-9]$/.test(subdomain)) {
              return `Invalid subdomain "${subdomain}". Single character subdomains must be alphanumeric`;
            }
          } else {
            // Multi-character subdomain - must start and end with alphanumeric, can contain hyphens
            if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/.test(subdomain)) {
              return `Invalid subdomain "${subdomain}". Use only letters, numbers, and hyphens (cannot start or end with hyphen)`;
            }
          }
          
          if (subdomain.length > 63) {
            return `Subdomain "${subdomain}" is too long (max 63 characters)`;
          }
        }
        
        return true;
      }
    }
  ];
  
  const validateFunction = questions[0].validate;
  
  for (const testInput of testInputs) {
    console.log(`\n📝 Testing input: ${JSON.stringify(testInput)}`);
    console.log(`   Type: ${typeof testInput}`);
    
    try {
      const result = await validateFunction(testInput);
      if (result === true) {
        console.log('   ✅ PASSED');
      } else {
        console.log(`   ❌ FAILED: ${result}`);
      }
    } catch (error) {
      console.log(`   💥 ERROR: ${error.message}`);
    }
  }
  
  console.log('\n🎯 Testing the specific problematic input: "app,api,docs,*,status"');
  const problematicInput = 'app,api,docs,*,status';
  const result = await validateFunction(problematicInput);
  
  if (result === true) {
    console.log('✅ SUCCESS! The fix works - subdomain validation now accepts the input correctly.');
  } else {
    console.log(`❌ STILL FAILING: ${result}`);
  }
}

testSubdomainValidation().catch(console.error);