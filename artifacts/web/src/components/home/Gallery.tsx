import { useListGallery } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export function Gallery() {
  const { data: gallery } = useListGallery();

  // Split gallery into two rows for marquee
  const row1 = gallery?.slice(0, Math.ceil((gallery?.length || 0) / 2)) || [];
  const row2 = gallery?.slice(Math.ceil((gallery?.length || 0) / 2)) || [];

  // Duplicate items for seamless infinite scroll
  const marquee1 = [...row1, ...row1, ...row1];
  const marquee2 = [...row2, ...row2, ...row2];

  if (!gallery || gallery.length === 0) return null;

  return (
    <section id="gallery" className="py-24 bg-[#0F0F13] overflow-hidden">
      <div className="container mx-auto px-4 md:px-6 mb-12">
        <div className="text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 tracking-tight">Результаты наших пользователей</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Тысячи людей уже создали свои идеальные фото. Присоединяйся!
          </p>
        </div>
      </div>

      {/* Marquee Row 1 (Left to Right) */}
      <div className="relative flex overflow-hidden group mb-6">
        <div className="flex space-x-6 animate-marquee group-hover:[animation-play-state:paused] pr-6">
          {marquee1.map((item, i) => (
            <div key={`${item.id}-${i}`} className="relative flex-none w-60 h-60 rounded-2xl overflow-hidden group/item">
              <img src={item.imageUrl} alt={item.styleTitle} className="w-full h-full object-cover" loading="lazy" />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/item:opacity-100 transition-opacity flex flex-col items-center justify-center p-4 text-center">
                <span className="text-white font-medium mb-3">{item.styleTitle}</span>
                <Link href={`/generate/${item.styleId}`}>
                  <Button size="sm" className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-md border border-white/20">
                    Попробовать →
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Marquee Row 2 (Right to Left) */}
      <div className="relative flex overflow-hidden group mb-12">
        <div className="flex space-x-6 animate-marquee-reverse group-hover:[animation-play-state:paused] pr-6">
          {marquee2.map((item, i) => (
            <div key={`${item.id}-${i}`} className="relative flex-none w-60 h-60 rounded-2xl overflow-hidden group/item">
              <img src={item.imageUrl} alt={item.styleTitle} className="w-full h-full object-cover" loading="lazy" />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/item:opacity-100 transition-opacity flex flex-col items-center justify-center p-4 text-center">
                <span className="text-white font-medium mb-3">{item.styleTitle}</span>
                <Link href={`/generate/${item.styleId}`}>
                  <Button size="sm" className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-md border border-white/20">
                    Попробовать →
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-center mt-12">
        <Button variant="outline" size="lg" className="border-border hover:bg-white/5 text-white h-12 px-8">
          Смотреть все работы
        </Button>
      </div>
    </section>
  );
}
