/**
 * Minimal Edge Runtime Polyfills
 * Provides compatibility for React scheduler in Edge environments
 */

// Only apply in browser/edge environments (not Node.js)
if (typeof globalThis !== 'undefined') {
  // Polyfill setImmediate (used by React scheduler)
  if (typeof globalThis.setImmediate === 'undefined') {
    globalThis.setImmediate = (fn, ...args) => setTimeout(() => fn(...args), 0);
  }

  // Minimal MessageChannel polyfill (used by React scheduler)
  if (typeof globalThis.MessageChannel === 'undefined') {
    globalThis.MessageChannel = class MessageChannel {
      constructor() {
        this.port1 = { onmessage: null };
        this.port2 = { onmessage: null };
        
        this.port1.postMessage = (msg) => {
          if (this.port2.onmessage) {
            setTimeout(() => this.port2.onmessage({ data: msg }), 0);
          }
        };
        
        this.port2.postMessage = (msg) => {
          if (this.port1.onmessage) {
            setTimeout(() => this.port1.onmessage({ data: msg }), 0);
          }
        };
      }
    };
  }
}

export {}; 