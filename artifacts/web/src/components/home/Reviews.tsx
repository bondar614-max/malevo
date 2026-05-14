import { useListReviews, useGetStatsSummary } from "@workspace/api-client-react";
import useEmblaCarousel from "embla-carousel-react";
import { useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Reviews() {
  const { data: reviews } = useListReviews();
  const { data: stats } = useGetStatsSummary();
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "start" });

  useEffect(() => {
    if (!emblaApi) return;
    const interval = setInterval(() => {
      emblaApi.scrollNext();
    }, 4000);
    return () => clearInterval(interval);
  }, [emblaApi]);

  if (!reviews || reviews.length === 0) return null;

  return (
    <section id="reviews" className="py-24 bg-background relative border-t border-border/50">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 tracking-tight">Что говорят пользователи</h2>
          <div className="inline-flex items-center gap-2 bg-secondary border border-border px-4 py-2 rounded-full">
            <span className="text-yellow-500">⭐</span>
            <span className="text-white font-medium">
              {stats?.averageRating ? stats.averageRating.toFixed(1) : "4.9"} из 5
            </span>
            <span className="text-muted-foreground">на основе {stats?.totalGenerated ? stats.totalGenerated.toLocaleString() : "100,000"}+ генераций</span>
          </div>
        </div>

        <div className="relative max-w-6xl mx-auto">
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex touch-pan-y -ml-4">
              {reviews.map((review) => (
                <div key={review.id} className="min-w-[100%] md:min-w-[50%] lg:min-w-[33.333%] pl-4 flex-[0_0_100%]">
                  <div className="h-full bg-card border border-border rounded-2xl p-6 flex flex-col">
                    <div className="flex items-center gap-4 mb-4">
                      <div 
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                        style={{ backgroundColor: review.avatarColor || '#7C3AED' }}
                      >
                        {review.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-white">{review.name}</div>
                        <div className="text-xs text-muted-foreground">{new Date(review.createdAt).toLocaleDateString('ru-RU')}</div>
                      </div>
                    </div>
                    
                    <div className="flex gap-1 mb-4 text-yellow-500 text-sm">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span key={i}>{i < review.rating ? '★' : '☆'}</span>
                      ))}
                    </div>

                    <p className="text-muted-foreground flex-1 leading-relaxed mb-6">
                      "{review.text}"
                    </p>

                    <div className="mt-auto pt-4 border-t border-border">
                      <div className="text-xs font-medium text-white/70 bg-white/5 px-2 py-1 rounded inline-block">
                        Стиль: {review.styleTag}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button 
            onClick={() => emblaApi?.scrollPrev()} 
            className="absolute -left-4 md:-left-12 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-secondary border border-border flex items-center justify-center text-white hover:bg-white/10 transition-colors hidden md:flex z-10"
          >
            <ChevronLeft size={20} />
          </button>
          
          <button 
            onClick={() => emblaApi?.scrollNext()} 
            className="absolute -right-4 md:-right-12 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-secondary border border-border flex items-center justify-center text-white hover:bg-white/10 transition-colors hidden md:flex z-10"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </section>
  );
}
