/**
 * Universal utility for handling missing RSS entry details in user feeds
 * Provides consistent filtering and logging across all feed components
 */

interface MissingEntryData {
  entryGuid: string;
  feedUrl?: string;
  title?: string;
  pubDate?: string;
  timestamp?: number;
  component: string;
}

interface ActivityWithEntryGuid {
  entryGuid: string;
  feedUrl?: string;
  title?: string;
  pubDate?: string;
  timestamp?: number;
  [key: string]: any;
}

/**
 * Logs missing entry to console and Axiom for monitoring
 */
export function logMissingEntry(data: MissingEntryData): void {
  console.log('🚨 Missing entry details for user activity:', {
    entryGuid: data.entryGuid,
    feedUrl: data.feedUrl,
    title: data.title,
    pubDate: data.pubDate,
    timestamp: data.timestamp,
    component: data.component
  });
  
  // Send to Axiom for monitoring (client-side only)
  if (typeof window !== 'undefined') {
    fetch('/api/log-missing-entry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entryGuid: data.entryGuid,
        feedUrl: data.feedUrl,
        title: data.title,
        pubDate: data.pubDate,
        timestamp: data.timestamp,
        component: data.component,
        logLevel: 'warning'
      })
    }).catch(err => console.error('Failed to log missing entry:', err));
  }
}

/**
 * Filters out activities with missing entry details and logs them
 * @param activities - Array of activities with entryGuid
 * @param entryDetails - Record of entryGuid to entry details
 * @param componentName - Name of the component for logging
 * @returns Filtered activities that have corresponding entry details
 */
export function filterActivitiesWithMissingEntries<T extends ActivityWithEntryGuid>(
  activities: T[],
  entryDetails: Record<string, any>,
  componentName: string
): T[] {
  return activities.filter((activity) => {
    const hasEntryDetails = !!entryDetails[activity.entryGuid];
    
    // Log missing entries for monitoring
    if (!hasEntryDetails) {
      logMissingEntry({
        entryGuid: activity.entryGuid,
        feedUrl: activity.feedUrl,
        title: activity.title,
        pubDate: activity.pubDate,
        timestamp: activity.timestamp,
        component: componentName
      });
    }
    
    return hasEntryDetails;
  });
}

/**
 * Type guard to check if an entry has required details
 */
export function hasEntryDetails(entryGuid: string, entryDetails: Record<string, any>): boolean {
  return !!entryDetails[entryGuid];
} 
