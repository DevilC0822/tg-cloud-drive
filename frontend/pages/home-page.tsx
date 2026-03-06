import { HeroSection } from "@/components/hero-section"
import { StorageDashboard } from "@/components/storage-dashboard"
import { FeaturesSection } from "@/components/features-section"
import { PricingSection } from "@/components/pricing-section"
import { Footer } from "@/components/footer"

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden pt-20">
      <HeroSection />
      <StorageDashboard />
      <FeaturesSection />
      <PricingSection />
      <Footer />
    </main>
  )
}
