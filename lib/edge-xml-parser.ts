/**
 * Edge-compatible wrapper for XMLParser
 * This version doesn't use process.on events and is compatible with Edge Runtime
 */
import { XMLParser as OriginalXMLParser } from 'fast-xml-parser';

// Export a factory function to create the parser instead of direct instantiation
export function createXMLParser(options?: any) {
  // Create a new parser instance with the provided options
  return new OriginalXMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseAttributeValue: true,
    trimValues: true,
    parseTagValue: false,
    isArray: (tagName: string) => {
      // Common array elements in RSS/Atom feeds
      return ['item', 'entry', 'link', 'category', 'enclosure'].includes(tagName);
    },
    // Add stopNodes for CDATA sections that shouldn't be parsed
    stopNodes: ['description', 'content:encoded', 'summary'],
    // Add processing instruction handling for XML declaration
    processEntities: true,
    htmlEntities: true,
    ...options,
  });
}

// Create a default parser instance
export const edgeParser = createXMLParser();

// Utility function to safely parse XML in Edge Runtime
export function parseXML(xml: string) {
  try {
    return edgeParser.parse(xml);
  } catch (error) {
    console.error('Error parsing XML:', error);
    throw error;
  }
} 