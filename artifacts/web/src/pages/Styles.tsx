import { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useListStyles, useListCategories } from "@workspace/api-client-react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";

export default function Styles() {
  const [activeCategory, setActiveCategory] = useState<string>("Все");
  const { data: categories } = useListCategories();
  const { data: styles, isLoading } = useListStyles(
    activeCategory !== "Все" ? { category: activeCategory } : undefined
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />

      <main className="flex-1 pt-32 pb-24 relative overflow-hidden">
        {/* Decorative gradient */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-[#7C3AED] rounded-full mix-blend-screen filter blur-[180px] opacity-10 pointer-events-none" />

        <div className="container mx-auto px-4 md:px-6 relative">
          <Link href="/">
            <button className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white transition-colors mb-6">
              <ArrowLeft size={16} /> На главную
            </button>
          </Link>

          <div className="mb-12 max-w-3xl">
            <div className="inline-block bg-[#7C3AED]/20 text-[#7C3AED] px-3 py-1 rounded-full text-xs font-semibold mb-4 border border-[#7C3AED]/30">
              Каталог стилей
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 tracking-tight">
              Все стили <span className="text-gradient">генерации</span>
            </h1>
            <p className="text-muted-foreground text-lg">
              Полная коллекция AI-стилей: от бизнес-портретов до фэнтези-миров. Выбери свой и создай уникальное фото за минуту.
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-10">
            <button
              onClick={() => setActiveCategory("Все")}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                activeCategory === "Все"
                  ? "bg-gradient-primary text-white shadow-[0_0_15px_rgba(124,58,237,0.4)] border-transparent"
                  : "bg-secondary text-muted-foreground border border-border hover:text-white hover:border-white/20"
              }`}
            >
              Все
            </button>
            {categories?.map((cat) => (
              <button
                key={cat.category}
                onClick={() => setActiveCategory(cat.category)}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                  activeCategory === cat.category
                    ? "bg-gradient-primary text-white shadow-[0_0_15px_rgba(124,58,237,0.4)] border-transparent"
                    : "bg-secondary text-muted-foreground border border-border hover:text-white hover:border-white/20"
                }`}
              >
                {cat.category} <span className="opacity-60 ml-1 text-xs">{cat.count}</span>
              </button>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-border bg-card p-3 space-y-4">
                  <Skeleton className="aspect-[4/5] w-full rounded-xl bg-white/5" />
                  <div className="space-y-2 px-2">
                    <Skeleton className="h-6 w-2/3 bg-white/5" />
                    <Skeleton className="h-4 w-full bg-white/5" />
                    <Skeleton className="h-10 w-full mt-4 bg-white/5" />
                  </div>
                </div>
              ))
            ) : (
              <AnimatePresence mode="popLayout">
                {styles?.map((style) => (
                  <motion.div
                    key={style.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3 }}
                    className="group rounded-2xl border border-border bg-card p-3 hover:border-[#7C3AED]/50 hover:shadow-[0_8px_30px_-12px_rgba(124,58,237,0.3)] hover:-translate-y-2 transition-all duration-300 flex flex-col"
                  >
                    <div className="relative aspect-[4/5] rounded-xl overflow-hidden mb-4 bg-secondary">
                      <img src={style.previewImageUrl} alt={style.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
                      <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1 rounded-full text-xs font-semibold text-white">
                        {style.category}
                      </div>
                    </div>

                    <div className="px-2 flex-1 flex flex-col">
                      <h3 className="text-lg font-bold text-white mb-1 line-clamp-1">{style.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px] mb-4">
                        {style.shortDescription}
                      </p>
                      <div className="flex items-center justify-between text-sm mb-4">
                        <div className="flex items-center gap-1 text-yellow-500 font-medium">
                          ⭐ {style.rating?.toFixed(1) || "4.9"}
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          👤 {style.ordersCount.toLocaleString()} фото
                        </div>
                      </div>

                      <div className="mt-auto pt-4 border-t border-border flex items-center justify-between gap-4">
                        <div className="font-bold text-xl text-gradient whitespace-nowrap">
                          от {style.price} ₽
                        </div>
                        <Link href={`/generate/${style.id}`} className="flex-1">
                          <Button className="w-full bg-gradient-primary text-white border-0 hover:opacity-90 shadow-[0_0_15px_rgba(124,58,237,0.3)]">
                            🚀 Создать
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>

          {!isLoading && styles && styles.length === 0 && (
            <div className="text-center py-20 text-muted-foreground">
              В этой категории пока нет стилей.
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
