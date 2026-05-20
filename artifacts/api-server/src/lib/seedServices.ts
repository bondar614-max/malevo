import { db, servicesTable, locationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const DEFAULT_SERVICES = [
  {
    key: "wb-photoshoot",
    title: "Фотосессия для Wildberries",
    shortDescription: "Профессиональная каталожная фотосессия одежды из ваших фото",
    fullDescription:
      "Загрузите 3–5 фото одежды или вашего образа — нейросеть создаст набор студийных кадров уровня каталога Wildberries: ровный свет, белый/светлый фон, аккуратные позы, разные ракурсы.",
    prompt:
      "Professional Wildberries catalog photoshoot of the same person wearing the same outfit shown in the reference photos. Studio lighting, clean light grey background, full body and waist-up shots, several confident catalog poses, sharp focus, true-to-life fabric texture and colors, ecommerce fashion catalog style, ultra-detailed, high resolution.",
    photosMin: 3,
    photosMax: 5,
    price: "799.00",
    generationTime: 90,
    accentFrom: "#7C3AED",
    accentTo: "#EC4899",
    badge: "WB",
    sortOrder: 1,
  },
  {
    key: "review",
    title: "Фото для отзывов",
    shortDescription: "Реалистичные «отзывные» фото с выбором локации из 1 кадра",
    fullDescription:
      "Загрузите одно фото и выберите локацию (кафе, дом, улица и др.) — получите естественные фото, как будто вы сами снимали себя в этом месте. Идеально для отзывов на маркетплейсах.",
    prompt:
      "A natural casual amateur photo of the same person from the reference image, candid pose, realistic skin texture and lighting, looks like a real customer review photo taken on a smartphone, photorealistic.",
    photosMin: 1,
    photosMax: 1,
    price: "199.00",
    generationTime: 60,
    accentFrom: "#0EA5E9",
    accentTo: "#10B981",
    badge: "Отзывы",
    sortOrder: 2,
  },
];

const DEFAULT_LOCATIONS = [
  { name: "Уютное кафе", promptFragment: "sitting in a cozy modern cafe with warm lighting, coffee cup on the table, soft window light behind", sortOrder: 1 },
  { name: "Дом / квартира", promptFragment: "at home in a bright modern apartment living room, soft daylight from a window, casual interior in the background", sortOrder: 2 },
  { name: "Улица города", promptFragment: "on a sunny city street with blurred urban background, natural daylight, casual outdoor portrait", sortOrder: 3 },
  { name: "Парк", promptFragment: "in a green city park with trees and soft afternoon sunlight, natural outdoor lighting", sortOrder: 4 },
  { name: "Офис", promptFragment: "in a modern office with bright workspace background, soft natural light, professional yet casual setting", sortOrder: 5 },
  { name: "Ресторан", promptFragment: "in a stylish modern restaurant interior with warm ambient lighting, soft bokeh background", sortOrder: 6 },
  { name: "Пляж", promptFragment: "on a sunny beach with sea and sky in the background, soft golden hour light, natural outdoor photo", sortOrder: 7 },
];

/** Ensure the two services exist; only inserts when missing — never overwrites admin edits. */
export async function ensureServicesAndLocations(): Promise<void> {
  try {
    for (const s of DEFAULT_SERVICES) {
      const existing = await db.select({ key: servicesTable.key }).from(servicesTable).where(eq(servicesTable.key, s.key)).limit(1);
      if (existing.length === 0) {
        await db.insert(servicesTable).values(s);
        logger.info({ key: s.key }, "[bootstrap] inserted service");
      }
    }

    const existingLocs = await db.select({ id: locationsTable.id }).from(locationsTable).where(eq(locationsTable.serviceKey, "review")).limit(1);
    if (existingLocs.length === 0) {
      await db.insert(locationsTable).values(
        DEFAULT_LOCATIONS.map((l) => ({ ...l, serviceKey: "review" })),
      );
      logger.info({ count: DEFAULT_LOCATIONS.length }, "[bootstrap] inserted default review locations");
    }
  } catch (err) {
    logger.error({ err }, "[bootstrap] failed to seed services/locations");
  }
}
