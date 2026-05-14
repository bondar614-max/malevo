import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useGetStatsSummary } from "@workspace/api-client-react";
import businessImg from "@/assets/hero/business.png";
import animeImg from "@/assets/hero/anime.png";
import fantasyImg from "@/assets/hero/fantasy.png";
import artImg from "@/assets/hero/art.png";

export function Hero() {
  const { data: stats } = useGetStatsSummary();

  const scrollToStyles = () => {
    document.getElementById("styles")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section id="home" className="relative min-h-screen pt-24 pb-20 flex items-center overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-[#7C3AED] rounded-full mix-blend-screen filter blur-[120px] opacity-15 animate-blob pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[600px] h-[600px] bg-[#EC4899] rounded-full mix-blend-screen filter blur-[120px] opacity-15 animate-blob animation-delay-2000 pointer-events-none" />

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="lg:col-span-7 flex flex-col gap-6 pt-10"
          >
            <div className="inline-flex items-center rounded-full border border-border bg-background/50 backdrop-blur-sm px-4 py-1.5 w-fit">
              <span className="text-sm font-medium">✨ AI-генерация нового поколения</span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.1]">
              Создай свою AI-фотографию за 60 <span className="text-gradient">секунд</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed">
              Превратите обычные селфи в студийные портреты, бизнес-фото или арты с помощью нейросетей премиум-класса.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mt-4">
              <Button size="lg" className="h-14 px-8 bg-gradient-primary text-white border-0 hover:opacity-90 shadow-[0_0_30px_rgba(124,58,237,0.3)] hover:shadow-[0_0_40px_rgba(124,58,237,0.5)] transition-all hover:scale-105 text-lg font-semibold" onClick={scrollToStyles}>
                🚀 Попробовать бесплатно
              </Button>
              <Button size="lg" variant="outline" className="h-14 px-8 border-border hover:bg-white/5 text-white text-lg font-medium" onClick={scrollToStyles}>
                ▶ Смотреть примеры
              </Button>
            </div>

            {/* Trust / Stats Bar */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-8 text-sm font-medium text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
                <span>{stats?.totalGenerated ? `${stats.totalGenerated.toLocaleString()}+ генераций` : '100,000+ генераций'}</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-border" />
              <div className="flex items-center gap-2">
                <span className="text-yellow-500">⭐</span>
                <span>{stats?.averageRating ? `${stats.averageRating.toFixed(1)} из 5` : '4.9 из 5'}</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-border" />
              <div className="flex items-center gap-2">
                <span>{stats?.totalStyles || '50'}+ стилей</span>
              </div>
            </div>
          </motion.div>

          {/* Right Column Grid */}
          <div className="lg:col-span-5 grid grid-cols-2 gap-4 relative">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative aspect-[3/4] rounded-2xl overflow-hidden group"
            >
              <img src={businessImg} alt="Business" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4">
                <div className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md">Бизнес</div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="relative aspect-[3/4] rounded-2xl overflow-hidden group mt-8"
            >
              <img src={animeImg} alt="Anime" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4">
                <div className="bg-pink-500/20 text-pink-300 border border-pink-500/30 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md">Аниме</div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="relative aspect-[3/4] rounded-2xl overflow-hidden group -mt-8"
            >
              <img src={fantasyImg} alt="Fantasy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4">
                <div className="bg-purple-500/20 text-purple-300 border border-purple-500/30 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md">Фэнтези</div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="relative aspect-[3/4] rounded-2xl overflow-hidden group"
            >
              <img src={artImg} alt="Art" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4">
                <div className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md">Арт</div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
