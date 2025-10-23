#!/usr/bin/env node

/**
 * Test script to validate primary domain input handling fix
 */

const inquirer = require('inquirer');

async function testPrimaryDomainValidation() {
  console.log('🧪 Testing primary domain validation fix...\n');
  
  // Test the exact validation function from project-configurator.js
  const primaryDomainQuestion = {
    type: 'input',
    name: 'primaryDomain',
    message: 'Primary domain(s) (comma-separated, e.g., example.com,app.example.com):',
    validate: async (input) => {
      if (!input) return 'At least one primary domain is required';
      
      // Debug logging to see what type we're getting
      console.log(`[DEBUG] Primary domain input type: ${typeof input}, value:`, input);
      
      // Convert input to string if it's not already
      let inputStr = input;
      if (typeof input !== 'string') {
        if (Array.isArray(input)) {
          inputStr = input.join(',');
        } else {
          inputStr = String(input);
        }
      }
      
      console.log(`[DEBUG] Converted primary domain input: ${typeof inputStr}, value:`, inputStr);
      
      // Split domains and validate each one
      const domains = inputStr.split(',').map(d => d.trim()).filter(d => d);
      
      if (domains.length === 0) {
        return 'At least one primary domain is required';
      }
      
      // Real-time domain format validation for each domain
      const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
      
      for (const domain of domains) {
        if (!domainRegex.test(domain)) {
          return `Please enter a valid domain name for "${domain}" (e.g., example.com)`;
        }
        
        // Additional domain validation checks
        if (domain.length > 253) {
          return `Domain name "${domain}" is too long (max 253 characters)`;
        }
        
        if (domain.includes('..')) {
          return `Domain name "${domain}" cannot contain consecutive dots`;
        }
        
        if (domain.startsWith('-') || domain.endsWith('-')) {
          return `Domain name "${domain}" cannot start or end with a hyphen`;
        }
        
        // Check for reserved domains
        const reservedDomains = ['localhost', 'example.com', 'test.com', 'invalid'];
        if (reservedDomains.some(reserved => domain.toLowerCase().includes(reserved))) {
          return `Please use a real domain name for "${domain}", not a reserved or example domain`;
        }
      }
      
      return true;
    },
    filter: (input) => {
      if (!input) return [];
      
      // Convert input to string if it's not already
      let inputStr = input;
      if (typeof input !== 'string') {
        if (Array.isArray(input)) {
          inputStr = input.join(',');
        } else {
          inputStr = String(input);
        }
      }
      
      return inputStr.split(',').map(d => d.trim()).filter(d => d);
    }
  };
  
  // Test the validation function directly with different input types
  const testInputs = [
    'focuswithfocal.com,focuswithfocal.io',
    ['focuswithfocal.com', 'focuswithfocal.io'], // Array input
    'example.com',
    'test.domain.com,another.domain.org',
    '',
    null,
    undefined
  ];
  
  const validateFunction = primaryDomainQuestion.validate;
  
  console.log('📝 Testing validation function directly:\n');
  
  for (const testInput of testInputs) {
    console.log(`Testing input: ${JSON.stringify(testInput)}`);
    console.log(`Type: ${typeof testInput}`);
    
    try {
      const result = await validateFunction(testInput);
      if (result === true) {
        console.log('✅ PASSED\n');
      } else {
        console.log(`❌ FAILED: ${result}\n`);
      }
    } catch (error) {
      console.log(`💥 ERROR: ${error.message}\n`);
    }
  }
  
  console.log('🎯 Testing the specific problematic input: "focuswithfocal.com,focuswithfocal.io"');
  const problematicInput = 'focuswithfocal.com,focuswithfocal.io';
  const result = await validateFunction(problematicInput);
  
  if (result === true) {
    console.log('✅ SUCCESS! The fix works - primary domain validation now accepts the input correctly.');
  } else {
    console.log(`❌ STILL FAILING: ${result}`);
  }
  
  console.log('\n🔄 Now testing with actual inquirer prompt...');
  
  try {
    const answer = await inquirer.prompt([{
      ...primaryDomainQuestion,
      default: 'focuswithfocal.com,focuswithfocal.io'
    }]);
    
    console.log('✅ Inquirer prompt completed successfully!');
    console.log('Result:', answer);
  } catch (error) {
    console.log('❌ Inquirer prompt failed:', error.message);
  }
}

testPrimaryDomainValidation().catch(console.error);