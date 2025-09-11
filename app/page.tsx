import HeroSection from "@srcfull/components/sections/HeroSection";
import AboutSection from "@srcfull/components/sections/AboutSection";
import ServicesSection from "@srcfull/components/sections/ServicesSection";
import ContactSection from "@srcfull/components/sections/ContactSection";

export default function Home() {
  return (
    <main className="min-h-screen">
      <HeroSection />
      <AboutSection />
      <ServicesSection />
      <ContactSection />
    </main>
  );
}