import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/home/Hero";
import { HowItWorks } from "@/components/home/HowItWorks";
import { StylesGrid } from "@/components/home/StylesGrid";
import { ServicesBlock } from "@/components/home/ServicesBlock";
import { Gallery } from "@/components/home/Gallery";
import { Reviews } from "@/components/home/Reviews";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-[#7C3AED]/30 selection:text-white">
      <Header />
      <main>
        <Hero />
        <HowItWorks />
        <StylesGrid />
        <Gallery />
        <Reviews />
        <ServicesBlock />
      </main>
      <Footer />
    </div>
  );
}
