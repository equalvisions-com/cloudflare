import { action } from "./_generated/server";
import { v } from "convex/values";
import { r2 } from "./r2";

/**
 * Action to delete an object from R2 storage
 * We use an action because it has more permissions and can access AWS SDK
 */
export const deleteR2Object = action({
  args: {
    key: v.string(),
  },
  handler: async (ctx, args) => {
    const { key } = args;
    
    try {
      console.log(`Attempting to delete R2 object with key: ${key}`);
      
      // First attempt - try a direct import of the AWS SDK if available
      try {
        // @ts-ignore - Import the AWS SDK directly if available
        const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
        
        // Try to get config from the R2 client
        // @ts-ignore - Accessing internal config
        const r2Config = r2._config || {};
        const bucket = r2Config.bucket || process.env.R2_BUCKET;
        const endpoint = r2Config.endpoint || process.env.R2_ENDPOINT;
        const region = r2Config.region || 'auto';
        const credentials = {
          accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || ''
        };
        
        if (bucket && endpoint && credentials.accessKeyId) {
          console.log(`Using direct AWS SDK with bucket: ${bucket}`);
          const s3Client = new S3Client({
            region,
            endpoint,
            credentials
          });
          
          const command = new DeleteObjectCommand({
            Bucket: bucket,
            Key: key
          });
          
          await s3Client.send(command);
          console.log(`Successfully deleted object ${key} with direct AWS SDK`);
          return { success: true, method: 'direct-aws-sdk', key, bucket };
        }
      } catch (error) {
        console.log('Direct AWS SDK approach failed:', error);
      }
      
      // Second attempt - try to access the S3 client if available
      // @ts-ignore - Accessing internal APIs
      const s3Client = r2._client?.s3Client;
      
      if (s3Client) {
        // @ts-ignore - Accessing internal config
        const bucket = r2._config?.bucket || process.env.R2_BUCKET;
        console.log(`Using internal S3 client with bucket: ${bucket}`);
        
        await s3Client.deleteObject({
          Bucket: bucket,
          Key: key
        });
        console.log(`Successfully deleted object ${key} using internal S3 client`);
        return { success: true, method: 's3-client', key };
      }
      
      // Third attempt - try any available method on the R2 client
      const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(r2));
      console.log('Available R2 methods:', methods);
      
      // @ts-ignore - Try various method names that might exist
      if (typeof r2.deleteObject === 'function') {
        // @ts-ignore
        await r2.deleteObject(key);
        return { success: true, method: 'deleteObject', key };
      }
      
      // @ts-ignore - Try various method names that might exist
      if (typeof r2.deleteByKey === 'function') {
        // @ts-ignore
        await r2.deleteByKey(key);
        return { success: true, method: 'deleteByKey', key };
      }
      
      // @ts-ignore - Try various method names that might exist
      if (typeof r2.delete === 'function') {
        // @ts-ignore
        await r2.delete(key);
        return { success: true, method: 'delete', key };
      }
      
      throw new Error(`No method available to delete R2 objects. Available methods: ${methods.join(', ')}`);
    } catch (error) {
      console.error(`Failed to delete R2 object with key ${key}:`, error);
      return { 
        success: false, 
        message: `Failed to delete object: ${error instanceof Error ? error.message : String(error)}`,
        key
      };
    }
  },
}); 