import { Link, useLocation } from "wouter";
import { useState, useEffect, useRef } from "react";
import { LifeBuoy, Menu, X, User as UserIcon, LogOut, Wallet, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest, useAuth } from "@/lib/auth";
import { useAuthModal } from "@/components/auth/AuthModal";
import { BrandLogo } from "@/components/layout/BrandLogo";

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [supportUnread, setSupportUnread] = useState(0);
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { open } = useAuthModal();
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (user?.role !== "admin") {
      setSupportUnread(0);
      return;
    }
    let alive = true;
    const load = () => {
      apiRequest<{ count: number }>("/admin/support/unread-count")
        .then((data) => { if (alive) setSupportUnread(data.count); })
        .catch(() => { if (alive) setSupportUnread(0); });
    };
    load();
    const timer = window.setInterval(load, 30_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [user?.role]);

  const scrollTo = (id: string) => {
    setMobileMenuOpen(false);
    if (window.location.pathname !== "/") {
      setLocation("/");
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 100);
      return;
    }
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  function handleCTA() {
    setMobileMenuOpen(false);
    if (user) setLocation("/styles");
    else open("register");
  }

  function handleLogin() {
    setMobileMenuOpen(false);
    open("login");
  }

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-background/80 backdrop-blur-md border-b border-border" : "bg-transparent"
      }`}
    >
      <div className="container mx-auto px-4 md:px-6 h-16 md:h-20 flex items-center justify-between">
        <Link
          href="/"
          className="group rounded-md transition-[filter] hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A855F7]"
        >
          <BrandLogo />
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          <button onClick={() => scrollTo("home")} className="text-sm font-medium text-muted-foreground hover:text-white transition-colors">Главная</button>
          <button onClick={() => scrollTo("how-it-works")} className="text-sm font-medium text-muted-foreground hover:text-white transition-colors">Как работает</button>
          <button onClick={() => scrollTo("services")} className="text-sm font-medium text-muted-foreground hover:text-white transition-colors">Услуги</button>
          <button onClick={() => scrollTo("styles")} className="text-sm font-medium text-muted-foreground hover:text-white transition-colors">Стили</button>
          <button onClick={() => scrollTo("pricing")} className="text-sm font-medium text-muted-foreground hover:text-white transition-colors">Цены</button>
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-2">
              {user.role === "admin" && (
                <Link
                  href="/admin"
                  className={`relative flex h-11 items-center gap-2 rounded-full border px-3 text-sm font-semibold text-white transition-colors ${
                    supportUnread > 0
                      ? "border-[#F43F5E]/60 bg-[#F43F5E]/20 shadow-[0_0_22px_rgba(244,63,94,0.45)] animate-pulse"
                      : "border-border bg-secondary hover:border-[#7C3AED]/50"
                  }`}
                  title="Непрочитанные обращения"
                >
                  <LifeBuoy size={17} />
                  <span>{supportUnread}</span>
                </Link>
              )}
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-secondary border border-border hover:border-[#7C3AED]/50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center text-sm font-bold text-white">
                    {(user.name || user.email)[0]?.toUpperCase()}
                  </div>
                  <div className="text-left">
                    <div className="text-xs text-muted-foreground leading-none">Баланс</div>
                    <div className="text-sm font-semibold text-white leading-tight">{user.balance.toFixed(2)} ₽</div>
                  </div>
                </button>
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
                  <div className="p-4 border-b border-border">
                    <div className="text-sm font-semibold text-white truncate">{user.name || "Привет!"}</div>
                    <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                  </div>
                  <div className="py-1">
                    <Link href="/account" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/5">
                      <UserIcon size={16} /> Личный кабинет
                    </Link>
                    <Link href="/account" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/5">
                      <Wallet size={16} /> Баланс
                    </Link>
                    {user.role === "admin" && (
                      <Link href="/admin" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/5">
                        <Shield size={16} /> Админ-панель
                      </Link>
                    )}
                  </div>
                  <div className="py-1 border-t border-border">
                    <button onClick={() => { logout(); setUserMenuOpen(false); setLocation("/"); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground hover:text-white hover:bg-white/5">
                      <LogOut size={16} /> Выйти
                    </button>
                  </div>
                </div>
              )}
              </div>
            </div>
          ) : (
            <>
              <Button variant="ghost" onClick={handleLogin} className="text-white hover:text-white hover:bg-white/10">Войти</Button>
              <Button onClick={handleCTA} className="bg-gradient-primary text-white border-0 hover:opacity-90 shadow-[0_0_20px_rgba(124,58,237,0.4)] transition-all hover:scale-105">
                Попробовать →
              </Button>
            </>
          )}
        </div>

        <button className="md:hidden text-white p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-background/95 backdrop-blur-xl border-b border-border p-4 flex flex-col gap-4">
          <button onClick={() => scrollTo("home")} className="text-left text-lg font-medium p-2 text-muted-foreground hover:text-white">Главная</button>
          <button onClick={() => scrollTo("how-it-works")} className="text-left text-lg font-medium p-2 text-muted-foreground hover:text-white">Как работает</button>
          <button onClick={() => scrollTo("services")} className="text-left text-lg font-medium p-2 text-muted-foreground hover:text-white">Услуги</button>
          <button onClick={() => scrollTo("styles")} className="text-left text-lg font-medium p-2 text-muted-foreground hover:text-white">Стили</button>
          <button onClick={() => scrollTo("pricing")} className="text-left text-lg font-medium p-2 text-muted-foreground hover:text-white">Цены</button>
          <div className="h-px bg-border my-2" />
          {user ? (
            <>
              <Link href="/account" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 p-2 text-white"><UserIcon size={18} /> Личный кабинет ({user.balance.toFixed(2)} ₽)</Link>
              {user.role === "admin" && (
                <Link href="/admin" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 p-2 text-white">
                  <Shield size={18} /> Админ-панель
                  {supportUnread > 0 && <span className="ml-auto rounded-full bg-[#F43F5E] px-2 py-0.5 text-xs font-bold animate-pulse">{supportUnread}</span>}
                </Link>
              )}
              <Button variant="ghost" onClick={() => { logout(); setMobileMenuOpen(false); setLocation("/"); }} className="justify-start w-full text-white"><LogOut size={16} className="mr-2" /> Выйти</Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={handleLogin} className="justify-start w-full text-white">Войти</Button>
              <Button onClick={handleCTA} className="bg-gradient-primary text-white w-full">Попробовать →</Button>
            </>
          )}
        </div>
      )}
    </header>
  );
}
