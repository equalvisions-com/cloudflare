/**
 * Edge compatibility utilities
 */
import dynamic from 'next/dynamic';

/**
 * Creates an Edge-compatible version of a component by:
 * 1. Disabling SSR
 * 2. Loading it dynamically
 * 3. Enabling suspense for better UX
 *
 * @param {Function} importFunc - Dynamic import function for the component
 * @param {Object} options - Additional options for dynamic import
 * @returns {Component} - Edge-compatible component
 */
export function edgeCompatible(importFunc, options = {}) {
  return dynamic(importFunc, {
    ssr: false,
    suspense: true,
    ...options
  });
}

/**
 * Creates placeholder content to show while edge components load
 * 
 * @param {Object} props - Props for the placeholder
 * @returns {JSX.Element} - Placeholder component
 */
export function EdgePlaceholder({ height = '40px', width = '100%', ...props }) {
  return (
    <div 
      style={{ 
        height, 
        width, 
        background: 'rgba(0,0,0,0.05)', 
        borderRadius: '4px' 
      }} 
      {...props} 
    />
  );
} 