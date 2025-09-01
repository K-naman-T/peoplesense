'use client';

/**
 * Sidebar navigation component
 */
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Camera, 
  BarChart3, 
  Settings,
  Menu,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);

  const toggleSidebar = () => {
    setExpanded(!expanded);
  };

  const links = [
    {
      name: 'Dashboard',
      href: '/',
      icon: <LayoutDashboard className="mr-2 h-4 w-4" />,
      current: pathname === '/',
    },
    {
      name: 'Cameras',
      href: '/cameras',
      icon: <Camera className="mr-2 h-4 w-4" />,
      current: pathname?.startsWith('/cameras'),
    },
    {
      name: 'Analytics',
      href: '/stats',
      icon: <BarChart3 className="mr-2 h-4 w-4" />,
      current: pathname === '/stats',
    },
    {
      name: 'Settings',
      href: '/settings',
      icon: <Settings className="mr-2 h-4 w-4" />,
      current: pathname === '/settings',
    },
  ];

  return (
    <>
      {/* Mobile navigation toggle */}
      <div className="sm:hidden fixed z-20 top-4 left-4">
        <Button
          variant="outline" 
          size="icon"
          onClick={toggleSidebar}
          className="bg-background"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open sidebar</span>
        </Button>
      </div>
      
      {/* Mobile overlay */}
      {expanded && (
        <div 
          className="sm:hidden fixed inset-0 bg-black/40 z-30"
          onClick={() => setExpanded(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed top-0 left-0 h-full border-r bg-background z-40 w-64 transform transition-transform duration-200 ease-in-out",
          expanded ? "translate-x-0" : "-translate-x-full sm:translate-x-0",
          className
        )}
      >
        <div className="flex h-16 items-center border-b px-4">
          <h1 className="text-lg font-semibold">People Tracking</h1>
          <button 
            className="ml-auto sm:hidden"
            onClick={() => setExpanded(false)}
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close sidebar</span>
          </button>
        </div>

        <nav className="flex flex-col gap-1 p-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setExpanded(false)}
              className={cn(
                "flex items-center px-3 py-2 rounded-md text-sm transition-colors",
                link.current ? 
                  "bg-primary text-primary-foreground" : 
                  "hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {link.icon}
              {link.name}
            </Link>
          ))}
        </nav>
      </aside>
    </>
  );
}
