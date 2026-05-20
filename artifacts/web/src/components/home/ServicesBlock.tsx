import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, Camera, MessageSquare } from "lucide-react";

interface Service {
  key: string;
  title: string;
  shortDescription: string;
  previewImageUrl: string;
  price: number;
  photosMin: number;
  photosMax: number;
  generationTime: number;
  accentFrom: string;
  accentTo: string;
  badge: string;
}

export function ServicesBlock() {
  const [services, setServices] = useState<Service[] | null>(null);

  useEffect(() => {
    fetch("/api/services")
      .then((r) => (r.ok ? r.json() : []))
      .then((d: Service[]) => setServices(d))
      .catch(() => setServices([]));
  }, []);

  if (!services || services.length === 0) return null;

  return (
    <section id="services" className="py-20 md:py-24 bg-background relative">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 bg-[#7C3AED]/10 border border-[#7C3AED]/30 text-[#EC4899] px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            <Sparkles size={14} /> Новые услуги
          </div>
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            Спец-услуги для бизнеса
          </h2>
          <p className="text-muted-foreground text-lg">
            Готовые решения для маркетплейсов и отзывов — на базе нашей нейросети.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
          {services.map((s) => {
            const Icon = s.key === "wb-photoshoot" ? Camera : MessageSquare;
            return (
              <Link key={s.key} href={`/service/${s.key}`}>
                <div
                  className="group relative rounded-3xl border border-border bg-card overflow-hidden hover:-translate-y-2 transition-all duration-300 cursor-pointer h-full"
                  style={{
                    boxShadow: `0 0 0 1px transparent`,
                  }}
                >
                  <div
                    className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity pointer-events-none"
                    style={{ background: `radial-gradient(circle at 0% 0%, ${s.accentFrom}, transparent 60%), radial-gradient(circle at 100% 100%, ${s.accentTo}, transparent 60%)` }}
                  />
                  <div className="relative grid sm:grid-cols-[1fr_220px] gap-0">
                    <div className="p-6 md:p-8 flex flex-col">
                      <div className="flex items-center gap-3 mb-4">
                        <div
                          className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg"
                          style={{ background: `linear-gradient(135deg, ${s.accentFrom}, ${s.accentTo})` }}
                        >
                          <Icon size={22} />
                        </div>
                        {s.badge && (
                          <span
                            className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border"
                            style={{ color: s.accentTo, borderColor: `${s.accentTo}66`, background: `${s.accentTo}15` }}
                          >
                            {s.badge}
                          </span>
                        )}
                      </div>
                      <h3 className="text-2xl md:text-3xl font-bold text-white mb-3">{s.title}</h3>
                      <p className="text-muted-foreground mb-6 flex-1">{s.shortDescription}</p>
                      <div className="flex flex-wrap items-center gap-3 mb-6 text-xs text-muted-foreground">
                        <span className="px-2.5 py-1 rounded-full bg-secondary border border-border">
                          {s.photosMin === s.photosMax ? `${s.photosMin} фото` : `${s.photosMin}–${s.photosMax} фото`}
                        </span>
                        <span className="px-2.5 py-1 rounded-full bg-secondary border border-border">
                          ~{s.generationTime}с
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-auto">
                        <div>
                          <div className="text-xs text-muted-foreground">от</div>
                          <div className="text-3xl font-bold text-white">{s.price.toFixed(0)} ₽</div>
                        </div>
                        <Button
                          className="text-white border-0 shadow-lg"
                          style={{ background: `linear-gradient(135deg, ${s.accentFrom}, ${s.accentTo})` }}
                        >
                          Заказать <ArrowRight size={16} className="ml-2" />
                        </Button>
                      </div>
                    </div>
                    <div className="hidden sm:block relative bg-secondary">
                      {s.previewImageUrl ? (
                        <img src={s.previewImageUrl} alt={s.title} className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <div
                          className="absolute inset-0 flex items-center justify-center"
                          style={{ background: `linear-gradient(135deg, ${s.accentFrom}33, ${s.accentTo}33)` }}
                        >
                          <Icon size={64} className="text-white/60" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
