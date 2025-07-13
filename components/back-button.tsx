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
      className={`!h-[36px] !w-[36px] hover:bg-transparent hover:opacity-100  md:hover:text-muted-foreground !m-0 relative ${className}`}
    >
      <Link href={href} className="flex items-center justify-center w-full h-full text-muted-foreground !ml-[-0.5rem]" prefetch={false}>
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.25" stroke="currentColor" className="!h-[18px] !w-[18px]">
  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
</svg>

        <span className="sr-only">Back</span>
      </Link>
    </Button>
  );
} 