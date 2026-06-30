import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { z } from "zod";
import { db, ordersTable, stylesTable, usersTable, servicesTable, locationsTable, appSettingsTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { downloadStorageObject, uploadBufferToStorage } from "../lib/storage-helpers";
import { affectedRows } from "../lib/db-result";
import { generateImages, getCategoryModel, type GenImage } from "../lib/imageGen";
import { getApiKey } from "../lib/apiKeys";
import { DEFAULT_SUPPORT_MODEL, getOpenAI } from "../lib/openai";

const REVIEW_AGES = new Set(["21-30", "30-45", "45+", "random"]);
const PHOTOSHOOT_TYPES = new Set(["studio", "street"]);
const PHOTOSHOOT_SEASONS = new Set(["winter", "spring", "summer", "autumn"]);
const PHOTOSHOOT_TIMES = new Set(["morning", "day", "evening", "night"]);
const MAX_SETS = 10;
const PHOTOS_PER_SET = 3;

async function ensureModelReady(model: string): Promise<string | null> {
  if (model.startsWith("kie:")) {
    return (await getApiKey("kie")) ? null : "KIE API key не настроен. Добавьте ключ в админке в разделе AI.";
  }
  return (await getApiKey("openrouter")) ? null : "OpenRouter API key не настроен. Добавьте ключ в админке в разделе AI.";
}

const AGE_LABELS: Record<string, string> = {
  "21-30": "21-30 years old",
  "30-45": "30-45 years old",
  "45+": "45+ years old",
};

/** Pick a random element from a non-empty array. */
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/**
 * Build the final kie.ai prompt for one review photo. The location prompt may
 * contain {item} / {age} placeholders; if it does not, those values are
 * appended automatically. The service base prompt is prepended.
 */
function composeReviewPrompt(basePrompt: string, locationPrompt: string, item: string, age: string): string {
  const ageText = age && age !== "random" ? (AGE_LABELS[age] ?? age) : "";
  const hasItem = locationPrompt.includes("{item}");
  const hasAge = locationPrompt.includes("{age}");
  let p = locationPrompt.replaceAll("{item}", item).replaceAll("{age}", ageText);
  const extras: string[] = [];
  if (!hasItem && item) extras.push(`Clothing/item: ${item}.`);
  if (!hasAge && ageText) extras.push(`Age: ${ageText}.`);
  return [basePrompt.trim(), p.trim(), ...extras].filter(Boolean).join(" ").trim();
}

function parseModelPhotoUrls(raw: unknown): string[] {
  if (!raw) return [];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((url): url is string => typeof url === "string")
      .map((url) => url.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function assertAllowedImageUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Некорректная ссылка на фото модели");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Фото модели должно быть доступно по HTTPS");
  }
}

