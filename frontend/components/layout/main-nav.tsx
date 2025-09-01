'use client';

/**
 * Main Navigation Component
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function MainNav() {
  const pathname = usePathname();

  const routes = [
    {
      href: '/',
      label: 'Dashboard',
      active: pathname === '/',
    },
    {
      href: '/cameras',
      label: 'Cameras',
      active: pathname === '/cameras' || pathname?.startsWith('/cameras/'),
    },
    {
      href: '/settings',
      label: 'Settings',
      active: pathname === '/settings',
    },
  ];

  return (
    <nav className="grid auto-cols-max grid-flow-col gap-2 px-2 justify-center sm:justify-start">
      {routes.map((route) => (
        <Button
          key={route.href}
          asChild
          variant={route.active ? 'default' : 'ghost'}
          className={cn(
            'text-sm font-medium transition-colors',
            route.active ? '' : 'text-muted-foreground hover:text-primary'
          )}
          size="sm"
        >
          <Link href={route.href}>{route.label}</Link>
        </Button>
      ))}
    </nav>
  );
}
