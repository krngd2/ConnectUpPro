// Stub file for cluster migration functions to avoid build errors
// This is a legacy migration that was already executed

export async function migrateClusterDataToTable(): Promise<void> {
    console.log('Cluster migration: This is a stub. Migration was already completed.');
    return Promise.resolve();
}

export async function getClusterHierarchy(videoId: string): Promise<unknown[]> {
    console.log('Getting cluster hierarchy for video:', videoId);
    // Return empty array as this is a legacy migration function
    return [];
}

export async function createSubCluster(
    parentClusterId: string,
    name: string,
    description: string,
    commentIds: string[]
): Promise<unknown> {
    console.log('Creating sub-cluster:', { parentClusterId, name, description, commentIds });
    return {};
}

export async function deleteCluster(clusterId: string): Promise<void> {
    console.log('Deleting cluster:', clusterId);
    return Promise.resolve();
}
