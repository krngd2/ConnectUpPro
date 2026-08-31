/**
 * Environment Variable Checker for ConnectUpPro Dashboard
 * Validates that all required environment variables are present and configured
 */

interface EnvCheckResult {
    isValid: boolean;
    missing: string[];
    empty: string[];
    present: string[];
}

const requiredEnvVars = [
    'DATABASE_URL',
    'GOOGLE_API_KEY',
] as const;

export function checkEnvironmentVariables(options: {
    silent?: boolean;
    exitOnError?: boolean
} = {}): EnvCheckResult {
    const { silent = false, exitOnError = false } = options;

    const missingVars: string[] = [];
    const emptyVars: string[] = [];
    const presentVars: string[] = [];

    if (!silent) {
        console.log('🔍 Checking environment variables...\n');
    }

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

    if (!silent) {
        // Report results
        if (presentVars.length > 0) {
            console.log('✅ Present environment variables:');
            presentVars.forEach(varName => {
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

            if (exitOnError) {
                console.error('❌ Exiting due to missing environment variables.');
                process.exit(1);
            } else {
                console.log('🚧 Application may not function correctly.');
            }
        } else {
            console.log('🎉 All required environment variables are configured!');
        }
    }

    return {
        isValid: missingVars.length === 0 && emptyVars.length === 0,
        missing: missingVars,
        empty: emptyVars,
        present: presentVars
    };
}

export function getRequiredEnvVar(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Environment variable ${name} is required but not set`);
    }
    return value;
}

export function getOptionalEnvVar(name: string, defaultValue: string = ''): string {
    return process.env[name] || defaultValue;
}
