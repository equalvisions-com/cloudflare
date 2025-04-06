import { R2 } from "@convex-dev/r2";
import { componentsGeneric } from "convex/server";

// Initialize the R2 client
const r2Client = new R2(componentsGeneric().r2);

// Create a wrapper with a direct public URL implementation
export const r2 = {
  ...r2Client,
  
  // Override getUrl to use the public domain directly
  getUrl: async (key: string) => {
    if (!key) throw new Error("Key is required");
    
    // Format the path correctly
    let path = key;
    // If it doesn't have a folder prefix and isn't already a URL, add the profile-images/ prefix
    if (!path.includes("/") && !path.startsWith("http")) {
      path = `profile-images/${path}`;
    }
    
    // Return direct public URL
    return `https://pub-9b8cc0b27a384f7aacf50e33dfd3d7d9.r2.dev/${path}`;
  },
  
  // Preserve original methods by passing through to the base client
  generateUploadUrl: (key?: string) => r2Client.generateUploadUrl(key),
  
  // Copy all other methods from r2Client
  component: r2Client.component,
  config: r2Client.config,
  options: r2Client.options,
  clientApi: r2Client.clientApi.bind(r2Client),
  // Any other methods you need should be added here
}; 