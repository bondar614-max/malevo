import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Upload, X, Sparkles, Loader2, MapPin, ImagePlus, Plus, Lock, Tag, User, Calendar, Layers, Minus, SlidersHorizontal, Maximize2, CheckCircle2, RotateCcw, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Camera, Snowflake, Flower2, Sun, Leaf, Sunrise, CloudSun, Sunset, Moon } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useAuthModal } from "@/components/auth/AuthModal";
import { PhotoCarousel } from "@/components/PhotoCarousel";
import { photoshootModels, type PhotoshootModel } from "@/data/photoshootModels";

interface ServiceDef {
  key: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
  previewImageUrl: string;
  price: number;
  photosMin: number;
  photosMax: number;
  generationTime: number;
  accentFrom: string;
  accentTo: string;
  badge: string;
}

interface LocationDef {
  id: string;
  name: string;
  previewImageUrl: string;
}

interface StatusResponse {
  orderId: string;
  status: "processing" | "success" | "failed" | string;
  resultPhotos?: string[];
  anchorPhotoUrl?: string;
  approvalMode?: "manual" | "automatic";
  revisionCount?: number;
  errorMessage?: string;
  refunded?: boolean;
}

const MAX_BYTES = 10 * 1024 * 1024;
type Phase = "idle" | "uploading" | "processing" | "approval" | "done" | "failed";
type PhotoshootType = "studio" | "street";
type PhotoshootSeason = "winter" | "spring" | "summer" | "autumn";
type PhotoshootTimeOfDay = "morning" | "day" | "evening" | "night";
type LocationCategory = "urban" | "industrial" | "recreational" | "natural";
type ProductPhotoKind = "front" | "side" | "back" | "texture" | "details";

const PRODUCT_PHOTO_SLOTS: Array<{ kind: ProductPhotoKind; label: string }> = [
  { kind: "front", label: "Спереди" },
  { kind: "side", label: "Сбоку" },
  { kind: "back", label: "Сзади" },
  { kind: "texture", label: "Текстура" },
  { kind: "details", label: "Детали" },
];

const PHOTOSHOOT_ATMOSPHERES: Record<PhotoshootSeason, Record<PhotoshootTimeOfDay, string[]>> = {
  winter: {
    morning: ["Голубовато-холодное солнце", "Туман или иней", "Слабый снегопад", "Ясное морозное небо", "Пар от дыхания, иней на деревьях"],
    day: ["Слепяще яркое солнце и белый снег", "Пасмурно и мягко рассеянно", "Снегопад с крупными хлопьями", "Вьюга или метель", "После снегопада — чистый свет и блеск"],
    evening: ["Холодный голубой час", "Туман при минусовой температуре", "Снег при свете фонарей", "Мерцающий иней", "Закат с морозным розовым оттенком"],
    night: ["Звёздное небо и хрустящий снег", "Свет луны на замерзшем пейзаже", "Метель в уличных фонарях", "Пар над рекой", "Снежное безмолвие"],
  },
  spring: {
    morning: ["Лёгкий туман", "Роса на растениях", "Мягкое рассеянное солнце", "Пасмурно с лёгким голубым светом", "После ночного дождя (влажный блеск, пар от земли)"],
    day: ["Чистое голубое небо", "Интервалы солнца и облаков", "Слабый дождь или морось", "Переменная облачность", "Радуга после дождя"],
    evening: ["Тёплое закатное солнце", "Контрастное золотое освещение", "Предгрозовые облака", "Солнечный дождь", "Спокойное безветрие"],
    night: ["Голубовато-холодная атмосфера", "Мокрый асфальт после дождя", "Редкие фонари в тумане", "Лунный свет сквозь облака", "Запах земли и дождя"],
  },
  summer: {
    morning: ["Мягкое золотое солнце через листву", "Роса и утренний туман над полем", "Яркое чистое небо", "Первый зной с длинными тенями", "Рассвет с акварельным горизонтом"],
    day: ["Палящее полуденное солнце", "Летняя гроза или дождь", "Лёгкие облака на синем небе", "Знойное марево", "Тень деревьев и пятна света"],
    evening: ["Золотой час — мягкий тёплый свет", "Сумерки с первыми звёздами", "Закат с огненным горизонтом", "Стрекозы и вечерний воздух", "Спокойная вечерняя тишина"],
    night: ["Звёздное небо без городских огней", "Тёплая июльская ночь", "Фейерверки", "Светлячки в темноте", "Тёплый бриз и лунная дорожка"],
  },
  autumn: {
    morning: ["Туман в долине, деревья в золоте", "Первые заморозки", "Роса на жёлтых листьях", "Тихий серый рассвет", "Осенний моросящий дождь"],
    day: ["Яркое осеннее солнце", "Пасмурно с рассеянным светом", "Листопад при ветре", "Серый дождливый день", "Туман в парке"],
    evening: ["Закат сквозь листву", "Тёплый янтарный час", "Сумерки и первые фонари", "Густой туман и фонари", "Морось при свете витрин"],
    night: ["Первые заморозки", "Отражения огней в воде", "Туман в ночных огнях", "Осенний дождь под фонарём", "Листья на мокром асфальте"],
  },
};

const PHOTOSHOOT_LOCATIONS: Record<LocationCategory, { label: string; options: string[] }> = {
  urban: {
    label: "Городские урбанистические",
    options: ["На городской набережной у реки", "Среди небоскрёбов", "На крыше здания с видом на город", "На мосту", "В арке или дворе-колодце", "На площади", "Уличный рынок"],
  },
  industrial: {
    label: "Индустриальные",
    options: ["В промышленной зоне", "У железной дороги", "На пустыре или в степи", "У старого кирпичного здания", "Заброшенный склад", "Старый заводской цех"],
  },
  recreational: {
    label: "Рекреационные",
    options: ["В городском парке", "На спортивной площадке", "Возле фонтана", "Около дорогого стильного кафе", "Велосипедная дорожка в парке", "Скамейка у пруда"],
  },
  natural: {
    label: "Природные",
    options: ["На лугу или в поле", "В горах", "У озера", "Песчаный пляж моря", "Лесная поляна", "Речной берег", "Скала у обрыва"],
  },
};
type ModelFilters = Pick<PhotoshootModel, "faceType" | "eyeColor" | "skinColor" | "bodyType" | "hairColor" | "hairLength" | "hairType">;

const EMPTY_MODEL_FILTERS: ModelFilters = {
  faceType: "",
  eyeColor: "",
  skinColor: "",
  bodyType: "",
  hairColor: "",
  hairLength: "",
  hairType: "",
};

const MODEL_FILTER_LABELS: Record<keyof ModelFilters, string> = {
  faceType: "Тип лица",
  eyeColor: "Цвет глаз",
  skinColor: "Цвет кожи",
  bodyType: "Телосложение",
  hairColor: "Цвет волос",
  hairLength: "Длина волос",
  hairType: "Тип волос",
};

