"use client";

import React, { createContext, useState, useContext, ReactNode } from 'react';

interface PostSearchContextType {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

const PostSearchContext = createContext<PostSearchContextType | undefined>(undefined);

export const PostSearchProvider = ({ children }: { children: ReactNode }) => {
  const [searchQuery, setSearchQueryState] = useState('');

  const setSearchQuery = (query: string) => {
    setSearchQueryState(query);
  };

  return (
    <PostSearchContext.Provider value={{ searchQuery, setSearchQuery }}>
      {children}
    </PostSearchContext.Provider>
  );
};

export const usePostSearch = () => {
  const context = useContext(PostSearchContext);
  if (context === undefined) {
    throw new Error('usePostSearch must be used within a PostSearchProvider');
  }
  return context;
}; 