async function downloadRemoteImage(url: string): Promise<GenImage> {
  assertAllowedImageUrl(url);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Не удалось загрузить фото выбранной модели");
  }
  const mime = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
  if (!ALLOWED_MIME.has(mime)) {
    throw new Error(`Неподдерживаемый формат фото модели: ${mime}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_BYTES) {
    throw new Error("Фото модели больше 10 МБ");
  }
  return { buffer: Buffer.from(arrayBuffer), mime };
}

type PhotoshootApprovalMode = "manual" | "automatic";
type RouteLog = { error: (o: object, m?: string) => void };

const PHOTOSHOOT_SHOTS = [
  [
    "Wide full-body action frame from the front.",
    "The model walks confidently toward the camera in mid-stride, one foot clearly ahead of the other.",
    "Her arms swing naturally and the garment reacts realistically to movement.",
    "Eye-level camera, enough space around the body, the whole product remains clearly visible.",
  ].join(" "),
  [
    "Wide full-body side-profile action frame.",
    "The model walks briskly from left to right across the frame with a long natural stride.",
    "Show a true side silhouette, bent elbows and visible separation between both legs.",
    "Track the moving model while keeping the product sharp and readable.",
  ].join(" "),
  [
    "Full-body rear three-quarter frame.",
    "The model walks away from the camera and turns her head back over one shoulder.",
    "One heel is lifted in the middle of a step and the arms are in different natural positions.",
    "Clearly show the complete back construction and fit of the product.",
  ].join(" "),
  [
    "Dynamic full-body turning frame.",
    "Capture the model halfway through a quick turn, with shoulders and hips rotating in different directions.",
    "Hair and the lower part of the garment show subtle motion, while fabric details remain sharp.",
    "Use a diagonal composition rather than a centered catalog stance.",
  ].join(" "),
  [
    "Full-body lifestyle frame using the architecture of the selected location.",
    "The model steps up onto a curb or low step, with one knee raised and weight on the other leg.",
    "One hand lightly touches a nearby railing or wall while the other arm remains relaxed.",
    "Use a slightly low camera angle and show the complete outfit.",
  ].join(" "),
  [
    "Seated fashion frame in the selected location.",
    "The model sits naturally on a bench, step or low architectural surface, leaning slightly forward.",
    "Her legs are asymmetrical, one foot closer to camera, and her hands rest in different positions.",
    "Use a three-quarter full-body composition that still shows the product shape.",
  ].join(" "),
  [
    "Energetic low-angle full-body frame.",
    "The model takes a wide diagonal step past the camera and looks to the side instead of directly forward.",
    "Use a low camera position, strong perspective and visible arm movement.",
    "Keep anatomy natural and do not crop hands or feet.",
  ].join(" "),
  [
    "High-angle medium-full fashion frame.",
    "The model pauses while shifting her weight strongly onto one hip, one knee bent and one shoulder lowered.",
    "One hand adjusts the collar or hood while the other hand touches a pocket or garment seam.",
    "The pose, hand placement and camera height must be visibly different from every previous shot.",
  ].join(" "),
  [
    "Waist-up candid action frame from a three-quarter side angle.",
    "The model is actively fastening, opening or adjusting the product with both hands while looking away.",
    "Show believable hand interaction with the real fasteners and preserve their exact construction.",
    "Use tighter framing and a different background position.",
  ].join(" "),
  [
    "Close product-detail frame with part of the model visible.",
    "One hand gently pulls or holds the fabric to reveal its exact texture, thickness and finish.",
    "Focus on material, stitching and color accuracy; use shallow depth of field.",
    "This must be a genuine close-up, not another standing portrait.",
  ].join(" "),
  [
    "Spontaneous medium-full lifestyle frame.",
    "The model is caught in a natural laughing or relaxed moment while moving diagonally through the location.",
    "Her torso leans slightly, both arms are away from the neutral hanging position, and the legs are mid-step.",
    "Compose the model off-center with visible environmental depth.",
  ].join(" "),
  [
    "Final advertising hero frame with an assertive asymmetrical fashion pose.",
    "Use a dramatic three-quarter camera angle, one leg extended forward and the other supporting the body.",
    "Place the hands deliberately in two different positions and turn the face toward the light.",
    "The result must feel distinct from a static front-facing catalog portrait.",
  ].join(" "),
];

const PHOTOSHOOT_DIVERSITY_RULES = [
  "The anchor image is an identity and product reference only, not a pose or composition template.",
  "Create a genuinely new photograph: change body pose, hand placement, leg position, gaze direction, camera distance, camera height and the model's position in the environment.",
  "Do not reproduce the anchor's static stance, centered composition, straight hanging arms or identical crop.",
  "Prioritize visible body movement and asymmetry while keeping anatomy realistic.",
  "Do not turn the requested action into a neutral standing portrait.",
  "Keep the exact same woman and exact garment; never redesign, recolor or simplify the product.",
];

async function getPhotoshootApprovalSettings(): Promise<{ mode: PhotoshootApprovalMode; visionModel: string }> {
  const rows = await db.select().from(appSettingsTable);
  const map = new Map(rows.map((row) => [row.key, row.value] as const));
  return {
    mode: map.get("photoshoot:approval_mode") === "automatic" ? "automatic" : "manual",
    visionModel: map.get("photoshoot:vision_model")?.trim() || DEFAULT_SUPPORT_MODEL,
  };
}

function imageDataUrl(image: GenImage): string {
  return `data:${image.mime};base64,${image.buffer.toString("base64")}`;
}

async function evaluateAnchorPhoto(
  visionModel: string,
  references: GenImage[],
  anchor: GenImage,
): Promise<{ accepted: boolean; feedback: string }> {
  const client = await getOpenAI();
  const content: Array<Record<string, unknown>> = [
    {
      type: "text",
      text: [
        "Evaluate the last image as an anchor frame for an ecommerce fashion photoshoot.",
        "The first two images are identity references for the model.",
        "The next five images are product references: front, side, back, texture and details.",
        "Check facial identity, body consistency, exact product color, cut, texture and distinctive details, anatomy, and scene coherence.",
        'Return strict JSON only: {"accepted":boolean,"feedback":"short actionable correction"}',
      ].join(" "),
    },
    ...references.map((image) => ({ type: "image_url", image_url: { url: imageDataUrl(image) } })),
    { type: "image_url", image_url: { url: imageDataUrl(anchor) } },
  ];
  const response = await client.chat.completions.create({
    model: visionModel,
    messages: [{ role: "user", content: content as never }],
    response_format: { type: "json_object" },
  });
  const raw = response.choices[0]?.message?.content ?? "";
  try {
    const parsed = JSON.parse(raw) as { accepted?: unknown; feedback?: unknown };
    return {
      accepted: parsed.accepted === true,
      feedback: typeof parsed.feedback === "string" ? parsed.feedback.slice(0, 1000) : "",
    };
  } catch {
    return { accepted: false, feedback: "Preserve the exact model identity and reproduce the product more accurately." };
  }
}

async function loadOrderSourceImages(sourcePhotos: string[]): Promise<GenImage[]> {
  return Promise.all(sourcePhotos.map(async (url) => {
    const object = await downloadStorageObject(url);
    return { buffer: object.buffer, mime: object.contentType };
  }));
}

async function generatePhotoshootSeries(
  orderId: string,
  basePrompt: string,
  sourceImages: GenImage[],
  anchor: GenImage,
  log: RouteLog,
): Promise<string[]> {
  const model = await getCategoryModel("photoshoot");
  const results = new Array<string>(PHOTOSHOOT_SHOTS.length);
  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    while (true) {
      const index = nextIndex++;
      if (index >= PHOTOSHOOT_SHOTS.length) return;
      const prompt = [
        basePrompt,
        "Use the anchor image to preserve the exact same woman, face, body, garment and visual continuity of the selected environment.",
        ...PHOTOSHOOT_DIVERSITY_RULES,
        PHOTOSHOOT_SHOTS[index],
        `This is shot ${index + 1} of a coherent 12-photo series and it must have its own unmistakably different pose and composition.`,
      ].join(" ");
      const images = await generateImages({
        model,
        prompt,
        inputs: [anchor, ...sourceImages.slice(2)],
        log,
      });
      const image = images[0];
      if (!image) throw new Error(`Не удалось создать кадр ${index + 1}`);
      const url = await uploadBufferToStorage(image.buffer, image.mime, "generated");
      results[index] = url;
      await db
        .update(ordersTable)
        .set({ resultPhotos: results.filter(Boolean) })
        .where(and(eq(ordersTable.id, orderId), eq(ordersTable.status, "processing")));
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return results;
}

function composePhotoshootPrompt(input: {
  basePrompt: string;
  type: string;
  season: string;
  timeOfDay: string;
  atmosphere: string;
  location: string;
  productName: string;
}): string {
  const typePrompt = input.type === "studio"
    ? "Professional studio photoshoot with controlled studio lighting and a clean studio setting."
    : "Professional outdoor street photoshoot in a realistic environment with natural light.";
  const seasonPrompt: Record<string, string> = {
    winter: "The scene is set in winter with season-appropriate surroundings.",
    spring: "The scene is set in spring with fresh greenery.",
    summer: "The scene is set in summer with season-appropriate surroundings.",
    autumn: "The scene is set in autumn with seasonal foliage.",
  };
  const timePrompt: Record<string, string> = {
    morning: "Morning with soft fresh light.",
    day: "Daytime with clear natural daylight.",
    evening: "Evening with warm golden-hour or early evening light.",
    night: "Night with realistic environmental lights and cinematic illumination.",
  };
  return [
    input.basePrompt,
    typePrompt,
    seasonPrompt[input.season],
    timePrompt[input.timeOfDay],
    input.atmosphere ? `Weather and atmosphere: ${input.atmosphere}.` : "",
    input.location ? `Location: ${input.location}.` : "",
    `Product being photographed: ${input.productName}.`,
    "The first two reference images show the selected model. The next five reference images show the product from the front, side, back, texture and detail views.",
    "Preserve the exact facial identity, body proportions, product design, colors, material, texture and distinctive details accurately.",
    "Commercial marketplace safety: the model is an adult woman aged 25+, fully clothed, styled modestly and naturally for Wildberries ecommerce.",
    "Do not create nudity, underwear-only styling, lingerie, swimwear, transparent clothing, erotic poses, cleavage emphasis, minors, violence or any sensitive content.",
    "If a product reference contains underwear, bare skin or a mannequin/body crop, use it only as a garment construction reference and place the final product in a fully clothed neutral fashion outfit.",
  ].filter(Boolean).join(" ");
}

// Pose directives appended on each chained step so every subsequent photo shows
// a clearly different pose while keeping the same person, outfit and location.
const POSE_VARIATIONS = [
  "Keep the exact same person, same face, same outfit and the same location as in the reference image, but change to a clearly DIFFERENT pose: different body angle, different position of arms and hands, different head tilt and a slightly different facial expression. Natural, candid amateur smartphone shot.",
  "Same person, same face, same outfit and same place as the reference image, but use yet another DIFFERENT pose and camera angle: shift the stance and weight, reposition the arms, change the framing. Natural, candid amateur smartphone shot.",
  "Same person, same face, same clothing and same setting as the reference image, but show a new DISTINCT pose: different gesture, different angle and different expression from before. Natural, candid amateur smartphone shot.",
];

/**
 * Atomically append one url to an order's resultPhotos JSON array (safe under
 * concurrency). Guarded on status='processing' so a late chain result can never
 * be written to an order the timeout safety net already failed/refunded.
 */
async function appendResultPhoto(orderId: string, url: string): Promise<void> {
  await db
    .update(ordersTable)
    .set({ resultPhotos: sql`json_array_append(coalesce(${ordersTable.resultPhotos}, json_array()), '$', ${url})` })
    .where(and(eq(ordersTable.id, orderId), eq(ordersTable.status, "processing")));
}

const router: IRouter = Router();

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 10 },
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ===== Style generation (unchanged behavior) =====
router.post("/generate", requireAuth, upload.array("photos", 3), async (req, res) => {
  try {
    const styleId = String(req.body?.styleId ?? "");
    if (!UUID_RE.test(styleId)) {
      res.status(400).json({ error: "Invalid styleId" });
      return;
    }

    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) {
      res.status(400).json({ error: "No photos uploaded" });
      return;
    }
    for (const f of files) {
      if (!ALLOWED_MIME.has(f.mimetype)) {
        res.status(400).json({ error: `Unsupported file type: ${f.mimetype}` });
        return;
      }
    }

    const [style] = await db.select().from(stylesTable).where(eq(stylesTable.id, styleId)).limit(1);
    if (!style || !style.isActive) {
      res.status(404).json({ error: "Style not found" });
      return;
    }
    if (files.length !== style.photosRequired) {
      res.status(400).json({ error: `Expected ${style.photosRequired} photo(s), got ${files.length}` });
      return;
    }
    if (!style.prompt || style.prompt.trim().length === 0) {
      res.status(400).json({ error: "Стиль ещё не настроен (нет промпта). Обратитесь к администратору." });
      return;
    }

    const userId = req.auth!.userId;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
    if (user.isBlocked) { res.status(403).json({ error: "Account blocked" }); return; }
    const price = Number(style.price);

    const debited = await db
      .update(usersTable)
      .set({
        balance: sql`${usersTable.balance} - ${price.toFixed(2)}`,
        totalSpent: sql`${usersTable.totalSpent} + ${price.toFixed(2)}`,
      })
      .where(and(eq(usersTable.id, userId), sql`${usersTable.balance} >= ${price.toFixed(2)}`));
    if (affectedRows(debited) === 0) {
      res.status(402).json({ error: "Недостаточно средств на балансе" });
      return;
    }

    const orderId = randomUUID();
    await db
      .insert(ordersTable)
      .values({ id: orderId, userId, styleId, status: "processing", amount: price.toFixed(2), sourcePhotos: [] });

    async function refundAndFail(message: string): Promise<void> {
      const transitioned = await db
        .update(ordersTable)
        .set({ status: "failed", errorMessage: message, completedAt: new Date() })
        .where(and(eq(ordersTable.id, orderId), eq(ordersTable.status, "processing")));
      if (affectedRows(transitioned) > 0) {
        await db.update(usersTable).set({
          balance: sql`${usersTable.balance} + ${price.toFixed(2)}`,
          totalSpent: sql`greatest(${usersTable.totalSpent} - ${price.toFixed(2)}, 0)`,
        }).where(eq(usersTable.id, userId));
      }
    }

    // Snapshot input buffers for the async job (multer memory storage).
    const styleInputs: GenImage[] = files.map((f) => ({ buffer: f.buffer, mime: f.mimetype }));
    const stylePrompt = style.prompt;

    // Respond immediately; generate in the background and let the status
    // endpoint surface the DB state (uniform across all providers/categories).
    res.status(201).json({ orderId, status: "processing" });

    void (async () => {
      try {
        const model = await getCategoryModel("styles");
        const srcUrls: string[] = [];
        for (const im of styleInputs) {
          try { srcUrls.push(await uploadBufferToStorage(im.buffer, im.mime, "source")); } catch { /* non-fatal */ }
        }
        const imgs = await generateImages({ model, prompt: stylePrompt, inputs: styleInputs, log: req.log });
        if (imgs.length === 0) {
          await refundAndFail("Не удалось сгенерировать фото");
          return;
        }
        const urls = await Promise.all(imgs.map((i) => uploadBufferToStorage(i.buffer, i.mime, "generated")));
        const ok = await db
          .update(ordersTable)
          .set({
            sourcePhotoUrl: srcUrls[0] ?? null,
            sourcePhotos: srcUrls,
            resultPhotos: urls,
            status: "success",
            completedAt: new Date(),
          })
          .where(and(eq(ordersTable.id, orderId), eq(ordersTable.status, "processing")));
        if (affectedRows(ok) > 0) {
          await db
            .update(stylesTable)
            .set({ ordersCount: sql`${stylesTable.ordersCount} + 1` })
            .where(eq(stylesTable.id, styleId));
        }
      } catch (err) {
        req.log.error({ err, orderId }, "style generation failed; refunding");
        await refundAndFail(err instanceof Error ? err.message : "Не удалось сгенерировать фото");
      }
    })();
  } catch (err) {
    req.log.error({ err }, "generate failed");
    const msg = err instanceof Error ? err.message : "Generation failed";
    res.status(500).json({ error: msg });
  }
});

// ===== Service generation (WB photoshoot / review) =====
router.post("/generate/service", requireAuth, upload.array("photos", 10), async (req, res) => {
  try {
    const serviceKey = String(req.body?.serviceKey ?? "");
    const locationId = req.body?.locationId ? String(req.body.locationId) : null;

    const [service] = await db.select().from(servicesTable).where(eq(servicesTable.key, serviceKey)).limit(1);
    if (!service || !service.isActive) {
      res.status(404).json({ error: "Услуга не найдена" });
      return;
    }
    if (!service.prompt || service.prompt.trim().length === 0) {
      res.status(400).json({ error: "Услуга ещё не настроена (нет промпта). Обратитесь к администратору." });
      return;
    }

    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const modelPhotoUrls = serviceKey === "wb-photoshoot" ? parseModelPhotoUrls(req.body?.modelPhotoUrls) : [];
    const photoshootType = serviceKey === "wb-photoshoot" ? String(req.body?.photoshootType ?? "") : "";
    const photoshootSeason = serviceKey === "wb-photoshoot" ? String(req.body?.photoshootSeason ?? "") : "";
    const photoshootTimeOfDay = serviceKey === "wb-photoshoot" ? String(req.body?.photoshootTimeOfDay ?? "") : "";
    const photoshootAtmosphere = serviceKey === "wb-photoshoot" ? String(req.body?.photoshootAtmosphere ?? "").trim() : "";
    const photoshootLocation = serviceKey === "wb-photoshoot" ? String(req.body?.photoshootLocation ?? "").trim() : "";
    const productName = serviceKey === "wb-photoshoot" ? String(req.body?.productName ?? "").trim() : "";
    if (serviceKey === "wb-photoshoot" && !PHOTOSHOOT_TYPES.has(photoshootType)) {
      res.status(400).json({ error: "Выберите тип фотосессии" });
      return;
    }
    if (serviceKey === "wb-photoshoot" && photoshootType === "street" && !PHOTOSHOOT_SEASONS.has(photoshootSeason)) {
      res.status(400).json({ error: "Выберите время года" });
      return;
    }
    if (serviceKey === "wb-photoshoot" && photoshootType === "street" && !PHOTOSHOOT_TIMES.has(photoshootTimeOfDay)) {
      res.status(400).json({ error: "Выберите время дня" });
      return;
    }
    if (serviceKey === "wb-photoshoot" && photoshootType === "street" && (!photoshootAtmosphere || photoshootAtmosphere.length > 200)) {
      res.status(400).json({ error: "Выберите атмосферу" });
      return;
    }
    if (serviceKey === "wb-photoshoot" && photoshootType === "street" && (!photoshootLocation || photoshootLocation.length > 150)) {
      res.status(400).json({ error: "Выберите локацию" });
      return;
    }
    if (serviceKey === "wb-photoshoot" && modelPhotoUrls.length !== 2) {
      res.status(400).json({ error: "У выбранной модели должно быть 2 фото" });
      return;
    }
    if (serviceKey === "wb-photoshoot" && files.length !== 5) {
      res.status(400).json({ error: "Нужно загрузить 5 фотографий товара" });
      return;
    }
    if (serviceKey !== "wb-photoshoot" && (files.length < service.photosMin || files.length > service.photosMax)) {
      res.status(400).json({
        error: service.photosMin === service.photosMax
          ? `Нужно загрузить ${service.photosMin} фото`
          : `Нужно от ${service.photosMin} до ${service.photosMax} фото`,
      });
      return;
    }
    if (serviceKey === "wb-photoshoot" && (!productName || productName.length > 255)) {
      res.status(400).json({ error: "Укажите название товара" });
      return;
    }
    for (const f of files) {
      if (!ALLOWED_MIME.has(f.mimetype)) {
        res.status(400).json({ error: `Неподдерживаемый формат: ${f.mimetype}` });
        return;
      }
    }
    let modelInputs: GenImage[] | null = null;
    if (modelPhotoUrls.length > 0) {
      try {
        modelInputs = await Promise.all(modelPhotoUrls.map((url) => downloadRemoteImage(url)));
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : "Не удалось загрузить фото модели" });
        return;
      }
    }

    let locationFragment = "";
    let resolvedLocationId: string | null = null;
    // Review-only inputs.
    let reviewItem = "";
    let reviewGender = "female";
    let reviewAge = "random";
    let reviewSets = 1;
    let reviewPromptPool: string[] = [];
    if (serviceKey === "review") {
      if (!locationId || !UUID_RE.test(locationId)) {
        res.status(400).json({ error: "Выберите локацию" });
        return;
      }
      const [loc] = await db.select().from(locationsTable).where(eq(locationsTable.id, locationId)).limit(1);
      if (!loc || !loc.isActive || loc.serviceKey !== serviceKey) {
        res.status(404).json({ error: "Локация не найдена" });
        return;
      }
      resolvedLocationId = loc.id;
      // Build the pool of prompts to choose from per photo. Prefer the new
      // multi-prompt list; fall back to the legacy single fragment.
      const listed = (loc.prompts ?? []).map((p) => p.trim()).filter(Boolean);
      reviewPromptPool = listed.length > 0
        ? listed
        : (loc.promptFragment.trim() ? [loc.promptFragment.trim()] : []);
      if (reviewPromptPool.length === 0) {
        res.status(400).json({ error: "Для этой локации не настроены промпты. Обратитесь к администратору." });
        return;
      }

      reviewItem = String(req.body?.item ?? "").trim();
      if (!reviewItem) {
        res.status(400).json({ error: "Укажите название одежды" });
        return;
      }
      if (reviewItem.length > 255) reviewItem = reviewItem.slice(0, 255);

      reviewGender = String(req.body?.gender ?? "female").trim().toLowerCase();
      if (reviewGender !== "female") {
        res.status(400).json({ error: "Сейчас доступна только женская генерация" });
        return;
      }

      reviewAge = String(req.body?.age ?? "random").trim();
      if (!REVIEW_AGES.has(reviewAge)) {
        res.status(400).json({ error: "Выберите возраст" });
        return;
      }

      reviewSets = Math.floor(Number(req.body?.sets ?? 1));
      if (!Number.isFinite(reviewSets) || reviewSets < 1 || reviewSets > MAX_SETS) {
        res.status(400).json({ error: `Количество комплектов: от 1 до ${MAX_SETS}` });
        return;
      }
    }

    const isReview = serviceKey === "review";
    const isPhotoshoot = serviceKey === "wb-photoshoot";
    const selectedGenerationModel = await getCategoryModel(isReview ? "review" : "photoshoot");
    const configurationError = await ensureModelReady(selectedGenerationModel);
    if (configurationError) {
      res.status(400).json({ error: configurationError });
      return;
    }

    const userId = req.auth!.userId;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
    if (user.isBlocked) { res.status(403).json({ error: "Аккаунт заблокирован" }); return; }
    const price = Number(service.price);

    const debited = await db
      .update(usersTable)
      .set({
        balance: sql`${usersTable.balance} - ${price.toFixed(2)}`,
        totalSpent: sql`${usersTable.totalSpent} + ${price.toFixed(2)}`,
      })
      .where(and(eq(usersTable.id, userId), sql`${usersTable.balance} >= ${price.toFixed(2)}`));
    if (affectedRows(debited) === 0) {
      res.status(402).json({ error: "Недостаточно средств на балансе" });
      return;
    }

    const approvalSettings = isPhotoshoot ? await getPhotoshootApprovalSettings() : null;
    const photoshootPrompt = isPhotoshoot
      ? composePhotoshootPrompt({
          basePrompt: service.prompt,
          type: photoshootType,
          season: photoshootSeason,
          timeOfDay: photoshootTimeOfDay,
          atmosphere: photoshootAtmosphere,
          location: photoshootLocation,
          productName,
        })
      : null;
    const expectedPhotos = isReview ? reviewSets * PHOTOS_PER_SET : isPhotoshoot ? PHOTOSHOOT_SHOTS.length : 0;

    const orderId = randomUUID();
    await db
      .insert(ordersTable)
      .values({
        id: orderId,
        userId,
        serviceKey: service.key,
        locationId: resolvedLocationId,
        status: "processing",
        amount: price.toFixed(2),
        sourcePhotos: [],
        expectedPhotos,
        ...(isPhotoshoot
          ? {
              approvalMode: approvalSettings!.mode,
              photoshootPrompt,
              item: productName,
            }
          : {}),
        ...(isReview
          ? { item: reviewItem, gender: reviewGender, age: reviewAge, sets: reviewSets }
          : {}),
      });

    async function refundAndFail(message: string): Promise<void> {
      const transitioned = await db
        .update(ordersTable)
        .set({ status: "failed", errorMessage: message, completedAt: new Date() })
        .where(and(eq(ordersTable.id, orderId), eq(ordersTable.status, "processing")));
      if (affectedRows(transitioned) > 0) {
        await db.update(usersTable).set({
          balance: sql`${usersTable.balance} + ${price.toFixed(2)}`,
          totalSpent: sql`greatest(${usersTable.totalSpent} - ${price.toFixed(2)}, 0)`,
        }).where(eq(usersTable.id, userId));
      }
    }

    // ===== Review: generate via kie.ai as a sequential chain per set =====
    // Each set is a chain of PHOTOS_PER_SET photos: photo 1 is generated from the
    // uploaded source, photo 2 from photo 1, photo 3 from photo 2 — each step
    // forcing a clearly different pose. Sets run as independent concurrent chains.
    if (isReview) {
      // Snapshot buffers/metadata for the async kickoff (multer memory storage).
      const reviewFiles: GenImage[] = files.map((f) => ({ buffer: f.buffer, mime: f.mimetype }));

      // Respond immediately; run the chains in the background.
      res.status(201).json({ orderId, status: "processing" });

      void (async () => {
        try {
          const model = selectedGenerationModel!;

          // Store the source photo(s) in our storage for the order record.
          const seedUrls: string[] = [];
          for (const rf of reviewFiles) {
            try { seedUrls.push(await uploadBufferToStorage(rf.buffer, rf.mime, "source")); } catch { /* non-fatal */ }
          }

          await db
            .update(ordersTable)
            .set({ sourcePhotoUrl: seedUrls[0] ?? null, sourcePhotos: seedUrls })
            .where(eq(ordersTable.id, orderId));

          // Remember the first provider error so a fully-failed order can show
          // the admin the real cause (e.g. a chosen model rejecting the input).
          let firstError: string | null = null;

          // One sequential chain per set. Errors inside a chain stop only that
          // chain — other chains keep producing photos.
          const runChain = async (): Promise<void> => {
            try {
              let inputs: GenImage[] = reviewFiles;
              for (let step = 0; step < PHOTOS_PER_SET; step++) {
                const locPrompt = pickRandom(reviewPromptPool);
                let prompt = composeReviewPrompt(service.prompt, locPrompt, reviewItem, reviewAge);
                if (step > 0) {
                  prompt += " " + POSE_VARIATIONS[(step - 1) % POSE_VARIATIONS.length]!;
                }
                const imgs = await generateImages({ model, prompt, inputs, log: req.log });
                const first = imgs[0];
                if (!first) return; // step failed/timed out; stop this chain
                const url = await uploadBufferToStorage(first.buffer, first.mime, "generated");
                await appendResultPhoto(orderId, url);
                // The next photo is generated FROM this one.
                inputs = [first];
              }
            } catch (err) {
              if (!firstError) firstError = err instanceof Error ? err.message : String(err);
              req.log.error({ err, orderId, model }, "review chain failed");
            }
          };

          await Promise.all(Array.from({ length: reviewSets }, () => runChain()));

          // Finalize: success if we produced any photos, otherwise refund.
          const [fin] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
          if (fin && fin.status === "processing") {
            if ((fin.resultPhotos?.length ?? 0) > 0) {
              await db
                .update(ordersTable)
                .set({ status: "success", completedAt: new Date() })
                .where(and(eq(ordersTable.id, orderId), eq(ordersTable.status, "processing")));
            } else {
              // Log the raw provider cause for admins/operators; show users a
              // clean message without leaking upstream provider internals.
              req.log.error(
                { orderId, model, cause: firstError },
                "review order produced no photos; refunding",
              );
              await refundAndFail(
                "Не удалось сгенерировать фото. Попробуйте ещё раз или обратитесь в поддержку.",
              );
            }
          }
        } catch (err) {
          req.log.error({ err, orderId }, "review kie kickoff failed; refunding");
          await refundAndFail(err instanceof Error ? err.message : "Не удалось запустить генерацию");
        }
      })();
      return;
    }

    const productInputs: GenImage[] = files.map((f) => ({ buffer: f.buffer, mime: f.mimetype }));
    const serviceInputs: GenImage[] = [...(modelInputs ?? []), ...productInputs];

    res.status(201).json({ orderId, status: "processing" });

    if (isPhotoshoot) {
      void (async () => {
        try {
          const model = selectedGenerationModel!;
          const sourceUrls = await Promise.all(
            serviceInputs.map((image) => uploadBufferToStorage(image.buffer, image.mime, "source")),
          );
          await db
            .update(ordersTable)
            .set({ sourcePhotoUrl: sourceUrls[0] ?? null, sourcePhotos: sourceUrls })
            .where(eq(ordersTable.id, orderId));

          let correction = "";
          let anchor: GenImage | null = null;
          for (let attempt = 0; attempt < (approvalSettings!.mode === "automatic" ? 3 : 1); attempt++) {
            const anchorPrompt = [
              photoshootPrompt!,
              "Create one strong anchor frame: full-body front three-quarter fashion pose.",
              "The product must be worn correctly and match all five product references exactly.",
              "This anchor will define identity, clothing and environment for the whole series.",
              correction,
            ].filter(Boolean).join(" ");
            const generated = await generateImages({ model, prompt: anchorPrompt, inputs: serviceInputs, log: req.log });
            anchor = generated[0] ?? null;
            if (!anchor) continue;
            if (approvalSettings!.mode === "manual") break;
            let evaluation: { accepted: boolean; feedback: string };
            try {
              evaluation = await evaluateAnchorPhoto(approvalSettings!.visionModel, serviceInputs, anchor);
            } catch (err) {
              req.log.error(
                { err, orderId, visionModel: approvalSettings!.visionModel },
                "photoshoot anchor evaluation failed; continuing with generated anchor",
              );
              break;
            }
            if (evaluation.accepted) break;
            correction = `Correct the following problems from the previous attempt: ${evaluation.feedback}`;
          }
          if (!anchor) {
            await refundAndFail("Не удалось создать опорный кадр");
            return;
          }

          const anchorUrl = await uploadBufferToStorage(anchor.buffer, anchor.mime, "generated");
          await db
            .update(ordersTable)
            .set({ anchorPhotoUrl: anchorUrl, resultPhotos: [], approvalComment: null })
            .where(eq(ordersTable.id, orderId));

          if (approvalSettings!.mode === "manual") {
            await db
              .update(ordersTable)
              .set({ status: "awaiting_approval" })
              .where(and(eq(ordersTable.id, orderId), eq(ordersTable.status, "processing")));
            return;
          }

          const urls = await generatePhotoshootSeries(orderId, photoshootPrompt!, serviceInputs, anchor, req.log);
          await db
            .update(ordersTable)
            .set({ resultPhotos: urls, status: "success", completedAt: new Date() })
            .where(and(eq(ordersTable.id, orderId), eq(ordersTable.status, "processing")));
        } catch (err) {
          req.log.error({ err, orderId }, "photoshoot generation failed; refunding");
          await refundAndFail(err instanceof Error ? err.message : "Не удалось создать фотосессию");
        }
      })();
      return;
    }

    // ===== Other non-review services: background generation =====
    const finalPrompt = locationFragment
      ? `${service.prompt} Setting: ${locationFragment}.`
      : service.prompt;

    void (async () => {
      try {
        const model = selectedGenerationModel!;
        const srcUrls: string[] = [];
        for (const im of serviceInputs) {
          try { srcUrls.push(await uploadBufferToStorage(im.buffer, im.mime, "source")); } catch { /* non-fatal */ }
        }
        const imgs = await generateImages({ model, prompt: finalPrompt, inputs: serviceInputs, log: req.log });
        if (imgs.length === 0) {
          await refundAndFail("Не удалось сгенерировать фото");
          return;
        }
        const urls = await Promise.all(imgs.map((i) => uploadBufferToStorage(i.buffer, i.mime, "generated")));
        await db
          .update(ordersTable)
          .set({
            sourcePhotoUrl: srcUrls[0] ?? null,
            sourcePhotos: srcUrls,
            resultPhotos: urls,
            status: "success",
            completedAt: new Date(),
          })
          .where(and(eq(ordersTable.id, orderId), eq(ordersTable.status, "processing")));
      } catch (err) {
        req.log.error({ err, orderId }, "service generation failed; refunding");
        await refundAndFail(err instanceof Error ? err.message : "Не удалось сгенерировать фото");
      }
    })();
  } catch (err) {
    req.log.error({ err }, "service generate failed");
    const msg = err instanceof Error ? err.message : "Generation failed";
    res.status(500).json({ error: msg });
  }
});

// Auto-fail tasks that have been processing too long.
const STUCK_TASK_MS = 30 * 60 * 1000;

const RevisionBody = z.object({
  comment: z.string().trim().min(3).max(1000),
});

router.post("/generate/:orderId/photoshoot/approve", requireAuth, async (req, res) => {
  const orderId = String(req.params.orderId ?? "");
  if (!UUID_RE.test(orderId)) { res.status(400).json({ error: "Invalid orderId" }); return; }
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
  if (!order || order.userId !== req.auth!.userId || order.serviceKey !== "wb-photoshoot") {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  if (order.status !== "awaiting_approval" || !order.anchorPhotoUrl || !order.photoshootPrompt) {
    res.status(409).json({ error: "Опорный кадр сейчас нельзя подтвердить" });
    return;
  }
  const transitioned = await db
    .update(ordersTable)
    .set({ status: "processing", errorMessage: null })
    .where(and(eq(ordersTable.id, orderId), eq(ordersTable.status, "awaiting_approval")));
  if (affectedRows(transitioned) === 0) { res.status(409).json({ error: "Заказ уже обрабатывается" }); return; }
  res.json({ orderId, status: "processing" });

  void (async () => {
    try {
      const sourceImages = await loadOrderSourceImages(order.sourcePhotos);
      const anchorObject = await downloadStorageObject(order.anchorPhotoUrl!);
      const anchor = { buffer: anchorObject.buffer, mime: anchorObject.contentType };
      const urls = await generatePhotoshootSeries(orderId, order.photoshootPrompt!, sourceImages, anchor, req.log);
      await db
        .update(ordersTable)
        .set({ resultPhotos: urls, status: "success", completedAt: new Date() })
        .where(and(eq(ordersTable.id, orderId), eq(ordersTable.status, "processing")));
    } catch (err) {
      req.log.error({ err, orderId }, "approved photoshoot series failed");
      const failed = await db
        .update(ordersTable)
        .set({ status: "failed", errorMessage: "Не удалось создать серию фотографий", completedAt: new Date() })
        .where(and(eq(ordersTable.id, orderId), eq(ordersTable.status, "processing")));
      if (affectedRows(failed) > 0 && order.userId) {
        await db
          .update(usersTable)
          .set({
            balance: sql`${usersTable.balance} + ${order.amount}`,
            totalSpent: sql`greatest(${usersTable.totalSpent} - ${order.amount}, 0)`,
          })
          .where(eq(usersTable.id, order.userId));
      }
    }
  })();
});

router.post("/generate/:orderId/photoshoot/revise", requireAuth, async (req, res) => {
  const orderId = String(req.params.orderId ?? "");
  const parsed = RevisionBody.safeParse(req.body);
  if (!UUID_RE.test(orderId) || !parsed.success) {
    res.status(400).json({ error: "Добавьте комментарий от 3 до 1000 символов" });
    return;
  }
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
  if (!order || order.userId !== req.auth!.userId || order.serviceKey !== "wb-photoshoot") {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  if (order.status !== "awaiting_approval" || !order.photoshootPrompt) {
    res.status(409).json({ error: "Опорный кадр сейчас нельзя изменить" });
    return;
  }
  if (order.revisionCount >= 3) {
    res.status(409).json({ error: "Доступно не более трёх правок опорного кадра" });
    return;
  }
  const transitioned = await db
    .update(ordersTable)
    .set({
      status: "processing",
      approvalComment: parsed.data.comment,
      revisionCount: order.revisionCount + 1,
      errorMessage: null,
    })
    .where(and(eq(ordersTable.id, orderId), eq(ordersTable.status, "awaiting_approval")));
  if (affectedRows(transitioned) === 0) { res.status(409).json({ error: "Заказ уже обрабатывается" }); return; }
  res.json({ orderId, status: "processing" });

  void (async () => {
    try {
      const sourceImages = await loadOrderSourceImages(order.sourcePhotos);
      const model = await getCategoryModel("photoshoot");
      const prompt = [
        order.photoshootPrompt!,
        "Regenerate the anchor frame while preserving the exact same woman and exact product.",
        `User correction: ${parsed.data.comment}`,
      ].join(" ");
      const images = await generateImages({ model, prompt, inputs: sourceImages, log: req.log });
      const anchor = images[0];
      if (!anchor) throw new Error("No anchor image");
      const anchorUrl = await uploadBufferToStorage(anchor.buffer, anchor.mime, "generated");
      await db
        .update(ordersTable)
        .set({ anchorPhotoUrl: anchorUrl, status: "awaiting_approval", errorMessage: null })
        .where(and(eq(ordersTable.id, orderId), eq(ordersTable.status, "processing")));
    } catch (err) {
      req.log.error({ err, orderId }, "photoshoot anchor revision failed");
      await db
        .update(ordersTable)
        .set({ status: "awaiting_approval", errorMessage: "Не удалось применить правки. Попробуйте изменить комментарий." })
        .where(and(eq(ordersTable.id, orderId), eq(ordersTable.status, "processing")));
    }
  })();
});

router.get("/generate/:orderId/status", requireAuth, async (req, res) => {
  const orderId = String(req.params.orderId ?? "");
  if (!UUID_RE.test(orderId)) {
    res.status(400).json({ error: "Invalid orderId" });
    return;
  }
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
  if (!order || order.userId !== req.auth!.userId) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  if (order.status === "success" || order.status === "failed") {
    res.json({
      orderId: order.id,
      status: order.status,
      resultPhotos: order.resultPhotos ?? [],
      errorMessage: order.errorMessage,
    });
    return;
  }
  if (order.status === "awaiting_approval") {
    res.json({
      orderId: order.id,
      status: order.status,
      anchorPhotoUrl: order.anchorPhotoUrl,
      approvalMode: order.approvalMode,
      revisionCount: order.revisionCount,
      errorMessage: order.errorMessage,
    });
    return;
  }

  async function failAndRefund(message: string): Promise<boolean> {
    const transitioned = await db
      .update(ordersTable)
      .set({ status: "failed", errorMessage: message, completedAt: new Date() })
      .where(and(eq(ordersTable.id, order!.id), eq(ordersTable.status, "processing")));
    if (affectedRows(transitioned) === 0) return false;
    if (order!.userId) {
      await db
        .update(usersTable)
        .set({
          balance: sql`${usersTable.balance} + ${order!.amount}`,
          totalSpent: sql`greatest(${usersTable.totalSpent} - ${order!.amount}, 0)`,
        })
        .where(eq(usersTable.id, order!.userId));
    }
    return true;
  }

  // All generation is background-driven: the worker writes resultPhotos and sets
  // the final status. Here we surface the current DB state, with a timeout safety
  // net in case the worker died (e.g. a server restart mid-generation).
  const aged = Date.now() - order.createdAt.getTime() > STUCK_TASK_MS;
  if (aged && order.status === "processing") {
    const resultCount = order.resultPhotos?.length ?? 0;
    const hasCompleteResult = order.serviceKey === "wb-photoshoot"
      ? resultCount === PHOTOSHOOT_SHOTS.length
      : resultCount > 0;
    if (hasCompleteResult) {
      await db
        .update(ordersTable)
        .set({ status: "success", completedAt: new Date() })
        .where(and(eq(ordersTable.id, order.id), eq(ordersTable.status, "processing")));
      res.json({ orderId: order.id, status: "success", resultPhotos: order.resultPhotos ?? [] });
      return;
    }
    const timeoutMessage = order.serviceKey === "wb-photoshoot" && resultCount > 0
      ? `Фотосессия создана не полностью: ${resultCount} из ${PHOTOSHOOT_SHOTS.length} кадров`
      : "Превышено время ожидания генерации";
    await failAndRefund(timeoutMessage);
    res.json({ orderId: order.id, status: "failed", errorMessage: timeoutMessage, refunded: true });
    return;
  }

  res.json({
    orderId: order.id,
    status: order.status,
    resultPhotos: order.resultPhotos ?? [],
    anchorPhotoUrl: order.anchorPhotoUrl,
    revisionCount: order.revisionCount,
  });
});

export default router;
