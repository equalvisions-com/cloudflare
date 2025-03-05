"use client";

// Simple wrapper for profile sidebar content
interface ProfileSidebarWrapperProps {
  className?: string;
  children: React.ReactNode;
}

export const ProfileSidebarWrapper = ({
  className,
  children,
}: ProfileSidebarWrapperProps) => {
  return (
    <div className={className}>
      {children}
    </div>
  );
}; 