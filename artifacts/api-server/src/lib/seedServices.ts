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

/**
 * The canonical review locations. `promptFragment` carries the value forwarded
 * to n8n as the `location` of the generated selfie.
 */
const REVIEW_LOCATIONS = [
  { name: "Селфи в квартире", promptFragment: "apartment", sortOrder: 1 },
  { name: "Селфи в комнате", promptFragment: "room", sortOrder: 2 },
  { name: "Селфи в лифте", promptFragment: "elevator", sortOrder: 3 },
  { name: "Селфи в примерочной ПВЗ", promptFragment: "pvz_fitting_room", sortOrder: 4 },
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

    // Reconcile the review location set to exactly the four canonical selfie
    // locations. We never delete rows (orders reference them via FK); instead we
    // deactivate any stale location and (re)activate / insert the canonical four.
    const desiredNames = new Set(REVIEW_LOCATIONS.map((l) => l.name));
    const allReviewLocs = await db.select().from(locationsTable).where(eq(locationsTable.serviceKey, "review"));

    for (const d of REVIEW_LOCATIONS) {
      const match = allReviewLocs.find((l) => l.name === d.name);
      if (!match) {
        await db.insert(locationsTable).values({ ...d, serviceKey: "review", isActive: true });
        logger.info({ name: d.name }, "[bootstrap] inserted review location");
      } else if (!match.isActive) {
        await db.update(locationsTable).set({ isActive: true }).where(eq(locationsTable.id, match.id));
      }
    }

    for (const loc of allReviewLocs) {
      if (!desiredNames.has(loc.name) && loc.isActive) {
        await db.update(locationsTable).set({ isActive: false }).where(eq(locationsTable.id, loc.id));
        logger.info({ name: loc.name }, "[bootstrap] deactivated stale review location");
      }
    }
  } catch (err) {
    logger.error({ err }, "[bootstrap] failed to seed services/locations");
  }
}
