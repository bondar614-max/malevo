import { useState, useRef } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useGetStyle, getGetStyleQueryKey } from "@workspace/api-client-react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Upload, X, Sparkles, Clock, Tag, ImagePlus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useAuthModal } from "@/components/auth/AuthModal";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

export default function Generate() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { open } = useAuthModal();

  const { data: style, isLoading, isError } = useGetStyle(id!, {
    query: { enabled: !!id, queryKey: getGetStyleQueryKey(id!) },
  });

  const photosRequired = Math.max(1, Math.min(3, style?.photosRequired ?? 1));
  const [photos, setPhotos] = useState<Array<File | null>>([null, null, null]);
  const [error, setError] = useState<string | null>(null);

  function setPhoto(idx: number, file: File | null) {
    setError(null);
    if (file && file.size > MAX_BYTES) {
      setError("Файл больше 10 МБ");
      return;
    }
    setPhotos((p) => {
      const next = [...p];
      next[idx] = file;
      return next;
    });
  }

  const filledCount = photos.slice(0, photosRequired).filter(Boolean).length;
  const ready = filledCount === photosRequired;

  function onGenerate() {
    setError(null);
    if (!user) { open("register"); return; }
    if (!style) return;
    if (!ready) { setError("Загрузите все фото"); return; }
    if (user.balance < style.price) {
      setError(`Недостаточно средств. Нужно ${style.price} ₽, на балансе ${user.balance.toFixed(2)} ₽`);
      return;
    }
    // Real generation pipeline isn't connected yet — let the user know.
    setError("Заявка принята! Скоро мы запустим обработку и пришлём результат в личный кабинет.");
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />

      <main className="flex-1 pt-28 pb-20 px-4 relative overflow-hidden">
        <div className="absolute top-1/3 left-1/4 w-[600px] h-[600px] bg-[#7C3AED] rounded-full mix-blend-screen filter blur-[150px] opacity-10 pointer-events-none" />
        <div className="absolute top-1/3 right-1/4 w-[600px] h-[600px] bg-[#EC4899] rounded-full mix-blend-screen filter blur-[150px] opacity-10 pointer-events-none" />

        <div className="container mx-auto max-w-5xl relative z-10">
          {isLoading ? (
            <div className="bg-card border border-border p-8 rounded-3xl">
              <Skeleton className="h-10 w-1/2 bg-white/5 mb-4" />
              <Skeleton className="h-4 w-full bg-white/5 mb-2" />
              <Skeleton className="h-4 w-3/4 bg-white/5" />
            </div>
          ) : isError || !style ? (
            <div className="bg-card border border-border p-12 rounded-3xl text-center">
              <div className="w-20 h-20 bg-destructive/20 text-destructive rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">⚠️</div>
              <h1 className="text-3xl font-bold text-white mb-4">Стиль не найден</h1>
              <Link href="/styles"><Button className="bg-gradient-primary text-white border-0">К каталогу</Button></Link>
            </div>
          ) : (
            <div className="grid lg:grid-cols-5 gap-6">
              {/* Left — style info */}
              <div className="lg:col-span-2 bg-card border border-border rounded-3xl overflow-hidden">
                <div className="aspect-square bg-secondary relative">
                  <img src={style.previewImageUrl} alt={style.title} className="w-full h-full object-cover" />
                  <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-md text-white text-xs font-medium px-3 py-1 rounded-full border border-white/10 flex items-center gap-1">
                    <Tag size={12} /> {style.category}
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <h1 className="text-2xl font-bold text-white">{style.title}</h1>
                  <p className="text-sm text-muted-foreground">{style.fullDescription || style.shortDescription}</p>
                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <div className="bg-secondary rounded-xl p-3 text-center">
                      <div className="text-xs text-muted-foreground">Цена</div>
                      <div className="text-lg font-bold text-gradient">{style.price} ₽</div>
                    </div>
                    <div className="bg-secondary rounded-xl p-3 text-center">
                      <div className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Clock size={11} /> Время</div>
                      <div className="text-lg font-bold text-white">~{style.generationTime}с</div>
                    </div>
                    <div className="bg-secondary rounded-xl p-3 text-center">
                      <div className="text-xs text-muted-foreground">Рейтинг</div>
                      <div className="text-lg font-bold text-yellow-400">⭐ {style.rating?.toFixed(1) ?? "—"}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right — uploader */}
              <div className="lg:col-span-3 bg-card border border-border rounded-3xl p-6 md:p-8 space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-6 h-6 text-[#7C3AED]" /> Загрузи свои фото
                  </h2>
                  <p className="text-sm text-muted-foreground mt-2">
                    Для этого стиля нужно <span className="text-white font-semibold">{photosRequired}</span> {photosRequired === 1 ? "фото" : "фото"}. Поддерживаются JPG/PNG/WebP, до 10 МБ.
                  </p>
                </div>

                <div className={`grid gap-4 ${photosRequired === 1 ? "grid-cols-1" : photosRequired === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
                  {Array.from({ length: photosRequired }).map((_, i) => (
                    <PhotoSlot key={i} index={i} file={photos[i] ?? null} onChange={(f) => setPhoto(i, f)} />
                  ))}
                </div>

                <div className="bg-secondary/50 border border-border rounded-xl p-4 text-sm text-muted-foreground">
                  💡 Для лучшего результата используй чёткие фото с хорошим освещением, лицо/объект в центре кадра.
                </div>

                {error && (
                  <div className="text-sm bg-[#7C3AED]/10 border border-[#7C3AED]/30 text-white rounded-lg p-3">{error}</div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button
                    size="lg"
                    onClick={onGenerate}
                    disabled={!ready}
                    className="flex-1 h-14 bg-gradient-primary text-white border-0 hover:opacity-90 shadow-[0_0_25px_rgba(124,58,237,0.4)] font-semibold text-base disabled:opacity-40 disabled:shadow-none"
                  >
                    <Sparkles className="w-5 h-5 mr-2" />
                    {user ? `Сгенерировать за ${style.price} ₽` : "Войти и сгенерировать"}
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => setLocation("/styles")} className="h-14 border-border text-white">
                    Другой стиль
                  </Button>
                </div>

                {user && (
                  <div className="text-xs text-muted-foreground text-center">
                    Баланс: <span className="text-white font-semibold">{user.balance.toFixed(2)} ₽</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

function PhotoSlot({ index, file, onChange }: { index: number; file: File | null; onChange: (f: File | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  function handle(f: File | null) {
    if (f) {
      const url = URL.createObjectURL(f);
      setPreview(url);
    } else {
      setPreview(null);
    }
    onChange(f);
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault(); setDragOver(false);
        const f = e.dataTransfer.files?.[0]; if (f) handle(f);
      }}
      className={`relative aspect-square rounded-2xl border-2 border-dashed transition-all overflow-hidden ${
        file ? "border-[#7C3AED]/50 bg-secondary" : dragOver ? "border-[#7C3AED] bg-[#7C3AED]/10" : "border-border bg-secondary/30 hover:border-[#7C3AED]/50 hover:bg-secondary/50"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handle(e.target.files?.[0] ?? null)}
      />
      {file && preview ? (
        <>
          <img src={preview} alt="" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => { handle(null); if (inputRef.current) inputRef.current.value = ""; }}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/70 backdrop-blur text-white flex items-center justify-center hover:bg-black/90"
            aria-label="Удалить"
          >
            <X size={16} />
          </button>
          <div className="absolute bottom-2 left-2 right-2 bg-black/70 backdrop-blur text-white text-xs px-2 py-1 rounded-md truncate">
            {file.name}
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-white transition-colors p-4"
        >
          <div className="w-12 h-12 rounded-full bg-gradient-primary/20 flex items-center justify-center text-[#7C3AED]">
            {index === 0 ? <Upload size={24} /> : <ImagePlus size={24} />}
          </div>
          <div className="text-sm font-medium">Фото {index + 1}</div>
          <div className="text-xs">Нажми или перетащи</div>
        </button>
      )}
    </div>
  );
}
