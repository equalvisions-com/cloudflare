import React from 'react';

const RSSPlaceholder = () => {
  return (
    <div className="p-4">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Latest Posts</h2>
        <p className="text-gray-600">Loading your RSS feed content...</p>
      </div>
      
      <div className="space-y-4">
        <div className="border rounded p-3">
          <h3 className="font-medium">Sample Blog Post Title</h3>
          <p className="text-sm text-gray-500">Published on January 1, 2024</p>
          <p className="mt-2 text-gray-600">This is a placeholder for your RSS feed content. Real articles will appear here once loaded.</p>
        </div>

        <div className="border rounded p-3">
          <h3 className="font-medium">Another Example Article</h3>
          <p className="text-sm text-gray-500">Published on December 31, 2023</p>
          <p className="mt-2 text-gray-600">Stay tuned for real content from your favorite RSS feeds...</p>
        </div>
      </div>
    </div>
  );
};

export default RSSPlaceholder;

