#!/usr/bin/env node

// Load environment variables using the same priority as Next.js.
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const requiredEnvVars = [
  'DATABASE_URL',
  'GOOGLE_API_KEY',
];

const optionalEnvVars = [
  'GA_MEASUREMENT_ID', // Google Analytics (optional)
];

function checkEnvironmentVariables() {
  const missingVars = [];
  const emptyVars = [];
  const presentVars = [];
  const optionalPresentVars = [];
  const optionalMissingVars = [];

  console.log('🔍 Checking environment variables...\n');

  requiredEnvVars.forEach(varName => {
    const value = process.env[varName];
    
    if (!value) {
      missingVars.push(varName);
    } else if (value.trim() === '' || value === '""' || value === "''") {
      emptyVars.push(varName);
    } else {
      presentVars.push(varName);
    }
  });

  // Check optional variables
  optionalEnvVars.forEach(varName => {
    const value = process.env[varName];
    if (value && value.trim() !== '' && value !== '""' && value !== "''") {
      optionalPresentVars.push(varName);
    } else {
      optionalMissingVars.push(varName);
    }
  });

  // Report results
  if (presentVars.length > 0) {
    console.log('✅ Present environment variables:');
    presentVars.forEach(varName => {
      console.log(`   ${varName}`);
    });
    console.log('');
  }

  if (optionalPresentVars.length > 0) {
    console.log('✅ Optional environment variables (configured):');
    optionalPresentVars.forEach(varName => {
      console.log(`   ${varName}`);
    });
    console.log('');
  }

  if (optionalMissingVars.length > 0) {
    console.log('ℹ️  Optional environment variables (not configured):');
    optionalMissingVars.forEach(varName => {
      console.log(`   ${varName}`);
    });
    console.log('');
  }

  if (emptyVars.length > 0) {
    console.warn('⚠️  Empty environment variables:');
    emptyVars.forEach(varName => {
      console.warn(`   ${varName} (set but empty)`);
    });
    console.log('');
  }

  if (missingVars.length > 0) {
    console.error('❌ Missing environment variables:');
    missingVars.forEach(varName => {
      console.error(`   ${varName}`);
    });
    console.log('');
  }

  // Summary
  const totalVars = requiredEnvVars.length;
  const configuredVars = presentVars.length;
  
  console.log(`📊 Environment Variables Summary:`);
  console.log(`   Total required: ${totalVars}`);
  console.log(`   Configured: ${configuredVars}`);
  console.log(`   Missing: ${missingVars.length}`);
  console.log(`   Empty: ${emptyVars.length}`);
  console.log('');

  if (missingVars.length > 0 || emptyVars.length > 0) {
    console.error('⚠️  Some environment variables are missing or empty.');
    console.error('   Please check your .env file and ensure all required variables are set.');
    console.log('');
    
    // Don't exit with error code, just warn
    console.log('🚧 Build will continue, but the application may not function correctly.');
    return false;
  } else {
    console.log('🎉 All required environment variables are configured!');
    return true;
  }
}

// Only run the check if this script is executed directly
if (require.main === module) {
  checkEnvironmentVariables();
}

module.exports = { checkEnvironmentVariables };
