"use client";

import { ChevronDown, LogOut, Menu, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SearchBar } from "@/components/shared/search-bar";
import { useToast } from "@/components/ui/toast";
import { MOCK_ORGANIZATIONS, useAuth } from "@/store/auth-context";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/rbac";

interface TopbarProps {
  onMenuClick: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { session, logout, switchOrganization } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showOrgMenu, setShowOrgMenu] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const runSearch = () => {
    const q = search.trim().toLowerCase();
    if (!q) {
      toast("Enter a search term", { variant: "info" });
      return;
    }
    if (q.startsWith("del") || q.includes("delivery")) router.push("/deliveries");
    else if (q.startsWith("lkr") || q.includes("locker")) router.push("/lockers");
    else if (q.startsWith("cus") || q.includes("customer")) router.push("/customers");
    else if (q.startsWith("drv") || q.includes("driver")) router.push("/drivers");
    else if (q.includes("whatsapp") || q.includes("chat") || q.includes("conversation"))
      router.push("/conversations");
    else if (q.includes("admin") || q.includes("user")) router.push("/admin");
    else router.push("/deliveries");
    toast("Search", { description: `Showing results related to “${search.trim()}”.`, variant: "info" });
    setShowMobileSearch(false);
  };

  useEffect(() => {
    const onPointer = (e: MouseEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) {
        setShowOrgMenu(false);
        setShowUserMenu(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowOrgMenu(false);
        setShowUserMenu(false);
        setShowMobileSearch(false);
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <header ref={headerRef} className="sticky top-0 z-30 border-b border-[#E5E7EB] bg-white">
      <div className="flex h-16 items-center gap-4 px-4 lg:px-6">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-lg p-2 text-[#6B7280] hover:bg-[#F8F9FA] lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <form
          className="hidden flex-1 md:block md:max-w-md"
          onSubmit={(e) => {
            e.preventDefault();
            runSearch();
          }}
        >
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search deliveries, customers, lockers..."
          />
        </form>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg p-2 text-[#6B7280] hover:bg-[#F8F9FA] md:hidden"
            aria-label="Search"
            onClick={() => setShowMobileSearch((v) => !v)}
          >
            <Search className="h-5 w-5" />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => { setShowOrgMenu(!showOrgMenu); setShowUserMenu(false); }}
              className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-sm hover:bg-[#F8F9FA]"
              aria-haspopup="listbox"
              aria-expanded={showOrgMenu}
            >
              <span className="hidden font-medium text-[#111827] sm:inline">{session?.organization.name}</span>
              <ChevronDown className="h-4 w-4 text-[#6B7280]" />
            </button>
            {showOrgMenu && (
              <div className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-[#E5E7EB] bg-white py-1 shadow-[var(--shadow-elevated)]">
                {MOCK_ORGANIZATIONS.map((org) => (
                  <button
                    key={org.id}
                    type="button"
                    onClick={() => { switchOrganization(org); setShowOrgMenu(false); }}
                    className={cn(
                      "flex w-full flex-col px-4 py-2.5 text-left text-sm hover:bg-[#F8F9FA]",
                      session?.organization.id === org.id && "bg-[#F8F9FA]"
                    )}
                  >
                    <span className="font-medium text-[#111827]">{org.name}</span>
                    <span className="text-xs text-[#6B7280]">{org.city}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => { setShowUserMenu(!showUserMenu); setShowOrgMenu(false); }}
              className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-[#F8F9FA]"
              aria-haspopup="menu"
              aria-expanded={showUserMenu}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#111827] text-xs font-semibold text-white">
                {session?.user.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </div>
              <ChevronDown className="hidden h-4 w-4 text-[#6B7280] sm:block" />
            </button>
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-[#E5E7EB] bg-white py-1 shadow-[var(--shadow-elevated)]">
                <div className="border-b border-[#E5E7EB] px-4 py-3">
                  <p className="text-sm font-medium text-[#111827]">{session?.user.name}</p>
                  <p className="text-xs text-[#6B7280]">{session?.user.email}</p>
                  <p className="mt-0.5 text-xs text-[#9CA3AF]">{session?.user.role && ROLE_LABELS[session.user.role]}</p>
                </div>
                <button type="button" onClick={handleLogout} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-[#EF4444] hover:bg-red-50">
                  <LogOut className="h-4 w-4" /> Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showMobileSearch && (
        <form
          className="border-t border-[#E5E7EB] px-4 py-3 md:hidden"
          onSubmit={(e) => {
            e.preventDefault();
            runSearch();
          }}
        >
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search deliveries, customers, lockers..."
          />
        </form>
      )}
    </header>
  );
}
