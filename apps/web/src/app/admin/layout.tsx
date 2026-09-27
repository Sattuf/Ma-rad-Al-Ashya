'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Activity, BarChart3, Flag, LayoutDashboard, ShieldAlert } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth-store';
import { Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';

const NAV = [
  { name: 'لوحة التحكم', href: '/admin', icon: LayoutDashboard },
  { name: 'البلاغات', href: '/admin/reports', icon: Flag },
  { name: 'الترتيب الذكي', href: '/admin/ranking', icon: BarChart3 },
  { name: 'مكافحة الاحتيال', href: '/admin/fraud', icon: ShieldAlert },
];

// Operations (Grafana) lives outside the app; linked only when configured.
const GRAFANA_URL = process.env.NEXT_PUBLIC_GRAFANA_URL;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, hydrated } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = user?.role === 'admin';

  // Wait until the session is restored; deciding earlier sent every admin home on reload.
  // (The API enforces the admin role on every endpoint; this only routes the UI.)
  useEffect(() => {
    if (hydrated && !isAdmin) router.replace(user ? '/' : `/login?next=${encodeURIComponent(pathname)}`);
  }, [hydrated, isAdmin, user, router, pathname]);

  if (!hydrated || !isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="جارٍ التحقق من الصلاحيات">
        <Spinner />
      </div>
    );
  }

  const isActive = (href: string) => (href === '/admin' ? pathname === href : pathname.startsWith(href));

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <aside className="border-b border-line bg-surface md:w-60 md:shrink-0 md:border-b-0 md:border-e">
        <nav aria-label="أقسام الإدارة" className="flex gap-1 overflow-x-auto p-2 md:sticky md:top-16 md:flex-col md:p-4">
          {NAV.map(({ name, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? 'page' : undefined}
              className={cn(
                'flex min-h-11 shrink-0 items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors',
                isActive(href) ? 'bg-primary-soft text-on-primary-soft' : 'text-fg-muted hover:bg-surface-muted hover:text-fg',
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
              {name}
            </Link>
          ))}
          {GRAFANA_URL && (
            <a
              href={GRAFANA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 shrink-0 items-center gap-3 rounded-control px-3 text-sm font-medium text-fg-muted hover:bg-surface-muted hover:text-fg"
            >
              <Activity className="h-5 w-5" aria-hidden />
              صحة الأنظمة ↗
            </a>
          )}
        </nav>
      </aside>
      <main className="min-w-0 flex-1 bg-canvas p-4 md:p-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
