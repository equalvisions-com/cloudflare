"use client";

// Client wrapper for handling width transitions
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