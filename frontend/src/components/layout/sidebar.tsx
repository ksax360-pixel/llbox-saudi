"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { cn } from "@/lib/utils";
import { adminNavItems, mainNavItems } from "@/lib/navigation";
import { canAccessRoute } from "@/lib/rbac";
import { useAuth } from "@/store/auth-context";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { session } = useAuth();
  const permissions = session?.user.permissions ?? [];

  const filteredMain = mainNavItems.filter(
    (item) => canAccessRoute(permissions, item.permissions)
  );
  const filteredAdmin = adminNavItems.filter(
    (item) => canAccessRoute(permissions, item.permissions)
  );

  const NavLink = ({ href, icon: Icon, title }: { href: string; icon: React.ElementType; title: string }) => {
    const isActive = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        href={href}
        onClick={onClose}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
          isActive
            ? "bg-[#111827] text-white"
            : "text-[#6B7280] hover:bg-[#F8F9FA] hover:text-[#111827]"
        )}
        aria-current={isActive ? "page" : undefined}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
        {title}
      </Link>
    );
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-[#E5E7EB] bg-white transition-transform duration-200 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        aria-label="Main navigation"
      >
        <div className="flex h-16 items-center justify-between border-b border-[#E5E7EB] px-5">
          <Link href="/dashboard" className="flex items-center" aria-label="LLBOX home">
            <BrandLogo height={36} priority />
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#6B7280] hover:bg-[#F8F9FA] lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-1">
            {filteredMain.map((item) => (
              <NavLink key={item.href} href={item.href} icon={item.icon} title={item.title} />
            ))}
          </div>

          {filteredAdmin.length > 0 && (
            <>
              <div className="my-4 border-t border-[#E5E7EB]" />
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
                Administration
              </p>
              <div className="space-y-1">
                {filteredAdmin.map((item) => (
                  <NavLink key={item.href} href={item.href} icon={item.icon} title={item.title} />
                ))}
              </div>
            </>
          )}
        </nav>

        <div className="border-t border-[#E5E7EB] p-4">
          <div className="rounded-lg bg-[#F8F9FA] p-3">
            <p className="text-xs font-medium text-[#111827]">{session?.organization.name}</p>
            <p className="text-xs text-[#6B7280]">{session?.organization.city}, {session?.organization.country}</p>
          </div>
        </div>
      </aside>
    </>
  );
}
