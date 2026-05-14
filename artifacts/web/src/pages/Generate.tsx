import { useParams, Link } from "wouter";
import { useGetStyle, getGetStyleQueryKey } from "@workspace/api-client-react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function Generate() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data: style, isLoading, isError } = useGetStyle(id!, {
    query: {
      enabled: !!id,
      queryKey: getGetStyleQueryKey(id!),
    }
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      
      <main className="flex-1 flex items-center justify-center py-32 px-4 relative overflow-hidden">
        {/* Decorative background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#7C3AED] rounded-full mix-blend-screen filter blur-[150px] opacity-10 pointer-events-none" />
        
        <div className="w-full max-w-2xl relative z-10">
          {isLoading ? (
            <div className="bg-card border border-border p-8 rounded-3xl shadow-2xl flex flex-col items-center text-center space-y-6">
              <Skeleton className="w-24 h-24 rounded-full bg-white/5" />
              <div className="space-y-3 w-full max-w-sm">
                <Skeleton className="h-8 w-3/4 mx-auto bg-white/5" />
                <Skeleton className="h-4 w-full bg-white/5" />
                <Skeleton className="h-4 w-5/6 mx-auto bg-white/5" />
              </div>
            </div>
          ) : isError || !style ? (
            <div className="bg-card border border-border p-8 md:p-12 rounded-3xl shadow-2xl text-center">
              <div className="w-20 h-20 bg-destructive/20 text-destructive rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">
                ⚠️
              </div>
              <h1 className="text-3xl font-bold text-white mb-4">Стиль не найден</h1>
              <p className="text-muted-foreground mb-8">Запрашиваемый стиль не существует или был удален.</p>
              <Link href="/">
                <Button size="lg" className="bg-white/10 hover:bg-white/20 text-white">Вернуться на главную</Button>
              </Link>
            </div>
          ) : (
            <div className="bg-card border border-border p-8 md:p-12 rounded-3xl shadow-2xl shadow-[#7C3AED]/10 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#7C3AED]/5 pointer-events-none" />
              
              <div className="w-24 h-24 mx-auto mb-8 relative">
                <img 
                  src={style.previewImageUrl} 
                  alt={style.title} 
                  className="w-full h-full object-cover rounded-full border-4 border-background shadow-[0_0_20px_rgba(124,58,237,0.3)] z-10 relative"
                />
                <div className="absolute inset-0 rounded-full border-2 border-[#EC4899] animate-ping opacity-20" />
              </div>
              
              <div className="inline-flex items-center rounded-full border border-[#7C3AED]/30 bg-[#7C3AED]/10 px-4 py-1.5 w-fit mb-6">
                <span className="text-sm font-medium text-[#7C3AED]">✨ Скоро запуск</span>
              </div>
              
              <h1 className="text-3xl md:text-5xl font-bold text-white mb-4">
                Генерация <span className="text-gradient">в процессе настройки</span>
              </h1>
              
              <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto">
                Вы выбрали стиль <strong className="text-white">"{style.title}"</strong>. Мы настраиваем вычислительные мощности для публичного запуска.
              </p>
              
              <div className="bg-secondary/50 border border-border rounded-xl p-6 mb-8 text-left inline-block w-full max-w-sm mx-auto backdrop-blur-sm">
                <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="text-pink-500">🚀</span> Детали стиля
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Категория</span>
                    <span className="text-white font-medium">{style.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Время генерации</span>
                    <span className="text-white font-medium">~{style.generationTime} сек</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Стоимость</span>
                    <span className="text-gradient font-bold">{style.price} ₽</span>
                  </div>
                </div>
              </div>
              
              <Link href="/">
                <Button size="lg" variant="outline" className="border-border hover:bg-white/5 text-white px-8">
                  Вернуться к выбору
                </Button>
              </Link>
            </div>
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
