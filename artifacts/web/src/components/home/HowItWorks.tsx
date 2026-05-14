import { motion } from "framer-motion";

const steps = [
  {
    num: "01",
    icon: "📤",
    title: "Загрузи фото",
    desc: "Загрузите от 1 до 5 обычных селфи или фотографий с телефона. Наш ИИ проанализирует черты лица.",
  },
  {
    num: "02",
    icon: "🎨",
    title: "Выбери стиль",
    desc: "Выберите один из десятков премиум-стилей: от строгого бизнеса до яркого киберпанка и фэнтези.",
  },
  {
    num: "03",
    icon: "✨",
    title: "Получи результат",
    desc: "Подождите около 60 секунд, пока нейросеть создаст уникальные фотографии студийного качества.",
  }
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 bg-background relative border-y border-border/50">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 tracking-tight">Как это работает?</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">Всего три простых шага до идеальных фотографий</p>
        </div>

        <div className="relative grid md:grid-cols-3 gap-12 lg:gap-8 max-w-5xl mx-auto">
          {/* Decorative line desktop */}
          <div className="hidden md:block absolute top-12 left-1/6 right-1/6 h-[2px] bg-gradient-to-r from-transparent via-[#7C3AED]/30 to-transparent -z-10" />

          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: i * 0.2 }}
              className="relative flex flex-col items-center text-center group"
            >
              <div className="w-24 h-24 rounded-full bg-secondary border border-border flex items-center justify-center mb-6 relative group-hover:border-[#7C3AED]/50 transition-colors shadow-lg">
                <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-10 rounded-full transition-opacity" />
                <span className="text-4xl filter drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">{step.icon}</span>
                <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-gradient-primary text-white flex items-center justify-center text-xs font-bold shadow-[0_0_10px_rgba(124,58,237,0.5)]">
                  {step.num}
                </div>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
              <p className="text-muted-foreground leading-relaxed">
                {step.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
