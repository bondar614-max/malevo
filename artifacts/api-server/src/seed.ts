import { randomUUID } from "node:crypto";
import { db, stylesTable, galleryTable, reviewsTable } from "@workspace/db";

const baseUrl = "/api/static/seed";

const styles = [
  { sortOrder: 1, title: "Бизнес-портрет", category: "Бизнес", shortDescription: "Профессиональные снимки для LinkedIn, сайтов и презентаций", fullDescription: "Преврати обычное селфи в безупречный бизнес-портрет студийного качества. Идеально для LinkedIn, корпоративных сайтов, медиа и заявок на конференции. Чёткий свет, нейтральный фон, уверенный взгляд.", price: "499.00", generationTime: 45, ordersCount: 4280, image: "style_business.png", rating: "4.9" },
  { sortOrder: 2, title: "Аниме-аватар", category: "Аниме", shortDescription: "Превратись в персонажа аниме в стиле студии Гибли", fullDescription: "Создай свой аниме-аватар с детальной прорисовкой, выразительными глазами и фирменным cel-shading. Подходит для аватаров в Telegram, Discord, обложек книг и стримов.", price: "349.00", generationTime: 60, ordersCount: 6120, image: "style_anime.png", rating: "5.0" },
  { sortOrder: 3, title: "Фэнтези-герой", category: "Фэнтези", shortDescription: "Эпический портрет в доспехах из мира тёмного фэнтези", fullDescription: "Стань героем своей собственной саги — детализированные доспехи, магические акценты, кинематографический свет. Отличный подарок для фанатов настолок и фэнтези.", price: "599.00", generationTime: 75, ordersCount: 3340, image: "style_fantasy.png", rating: "4.8" },
  { sortOrder: 4, title: "Журнальный портрет", category: "Портрет", shortDescription: "Кинематографичный портрет уровня обложки Vogue", fullDescription: "Утончённый редакционный портрет с мягким светом и малой глубиной резкости. Подойдёт для творческого портфолио, личного бренда и съёмок «как у звёзд».", price: "449.00", generationTime: 50, ordersCount: 5210, image: "style_portrait.png", rating: "4.9" },
  { sortOrder: 5, title: "Арт-портрет", category: "Арт", shortDescription: "Художественный портрет в стиле современной живописи", fullDescription: "Выразительные мазки, насыщенная палитра пурпура и розового — ты в виде современной арт-работы. Для тех, кто любит выделяться.", price: "399.00", generationTime: 55, ordersCount: 2870, image: "style_art.png", rating: "4.8" },
  { sortOrder: 6, title: "Киберпанк-неон", category: "Арт", shortDescription: "Футуристичный неоновый портрет в стиле Blade Runner", fullDescription: "Неоновые отблески, дождь, ночной город — ты в эстетике киберпанка. Идеально для обложек, аватаров и тематических проектов.", price: "549.00", generationTime: 65, ordersCount: 3960, image: "style_cyberpunk.png", rating: "4.9" },
];

const galleryAssign: Array<{ image: string; styleIdx: number }> = [
  { image: "g1.png", styleIdx: 0 }, { image: "g2.png", styleIdx: 1 },
  { image: "g3.png", styleIdx: 2 }, { image: "g4.png", styleIdx: 3 },
  { image: "g5.png", styleIdx: 4 }, { image: "g6.png", styleIdx: 5 },
  { image: "g7.png", styleIdx: 4 }, { image: "g8.png", styleIdx: 1 },
  { image: "g9.png", styleIdx: 3 }, { image: "g10.png", styleIdx: 5 },
  { image: "g11.png", styleIdx: 4 }, { image: "g12.png", styleIdx: 0 },
];

const reviews = [
  { name: "Анна Соколова", avatarColor: "#7C3AED", rating: 5, text: "Сделала бизнес-портрет для LinkedIn — коллеги спрашивали, у какого фотографа я снималась. Реально студийное качество за 45 секунд.", styleTag: "Бизнес-портрет" },
  { name: "Дмитрий Орлов", avatarColor: "#EC4899", rating: 5, text: "Заказал аниме-аватар для Discord-сервера — все в восторге. Похоже на меня, но в стиле Гибли. Вышло ровно так, как я хотел.", styleTag: "Аниме-аватар" },
  { name: "Мария Иванова", avatarColor: "#0EA5E9", rating: 5, text: "Фэнтези-портрет получился просто огонь. Распечатала на холсте и подарила мужу на день рождения — он в восторге.", styleTag: "Фэнтези-герой" },
  { name: "Игорь Петров", avatarColor: "#F59E0B", rating: 5, text: "Журнальный портрет помог обновить аватарку для всех соцсетей. Друзья реально подумали, что я ходил к фотографу.", styleTag: "Журнальный портрет" },
  { name: "Елена Кузнецова", avatarColor: "#10B981", rating: 5, text: "Арт-портрет вышел невероятно красивым — насыщенные цвета, выразительные мазки. Заказала ещё один в подарок маме.", styleTag: "Арт-портрет" },
  { name: "Артём Васильев", avatarColor: "#EF4444", rating: 5, text: "Киберпанк-стиль превзошёл ожидания. Поставил на обложку YouTube-канала — подписчиков прибавилось.", styleTag: "Киберпанк-неон" },
];

async function seed(): Promise<void> {
  await db.delete(galleryTable);
  await db.delete(reviewsTable);
  await db.delete(stylesTable);

  const stylesWithIds = styles.map((style) => ({ ...style, id: randomUUID() }));
  await db
    .insert(stylesTable)
    .values(
      stylesWithIds.map((s, i) => ({
        id: s.id,
        title: s.title,
        shortDescription: s.shortDescription,
        fullDescription: s.fullDescription,
        price: s.price,
        previewImageUrl: `${baseUrl}/${s.image}`,
        exampleImages: [
          `${baseUrl}/g${i * 2 + 1}.png`,
          `${baseUrl}/g${i * 2 + 2}.png`,
          `${baseUrl}/${s.image}`,
        ],
        generationTime: s.generationTime,
        sortOrder: s.sortOrder,
        ordersCount: s.ordersCount,
        category: s.category,
        rating: s.rating,
      })),
    );

  await db.insert(galleryTable).values(
    galleryAssign.map((g, i) => {
      const s = stylesWithIds[g.styleIdx]!;
      return { imageUrl: `${baseUrl}/${g.image}`, styleId: s.id, styleTitle: s.title, sortOrder: i };
    }),
  );

  await db.insert(reviewsTable).values(reviews);

  // eslint-disable-next-line no-console
  console.log(`Seeded ${stylesWithIds.length} styles, ${galleryAssign.length} gallery, ${reviews.length} reviews`);
}

seed().then(() => process.exit(0)).catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
