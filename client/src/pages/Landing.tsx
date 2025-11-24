import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { Features } from "@/components/Features";
import { Roadmap } from "@/components/Roadmap";
import { CtaBand } from "@/components/CtaBand";
import { Footer } from "@/components/Footer";
import { Starfield } from "@/components/Starfield";

export default function Landing() {
  return (
    <div className="min-h-screen bg-bg-1 relative">
      <Starfield />
      <div className="relative z-10">
        <Header />
        <Hero />
        <Features />
        <Roadmap />
        <CtaBand />
        <Footer />
      </div>
    </div>
  );
}
