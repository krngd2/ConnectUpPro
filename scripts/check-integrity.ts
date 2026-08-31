/**
 * Data Integrity Check Script
 * 
 * Executes the data integrity check and displays results
 * Usage: npm run check:integrity
 */

import { checkDataIntegrity } from '@/lib/data-integrity';

async function main() {
    try {
        const report = await checkDataIntegrity();

        // Exit with appropriate code
        process.exit(report.issues.length > 0 ? 1 : 0);
    } catch (error) {
        console.error('Fatal error during integrity check:', error);
        process.exit(1);
    }
}

main().catch((error) => {
    console.error('Script error:', error);
    process.exit(1);
});
