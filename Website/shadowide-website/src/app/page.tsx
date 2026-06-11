import Hero from '../components/Hero';
import Features from '../components/Features';
import Community from '../components/Community';
import Showcase from '../components/Showcase';
import GetStarted from '../components/GetStarted';
import Footer from '../components/Footer';
import Testimonials from '../components/Testimonials';
import Comparison from '../components/Comparison';
import LatencyComparison from '../components/LatencyComparison';

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-white">
      <Hero />
      <Features />
      <Comparison />
      <LatencyComparison />
      <Showcase id="future" />
      <Community id="community" />
      <Testimonials />
      <GetStarted id="get-started" />
      <Footer />
    </div>
  );
}
