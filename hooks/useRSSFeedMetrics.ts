import { useMemo, useDeferredValue } from 'react';
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRSSFeedEntries, useRSSFeedUI } from '@/lib/stores/rssFeedStore';
import type { UseRSSFeedMetricsReturn, RSSFeedEntry } from '@/lib/types';

/**
 * Custom hook for RSS Feed metrics management
 * Handles Convex queries for entry metrics and enhances entries with real-time data
 * Extracted from RSSFeedClient to separate concerns and optimize performance
 */
export const useRSSFeedMetrics = (): UseRSSFeedMetricsReturn => {
  // Get state from Zustand store
  const entries = useRSSFeedEntries();
  const ui = useRSSFeedUI();
  
  // Extract all entry GUIDs for metrics query - memoized for performance
  const entryGuids = useMemo(() => 
    entries
      .filter((entry: RSSFeedEntry) => entry?.entry?.guid)
      .map((entry: RSSFeedEntry) => entry.entry.guid),
    [entries]
  );
  
  // Extract unique feed URLs for metadata query - memoized for performance
  const feedUrls = useMemo(() => {
    const urls = entries
      .filter((entry: RSSFeedEntry) => entry?.entry?.feedUrl)
      .map((entry: RSSFeedEntry) => entry.entry.feedUrl);
    return [...new Set(urls)];
  }, [entries]);
  
  // Use the combined query to fetch entry metrics - ONLY IF ACTIVE
  // This prevents unnecessary API calls when the component is not visible
  const combinedData = useQuery(
    api.entries.getFeedDataWithMetrics,
    ui.isActive && entryGuids.length > 0 ? { entryGuids, feedUrls } : "skip"
  );
  
  // Defer data updates to prevent synchronous re-renders that may cause scroll jumps
  // This is crucial for preventing the "Maximum update depth exceeded" error
  const deferredCombinedData = useDeferredValue(combinedData);
  
  // Extract metrics from combined data with memoization
  const entryMetricsMap = useMemo(() => {
    if (!deferredCombinedData?.entryMetrics) return null;
    
    // Convert to a simple object for easier use in components
    const metricsObject: Record<string, RSSFeedEntry['initialData']> = {};
    deferredCombinedData.entryMetrics.forEach(item => {
      if (item.guid && item.metrics) {
        metricsObject[item.guid] = item.metrics;
      }
    });
    
    return metricsObject;
  }, [deferredCombinedData?.entryMetrics]);
  
  // Apply metrics to entries with memoization to prevent unnecessary re-renders
  const enhancedEntries = useMemo(() => {
    if (!entries.length) return entries;
    
    // If no metrics available, return original entries
    if (!entryMetricsMap) return entries;
    
    // Enhance entries with real-time metrics
    return entries.map(entryWithData => {
      const enhanced = { ...entryWithData };
      
      // Apply metrics if available for this entry
      if (entryMetricsMap && enhanced.entry.guid in entryMetricsMap) {
        enhanced.initialData = {
          ...enhanced.initialData,
          ...entryMetricsMap[enhanced.entry.guid]
        };
      }
      
      return enhanced;
    });
  }, [entries, entryMetricsMap]);
  
  // Determine if metrics are currently loading
  const isMetricsLoading = useMemo(() => {
    return ui.isActive && entryGuids.length > 0 && !deferredCombinedData;
  }, [ui.isActive, entryGuids.length, deferredCombinedData]);
  
  // Return stable object to prevent unnecessary re-renders
  return useMemo(() => ({
    entryMetricsMap,
    isMetricsLoading,
    enhancedEntries
  }), [entryMetricsMap, isMetricsLoading, enhancedEntries]);
}; 