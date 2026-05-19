import { useState } from "react";
import { useListStyles, useListCategories } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "wouter";

export function StylesGrid() {
  const [activeCategory, setActiveCategory] = useState<string>("Все");
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);

  const { data: categories } = useListCategories();
  const { data: styles, isLoading } = useListStyles(
    activeCategory !== "Все" ? { category: activeCategory } : undefined
  );

  const selectedStyle = styles?.find(s => s.id === selectedStyleId);

  return (
    <section id="styles" className="py-24 bg-background relative">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-12">
          <div>
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 tracking-tight">Выбери свой стиль</h2>
            <p className="text-muted-foreground text-lg max-w-xl">
              От бизнес-портретов до фэнтези миров. Найди идеальное воплощение себя.
            </p>
          </div>
          
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
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
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 lg:gap-6">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-3 space-y-4">
                <Skeleton className="aspect-[4/5] w-full rounded-xl bg-white/5" />
                <div className="space-y-2 px-2">
                  <Skeleton className="h-6 w-2/3 bg-white/5" />
                  <Skeleton className="h-4 w-full bg-white/5" />
                  <div className="flex justify-between pt-2">
                    <Skeleton className="h-6 w-1/4 bg-white/5" />
                    <Skeleton className="h-6 w-1/4 bg-white/5" />
                  </div>
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
                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button variant="secondary" className="bg-white/10 text-white border border-white/20 hover:bg-white/20 backdrop-blur-md" onClick={() => setSelectedStyleId(style.id)}>
                        🔍 Быстрый просмотр
                      </Button>
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
                          🚀 Сгенерировать
                        </Button>
                      </Link>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* View all CTA */}
        <div className="flex justify-center mt-12">
          <Link href="/styles">
            <Button
              size="lg"
              variant="outline"
              className="h-14 px-8 rounded-full border-[#7C3AED]/40 bg-[#7C3AED]/10 text-white hover:bg-[#7C3AED]/20 hover:border-[#7C3AED] backdrop-blur-md text-base font-semibold shadow-[0_0_20px_rgba(124,58,237,0.2)]"
            >
              Смотреть все стили <ChevronRight size={18} className="ml-1" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick View Modal */}
      <AnimatePresence>
        {selectedStyle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setSelectedStyleId(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-card border border-border rounded-2xl overflow-hidden shadow-2xl z-10 flex flex-col md:flex-row max-h-[90vh]"
            >
              <button 
                onClick={() => setSelectedStyleId(null)}
                className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-white/20 transition-colors backdrop-blur-md border border-white/10"
              >
                <X size={18} />
              </button>

              {/* Left: Images */}
              <div className="w-full md:w-1/2 bg-secondary relative">
                <div className="aspect-[4/5] md:aspect-auto md:h-full relative overflow-hidden">
                  <img src={selectedStyle.exampleImages?.[0] || selectedStyle.previewImageUrl} alt={selectedStyle.title} className="w-full h-full object-cover" />
                  {/* Arrows could be added here if multiple images */}
                </div>
              </div>

              {/* Right: Info */}
              <div className="w-full md:w-1/2 p-6 md:p-8 flex flex-col overflow-y-auto">
                <div className="inline-block bg-[#7C3AED]/20 text-[#7C3AED] px-3 py-1 rounded-full text-xs font-semibold w-fit mb-4 border border-[#7C3AED]/30">
                  {selectedStyle.category}
                </div>
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">{selectedStyle.title}</h3>
                
                <div className="flex items-center gap-4 mb-6 text-sm">
                  <span className="flex items-center gap-1 text-yellow-500 font-medium">⭐ {selectedStyle.rating?.toFixed(1) || "4.9"}</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">👤 {selectedStyle.ordersCount} использований</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">⏱ ~{selectedStyle.generationTime} сек</span>
                </div>

                <p className="text-muted-foreground leading-relaxed mb-8 flex-1">
                  {selectedStyle.fullDescription || selectedStyle.shortDescription}
                </p>

                <div className="mt-auto pt-6 border-t border-border">
                  <div className="flex items-end justify-between mb-6">
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Стоимость генерации</div>
                      <div className="text-3xl font-bold text-white">{selectedStyle.price} ₽</div>
                    </div>
                  </div>
                  
                  <Link href={`/generate/${selectedStyle.id}`}>
                    <Button size="lg" className="w-full h-14 bg-gradient-primary text-white border-0 hover:opacity-90 shadow-[0_0_20px_rgba(124,58,237,0.4)] text-lg font-semibold">
                      🚀 Сгенерировать сейчас
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}
