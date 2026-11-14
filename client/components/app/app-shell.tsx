'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  IconDeviceGamepad2,
  IconHome2,
  IconLogin2,
  IconLogout,
  IconMessageCircle,
  IconSearch,
  IconSettings,
  IconUser,
} from '@tabler/icons-react';
import { useAuth } from '@/components/auth/auth-provider';
import { NookLogo } from '@/components/nook-logo';
import { ThemeSelector } from '@/components/theme-selector';
import { Separator } from '@/components/ui/separator';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';

const navigation = [
  { label: 'Feed', href: '/feed', Icon: IconHome2 },
  { label: 'Search', href: '/search', Icon: IconSearch },
  { label: 'Chat', href: '/chat', Icon: IconMessageCircle },
  { label: 'Play', href: '/play', Icon: IconDeviceGamepad2 },
  { label: 'Profile', href: '/profile', Icon: IconUser },
];

function AppNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { session, isRestoring, logout } = useAuth();
  const { setOpenMobile, isMobile } = useSidebar();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const closeMobile = () => setOpenMobile(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    await logout().catch(() => undefined);
    closeMobile();
    router.replace('/login');
    setIsLoggingOut(false);
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-16 flex-row items-center justify-between border-b border-sidebar-border">
        <Link
          href="/"
          aria-label="Nook home"
          onClick={closeMobile}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
        >
          <NookLogo />
        </Link>
        {isMobile && <SidebarTrigger aria-label="Close navigation" />}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <nav aria-label="Main">
            <SidebarMenu>
              {navigation.map(({ label, href, Icon }) => {
                const active =
                  pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      render={<Link href={href} />}
                      isActive={active}
                      aria-current={active ? 'page' : undefined}
                      aria-label={label}
                      tooltip={label}
                      size="lg"
                      onClick={closeMobile}
                    >
                      <Icon aria-hidden="true" />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </nav>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <nav aria-label="Account">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link href="/settings" />}
                isActive={pathname === '/settings'}
                aria-current={pathname === '/settings' ? 'page' : undefined}
                aria-label="Settings"
                tooltip="Settings"
                size="lg"
                onClick={closeMobile}
              >
                <IconSettings aria-hidden="true" />
                <span>Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {!isRestoring && (
              <SidebarMenuItem>
                {session ? (
                  <SidebarMenuButton
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    aria-label="Log out"
                    tooltip="Log out"
                    size="lg"
                  >
                    <IconLogout aria-hidden="true" />
                    <span>{isLoggingOut ? 'Logging out…' : 'Log out'}</span>
                  </SidebarMenuButton>
                ) : (
                  <SidebarMenuButton
                    render={<Link href="/login" />}
                    onClick={closeMobile}
                    aria-label="Log in"
                    tooltip="Log in"
                    size="lg"
                  >
                    <IconLogin2 aria-hidden="true" />
                    <span>Log in</span>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </nav>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppShell({
  children,
  defaultSidebarOpen = true,
}: {
  children: ReactNode;
  defaultSidebarOpen?: boolean;
}) {
  const pathname = usePathname();
  const currentPage = navigation.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  const title =
    pathname === '/play/chess'
      ? 'Chess'
      : (currentPage?.label ??
        (pathname === '/settings' ? 'Settings' : 'Nook'));

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={defaultSidebarOpen}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-primary focus:p-3 focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <AppNavigation />
        <div className="flex min-h-svh min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-4 border-b border-border bg-background px-4 md:px-8">
            <SidebarTrigger />
            <Separator
              orientation="vertical"
              className="h-4 data-vertical:self-center"
            />
            <p className="truncate text-sm">
              <span className="text-muted-foreground">Nook</span>
              <span className="mx-3 text-muted-foreground" aria-hidden="true">
                /
              </span>
              <span className="font-medium">{title}</span>
            </p>
            <div className="ml-auto">
              <ThemeSelector />
            </div>
          </header>
          <main
            id="main-content"
            tabIndex={-1}
            className="flex flex-1 flex-col"
          >
            {children}
          </main>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
