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

const fittingRoomExamples = [
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
];

export default function BusinessServices() {
  const [services, setServices] = useState<ServiceDef[]>(fallbackServices);

  useEffect(() => {
    fetch("/api/services")
      .then((r) => (r.ok ? r.json() : fallbackServices))
      .then((d: ServiceDef[]) => {
        const business = d.filter((s) => s.key === "wb-photoshoot" || s.key === "review");
        if (business.length > 0) setServices(business);
      })
      .catch(() => setServices(fallbackServices));
  }, []);

  const normalized = useMemo(() => {
    const byKey = new Map(services.map((s) => [s.key, s]));
    return fallbackServices.map((fallback) => ({ ...fallback, ...(byKey.get(fallback.key) ?? {}) }));
  }, [services]);

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-[#7C3AED]/30 selection:text-white">
      <Header />
      <main className="overflow-hidden">
        <section className="relative pt-28 md:pt-36 pb-14 md:pb-20">
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_18%_8%,rgba(124,58,237,0.2),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.16),transparent_30%)]" />
          <div className="container mx-auto px-4 md:px-6 relative">
            <div className="grid lg:grid-cols-[1.02fr_0.98fr] gap-10 lg:gap-14 items-center">
              <div>
                <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 text-[#67E8F9] px-4 py-1.5 rounded-full text-sm font-medium mb-5">
                  <Sparkles size={14} /> AI-фото для маркетплейсов
                </div>
                <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white leading-[1.04]">
                  Фото, которые помогают карточке продавать быстрее
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground mt-6 max-w-2xl leading-relaxed">
                  Две прикладные услуги для продавцов: каталожная WB-фотосессия и реалистичные фото для отзывов. Без студии, модели, логистики и недель ожидания.
                </p>
                <div className="grid sm:grid-cols-3 gap-3 mt-8 max-w-2xl">
                  {[
                    { icon: Clock3, label: "Результат за минуты" },
                    { icon: WalletCards, label: "Цена ниже съемки" },
                    { icon: ShieldCheck, label: "Оплата за генерацию" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-white">
                      <item.icon size={16} className="text-[#67E8F9] shrink-0" />
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row gap-3 mt-8">
                  <Button asChild size="lg" className="h-13 bg-gradient-primary text-white border-0 shadow-[0_0_22px_rgba(124,58,237,0.35)]">
                    <a href="#choose-service">Выбрать услугу <ArrowRight size={18} className="ml-2" /></a>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="h-13 border-white/15 text-white bg-white/[0.02]">
                    <a href="#how-it-works">Как это работает</a>
                  </Button>
                </div>
              </div>

              <div className="grid gap-4">
                {normalized.map((service) => (
                  <HeroServiceCard key={service.key} service={service} />
                ))}
              </div>
            </div>
          </div>
        </section>

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
                      src="/review-examples/fitting-room-before.png"
                      alt="Исходное фото в примерочной до генерации"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <div className="absolute left-4 top-4 rounded-full bg-black/65 px-3 py-1 text-xs font-semibold text-white">
                      До
                    </div>
                  </div>
                  <div className="p-5">
                    <h3 className="font-semibold text-white">Исходник продавца</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                      Обычное фото из кабинки примерочной становится базой для нескольких UGC-вариантов.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                {fittingRoomExamples.map((example, index) => (
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
