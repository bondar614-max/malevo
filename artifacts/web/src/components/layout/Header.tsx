import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    setMobileMenuOpen(false);
    if (window.location.pathname !== "/") {
      setLocation("/");
      setTimeout(() => {
        const el = document.getElementById(id);
        el?.scrollIntoView({ behavior: "smooth" });
      }, 100);
      return;
    }
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-background/80 backdrop-blur-md border-b border-border"
          : "bg-transparent"
      }`}
    >
      <div className="container mx-auto px-4 md:px-6 h-16 md:h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center text-white font-bold shadow-[0_0_15px_rgba(124,58,237,0.5)] group-hover:shadow-[0_0_25px_rgba(124,58,237,0.7)] transition-all">
            ✨
          </div>
          <span className="font-bold text-xl tracking-tight text-white">
            PhotoGen <span className="text-gradient">AI</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          <button onClick={() => scrollTo("home")} className="text-sm font-medium text-muted-foreground hover:text-white transition-colors">Главная</button>
          <button onClick={() => scrollTo("how-it-works")} className="text-sm font-medium text-muted-foreground hover:text-white transition-colors">Как работает</button>
          <button onClick={() => scrollTo("styles")} className="text-sm font-medium text-muted-foreground hover:text-white transition-colors">Стили</button>
          <button onClick={() => scrollTo("pricing")} className="text-sm font-medium text-muted-foreground hover:text-white transition-colors">Цены</button>
        </nav>

        <div className="hidden md:flex items-center gap-4">
          <Button variant="ghost" className="text-white hover:text-white hover:bg-white/10">Войти</Button>
          <Button className="bg-gradient-primary text-white border-0 hover:opacity-90 shadow-[0_0_20px_rgba(124,58,237,0.4)] transition-all hover:scale-105">
            Попробовать →
          </Button>
        </div>

        {/* Mobile Toggle */}
        <button
          className="md:hidden text-white p-2"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Nav */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-background/95 backdrop-blur-xl border-b border-border p-4 flex flex-col gap-4">
          <button onClick={() => scrollTo("home")} className="text-left text-lg font-medium p-2 text-muted-foreground hover:text-white">Главная</button>
          <button onClick={() => scrollTo("how-it-works")} className="text-left text-lg font-medium p-2 text-muted-foreground hover:text-white">Как работает</button>
          <button onClick={() => scrollTo("styles")} className="text-left text-lg font-medium p-2 text-muted-foreground hover:text-white">Стили</button>
          <button onClick={() => scrollTo("pricing")} className="text-left text-lg font-medium p-2 text-muted-foreground hover:text-white">Цены</button>
          <div className="h-px bg-border my-2" />
          <Button variant="ghost" className="justify-start w-full text-white">Войти</Button>
          <Button className="bg-gradient-primary text-white w-full">Попробовать →</Button>
        </div>
      )}
    </header>
  );
}
