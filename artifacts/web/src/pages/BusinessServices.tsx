import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  CheckCircle2,
  Clock3,
  Image,
  Layers3,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Store,
  Upload,
  WalletCards,
  Zap,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";

interface ServiceDef {
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

interface ExampleItem {
  src: string;
  title: string;
  text: string;
  className?: string;
}

interface PhotoExamplesSettings {
  heroVariant: "variant1" | "variant2" | "variant3" | "variant4";
  photoshoot: ExampleItem[];
  reviewBefore: ExampleItem;
  reviewAfter: ExampleItem[];
}

const serviceCopy = {
  "wb-photoshoot": {
    eyebrow: "Для карточек Wildberries",
    headline: "Каталожные фото без студии, модели и пересъемок",
    lead:
      "Когда товар уже готов к продаже, но фотографии тормозят запуск, нейросеть соберет аккуратную WB-фотосессию из ваших снимков: чистый фон, ровный свет, несколько ракурсов и визуал, который не выглядит как случайное фото на телефон.",
    pain: "Закрывает боль продавца: не нужно искать модель, бронировать студию, ждать ретушь и переснимать вещь из-за света или фона.",
    result: "На выходе: 3-5 готовых изображений для карточки, тестов обложки и контента в описании.",
    href: "/service/wb-photoshoot",
    icon: Camera,
    stats: ["3-5 фото", "~90 секунд", "от 799 ₽"],
    bullets: [
      "Помогает быстро вывести новый SKU на маркетплейс",
      "Дает единый визуальный стиль для линейки товаров",
      "Подходит для одежды, образов и каталожных ракурсов",
    ],
  },
  review: {
    eyebrow: "Для отзывов и UGC",
    headline: "Живые фото, которые выглядят как реальный покупательский опыт",
    lead:
      "Отзывы без фото часто пролистывают, а постановочные кадры вызывают недоверие. Загрузите один снимок, выберите локацию и получите естественные кадры в стиле смартфон-фото: квартира, комната, лифт или примерочная ПВЗ.",
    pain: "Закрывает боль доверия: товар получает визуальное социальное доказательство без долгого сбора пользовательского контента.",
    result: "На выходе: комплект реалистичных отзывных фото для карточек, тестов и прогрева спроса.",
    href: "/service/review",
    icon: MessageSquareText,
    stats: ["1 исходное фото", "~60 секунд", "от 199 ₽"],
    bullets: [
      "Добавляет карточке ощущение реального использования",
      "Можно выбрать сценарий и возраст модели",
      "Удобно делать серии фото под разные товары и локации",
    ],
  },
} as const;

const fallbackServices: ServiceDef[] = [
  {
    key: "wb-photoshoot",
    title: "Фотосессия для Wildberries",
    shortDescription: "Профессиональная каталожная фотосессия одежды из ваших фото",
    previewImageUrl: "",
    price: 799,
    photosMin: 3,
    photosMax: 5,
    generationTime: 90,
    accentFrom: "#7C3AED",
    accentTo: "#EC4899",
    badge: "WB",
  },
  {
    key: "review",
    title: "Фото для отзывов",
    shortDescription: "Реалистичные отзывные фото с выбором локации из 1 кадра",
    previewImageUrl: "",
    price: 199,
    photosMin: 1,
    photosMax: 1,
    generationTime: 60,
    accentFrom: "#0EA5E9",
    accentTo: "#10B981",
    badge: "Отзывы",
  },
];

const defaultPhotoExamples: PhotoExamplesSettings = {
  heroVariant: "variant3",
  photoshoot: [
    {
      src: "/api/static/generated/8c995cee-716a-42b3-81ae-1c4b832006ce.png",
      title: "Обложка",
      text: "Крупный lifestyle-кадр показывает посадку и цвет товара.",
      className: "sm:col-span-2 lg:col-span-2 lg:row-span-2",
    },
    {
      src: "/api/static/generated/3bf0f84c-6f49-48bf-870d-3b6fe50481b4.jpg",
      title: "Другой ракурс",
      text: "Та же модель и куртка, но новая поза и композиция.",
      className: "",
    },
    {
      src: "/api/static/generated/f8aecf5b-8d2d-4121-bb69-ce7b79225cf3.jpg",
      title: "Каталожный план",
      text: "Средний кадр для карточки, описания или рекламы.",
      className: "",
    },
    {
      src: "/api/static/generated/15258a95-0cce-4f78-9a9f-195cbf544ff8.jpg",
      title: "Детали ткани",
      text: "Отдельный кадр помогает показать фактуру, фурнитуру и швы.",
      className: "sm:col-span-2 lg:col-span-2",
    },
  ],
  reviewBefore: {
    src: "/review-examples/fitting-room-before.png",
    title: "Исходник продавца",
    text: "Обычное фото из кабинки примерочной становится базой для нескольких UGC-вариантов.",
  },
  reviewAfter: [
  {
    src: "/review-examples/fitting-room-after-1.png",
    title: "Чище свет",
    text: "Кадр выглядит как обычный отзыв, но товар легче рассмотреть.",
  },
  {
    src: "/review-examples/fitting-room-after-2.png",
    title: "Новая поза",
    text: "Можно получить другой ракурс без повторной съемки.",
  },
  {
    src: "/review-examples/fitting-room-after-3.png",
    title: "Живой UGC",
    text: "Сохраняется ощущение смартфон-фото из примерочной.",
  },
  ],
};

export default function BusinessServices() {
  const [services, setServices] = useState<ServiceDef[]>(fallbackServices);
  const [examples, setExamples] = useState<PhotoExamplesSettings>(defaultPhotoExamples);

  useEffect(() => {
    fetch("/api/services")
      .then((r) => (r.ok ? r.json() : fallbackServices))
      .then((d: ServiceDef[]) => {
        const business = d.filter((s) => s.key === "wb-photoshoot" || s.key === "review");
        if (business.length > 0) setServices(business);
      })
      .catch(() => setServices(fallbackServices));
  }, []);

  useEffect(() => {
    fetch("/api/photo-examples")
      .then((r) => (r.ok ? r.json() : defaultPhotoExamples))
      .then((d: PhotoExamplesSettings) => setExamples(d))
      .catch(() => setExamples(defaultPhotoExamples));
  }, []);

  const normalized = useMemo(() => {
    const byKey = new Map(services.map((s) => [s.key, s]));
    return fallbackServices.map((fallback) => ({ ...fallback, ...(byKey.get(fallback.key) ?? {}) }));
  }, [services]);

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-[#7C3AED]/30 selection:text-white">
      <Header />
      <main className="overflow-hidden">
        <PhotoHero variant={examples.heroVariant} examples={examples} services={normalized} />

        <section id="choose-service" className="py-16 md:py-20 border-y border-white/10 bg-white/[0.02]">
          <div className="container mx-auto px-4 md:px-6">
            <SectionIntro
              label="Выбор услуги"
              title="Под разные задачи нужны разные фото"
              text="Каталожная съемка отвечает за первое впечатление в выдаче и карточке. Отзывные фото отвечают за доверие, когда покупатель уже сравнивает и сомневается."
            />
            <div className="grid lg:grid-cols-2 gap-6 mt-10">
              {normalized.map((service) => (
                <ServiceLandingCard key={service.key} service={service} />
              ))}
            </div>
          </div>
        </section>

        <section id="photoshoot-examples" className="py-16 md:py-20 scroll-mt-24">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid lg:grid-cols-[0.78fr_1.22fr] gap-8 lg:gap-12 items-start">
              <div className="lg:sticky lg:top-28">
                <SectionIntro
                  label="Пример WB-фотосессии"
                  title="Так может выглядеть серия для карточки товара"
                  text="Взяли последнюю тестовую фотосессию: нейросеть сохраняет модель, товар и общую сцену, но делает разные кадры для обложки, каталога, описания и демонстрации деталей."
                />
                <div className="grid grid-cols-2 gap-3 mt-7">
                  {[
                    ["12", "кадров в серии"],
                    ["2", "фото модели"],
                    ["5", "фото товара"],
                    ["WB", "формат карточки"],
                  ].map(([value, label]) => (
                    <div key={label} className="rounded-2xl border border-white/10 bg-card p-4">
                      <div className="text-2xl font-bold text-white">{value}</div>
                      <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">{label}</div>
                    </div>
                  ))}
                </div>
                <Button asChild size="lg" className="h-13 mt-7 bg-gradient-primary text-white border-0">
                  <Link href="/service/wb-photoshoot">Заказать такую фотосессию <ArrowRight size={18} className="ml-2" /></Link>
                </Button>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 auto-rows-[260px] md:auto-rows-[320px] gap-4">
                {examples.photoshoot.map((example) => (
                  <article key={example.src} className={`group relative overflow-hidden rounded-3xl border border-white/10 bg-card ${example.className}`}>
                    <img
                      src={example.src}
                      alt={`${example.title}: пример сгенерированной WB-фотосессии`}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/20 to-transparent" />
                    <div className="absolute left-4 right-4 bottom-4">
                      <div className="inline-flex rounded-full bg-[#7C3AED]/90 px-3 py-1 text-xs font-semibold text-white mb-3">
                        {example.title}
                      </div>
                      <p className="text-sm text-white/88 leading-relaxed">{example.text}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 md:py-20">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid lg:grid-cols-[0.82fr_1.18fr] gap-8 lg:gap-12 items-start">
              <div className="lg:sticky lg:top-28">
                <SectionIntro
                  label="Пример фотоотзывов"
                  title="Из одного снимка в примерочной — серия живых отзывных фото"
                  text="Покупательские кадры должны выглядеть естественно: зеркало, примерочная, телефон в руке и понятная посадка вещи. Поэтому показываем не студийный результат, а реалистичный сценарий для карточки Wildberries."
                />
                <div className="mt-7 rounded-3xl border border-white/10 bg-card overflow-hidden">
                  <div className="relative aspect-[3/4] bg-white/[0.03]">
                    <img
                      src={examples.reviewBefore.src}
                      alt="Исходное фото в примерочной до генерации"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <div className="absolute left-4 top-4 rounded-full bg-black/65 px-3 py-1 text-xs font-semibold text-white">
                      До
                    </div>
                  </div>
                  <div className="p-5">
                    <h3 className="font-semibold text-white">{examples.reviewBefore.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                      {examples.reviewBefore.text}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                {examples.reviewAfter.map((example, index) => (
                  <article key={example.src} className="rounded-3xl border border-white/10 bg-card overflow-hidden">
                    <div className="relative aspect-[3/4] bg-white/[0.03]">
                      <img
                        src={example.src}
                        alt={`${example.title}: сгенерированное фотоотзывное фото ${index + 1}`}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <div className="absolute left-3 top-3 rounded-full bg-[#10B981]/90 px-3 py-1 text-xs font-semibold text-white">
                        После {index + 1}
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-white">{example.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed mt-2">{example.text}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 md:py-20">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-8 lg:gap-14 items-start">
              <div>
                <SectionIntro
                  label="Боли клиентов"
                  title="Почему продавцы теряют время и деньги на фото"
                  text="Проблема редко только в красоте кадра. Нужны скорость, повторяемость, доверие и возможность тестировать визуал без большого бюджета."
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  ["Съемка запускается долго", "Студия, модель, доставка образцов и ретушь растягивают запуск карточки."],
                  ["Фото не вызывают доверия", "Покупатель видит глянец, но не понимает, как товар выглядит в жизни."],
                  ["Каждый тест стоит дорого", "Проверить другой ракурс, фон или локацию обычной съемкой сложно и затратно."],
                  ["Нет единого визуального стандарта", "Карточки одной линейки выглядят разрозненно и хуже считываются в каталоге."],
                ].map(([title, text]) => (
                  <div key={title} className="rounded-2xl border border-white/10 bg-card/70 p-5">
                    <h3 className="font-semibold text-white">{title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground mt-2">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="py-16 md:py-20 bg-white/[0.02] border-y border-white/10">
          <div className="container mx-auto px-4 md:px-6">
            <SectionIntro
              label="Процесс"
              title="От исходника до готовых фото за один короткий сценарий"
              text="Загрузите фото, выберите параметры, запустите генерацию и заберите результат в личном кабинете."
            />
            <div className="grid md:grid-cols-4 gap-4 mt-10">
              {[
                { icon: Upload, title: "Загрузите исходники", text: "1 фото для отзывов или 3-5 фото для WB-фотосессии." },
                { icon: Layers3, title: "Выберите сценарий", text: "Для отзывов: локация, возраст и количество комплектов." },
                { icon: Zap, title: "Запустите AI", text: "Сервис обработает фото и сохранит результат в заказе." },
                { icon: BadgeCheck, title: "Используйте в карточке", text: "Скачайте изображения и протестируйте их в маркетплейсе." },
              ].map((step, index) => (
                <div key={step.title} className="rounded-2xl border border-white/10 bg-card p-5">
                  <div className="flex items-center justify-between mb-5">
                    <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#67E8F9]">
                      <step.icon size={20} />
                    </div>
                    <span className="text-sm text-muted-foreground">0{index + 1}</span>
                  </div>
                  <h3 className="font-semibold text-white">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mt-2">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 md:py-20">
          <div className="container mx-auto px-4 md:px-6">
            <div className="rounded-3xl border border-white/10 bg-card p-6 md:p-8 lg:p-10">
              <div className="grid lg:grid-cols-[0.92fr_1.08fr] gap-8 items-start">
                <div>
                  <div className="inline-flex items-center gap-2 text-sm text-[#67E8F9] mb-3">
                    <Store size={16} /> Экономика
                  </div>
                  <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">В чем выгода по сравнению с обычной съемкой</h2>
                  <p className="text-muted-foreground mt-4 leading-relaxed">
                    AI-фото не заменяет большую бренд-съемку, но отлично закрывает быстрые коммерческие задачи: запустить товар, проверить гипотезу, усилить доверие и не замораживать бюджет на каждом визуальном тесте.
                  </p>
                </div>
                <div className="grid sm:grid-cols-3 gap-3">
                  {[
                    ["Скорость", "Минуты вместо дней согласований и ретуши"],
                    ["Бюджет", "От 199 ₽ за отзывные фото и от 799 ₽ за WB-съемку"],
                    ["Гибкость", "Можно быстро пробовать разные сценарии под спрос"],
                  ].map(([title, text]) => (
                    <div key={title} className="rounded-2xl bg-white/[0.04] border border-white/10 p-5">
                      <div className="text-xl font-bold text-white">{title}</div>
                      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 md:py-20 bg-white/[0.02] border-y border-white/10">
          <div className="container mx-auto px-4 md:px-6">
            <SectionIntro
              label="Вопросы"
              title="Что важно знать перед заказом"
              text="Коротко о качестве исходников, назначении фото и формате результата."
            />
            <div className="grid md:grid-cols-2 gap-4 mt-10">
              {[
                ["Какие фото загружать?", "Лучше использовать четкие снимки без сильного размытия и перекрытий. Для WB нужно 3-5 ракурсов, для отзывного фото достаточно одного исходника."],
                ["Это подойдет для всех товаров?", "Лучше всего услуги работают для одежды, образов и товаров, где важны посадка, доверие и визуальный контекст."],
                ["Можно ли сделать несколько вариантов?", "Да. Для отзывов можно выбрать количество комплектов, а для WB запускать новые генерации с другими исходниками."],
                ["Где будут результаты?", "После генерации изображения появятся на странице заказа и сохранятся в личном кабинете."],
              ].map(([question, answer]) => (
                <div key={question} className="rounded-2xl border border-white/10 bg-card p-5">
                  <h3 className="font-semibold text-white">{question}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mt-2">{answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 md:py-20">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 bg-[#7C3AED]/10 border border-[#7C3AED]/30 text-[#EC4899] px-4 py-1.5 rounded-full text-sm font-medium mb-5">
                <Sparkles size={14} /> Готовы попробовать
              </div>
              <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight">Выберите услугу и получите первые фото уже сейчас</h2>
              <p className="text-muted-foreground text-lg mt-4">
                Начните с задачи, которая сильнее всего влияет на карточку: обложка и каталог для клика или отзывные фото для доверия.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
                <Button asChild size="lg" className="h-13 bg-gradient-primary text-white border-0">
                  <Link href="/service/wb-photoshoot">Заказать WB-фотосессию <ArrowRight size={18} className="ml-2" /></Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-13 border-white/15 text-white">
                  <Link href="/service/review">Заказать фото для отзывов</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function SectionIntro({ label, title, text }: { label: string; title: string; text: string }) {
  return (
    <div className="max-w-3xl">
      <div className="text-sm font-semibold text-[#67E8F9] mb-3">{label}</div>
      <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">{title}</h2>
      <p className="text-muted-foreground text-lg mt-4 leading-relaxed">{text}</p>
    </div>
  );
}

function PhotoHero({ variant, examples, services }: { variant: PhotoExamplesSettings["heroVariant"]; examples: PhotoExamplesSettings; services: ServiceDef[] }) {
  if (variant === "variant1") return <PhotoHeroPremium examples={examples} services={services} />;
  if (variant === "variant2") return <PhotoHeroPain examples={examples} services={services} />;
  if (variant === "variant4") return <PhotoHeroProduct examples={examples} services={services} />;
  return <PhotoHeroBeforeAfter examples={examples} services={services} />;
}

function HeroCtas({ primary }: { primary: string }) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mt-8">
      <Button asChild size="lg" className="h-14 px-7 bg-gradient-to-r from-[#FF3D7F] via-[#A855F7] to-[#22D3EE] text-white border-0 shadow-[0_0_30px_rgba(236,72,153,0.34)]">
        <Link href="/service/wb-photoshoot">{primary} <ArrowRight size={18} className="ml-2" /></Link>
      </Button>
      <Button asChild size="lg" variant="outline" className="h-14 px-7 border-white/15 text-white bg-white/[0.03] hover:bg-white/[0.06]">
        <a href="#photoshoot-examples">Смотреть примеры</a>
      </Button>
    </div>
  );
}

function PhotoHeroPremium({ examples, services }: { examples: PhotoExamplesSettings; services: ServiceDef[] }) {
  const wb = services.find((s) => s.key === "wb-photoshoot") ?? fallbackServices[0]!;
  return (
    <section className="relative pt-24 md:pt-28 pb-12 md:pb-14 min-h-[780px] bg-[#050506]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_25%,rgba(34,211,238,0.12),transparent_30%),radial-gradient(circle_at_18%_45%,rgba(236,72,153,0.12),transparent_28%)]" />
      <div className="container mx-auto px-4 md:px-6 relative">
        <div className="grid lg:grid-cols-[0.82fr_1.18fr] gap-9 lg:gap-12 items-start">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#A855F7]/40 bg-[#A855F7]/10 px-4 py-1.5 text-sm font-semibold text-[#C084FC]">
              <Zap size={15} /> AI-фотосессии для маркетплейсов
            </div>
            <h1 className="mt-6 text-5xl md:text-7xl font-bold tracking-tight text-white leading-[0.98]">
              Фото для <span className="bg-gradient-to-r from-[#EC4899] to-[#38BDF8] bg-clip-text text-transparent">Wildberries</span> за минуты
            </h1>
            <p className="mt-6 max-w-2xl text-lg md:text-xl leading-relaxed text-muted-foreground">
              Загрузите товар — получите серию кадров для карточки, отзывов и рекламы.
            </p>
            <HeroCtas primary="Создать фотосессию" />
            <div className="mt-7 grid sm:grid-cols-3 gap-3 max-w-2xl">
              {[
                ["12 кадров", "в серии"],
                ["без студии", "и лишних затрат"],
                [`от ${Number(wb.price).toFixed(0)} ₽`, "за фотосессию"],
              ].map(([value, label]) => (
                <div key={value} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="text-lg font-bold text-white">{value}</div>
                  <div className="text-sm text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span>2 847 продавцов уже создают фото с MALEVO</span>
              <span className="text-[#10B981]">★★★★★</span>
              <span className="text-white">4.9</span>
            </div>
            <ReadyBadge className="mt-5 max-w-xl" />
          </div>
          <div className="grid grid-cols-5 gap-3">
            <HeroImage src={examples.photoshoot[0]?.src} className="col-span-3 row-span-2 aspect-[3/4]" />
            <HeroImage src={examples.photoshoot[1]?.src} className="col-span-2 aspect-[4/3]" />
            <HeroImage src={examples.photoshoot[2]?.src} className="col-span-2 aspect-[4/3]" />
            <HeroImage src={examples.photoshoot[3]?.src} className="aspect-square" />
            <HeroImage src={examples.reviewAfter[0]?.src} className="aspect-square" />
            <HeroImage src={examples.reviewAfter[1]?.src} className="aspect-square" />
          </div>
        </div>
        <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.02] p-6 md:p-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-3xl md:text-4xl font-bold text-white">Как это <span className="text-[#A855F7]">работает</span></h2>
            <Button asChild variant="outline" className="hidden sm:inline-flex border-white/15 text-white">
              <a href="#how-it-works">Весь процесс в 4 шага <ArrowRight size={16} className="ml-2" /></a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function PhotoHeroPain({ examples, services }: { examples: PhotoExamplesSettings; services: ServiceDef[] }) {
  const wb = services.find((s) => s.key === "wb-photoshoot") ?? fallbackServices[0]!;
  return (
    <section className="relative pt-28 md:pt-34 pb-12 md:pb-16 min-h-[860px]">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#050506_0%,rgba(5,5,6,0.96)_42%,rgba(5,5,6,0.72)_100%)]" />
      <div className="container mx-auto px-4 md:px-6 relative">
        <div className="grid lg:grid-cols-[0.95fr_1.05fr] gap-8 lg:gap-10 items-center">
          <div>
            <SourcePanel examples={examples} />
            <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-[#22D3EE]/30 bg-[#22D3EE]/10 px-4 py-1.5 text-sm font-semibold text-[#67E8F9]">
              <Sparkles size={15} /> WB + фотоотзывы
            </div>
            <h1 className="mt-5 text-4xl md:text-6xl font-bold tracking-tight text-white leading-[1.02]">
              Карточка без сильных фото <span className="text-[#22D3EE]">теряет продажи</span>
            </h1>
            <p className="mt-5 max-w-2xl text-lg md:text-xl leading-relaxed text-muted-foreground">
              Сделайте WB-фотосессию и фотоотзывы из ваших исходников — быстро, красиво, без студии.
            </p>
            <HeroCtas primary="Запустить AI-фото" />
            <div className="mt-6 flex flex-wrap gap-3 text-sm">
              {["WB", "Отзывы", `от ${Number(wb.price).toFixed(0)} ₽`, "готово за минуты"].map((chip) => (
                <span key={chip} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-white">{chip}</span>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="grid grid-cols-4 gap-3">
              <HeroImage src={examples.photoshoot[0]?.src} className="col-span-2 row-span-2 aspect-[3/4]" />
              <HeroImage src={examples.photoshoot[1]?.src} className="col-span-2 aspect-[4/3]" />
              <HeroImage src={examples.photoshoot[2]?.src} className="aspect-square" />
              <HeroImage src={examples.photoshoot[3]?.src} className="aspect-square" />
              <div className="col-span-4 rounded-2xl border border-white/10 bg-card/90 p-4 shadow-2xl">
                <div className="text-xs text-[#67E8F9] font-semibold mb-3">Фотоотзывы</div>
                <div className="grid grid-cols-3 gap-2">
                  {examples.reviewAfter.map((item) => <HeroImage key={item.src} src={item.src} className="aspect-[3/4]" />)}
                </div>
                <div className="mt-3 text-sm text-white">4.9 из 5 на основе 2 357 отзывов</div>
              </div>
            </div>
          </div>
        </div>
        <HeroMetricBand />
      </div>
    </section>
  );
}

function PhotoHeroBeforeAfter({ examples }: { examples: PhotoExamplesSettings; services: ServiceDef[] }) {
  return (
    <section className="relative pt-24 md:pt-28 pb-10 md:pb-14 min-h-[820px] bg-[#050506]">
      <div className="container mx-auto px-4 md:px-6 relative">
        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-8 items-center">
          <div>
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-card min-h-[340px]">
              <HeroImage src={examples.reviewBefore.src} className="absolute inset-0 h-full w-full opacity-60" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
              <span className="absolute left-5 top-5 rounded-full bg-black/70 px-3 py-1 text-sm font-semibold text-white">До</span>
              <div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-white/10 bg-black/50 p-4">
                <div className="text-sm text-muted-foreground">Слабый исходник</div>
                <div className="text-white font-semibold">Мало доверия, мало кликов, непонятная посадка</div>
              </div>
            </div>
            <h1 className="mt-8 text-4xl md:text-6xl font-bold tracking-tight text-white leading-[1.04]">
              Слабые фото? Сделаем карточку <span className="text-[#22D3EE]">заметной.</span>
            </h1>
            <p className="mt-5 text-lg text-muted-foreground leading-relaxed">
              AI-фотосессия и фотоотзывы для маркетплейсов из ваших исходников.
            </p>
            <HeroCtas primary="Хочу такие фото" />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-3 rounded-3xl overflow-hidden border border-[#22D3EE]/30 relative min-h-[430px]">
              <HeroImage src={examples.photoshoot[0]?.src} className="absolute inset-0 h-full w-full" />
              <span className="absolute left-5 top-5 rounded-full bg-[#22D3EE] px-4 py-1.5 text-sm font-bold text-black">После</span>
            </div>
            <div className="grid gap-3">
              {examples.photoshoot.slice(1).map((item) => <HeroImage key={item.src} src={item.src} className="aspect-square" />)}
            </div>
            <div className="col-span-4 grid grid-cols-[repeat(4,minmax(0,1fr))] gap-3">
              {examples.reviewAfter.map((item) => <HeroImage key={item.src} src={item.src} className="aspect-[3/4]" />)}
              <div className="rounded-2xl border border-[#10B981]/30 bg-[#10B981]/10 p-5 flex flex-col justify-center">
                <div className="text-4xl font-bold text-white">4.9</div>
                <div className="text-sm text-muted-foreground mt-1">рейтинг доверия</div>
                <div className="text-[#10B981] mt-3">★★★★★</div>
              </div>
            </div>
          </div>
        </div>
        <HeroMetricBand />
      </div>
    </section>
  );
}

function PhotoHeroProduct({ examples, services }: { examples: PhotoExamplesSettings; services: ServiceDef[] }) {
  const wb = services.find((s) => s.key === "wb-photoshoot") ?? fallbackServices[0]!;
  return (
    <section className="relative pt-28 md:pt-34 pb-12 md:pb-16 min-h-[860px] bg-[#050506]">
      <div className="container mx-auto px-4 md:px-6 relative">
        <div className="grid xl:grid-cols-[0.82fr_1fr_0.92fr] gap-7 items-center">
          <WorkflowPanel examples={examples} />
          <div className="text-center">
            <div className="inline-flex items-center rounded-full border border-[#10B981]/40 px-4 py-1.5 text-sm font-semibold uppercase tracking-[0.22em] text-[#67E8F9]">
              Фотосессия для Wildberries
            </div>
            <h1 className="mt-7 text-4xl md:text-6xl font-bold tracking-tight text-white leading-[1.05]">
              Загрузите товар. Получите фото, которые <span className="text-[#10B981]">продают.</span>
            </h1>
            <p className="mt-5 text-lg text-muted-foreground leading-relaxed">
              AI соберет фотосессию для WB: модель, ракурсы, детали ткани и отзывные кадры.
            </p>
            <div className="mt-6 flex justify-center flex-wrap gap-3 text-sm">
              {["без студии", "12+ кадров", `от ${Number(wb.price).toFixed(0)} ₽`].map((chip) => (
                <span key={chip} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-white">{chip}</span>
              ))}
            </div>
            <HeroCtas primary="Создать фото сейчас" />
          </div>
          <ProductCardPreview examples={examples} />
        </div>
        <HeroMetricBand />
      </div>
    </section>
  );
}

function HeroImage({ src, className }: { src?: string; className: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] ${className}`}>
      {src && <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />}
    </div>
  );
}

function ReadyBadge({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-2xl border border-[#10B981]/30 bg-[#10B981]/10 px-5 py-4 flex items-center gap-3 ${className}`}>
      <CheckCircle2 size={22} className="text-[#10B981] shrink-0" />
      <div>
        <div className="font-semibold text-white">Готово за 15-30 минут</div>
        <div className="text-sm text-muted-foreground">Без фотостудии и повторных съемок</div>
      </div>
    </div>
  );
}

function SourcePanel({ examples }: { examples: PhotoExamplesSettings }) {
  return (
    <div className="max-w-sm rounded-3xl border border-white/10 bg-card/80 p-4">
      <div className="text-sm font-semibold text-white mb-3">Ваши исходники</div>
      <div className="grid grid-cols-5 gap-2">
        {examples.photoshoot.map((item) => <HeroImage key={item.src} src={item.src} className="aspect-square" />)}
        <HeroImage src={examples.reviewBefore.src} className="aspect-square" />
      </div>
    </div>
  );
}

function WorkflowPanel({ examples }: { examples: PhotoExamplesSettings }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-card/80 p-5 space-y-5">
      {[
        ["1", "Загрузите товар", "5 фото", examples.photoshoot.slice(0, 4)],
        ["2", "Выберите модель", "2 фото", examples.reviewAfter.slice(0, 2)],
        ["3", "AI создаст фотосессию", "12+ кадров", examples.photoshoot],
      ].map(([num, title, meta, imgs]) => (
        <div key={String(title)} className="border-b border-white/10 last:border-0 pb-5 last:pb-0">
          <div className="flex items-center justify-between text-sm">
            <div className="font-semibold text-white"><span className="mr-2 rounded-full bg-[#10B981] px-2 py-0.5 text-black">{String(num)}</span>{String(title)}</div>
            <span className="text-muted-foreground">{String(meta)}</span>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {(imgs as ExampleItem[]).slice(0, 4).map((item) => <HeroImage key={item.src} src={item.src} className="aspect-square" />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProductCardPreview({ examples }: { examples: PhotoExamplesSettings }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-card p-4 shadow-2xl">
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl">
        <img src={examples.photoshoot[0]?.src} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <span className="absolute left-4 top-4 rounded-full bg-[#EC4899] px-3 py-1 text-xs font-bold text-white">ХИТ ПРОДАЖ</span>
      </div>
      <div className="mt-4 flex items-end justify-between">
        <div>
          <div className="text-2xl font-bold text-white">3 990 ₽</div>
          <div className="text-sm text-muted-foreground">Куртка женская</div>
        </div>
        <div className="text-[#10B981] text-sm">4.9 ★★★★★</div>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2">
        {examples.reviewAfter.map((item) => <HeroImage key={item.src} src={item.src} className="aspect-square" />)}
        <div className="rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-sm text-white">+37</div>
      </div>
    </div>
  );
}

function HeroMetricBand() {
  return (
    <div className="mt-10 grid md:grid-cols-4 gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      {[
        ["12+ фото", "в каждой фотосессии"],
        ["≈60 сек", "среднее время кадра"],
        ["+35%", "к росту конверсии"],
        ["Без рисков", "можно править первый кадр"],
      ].map(([value, label]) => (
        <div key={value} className="rounded-2xl bg-black/20 p-4">
          <div className="text-2xl font-bold text-white">{value}</div>
          <div className="text-sm text-muted-foreground mt-1">{label}</div>
        </div>
      ))}
    </div>
  );
}

function HeroServiceCard({ service }: { service: ServiceDef }) {
  const copy = serviceCopy[service.key as keyof typeof serviceCopy];
  const Icon = copy.icon;

  return (
    <Link href={copy.href} className="group block">
      <article className="relative overflow-hidden rounded-3xl border border-white/10 bg-card min-h-[250px] transition-transform duration-300 group-hover:-translate-y-1">
        <div className="absolute inset-0 opacity-30" style={{ background: `linear-gradient(135deg, ${service.accentFrom}55, ${service.accentTo}22)` }} />
        {service.previewImageUrl ? (
          <img src={service.previewImageUrl} alt={service.title} className="absolute inset-y-0 right-0 h-full w-1/2 object-cover opacity-70" />
        ) : (
          <div className="absolute inset-y-0 right-0 w-1/2 flex items-center justify-center bg-white/[0.03]">
            <Icon size={72} className="text-white/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-card via-card/90 to-card/20" />
        <div className="relative p-6 md:p-7 max-w-[72%]">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white mb-5" style={{ background: `linear-gradient(135deg, ${service.accentFrom}, ${service.accentTo})` }}>
            <Icon size={22} />
          </div>
          <div className="text-sm font-semibold mb-2" style={{ color: service.accentTo }}>{copy.eyebrow}</div>
          <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight">{service.title}</h2>
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{service.shortDescription}</p>
          <div className="flex flex-wrap gap-2 mt-5">
            {copy.stats.map((stat) => (
              <span key={stat} className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/85">{stat}</span>
            ))}
          </div>
        </div>
      </article>
    </Link>
  );
}

function ServiceLandingCard({ service }: { service: ServiceDef }) {
  const copy = serviceCopy[service.key as keyof typeof serviceCopy];
  const Icon = copy.icon;

  return (
    <article id={service.key} className="rounded-3xl border border-white/10 bg-card overflow-hidden">
      <div className="relative min-h-[230px]">
        <div className="absolute inset-0 opacity-35" style={{ background: `linear-gradient(135deg, ${service.accentFrom}, ${service.accentTo})` }} />
        {service.previewImageUrl ? (
          <img src={service.previewImageUrl} alt={service.title} className="absolute inset-0 w-full h-full object-cover opacity-65" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-white/[0.03]">
            <Image size={80} className="text-white/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/55 to-transparent" />
        <div className="relative p-6 md:p-8 flex flex-col justify-end min-h-[230px]">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-black/25 px-3 py-1 text-sm text-white mb-4">
            <Icon size={15} /> {copy.eyebrow}
          </div>
          <h3 className="text-3xl md:text-4xl font-bold text-white tracking-tight">{copy.headline}</h3>
        </div>
      </div>
      <div className="p-6 md:p-8">
        <p className="text-muted-foreground leading-relaxed text-base md:text-lg">{copy.lead}</p>
        <div className="grid sm:grid-cols-3 gap-3 mt-6">
          <Metric value={`от ${Number(service.price).toFixed(0)} ₽`} label="стоимость" />
          <Metric value={service.photosMin === service.photosMax ? `${service.photosMin} фото` : `${service.photosMin}-${service.photosMax} фото`} label="исходники" />
          <Metric value={`~${service.generationTime}с`} label="генерация" />
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 mt-6">
          <p className="text-white font-medium">{copy.pain}</p>
          <p className="text-sm text-muted-foreground mt-2">{copy.result}</p>
        </div>
        <div className="space-y-3 mt-6">
          {copy.bullets.map((bullet) => (
            <div key={bullet} className="flex gap-3 text-sm text-muted-foreground">
              <CheckCircle2 size={18} className="text-[#10B981] shrink-0 mt-0.5" />
              <span>{bullet}</span>
            </div>
          ))}
        </div>
        <Button asChild size="lg" className="w-full h-13 mt-7 text-white border-0" style={{ background: `linear-gradient(135deg, ${service.accentFrom}, ${service.accentTo})` }}>
          <Link href={copy.href}>Перейти к заказу <ArrowRight size={18} className="ml-2" /></Link>
        </Button>
      </div>
    </article>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
