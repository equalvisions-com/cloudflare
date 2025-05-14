'use client';

import { useRouter } from 'next/navigation';
import { useEffect, ComponentProps } from 'react';

type AnchorProps = ComponentProps<'a'> & { href: string };

export function PrefetchAnchor({ href, children, ...rest }: AnchorProps) {
  const router = useRouter();

  useEffect(() => {
    router.prefetch(href);
  }, [href, router]);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    window.open(href, '_self');
  };

  return (
    <a href={href} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
} 