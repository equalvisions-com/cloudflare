import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface BackButtonProps {
  href?: string;
  className?: string;
}

export function BackButton({ href = '/', className = '' }: BackButtonProps) {
  return (
    <Button 
      variant="ghost" 
      asChild 
      className={`!h-[32px] !w-[32px] min-h-0 p-0 hover:bg-transparent hover:opacity-100 !m-0 relative ${className}`}
      style={{ padding: 0, lineHeight: 1, margin: 0 }}
    >
      <Link href={href} className="flex items-center justify-start w-full h-full text-muted-foreground">
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="20" 
          height="20" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          style={{ 
            width: '20px', 
            height: '20px', 
            minWidth: '20px', 
            minHeight: '20px',
            position: 'absolute',
            left: '0',
            top: '50%',
            transform: 'translateY(-50%)'
          }}
        >
          <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
          <path d="M5 12l14 0" />
          <path d="M5 12l6 6" />
          <path d="M5 12l6 -6" />
        </svg>
        <span className="sr-only">Back</span>
      </Link>
    </Button>
  );
} 