function uniqueValues(key: keyof ModelFilters): string[] {
  return Array.from(new Set(photoshootModels.map((m) => m[key]).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ru"));
}

function normalizeImageUrl(url: string): string {
  const directMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (directMatch?.[1]) return `https://drive.google.com/uc?id=${directMatch[1]}&export=download`;
  return url;
}

function googleDriveDownloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?id=${encodeURIComponent(fileId)}&export=download`;
}

export default function Service() {
  const params = useParams<{ key: string }>();
  const key = params.key ?? "";
  const [, setLocation] = useLocation();
  const { user, token, refresh } = useAuth();
  const { open } = useAuthModal();

  const [service, setService] = useState<ServiceDef | null | undefined>(undefined);
  const [locations, setLocations] = useState<LocationDef[] | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [results, setResults] = useState<string[]>([]);
  const [anchorPhotoUrl, setAnchorPhotoUrl] = useState("");
  const [approvalComment, setApprovalComment] = useState("");
  const [revisionCount, setRevisionCount] = useState(0);
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);
  // Review-only inputs
  const [item, setItem] = useState("");
  const [gender, setGender] = useState<"female" | "male">("female");
  const [age, setAge] = useState<string | null>(null);
  const [sets, setSets] = useState(1);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [photoshootType, setPhotoshootType] = useState<PhotoshootType | null>(null);
  const [photoshootSeason, setPhotoshootSeason] = useState<PhotoshootSeason | null>(null);
  const [photoshootTimeOfDay, setPhotoshootTimeOfDay] = useState<PhotoshootTimeOfDay | null>(null);
  const [photoshootAtmosphere, setPhotoshootAtmosphere] = useState<string | null>(null);
  const [photoshootLocation, setPhotoshootLocation] = useState<string | null>(null);
  const [openLocationCategory, setOpenLocationCategory] = useState<LocationCategory>("urban");
  const [productName, setProductName] = useState("");
  const [productPhotos, setProductPhotos] = useState<Record<ProductPhotoKind, File | null>>({
    front: null,
    side: null,
    back: null,
    texture: null,
    details: null,
  });
  const [modelFilters, setModelFilters] = useState<ModelFilters>(EMPTY_MODEL_FILTERS);
  const [lightboxPhoto, setLightboxPhoto] = useState<{ model: PhotoshootModel; index: number } | null>(null);

  useEffect(() => {
    const resumeOrderId = new URLSearchParams(window.location.search).get("order");
    if (resumeOrderId && token) {
      setOrderId(resumeOrderId);
      setPhase("processing");
    }
  }, [token]);

  useEffect(() => {
    let cancel = false;
    fetch(`/api/services/${key}`).then(async (r) => {
      if (!cancel) {
        if (r.ok) setService((await r.json()) as ServiceDef);
        else setService(null);
      }
    }).catch(() => { if (!cancel) setService(null); });
    return () => { cancel = true; };
  }, [key]);

  useEffect(() => {
    if (!service || service.key !== "review") return;
    fetch(`/api/services/${service.key}/locations`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d: LocationDef[]) => setLocations(d))
      .catch(() => setLocations([]));
  }, [service]);

  useEffect(() => {
    if (phase !== "processing" || !orderId || !token) return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/generate/${orderId}/status`, { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) throw new Error(await r.text());
        const data = (await r.json()) as StatusResponse;
        if (stop) return;
        if (data.status === "success" && data.resultPhotos && data.resultPhotos.length > 0) {
          setResults(data.resultPhotos);
          setPhase("done");
          refresh().catch(() => undefined);
        } else if (data.status === "failed") {
          setError(data.errorMessage ?? "Генерация не удалась. Средства возвращены на баланс.");
          setPhase("failed");
          refresh().catch(() => undefined);
        } else if (data.status === "awaiting_approval" && data.anchorPhotoUrl) {
          setAnchorPhotoUrl(data.anchorPhotoUrl);
          setRevisionCount(data.revisionCount ?? 0);
          setError(data.errorMessage ?? null);
          setPhase("approval");
        }
      } catch (e) {
        if (!stop) console.warn("status poll failed", e);
      }
    };
    const interval = window.setInterval(tick, 3000);
    void tick();
    return () => { stop = true; window.clearInterval(interval); };
  }, [phase, orderId, token, refresh]);

  const isReview = service?.key === "review";
  const isPhotoshoot = service?.key === "wb-photoshoot";
  const requiresLocation = isReview;
  const max = service?.photosMax ?? 1;
  const min = service?.photosMin ?? 1;
  const canAddMore = photos.length < max;
  const selectedModel = useMemo(
    () => photoshootModels.find((m) => m.id === selectedModelId) ?? null,
    [selectedModelId],
  );
  const modelFilterOptions = useMemo(() => ({
    faceType: uniqueValues("faceType"),
    eyeColor: uniqueValues("eyeColor"),
    skinColor: uniqueValues("skinColor"),
    bodyType: uniqueValues("bodyType"),
    hairColor: uniqueValues("hairColor"),
    hairLength: uniqueValues("hairLength"),
    hairType: uniqueValues("hairType"),
  }), []);
  const filteredModels = useMemo(() => {
    return photoshootModels.filter((model) =>
      (Object.keys(modelFilters) as Array<keyof ModelFilters>).every((filterKey) => {
        const value = modelFilters[filterKey];
        return !value || model[filterKey] === value;
      }),
    );
  }, [modelFilters]);
  const activeFilterCount = Object.values(modelFilters).filter(Boolean).length;
  const photoshootSetupComplete =
    !!photoshootType &&
    (photoshootType === "studio" ||
      (!!photoshootSeason &&
        !!photoshootTimeOfDay &&
        !!photoshootAtmosphere &&
        !!photoshootLocation));
  const allProductPhotosReady = PRODUCT_PHOTO_SLOTS.every(({ kind }) => !!productPhotos[kind]);
  const ready =
    (isPhotoshoot
      ? !!selectedModel &&
        photoshootSetupComplete &&
        productName.trim().length > 0 &&
        allProductPhotosReady
      : photos.length >= min &&
        photos.length <= max) &&
    (!isReview ||
      (!!selectedLocationId &&
        item.trim().length > 0 &&
        gender === "female" &&
        !!age &&
        sets >= 1));
  const busy = phase === "uploading" || phase === "processing";

  function addFiles(files: File[]) {
    setError(null);
    const valid: File[] = [];
    for (const f of files) {
      if (f.size > MAX_BYTES) { setError(`«${f.name}» больше 10 МБ`); continue; }
      valid.push(f);
    }
    setPhotos((prev) => [...prev, ...valid].slice(0, max));
  }
  function removePhoto(i: number) {
    setPhotos((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function onGenerate() {
    setError(null);
    if (!user || !token) { open("register"); return; }
    if (!service) return;
    if (!ready) {
      if (isPhotoshoot && !selectedModel) {
        setError("Выберите модель для фотосессии");
      } else if (isPhotoshoot && !photoshootType) {
        setError("Выберите тип фотосессии");
      } else if (isPhotoshoot && photoshootType === "street" && !photoshootSeason) {
        setError("Выберите время года");
      } else if (isPhotoshoot && photoshootType === "street" && !photoshootTimeOfDay) {
        setError("Выберите время дня");
      } else if (isPhotoshoot && photoshootType === "street" && !photoshootAtmosphere) {
        setError("Выберите атмосферу");
      } else if (isPhotoshoot && photoshootType === "street" && !photoshootLocation) {
        setError("Выберите локацию");
      } else if (isPhotoshoot && !productName.trim()) {
        setError("Укажите название товара");
      } else if (isPhotoshoot && !allProductPhotosReady) {
        setError("Загрузите все 5 фотографий товара");
      } else if (photos.length < min || photos.length > max) {
        setError(min === max ? `Загрузите ${min} фото` : `Загрузите от ${min} до ${max} фото`);
      } else if (isReview && !item.trim()) {
        setError("Укажите название одежды");
      } else if (isReview && !selectedLocationId) {
        setError("Выберите локацию");
      } else if (isReview && !age) {
        setError("Выберите возраст");
      } else {
        setError("Заполните все поля формы");
      }
      return;
    }
    if (user.balance < service.price) {
      setError(`Недостаточно средств. Нужно ${service.price} ₽, на балансе ${user.balance.toFixed(2)} ₽`);
      return;
    }

    setPhase("uploading");
    const form = new FormData();
    form.append("serviceKey", service.key);
    if (selectedLocationId) form.append("locationId", selectedLocationId);
    if (isPhotoshoot && selectedModel) {
      form.append("modelId", selectedModel.id);
      form.append("modelPhotoUrls", JSON.stringify(selectedModel.drivePhotoIds.map(googleDriveDownloadUrl)));
      if (photoshootType) form.append("photoshootType", photoshootType);
      if (photoshootSeason) form.append("photoshootSeason", photoshootSeason);
      if (photoshootTimeOfDay) form.append("photoshootTimeOfDay", photoshootTimeOfDay);
      if (photoshootAtmosphere) form.append("photoshootAtmosphere", photoshootAtmosphere);
      if (photoshootLocation) form.append("photoshootLocation", photoshootLocation);
      form.append("productName", productName.trim());
      PRODUCT_PHOTO_SLOTS.forEach(({ kind }) => {
        const file = productPhotos[kind];
        if (file) form.append("photos", file, `${kind}-${file.name}`);
      });
    }
    if (isReview) {
      form.append("item", item.trim());
      form.append("gender", gender);
      form.append("age", age ?? "random");
      form.append("sets", String(sets));
    }
    photos.forEach((f) => form.append("photos", f, f.name));

    try {
      const res = await fetch("/api/generate/service", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = (await res.json()) as { orderId?: string; error?: string };
      if (!res.ok || !data.orderId) throw new Error(data.error ?? `Ошибка ${res.status}`);
      setOrderId(data.orderId);
      setPhase("processing");
      refresh().catch(() => undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось запустить генерацию");
      setPhase("idle");
    }
  }

  async function approveAnchor() {
    if (!orderId || !token) return;
    setApprovalSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/generate/${orderId}/photoshoot/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Не удалось подтвердить кадр");
      setPhase("processing");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось подтвердить кадр");
    } finally {
      setApprovalSubmitting(false);
    }
  }

  async function reviseAnchor() {
    if (!orderId || !token || approvalComment.trim().length < 3) return;
    setApprovalSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/generate/${orderId}/photoshoot/revise`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ comment: approvalComment.trim() }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Не удалось отправить правки");
      setApprovalComment("");
      setPhase("processing");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось отправить правки");
    } finally {
      setApprovalSubmitting(false);
    }
  }

  function reset() {
    setPhase("idle");
    setOrderId(null);
    setResults([]);
    setAnchorPhotoUrl("");
    setApprovalComment("");
    setRevisionCount(0);
    setApprovalSubmitting(false);
    setError(null);
    setPhotos([]);
    setItem("");
    setAge(null);
    setSets(1);
    setSelectedLocationId(null);
    setSelectedModelId(null);
    setPhotoshootType(null);
    setPhotoshootSeason(null);
    setPhotoshootTimeOfDay(null);
    setPhotoshootAtmosphere(null);
    setPhotoshootLocation(null);
    setOpenLocationCategory("urban");
    setProductName("");
    setProductPhotos({ front: null, side: null, back: null, texture: null, details: null });
    setModelFilters(EMPTY_MODEL_FILTERS);
    setLightboxPhoto(null);
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      <main className="flex-1 pt-28 pb-20 px-4 relative overflow-hidden">
        <div
          className="absolute top-1/3 left-1/4 w-[600px] h-[600px] rounded-full mix-blend-screen filter blur-[150px] opacity-10 pointer-events-none"
          style={{ backgroundColor: service?.accentFrom ?? "#7C3AED" }}
        />
        <div
          className="absolute top-1/3 right-1/4 w-[600px] h-[600px] rounded-full mix-blend-screen filter blur-[150px] opacity-10 pointer-events-none"
          style={{ backgroundColor: service?.accentTo ?? "#EC4899" }}
        />
        <div className={`container mx-auto relative z-10 ${isPhotoshoot ? "max-w-7xl" : "max-w-5xl"}`}>
          {service === undefined ? (
            <div className="bg-card border border-border p-8 rounded-3xl">
              <Skeleton className="h-10 w-1/2 bg-white/5 mb-4" />
              <Skeleton className="h-4 w-full bg-white/5 mb-2" />
              <Skeleton className="h-4 w-3/4 bg-white/5" />
            </div>
          ) : service === null ? (
            <div className="bg-card border border-border p-12 rounded-3xl text-center">
              <div className="w-20 h-20 bg-destructive/20 text-destructive rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">⚠️</div>
              <h1 className="text-3xl font-bold text-white mb-4">Услуга не найдена</h1>
              <Link href="/"><Button className="bg-gradient-primary text-white border-0">На главную</Button></Link>
            </div>
          ) : phase === "done" ? (
            <ResultView results={results} service={service} onReset={reset} />
          ) : phase === "approval" ? (
            <AnchorApprovalView
              anchorPhotoUrl={anchorPhotoUrl}
              comment={approvalComment}
              revisionCount={revisionCount}
              submitting={approvalSubmitting}
              error={error}
              onCommentChange={setApprovalComment}
              onApprove={() => void approveAnchor()}
              onRevise={() => void reviseAnchor()}
            />
          ) : phase === "processing" ? (
            <ProcessingView service={service} />
          ) : (
            <div className="space-y-6">
              {/* Header */}
              <div className="bg-card border border-border rounded-3xl p-6 md:p-8 relative overflow-hidden">
                <div
                  className="absolute inset-0 opacity-20 pointer-events-none"
                  style={{ background: `radial-gradient(circle at 0% 0%, ${service.accentFrom}, transparent 60%)` }}
                />
                <div className="relative flex flex-col md:flex-row gap-6 items-start">
                  {service.previewImageUrl && (
                    <div className="w-full md:w-48 aspect-square rounded-2xl overflow-hidden flex-shrink-0 bg-secondary">
                      <img src={service.previewImageUrl} alt={service.title} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1">
                    {service.badge && (
                      <span
                        className="inline-block text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border mb-3"
                        style={{ color: service.accentTo, borderColor: `${service.accentTo}66`, background: `${service.accentTo}15` }}
                      >
                        {service.badge}
                      </span>
                    )}
                    <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{service.title}</h1>
                    <p className="text-muted-foreground">{service.fullDescription || service.shortDescription}</p>
                    <div className="flex flex-wrap gap-4 mt-4 text-sm">
                      <div><span className="text-muted-foreground">Стоимость:</span> <span className="text-white font-bold">{service.price} ₽</span></div>
                      <div><span className="text-muted-foreground">Фото:</span> <span className="text-white font-bold">{isPhotoshoot ? "2 фото модели" : service.photosMin === service.photosMax ? service.photosMin : `${service.photosMin}–${service.photosMax}`}</span></div>
                      <div><span className="text-muted-foreground">Время:</span> <span className="text-white font-bold">~{service.generationTime}с</span></div>
                    </div>
                  </div>
                </div>
              </div>

              {isPhotoshoot ? (
                <PhotoshootCatalog
                  busy={busy}
                  filters={modelFilters}
                  filterOptions={modelFilterOptions}
                  activeFilterCount={activeFilterCount}
                  models={filteredModels}
                  selectedModelId={selectedModelId}
                  accentFrom={service.accentFrom}
                  accentTo={service.accentTo}
                  onFilterChange={(filterKey, value) => setModelFilters((prev) => ({ ...prev, [filterKey]: value }))}
                  onResetFilters={() => setModelFilters(EMPTY_MODEL_FILTERS)}
                  onSelectModel={setSelectedModelId}
                  onOpenPhoto={(model, index) => setLightboxPhoto({ model, index })}
                />
              ) : (
                <div className="bg-card border border-border rounded-3xl p-6 md:p-8 space-y-5">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <Upload className="w-5 h-5" style={{ color: service.accentFrom }} /> Загрузите фото
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {service.photosMin === service.photosMax
                        ? `Нужно ${service.photosMin} фото`
                        : `От ${service.photosMin} до ${service.photosMax} фото`}, JPG/PNG/WebP, до 10 МБ каждое.
                    </p>
                  </div>

                  <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                    {photos.map((f, i) => (
                      <PhotoTile key={`${f.name}-${i}`} file={f} onRemove={() => removePhoto(i)} disabled={busy} />
                    ))}
                    {canAddMore && <AddPhotoButton onChange={(files) => addFiles(files)} disabled={busy} />}
                  </div>

                  {isReview && (
                    <div className="pt-2 border-t border-border">
                      <label htmlFor="review-item" className="text-sm font-semibold text-white flex items-center gap-2">
                        <Tag className="w-4 h-4" style={{ color: service.accentTo }} /> Название одежды
                      </label>
                      <p className="text-xs text-muted-foreground mt-1 mb-2">Например: «Чёрное платье миди» или «Джинсовая куртка оверсайз».</p>
                      <input
                        id="review-item"
                        type="text"
                        value={item}
                        maxLength={255}
                        disabled={busy}
                        onChange={(e) => setItem(e.target.value)}
                        placeholder="Введите название одежды"
                        className="w-full rounded-xl bg-secondary border border-border px-4 py-3 text-white placeholder:text-muted-foreground focus:outline-none focus:border-[#7C3AED] disabled:opacity-50"
                      />
                    </div>
                  )}
                </div>
              )}

              {isPhotoshoot && selectedModel && (
                <div className="bg-card border border-border rounded-3xl p-6 md:p-8 space-y-5">
                  <div>
                    <h2 className="text-xl font-bold text-white uppercase tracking-wide">Тип фотосессии</h2>
                    <p className="text-sm text-muted-foreground mt-1">Выберите, в какой обстановке должна проходить фотосессия.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setPhotoshootType("studio");
                        setPhotoshootSeason(null);
                        setPhotoshootTimeOfDay(null);
                        setPhotoshootAtmosphere(null);
                        setPhotoshootLocation(null);
                      }}
                      className={`h-20 rounded-2xl border-2 px-5 flex items-center gap-4 text-left transition-all disabled:opacity-50 ${
                        photoshootType === "studio"
                          ? "border-[#7C3AED] bg-[#7C3AED]/10 text-white shadow-[0_0_20px_rgba(124,58,237,0.25)]"
                          : "border-border text-white hover:border-[#7C3AED]/50"
                      }`}
                    >
                      <Camera className="w-7 h-7 flex-shrink-0 text-muted-foreground" />
                      <span className="text-lg md:text-xl font-medium">Студийная фотосессия</span>
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setPhotoshootType("street")}
                      className={`h-20 rounded-2xl border-2 px-5 flex items-center gap-4 text-left transition-all disabled:opacity-50 ${
                        photoshootType === "street"
                          ? "border-[#7C3AED] bg-[#7C3AED]/10 text-white shadow-[0_0_20px_rgba(124,58,237,0.25)]"
                          : "border-border text-white hover:border-[#7C3AED]/50"
                      }`}
                    >
                      <MapPin className="w-7 h-7 flex-shrink-0 text-muted-foreground" />
                      <span className="text-lg md:text-xl font-medium">Уличная фотосессия</span>
                    </button>
                  </div>
                </div>
              )}

              {isPhotoshoot && selectedModel && photoshootType === "street" && (
                <div className="bg-card border border-border rounded-3xl p-6 md:p-8 space-y-5">
                  <div>
                    <h2 className="text-xl font-bold text-white uppercase tracking-wide">Время года</h2>
                    <p className="text-sm text-muted-foreground mt-1">Выберите сезон для уличной фотосессии.</p>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { value: "winter" as const, label: "Зима", Icon: Snowflake },
                      { value: "spring" as const, label: "Весна", Icon: Flower2 },
                      { value: "summer" as const, label: "Лето", Icon: Sun },
                      { value: "autumn" as const, label: "Осень", Icon: Leaf },
                    ].map(({ value, label, Icon }) => {
                      const selected = photoshootSeason === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setPhotoshootSeason(value);
                            setPhotoshootTimeOfDay(null);
                            setPhotoshootAtmosphere(null);
                            setPhotoshootLocation(null);
                          }}
                          className={`h-20 rounded-2xl border-2 px-5 flex items-center justify-center md:justify-start gap-4 text-left transition-all disabled:opacity-50 ${
                            selected
                              ? "border-[#7C3AED] bg-[#7C3AED]/10 text-white shadow-[0_0_20px_rgba(124,58,237,0.25)]"
                              : "border-border text-white hover:border-[#7C3AED]/50"
                          }`}
                        >
                          <Icon className="w-7 h-7 flex-shrink-0 text-muted-foreground" />
                          <span className="text-lg md:text-xl font-medium">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {isPhotoshoot && selectedModel && photoshootType === "street" && photoshootSeason && (
                <div className="bg-card border border-border rounded-3xl p-6 md:p-8 space-y-5">
                  <div>
                    <h2 className="text-xl font-bold text-white uppercase tracking-wide">Время дня</h2>
                    <p className="text-sm text-muted-foreground mt-1">Выберите освещение для уличной фотосессии.</p>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { value: "morning" as const, label: "Утро", Icon: Sunrise },
                      { value: "day" as const, label: "День", Icon: CloudSun },
                      { value: "evening" as const, label: "Вечер", Icon: Sunset },
                      { value: "night" as const, label: "Ночь", Icon: Moon },
                    ].map(({ value, label, Icon }) => {
                      const selected = photoshootTimeOfDay === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setPhotoshootTimeOfDay(value);
                            setPhotoshootAtmosphere(null);
                            setPhotoshootLocation(null);
                          }}
                          className={`relative h-20 rounded-2xl border-2 px-5 flex items-center justify-center md:justify-start gap-4 text-left transition-all disabled:opacity-50 ${
                            selected
                              ? "border-[#7C3AED] bg-[#7C3AED]/10 text-white shadow-[0_0_20px_rgba(124,58,237,0.25)]"
                              : "border-border text-white hover:border-[#7C3AED]/50"
                          }`}
                        >
                          <Icon className="w-7 h-7 flex-shrink-0 text-muted-foreground" />
                          <span className="text-lg md:text-xl font-medium">{label}</span>
                          {selected && (
                            <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-[#7C3AED] text-white flex items-center justify-center">
                              <CheckCircle2 size={17} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {isPhotoshoot && selectedModel && photoshootType === "street" && photoshootSeason && photoshootTimeOfDay && (
                <div className="bg-card border border-border rounded-3xl p-6 md:p-8 space-y-5">
                  <div>
                    <h2 className="text-xl font-bold text-white uppercase tracking-wide">Атмосфера (погода)</h2>
                    <p className="text-sm text-muted-foreground mt-1">Выберите характер погоды и освещения для сцены.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {PHOTOSHOOT_ATMOSPHERES[photoshootSeason][photoshootTimeOfDay].map((atmosphere) => {
                      const selected = photoshootAtmosphere === atmosphere;
                      return (
                        <button
                          key={atmosphere}
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setPhotoshootAtmosphere(atmosphere);
                            setPhotoshootLocation(null);
                          }}
                          className={`min-h-16 rounded-2xl border-2 px-4 py-3 flex items-center justify-between gap-3 text-left transition-all disabled:opacity-50 ${
                            selected
                              ? "border-[#7C3AED] bg-[#7C3AED]/10 text-white shadow-[0_0_20px_rgba(124,58,237,0.25)]"
                              : "border-border text-white hover:border-[#7C3AED]/50"
                          }`}
                        >
                          <span className="text-sm md:text-base font-medium">{atmosphere}</span>
                          {selected && <CheckCircle2 className="w-5 h-5 text-[#7C3AED] flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {isPhotoshoot && selectedModel && photoshootType === "street" && photoshootAtmosphere && (
                <div className="bg-card border border-border rounded-3xl p-6 md:p-8 space-y-5">
                  <div>
                    <h2 className="text-xl font-bold text-white uppercase tracking-wide">Локация</h2>
                    <p className="text-sm text-muted-foreground mt-1">Выберите категорию, затем конкретное место для съёмки.</p>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {(Object.keys(PHOTOSHOOT_LOCATIONS) as LocationCategory[]).map((category) => {
                      const active = openLocationCategory === category;
                      return (
                        <button
                          key={category}
                          type="button"
                          disabled={busy}
                          onClick={() => setOpenLocationCategory(category)}
                          className={`min-h-14 rounded-xl border-2 px-3 py-2 text-sm font-medium transition-all disabled:opacity-50 ${
                            active
                              ? "border-[#7C3AED] bg-[#7C3AED]/10 text-white"
                              : "border-border text-muted-foreground hover:border-[#7C3AED]/50 hover:text-white"
                          }`}
                        >
                          {PHOTOSHOOT_LOCATIONS[category].label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 pt-1">
                    {PHOTOSHOOT_LOCATIONS[openLocationCategory].options.map((location) => {
                      const selected = photoshootLocation === location;
                      return (
                        <button
                          key={location}
                          type="button"
                          disabled={busy}
                          onClick={() => setPhotoshootLocation(location)}
                          className={`min-h-14 rounded-xl border-2 px-4 py-3 flex items-center justify-between gap-3 text-left transition-all disabled:opacity-50 ${
                            selected
                              ? "border-[#7C3AED] bg-[#7C3AED]/10 text-white shadow-[0_0_20px_rgba(124,58,237,0.25)]"
                              : "border-border text-white hover:border-[#7C3AED]/50"
                          }`}
                        >
                          <span className="text-sm md:text-base">{location}</span>
                          {selected && <CheckCircle2 className="w-5 h-5 text-[#7C3AED] flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {isPhotoshoot && selectedModel && photoshootSetupComplete && (
                <>
                  <div className="bg-card border border-border rounded-3xl p-6 md:p-8 space-y-4">
                    <div>
                      <h2 className="text-xl font-bold text-white uppercase tracking-wide">Название товара</h2>
                      <p className="text-sm text-muted-foreground mt-1">Укажите товар, для которого будет создана фотосессия.</p>
                    </div>
                    <input
                      type="text"
                      value={productName}
                      maxLength={255}
                      disabled={busy}
                      onChange={(e) => setProductName(e.target.value)}
                      placeholder="Например: женское платье миди"
                      className="w-full h-12 rounded-xl bg-secondary border border-border px-4 text-white placeholder:text-muted-foreground focus:outline-none focus:border-[#7C3AED] disabled:opacity-50"
                    />
                  </div>

                  <div className="bg-card border border-border rounded-3xl p-6 md:p-8 space-y-5">
                    <div>
                      <h2 className="text-xl font-bold text-white uppercase tracking-wide">Фотографии товара</h2>
                      <p className="text-sm text-muted-foreground mt-1">Загрузите все 5 обязательных ракурсов товара, JPG/PNG/WebP до 10 МБ.</p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
                      {PRODUCT_PHOTO_SLOTS.map((slot) => (
                        <ProductPhotoSlot
                          key={slot.kind}
                          label={slot.label}
                          file={productPhotos[slot.kind]}
                          disabled={busy}
                          onChange={(file) => {
                            setError(null);
                            if (file && file.size > MAX_BYTES) {
                              setError(`«${file.name}» больше 10 МБ`);
                              return;
                            }
                            setProductPhotos((current) => ({ ...current, [slot.kind]: file }));
                          }}
                        />
                      ))}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Загружено: <span className="text-white font-semibold">{PRODUCT_PHOTO_SLOTS.filter(({ kind }) => productPhotos[kind]).length} из 5</span>
                    </div>
                  </div>
                </>
              )}

              {/* Gender (review) */}
              {isReview && (
                <div className="bg-card border border-border rounded-3xl p-6 md:p-8 space-y-4">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <User className="w-5 h-5" style={{ color: service.accentFrom }} /> Пол
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setGender("female")}
                      disabled={busy}
                      className={`rounded-xl border-2 py-4 font-semibold transition-all ${
                        gender === "female"
                          ? "border-[#7C3AED] bg-[#7C3AED]/10 text-white shadow-[0_0_20px_rgba(124,58,237,0.3)]"
                          : "border-border text-muted-foreground hover:border-[#7C3AED]/50"
                      }`}
                    >
                      Женский
                    </button>
                    <button
                      type="button"
                      disabled
                      title="Скоро"
                      className="rounded-xl border-2 border-border py-4 font-semibold text-muted-foreground/60 bg-secondary/30 cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Lock size={16} /> Мужской
                    </button>
                  </div>
                </div>
              )}

              {/* Age (review) */}
              {isReview && (
                <div className="bg-card border border-border rounded-3xl p-6 md:p-8 space-y-4">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5" style={{ color: service.accentTo }} /> Выберите возраст
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { value: "21-30", label: "21–30" },
                      { value: "30-45", label: "30–45" },
                      { value: "45+", label: "45+" },
                      { value: "random", label: "Случайный возраст" },
                    ].map((opt) => {
                      const selected = age === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setAge(opt.value)}
                          disabled={busy}
                          className={`rounded-xl border-2 py-4 px-2 text-sm font-semibold transition-all ${
                            selected
                              ? "border-[#7C3AED] bg-[#7C3AED]/10 text-white shadow-[0_0_20px_rgba(124,58,237,0.3)]"
                              : "border-border text-muted-foreground hover:border-[#7C3AED]/50"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Locations for review */}
              {requiresLocation && (
                <div className="bg-card border border-border rounded-3xl p-6 md:p-8 space-y-5">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <MapPin className="w-5 h-5" style={{ color: service.accentTo }} /> Выберите локацию
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">Где должно быть «снято» отзывное фото.</p>
                  </div>
                  {!locations ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-xl bg-white/5" />)}
                    </div>
                  ) : locations.length === 0 ? (
                    <div className="text-sm text-muted-foreground bg-secondary rounded-xl p-4 border border-border">
                      Локации пока не добавлены. Свяжитесь с поддержкой.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {locations.map((l) => {
                        const selected = selectedLocationId === l.id;
                        return (
                          <button
                            key={l.id}
                            type="button"
                            disabled={busy}
                            onClick={() => setSelectedLocationId(l.id)}
                            className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                              selected
                                ? "border-[#7C3AED] shadow-[0_0_20px_rgba(124,58,237,0.4)] scale-[1.02]"
                                : "border-border hover:border-[#7C3AED]/50"
                            }`}
                          >
                            {l.previewImageUrl ? (
                              <img src={l.previewImageUrl} alt={l.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-secondary flex items-center justify-center text-muted-foreground">
                                <MapPin size={28} />
                              </div>
                            )}
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2 text-left">
                              <div className="text-white text-sm font-semibold truncate">{l.name}</div>
                            </div>
                            {selected && (
                              <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#7C3AED] flex items-center justify-center text-white text-xs">✓</div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Sets (review) */}
              {isReview && (
                <div className="bg-card border border-border rounded-3xl p-6 md:p-8 space-y-4">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <Layers className="w-5 h-5" style={{ color: service.accentFrom }} /> Количество комплектов
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">1 комплект = 3 фото. Максимум 10 комплектов.</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center rounded-xl border border-border bg-secondary overflow-hidden">
                      <button
                        type="button"
                        disabled={busy || sets <= 1}
                        onClick={() => setSets((s) => Math.max(1, s - 1))}
                        className="px-4 py-3 text-white hover:bg-white/5 disabled:opacity-30"
                        aria-label="Меньше"
                      >
                        <Minus size={18} />
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={sets}
                        disabled={busy}
                        onChange={(e) => {
                          const n = Math.floor(Number(e.target.value));
                          setSets(Number.isFinite(n) ? Math.min(10, Math.max(1, n)) : 1);
                        }}
                        className="w-16 text-center bg-transparent text-white text-lg font-bold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button
                        type="button"
                        disabled={busy || sets >= 10}
                        onClick={() => setSets((s) => Math.min(10, s + 1))}
                        className="px-4 py-3 text-white hover:bg-white/5 disabled:opacity-30"
                        aria-label="Больше"
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Итого: <span className="text-white font-semibold">{sets * 3} фото</span>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="text-sm bg-destructive/10 border border-destructive/30 text-white rounded-lg p-4">{error}</div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  size="lg"
                  onClick={onGenerate}
                  disabled={!ready || busy}
                  className="flex-1 h-14 text-white border-0 hover:opacity-90 font-semibold text-base disabled:opacity-40"
                  style={{ background: `linear-gradient(135deg, ${service.accentFrom}, ${service.accentTo})` }}
                >
                  {phase === "uploading" ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Загружаем фото…</>
                  ) : isPhotoshoot ? (
                    <><CheckCircle2 className="w-5 h-5 mr-2" />{
                      selectedModel && !photoshootType
                        ? "Выберите тип фотосессии"
                        : photoshootType === "street" && !photoshootSeason
                          ? "Выберите время года"
                        : photoshootType === "street" && !photoshootTimeOfDay
                          ? "Выберите время дня"
                        : photoshootType === "street" && !photoshootAtmosphere
                          ? "Выберите атмосферу"
                        : photoshootType === "street" && !photoshootLocation
                          ? "Выберите локацию"
                        : !productName.trim()
                          ? "Укажите название товара"
                        : !allProductPhotosReady
                          ? "Загрузите 5 фотографий товара"
                        : user
                          ? `Запустить фотосессию за ${service.price} ₽`
                          : "Войти и запустить фотосессию"
                    }</>
                  ) : (
                    <><Sparkles className="w-5 h-5 mr-2" />{user ? `Сгенерировать за ${service.price} ₽` : "Войти и сгенерировать"}</>
                  )}
                </Button>
                <Button size="lg" variant="outline" onClick={() => setLocation("/")} className="h-14 border-border text-white" disabled={busy}>
                  Назад
                </Button>
              </div>
              {user && (
                <div className="text-xs text-muted-foreground text-center">
                  Баланс: <span className="text-white font-semibold">{user.balance.toFixed(2)} ₽</span>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      {lightboxPhoto && (
        <ModelPhotoLightbox
          model={lightboxPhoto.model}
          index={lightboxPhoto.index}
          onIndexChange={(index) => setLightboxPhoto((prev) => prev ? { ...prev, index } : prev)}
          onClose={() => setLightboxPhoto(null)}
        />
      )}
      <Footer />
    </div>
  );
}

function PhotoshootCatalog({
  busy,
  filters,
  filterOptions,
  activeFilterCount,
  models,
  selectedModelId,
  accentFrom,
  accentTo,
  onFilterChange,
  onResetFilters,
  onSelectModel,
  onOpenPhoto,
}: {
  busy: boolean;
  filters: ModelFilters;
  filterOptions: Record<keyof ModelFilters, string[]>;
  activeFilterCount: number;
  models: PhotoshootModel[];
  selectedModelId: string | null;
  accentFrom: string;
  accentTo: string;
  onFilterChange: (filterKey: keyof ModelFilters, value: string) => void;
  onResetFilters: () => void;
  onSelectModel: (id: string) => void;
  onOpenPhoto: (model: PhotoshootModel, index: number) => void;
}) {
  return (
    <div className="bg-card border border-border rounded-3xl p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5" style={{ color: accentFrom }} /> Каталог моделей
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Выберите модель для фотосессии. В карточке доступны 2 фото для просмотра.
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          Найдено: <span className="text-white font-semibold">{models.length}</span> из {photoshootModels.length}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {(Object.keys(filters) as Array<keyof ModelFilters>).map((filterKey) => (
          <label key={filterKey} className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">{MODEL_FILTER_LABELS[filterKey]}</span>
            <select
              value={filters[filterKey]}
              disabled={busy}
              onChange={(e) => onFilterChange(filterKey, e.target.value)}
              className="w-full h-11 rounded-xl bg-secondary border border-border px-3 text-sm text-white focus:outline-none focus:border-[#7C3AED] disabled:opacity-50"
            >
              <option value="">Все</option>
              {filterOptions[filterKey].map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
        ))}
      </div>

      {activeFilterCount > 0 && (
        <Button type="button" variant="outline" onClick={onResetFilters} disabled={busy} className="border-border text-white">
          <RotateCcw className="w-4 h-4 mr-2" /> Сбросить фильтры
        </Button>
      )}

      {models.length === 0 ? (
        <div className="rounded-xl border border-border bg-secondary/40 p-6 text-sm text-muted-foreground">
          По выбранным параметрам моделей не найдено.
        </div>
      ) : (
        <div className="max-h-[1400px] lg:max-h-[1550px] xl:max-h-[1290px] overflow-y-auto overscroll-contain pr-2 [scrollbar-color:#7C3AED_transparent] [scrollbar-width:thin]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-stretch">
            {models.map((model) => (
              <ModelCard
                key={model.id}
                model={model}
                selected={selectedModelId === model.id}
                busy={busy}
                accentTo={accentTo}
                onSelect={() => onSelectModel(model.id)}
                onOpenPhoto={onOpenPhoto}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ModelCard({
  model,
  selected,
  busy,
  accentTo,
  onSelect,
  onOpenPhoto,
}: {
  model: PhotoshootModel;
  selected: boolean;
  busy: boolean;
  accentTo: string;
  onSelect: () => void;
  onOpenPhoto: (model: PhotoshootModel, index: number) => void;
}) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const tags = [model.faceType, model.bodyType, model.skinColor, model.eyeColor, model.hairColor, model.hairLength, model.hairType];
  const previousPhoto = () => setPhotoIndex((current) => (current - 1 + model.photos.length) % model.photos.length);
  const nextPhoto = () => setPhotoIndex((current) => (current + 1) % model.photos.length);

  return (
    <div className={`h-full rounded-2xl border bg-secondary/30 overflow-hidden transition-all flex flex-col ${selected ? "border-[#7C3AED] shadow-[0_0_24px_rgba(124,58,237,0.35)]" : "border-border hover:border-[#7C3AED]/50"}`}>
      <div className="relative p-1.5">
        <button
          type="button"
          onClick={() => onOpenPhoto(model, photoIndex)}
          className="relative block w-full aspect-[3/4] overflow-hidden rounded-xl bg-background group focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
          aria-label={`Открыть фото модели ${model.id}, фото ${photoIndex + 1}`}
        >
          <RemoteModelImage
            src={normalizeImageUrl(model.photos[photoIndex])}
            alt={`Модель ${model.id}, фото ${photoIndex + 1}`}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <span className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Maximize2 size={16} />
          </span>
        </button>
        {model.photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={previousPhoto}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/65 text-white flex items-center justify-center hover:bg-black/85"
              aria-label="Предыдущее фото"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={nextPhoto}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/65 text-white flex items-center justify-center hover:bg-black/85"
              aria-label="Следующее фото"
            >
              <ChevronRight size={20} />
            </button>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/65 px-2.5 py-1 text-xs font-medium text-white">
              {photoIndex + 1} / {model.photos.length}
            </div>
          </>
        )}
      </div>
      <div className="p-4 pt-3 flex flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 min-h-8">
          <div className="text-white font-semibold">Модель #{model.id}</div>
          {selected && (
            <div className="w-8 h-8 rounded-full bg-[#7C3AED] text-white flex items-center justify-center flex-shrink-0">
              <CheckCircle2 size={18} />
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setDetailsOpen((open) => !open)}
          className="mt-3 h-10 w-full rounded-xl border border-border bg-background/40 px-3 text-sm text-muted-foreground flex items-center justify-between hover:border-[#7C3AED]/50 hover:text-white"
          aria-expanded={detailsOpen}
        >
          <span>Параметры модели</span>
          {detailsOpen ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
        </button>

        {detailsOpen && (
          <div className="flex flex-wrap gap-1.5 pt-3">
            {tags.map((tag) => (
              <span key={tag} className="rounded-full border border-border bg-background/60 px-2.5 py-1 text-xs text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto pt-4">
          <button
            type="button"
            disabled={busy}
            onClick={onSelect}
            className={`w-full h-11 rounded-xl text-sm font-medium text-white transition-opacity disabled:opacity-50 ${selected ? "bg-[#7C3AED]" : ""}`}
            style={selected ? undefined : { background: accentTo }}
          >
            {selected ? "Выбрана" : "Выбрать"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModelPhotoLightbox({
  model,
  index,
  onIndexChange,
  onClose,
}: {
  model: PhotoshootModel;
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col p-4 md:p-8" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="text-white font-semibold">Модель #{model.id}</div>
        <button type="button" onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20" aria-label="Закрыть">
          <X size={20} />
        </button>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <RemoteModelImage src={normalizeImageUrl(model.photos[index])} alt={`Модель ${model.id}, фото ${index + 1}`} className="max-w-full max-h-full object-contain rounded-2xl" fallbackClassName="w-full max-w-md aspect-[3/4] rounded-2xl" />
      </div>
      <div className="flex justify-center gap-3 mt-4">
        {model.photos.map((photo, photoIndex) => (
          <button
            key={photo}
            type="button"
            onClick={() => onIndexChange(photoIndex)}
            className={`w-20 aspect-[3/4] rounded-xl overflow-hidden border-2 ${index === photoIndex ? "border-[#7C3AED]" : "border-white/20"}`}
            aria-label={`Показать фото ${photoIndex + 1}`}
          >
            <RemoteModelImage src={normalizeImageUrl(photo)} alt="" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}

function RemoteModelImage({
  src,
  alt,
  className,
  fallbackClassName,
}: {
  src: string;
  alt: string;
  className: string;
  fallbackClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (failed) {
    return (
      <div className={`${fallbackClassName ?? className} bg-background border border-border flex flex-col items-center justify-center gap-2 text-muted-foreground text-xs text-center p-3`}>
        <ImagePlus size={22} />
        <span>Фото недоступно</span>
      </div>
    );
  }
  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />;
}

function ProductPhotoSlot({
  label,
  file,
  disabled,
  onChange,
}: {
  label: string;
  file: File | null;
  disabled: boolean;
  onChange: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState("");

  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="min-w-0">
      <div className="mb-2">
        <div className="text-sm font-semibold text-white">{label}</div>
      </div>
      <div className="relative aspect-[3/4] rounded-xl border border-border bg-secondary/40 overflow-hidden">
        {preview ? (
          <img src={preview} alt={`${label} товара`} className="w-full h-full object-cover" />
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-white hover:bg-white/5 disabled:opacity-50"
          >
            <ImagePlus size={28} />
            <span className="text-xs font-medium">Загрузить</span>
          </button>
        )}
        {preview && !disabled && (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="absolute inset-x-2 bottom-2 h-9 rounded-lg bg-black/70 text-xs font-medium text-white hover:bg-black/85"
            >
              Заменить
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-red-500/80"
              aria-label={`Удалить фото: ${label}`}
            >
              <X size={15} />
            </button>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            const nextFile = e.target.files?.[0] ?? null;
            e.target.value = "";
            if (nextFile) onChange(nextFile);
          }}
        />
      </div>
    </div>
  );
}

function PhotoTile({ file, onRemove, disabled }: { file: File; onRemove: () => void; disabled?: boolean }) {
  const [preview, setPreview] = useState<string>("");
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <div className="relative aspect-square rounded-xl overflow-hidden border border-border bg-secondary group">
      {preview && <img src={preview} alt="" className="w-full h-full object-cover" />}
      {!disabled && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/70 backdrop-blur text-white flex items-center justify-center hover:bg-red-500/80"
          aria-label="Удалить"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

function AddPhotoButton({ onChange, disabled }: { onChange: (files: File[]) => void; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  return (
    <label
      onDragOver={(e) => { if (disabled) return; e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        if (disabled) return;
        e.preventDefault(); setDragOver(false);
        const fs = Array.from(e.dataTransfer.files ?? []);
        if (fs.length > 0) onChange(fs);
      }}
      className={`aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all ${
        dragOver ? "border-[#7C3AED] bg-[#7C3AED]/10" : "border-border bg-secondary/30 hover:border-[#7C3AED]/50 hover:bg-secondary/50"
      } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
    >
      <div className="w-10 h-10 rounded-full bg-gradient-primary/20 flex items-center justify-center text-[#7C3AED]">
        <Plus size={20} />
      </div>
      <div className="text-xs font-medium text-muted-foreground">Добавить</div>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ""; if (fs.length > 0) onChange(fs); }}
      />
      <ImagePlus className="hidden" />
    </label>
  );
}

function AnchorApprovalView({
  anchorPhotoUrl,
  comment,
  revisionCount,
  submitting,
  error,
  onCommentChange,
  onApprove,
  onRevise,
}: {
  anchorPhotoUrl: string;
  comment: string;
  revisionCount: number;
  submitting: boolean;
  error: string | null;
  onCommentChange: (value: string) => void;
  onApprove: () => void;
  onRevise: () => void;
}) {
  const revisionsLeft = Math.max(0, 3 - revisionCount);
  return (
    <div className="bg-card border border-border rounded-3xl p-6 md:p-10 space-y-6">
      <div className="text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-white">Проверьте опорный кадр</h2>
        <p className="text-sm text-muted-foreground mt-2">
          После подтверждения на его основе будет создана фотосессия из 12 кадров.
        </p>
      </div>
      <div className="max-w-xl mx-auto aspect-[3/4] rounded-2xl overflow-hidden bg-secondary border border-border">
        <img src={anchorPhotoUrl} alt="Опорный кадр фотосессии" className="w-full h-full object-contain" />
      </div>
      <div className="max-w-2xl mx-auto space-y-3">
        <label className="text-sm font-semibold text-white" htmlFor="approval-comment">
          Комментарий с правками
        </label>
        <textarea
          id="approval-comment"
          value={comment}
          maxLength={1000}
          disabled={submitting || revisionsLeft === 0}
          onChange={(event) => onCommentChange(event.target.value)}
          placeholder="Например: сохранить точный цвет ткани, сделать лицо ближе к референсу, поправить длину рукава"
          rows={4}
          className="w-full rounded-xl bg-secondary border border-border px-4 py-3 text-white placeholder:text-muted-foreground focus:outline-none focus:border-[#7C3AED] disabled:opacity-50 resize-y"
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Осталось правок: {revisionsLeft}</span>
          <span>{comment.length} / 1000</span>
        </div>
      </div>
      {error && (
        <div className="max-w-2xl mx-auto text-sm bg-destructive/10 border border-destructive/30 text-white rounded-lg p-4">{error}</div>
      )}
      <div className="max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Button
          size="lg"
          onClick={onApprove}
          disabled={submitting}
          className="h-14 bg-gradient-primary text-white border-0"
        >
          {submitting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
          Подтвердить и создать 12 фото
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={onRevise}
          disabled={submitting || revisionsLeft === 0 || comment.trim().length < 3}
          className="h-14 border-border text-white"
        >
          <RotateCcw className="w-5 h-5 mr-2" /> Отправить правки
        </Button>
      </div>
    </div>
  );
}

function ProcessingView({ service }: { service: ServiceDef }) {
  return (
    <div className="bg-card border border-border rounded-3xl p-12 flex flex-col items-center text-center gap-6">
      <div className="relative w-32 h-32 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border-4 border-[#7C3AED]/20" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#7C3AED] border-r-[#EC4899] animate-spin" />
        <Sparkles className="w-12 h-12 text-[#EC4899]" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-white">Нейросеть работает над «{service.title}»</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          Обычно занимает около {service.generationTime} секунд. Не закрывай вкладку — результат появится здесь.
        </p>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 size={14} className="animate-spin" /> Проверяем готовность каждые 3 секунды…
      </div>
    </div>
  );
}

function ResultView({ results, service, onReset }: { results: string[]; service: ServiceDef; onReset: () => void }) {
  return (
    <div className="bg-card border border-border rounded-3xl p-6 md:p-10 space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 bg-[#7C3AED]/10 border border-[#7C3AED]/30 text-[#EC4899] px-4 py-1.5 rounded-full text-sm font-medium mb-4">
          <Sparkles size={14} /> Готово!
        </div>
        <h2 className="text-3xl md:text-4xl font-bold text-white">
          «<span className="text-gradient">{service.title}</span>» готово
        </h2>
        <p className="text-muted-foreground mt-2">Сохрани результаты — они уже у тебя в «Моих генерациях».</p>
      </div>
      <div className="max-w-2xl mx-auto">
        <PhotoCarousel photos={results} />
      </div>
      <div className="flex flex-col sm:flex-row gap-3 pt-4 justify-center">
        <Button size="lg" onClick={onReset} className="bg-gradient-primary text-white border-0">
          <Sparkles className="w-4 h-4 mr-2" /> Сгенерировать ещё
        </Button>
        <Link href="/account">
          <Button size="lg" variant="outline" className="border-border text-white">Мои генерации</Button>
        </Link>
      </div>
    </div>
  );
}
