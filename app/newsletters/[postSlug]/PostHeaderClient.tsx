"use client";

import React from "react";
import { UserMenuClientWithErrorBoundary } from "@/components/user-menu/UserMenuClient";
import { Input } from "@/components/ui/input";
import { X, Search } from "lucide-react";
import { BackButton } from "@/components/back-button";
import { PostSearchButton } from "@/components/ui/PostSearchButton";
import { SignInButton } from "@/components/ui/SignInButton";
import { MenuButton } from "@/components/ui/menu-button";
import { usePostSearchHeader } from "@/hooks/usePostSearchHeader";
import { usePostHeaderUserMenu } from "@/hooks/usePostHeaderUserMenu";

// Optimized PostHeaderUserMenu with custom hook
export const PostHeaderUserMenu = React.memo(function PostHeaderUserMenu() {
  const { shouldShowUserMenu, userMenuProps } = usePostHeaderUserMenu();
  
  if (!shouldShowUserMenu) return null;
  
  return (
    <UserMenuClientWithErrorBoundary
      initialDisplayName={userMenuProps.initialDisplayName}
      initialProfileImage={userMenuProps.initialProfileImage}
      isBoarded={userMenuProps.isBoarded}
      pendingFriendRequestCount={userMenuProps.pendingFriendRequestCount}
    />
  );
});

// Memoized search input component for better performance
const SearchInput = React.memo(function SearchInput({
  value,
  onChange,
  onKeyDown,
  placeholder,
  onClose
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder: string;
  onClose: () => void;
}) {
  return (
    <div className="relative w-full">
      <Search 
        className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" 
        strokeWidth={2.5} 
      />
      <Input
        type="text"
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="pl-9 pr-10 h-9 w-full focus-visible:ring-0 rounded-full border shadow-none"
        autoFocus
      />
      <button
        onClick={onClose}
        className="absolute right-3 top-1/2 -translate-y-1/2 focus:outline-none"
        aria-label="Close search"
      >
        <X className="h-4 w-4 text-muted-foreground" strokeWidth={2.5} />
      </button>
    </div>
  );
});

// Memoized header navigation component
const HeaderNavigation = React.memo(function HeaderNavigation({
  displayText,
  title,
  onSearchToggle,
  isAuthenticated
}: {
  displayText: string;
  title: string;
  onSearchToggle: () => void;
  isAuthenticated: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4">
      <div className="w-24 flex items-start justify-start">
        <div className="hidden md:block">
          <BackButton />
        </div>
        <div className="md:hidden">
          {isAuthenticated ? (
            <PostHeaderUserMenu />
          ) : (
            <SignInButton />
          )}
        </div>
      </div>
      <div className="flex-1 flex justify-center text-base font-extrabold tracking-tight">
        {displayText}
      </div>
      <div className="w-24 flex justify-end items-center gap-2">
        <div className="hidden md:block">
          <MenuButton />
        </div>
        <PostSearchButton onClick={onSearchToggle} title={title} />
      </div>
    </div>
  );
});

// Optimized PostSearchHeader with custom hooks and memoization
export const PostSearchHeader = React.memo(function PostSearchHeader({ 
  title, 
  mediaType 
}: { 
  title: string; 
  mediaType?: string 
}) {
  const { isAuthenticated } = usePostHeaderUserMenu();
  const {
    isSearching,
    localSearchValue,
    displayText,
    searchPlaceholder,
    toggleSearch,
    handleSearch,
    handleInputChange
  } = usePostSearchHeader({ title, mediaType });

  return (
    <div className="w-full border-b py-2">
      {isSearching ? (
        <div className="flex items-center px-4">
          <SearchInput
            value={localSearchValue}
            onChange={handleInputChange}
            onKeyDown={handleSearch}
            placeholder={searchPlaceholder}
            onClose={toggleSearch}
          />
        </div>
      ) : (
        <HeaderNavigation
          displayText={displayText}
          title={title}
          onSearchToggle={toggleSearch}
          isAuthenticated={isAuthenticated}
        />
      )}
    </div>
  );
}); 