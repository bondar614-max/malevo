import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";

interface PhotoCarouselProps {
  photos: string[];
  /** Aspect ratio class for the main image frame. Defaults to square. */
  aspectClassName?: string;
  /** Initial photo index. */
  initialIndex?: number;
}

/**
 * Shows one photo at a time with left/right arrows, a counter, thumbnails and a
 * download button. Used to browse all photos generated for an order.
 */
export function PhotoCarousel({
  photos,
  aspectClassName = "aspect-square",
  initialIndex = 0,
}: PhotoCarouselProps) {
  const total = photos.length;
  const [index, setIndex] = useState(Math.min(initialIndex, Math.max(0, total - 1)));

  useEffect(() => {
    if (index > total - 1) setIndex(Math.max(0, total - 1));
  }, [total, index]);

  if (total === 0) return null;

  const go = (delta: number) => setIndex((i) => (i + delta + total) % total);
  const current = photos[index]!;

  return (
    <div className="w-full">
      <div className={`group relative w-full ${aspectClassName} bg-secondary rounded-2xl overflow-hidden border border-border`}>
        <img src={current} alt={`Фото ${index + 1} из ${total}`} className="w-full h-full object-contain" />

        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Предыдущее фото"
              className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/60 backdrop-blur text-white rounded-full p-2.5 hover:bg-black/90 transition-colors"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Следующее фото"
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/60 backdrop-blur text-white rounded-full p-2.5 hover:bg-black/90 transition-colors"
            >
              <ChevronRight size={22} />
            </button>
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur text-white text-xs font-medium px-3 py-1 rounded-full">
              {index + 1} / {total}
            </div>
          </>
        )}

        <a
          href={current}
          target="_blank"
          rel="noopener noreferrer"
          download
          className="absolute bottom-3 right-3 bg-black/70 backdrop-blur text-white rounded-full p-3 hover:bg-black/90 transition-colors"
          aria-label="Скачать"
        >
          <Download size={18} />
        </a>
      </div>

      {total > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
          {photos.map((url, i) => (
            <button
              type="button"
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Перейти к фото ${i + 1}`}
              className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                i === index ? "border-[#EC4899] ring-2 ring-[#EC4899]/40" : "border-border opacity-60 hover:opacity-100"
              }`}
            >
              <img src={url} alt={`Миниатюра ${i + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
