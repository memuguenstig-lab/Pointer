'use client';

import { useState } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import Link from 'next/link';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';

interface NavbarProps {
  showDownloadsLink?: boolean;
  showTextLogo?: boolean;
}

export default function Navbar({
  showDownloadsLink = false,
  showTextLogo = false,
}: NavbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { scrollY } = useScroll();
  
  // Smooth transitions for all properties
  const width = useTransform(scrollY, [0, 100], ['100%', '60%']);
  const opacity = useTransform(scrollY, [0, 100], [1, 0.95]);
  const scale = useTransform(scrollY, [0, 100], [1, 0.95]);
  const borderRadius = useTransform(scrollY, [0, 100], ['0px', '16px']);
  const padding = useTransform(scrollY, [0, 100], ['0px', '8px']);
  const background = useTransform(
    scrollY,
    [0, 100],
    ['rgba(0,0,0,0)', 'rgba(17, 17, 17, 0.85)']
  );
  const blur = useTransform(scrollY, [0, 100], ['0px', '20px']);
  const gradientOpacity = useTransform(scrollY, [0, 100], [0, 0.2]);
  const shadowOpacity = useTransform(scrollY, [0, 100], [0, 0.36]);

  return (
    <motion.nav
      style={{
        width,
        opacity,
        scale,
        borderRadius,
        padding,
        background,
        backdropFilter: `blur(${blur})`,
        boxShadow: `0 8px 32px 0 rgba(0,0,0,${shadowOpacity})`,
      }}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 overflow-hidden"
    >
      <motion.div 
        style={{ opacity: gradientOpacity }}
        className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent shadowide-events-none"
      />
      <div className="relative h-full w-full">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14 md:h-16">
            <Link href="/" className="flex items-center space-x-2">
              <Image
                src="/images/logo-min.png"
                alt="ShadowIDE Logo"
                width={28}
                height={28}
                priority
                quality={90}
                className="h-7 w-7"
              />
              {showTextLogo && (
                <span className="text-xl font-bold bg-gradient-to-r from-primary to-tertiary bg-clip-text text-transparent">
                  ShadowIDE
                </span>
              )}
            </Link>

            <div className="hidden md:flex items-center space-x-6">
              <Link href="#features" className="text-gray-300 hover:text-primary transition-colors duration-300 text-sm">
                Features
              </Link>
              <Link href="#comparison" className="text-gray-300 hover:text-primary transition-colors duration-300 text-sm">
                Keys
              </Link>
              <Link href="#community" className="text-gray-300 hover:text-primary transition-colors duration-300 text-sm">
                Community
              </Link>
              <Link href="#get-started" className="text-gray-300 hover:text-primary transition-colors duration-300 text-sm">
                Get Started
              </Link>
            </div>

            <div className="flex items-center space-x-3">
              <a
                href="https://github.com/f1shyondrugs/ShadowIDE"
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors duration-300"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.237 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              </a>
              <a
                href="https://discord.gg/vhgc8THmNk"
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors duration-300"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.317 4.37a19.791 19.791 0 00-4.8851-1.5152.0747.0747 0 00-.0785.0371c-.211.3753-.4447.8648-.608 1.2495-1.8447-.2762-3.6677-.2762-5.4878 0-.1634-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0786-.037 19.736 19.736 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.299 12.299 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
                </svg>
              </a>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="text-white/70 hover:text-white transition-colors duration-300"
              >
                {isOpen ? (
                  <XMarkIcon className="h-6 w-6" />
                ) : (
                  <Bars3Icon className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden bg-background/90 backdrop-blur-md"
          >
            <div className="px-4 py-4 space-y-4">
              <Link
                href="#features"
                className="block text-white/70 hover:text-white transition-colors duration-300"
                onClick={() => setIsOpen(false)}
              >
                Features
              </Link>
              <Link
                href="#future"
                className="block text-white/70 hover:text-white transition-colors duration-300"
                onClick={() => setIsOpen(false)}
              >
                Keys
              </Link>
              <Link
                href="#community"
                className="block text-white/70 hover:text-white transition-colors duration-300"
                onClick={() => setIsOpen(false)}
              >
                Join Our Growing Community
              </Link>
              <Link
                href="#get-started"
                className="block text-white/70 hover:text-white transition-colors duration-300"
                onClick={() => setIsOpen(false)}
              >
                Be Part of the Future
              </Link>
              {showDownloadsLink && (
                <Link
                  href="#downloads"
                  className="block text-white/70 hover:text-white transition-colors duration-300"
                  onClick={() => setIsOpen(false)}
                >
                  Downloads
                </Link>
              )}
              <Link
                href="https://github.com/f1shyondrugs/ShadowIDE"
                target="_blank"
                className="block text-white/70 hover:text-white transition-colors duration-300"
                onClick={() => setIsOpen(false)}
              >
                GitHub
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
} 