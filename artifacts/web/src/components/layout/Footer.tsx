import { Link } from "wouter";
import { BrandLogo } from "@/components/layout/BrandLogo";

export function Footer() {
  return (
    <footer className="bg-[#09090B] pt-20 pb-10 border-t border-border">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          <div className="flex flex-col gap-4">
            <Link href="/" className="group w-fit transition-[filter] hover:brightness-125">
              <BrandLogo />
            </Link>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
              AI фотографии за 60 секунд. Профессиональные портреты, аватары и арт-генерации.
            </p>
            <div className="flex items-center gap-4 mt-2">
              <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white hover:bg-white/10 transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 0C5.372 0 0 5.372 0 12C0 18.628 5.372 24 12 24C18.628 24 24 18.628 24 12C24 5.372 18.628 0 12 0ZM17.818 8.181L15.636 18.363C15.454 19.091 14.818 19.363 14.181 19L10.091 16L8.181 17.818C8 18 7.727 18.181 7.454 18.181L7.818 14.091L15.272 7.363C15.636 7 15.181 6.818 14.727 7.091L5.545 12.909L1.545 11.636C0.636 11.363 0.636 10.727 1.727 10.272L16.909 4.363C17.636 4.091 18.272 4.545 17.818 8.181Z" fill="currentColor"/>
                </svg>
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white hover:bg-white/10 transition-colors">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M13.162 18.994C6.544 18.994 2.766 14.475 2.593 7.5H5.875C5.99 12.637 8.528 14.813 10.518 15.25V7.5H13.633V11.931C15.592 11.719 17.695 9.712 18.415 7.5H21.53C20.954 10.25 18.736 12.369 17.152 13.238C18.736 13.931 21.242 15.8 22.193 18.994H18.789C18.04 16.669 16.053 14.931 13.633 14.65V18.994H13.162Z" fill="currentColor"/>
                </svg>
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-6">Сервис</h4>
            <ul className="flex flex-col gap-3">
              <li><a href="#styles" className="text-muted-foreground hover:text-transparent hover:bg-clip-text hover:bg-gradient-to-r hover:from-[#7C3AED] hover:to-[#EC4899] transition-all">Стили</a></li>
              <li><a href="#pricing" className="text-muted-foreground hover:text-transparent hover:bg-clip-text hover:bg-gradient-to-r hover:from-[#7C3AED] hover:to-[#EC4899] transition-all">Цены</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-transparent hover:bg-clip-text hover:bg-gradient-to-r hover:from-[#7C3AED] hover:to-[#EC4899] transition-all">API</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-transparent hover:bg-clip-text hover:bg-gradient-to-r hover:from-[#7C3AED] hover:to-[#EC4899] transition-all">Партнёрам</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-6">Информация</h4>
            <ul className="flex flex-col gap-3">
              <li><a href="#" className="text-muted-foreground hover:text-transparent hover:bg-clip-text hover:bg-gradient-to-r hover:from-[#7C3AED] hover:to-[#EC4899] transition-all">О нас</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-transparent hover:bg-clip-text hover:bg-gradient-to-r hover:from-[#7C3AED] hover:to-[#EC4899] transition-all">FAQ</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-transparent hover:bg-clip-text hover:bg-gradient-to-r hover:from-[#7C3AED] hover:to-[#EC4899] transition-all">Блог</a></li>
              <li><a href="#reviews" className="text-muted-foreground hover:text-transparent hover:bg-clip-text hover:bg-gradient-to-r hover:from-[#7C3AED] hover:to-[#EC4899] transition-all">Отзывы</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-6">Контакты</h4>
            <ul className="flex flex-col gap-3">
              <li><a href="#" className="text-muted-foreground hover:text-white transition-colors">TG: @photogenai</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-white transition-colors">hello@photogen.ai</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-muted-foreground text-sm">
            © 2026 MALEVO. Все права защищены.
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-sm text-muted-foreground hover:text-white transition-colors">Политика конфиденциальности</a>
            <a href="#" className="text-sm text-muted-foreground hover:text-white transition-colors">Публичная оферта</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
