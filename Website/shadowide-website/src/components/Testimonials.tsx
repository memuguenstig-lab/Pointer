'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';

export default function Testimonials() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const testimonials = [
    {
      quote: "ShadowIDE has completely transformed my development workflow. The local AI processing means I can work offline and still get intelligent code suggestions.",
      author: "Haikuu",
      role: "Beginner Developer",
    },
    {
      quote: "The privacy-first approach is exactly what I&apos;ve been looking for. My code never leaves my machine, and the AI assistance is just as good as cloud-based solutions.",
      author: "TheGalitube",
      role: "Full Stack Vibe Coder",
    },
    {
      quote: "As someone who works with sensitive code, ShadowIDE&apos;s local processing gives me peace of mind. The AI suggestions are spot-on and the editor is incredibly responsive.",
      author: "Michael Rodriguez",
      role: "Security Engineer",
    },
  ];

  return (
    <section 
      ref={ref}
      className="relative py-24 overflow-hidden"
    >
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(106,17,203,0.1),transparent_50%)]" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            What Developers <span className="text-primary">Say</span>
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Hear from developers who are using ShadowIDE to write better code, faster.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.author}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.8, ease: "easeOut", delay: index * 0.2 }}
              className="bg-white/5 backdrop-blur-md rounded-xl p-8 border border-white/10 hover:border-white/20 transition-all duration-300"
            >
              <div className="flex flex-col h-full">
                <div className="flex-grow">
                  <p className="text-gray-300 mb-6" dangerouslySetInnerHTML={{ __html: testimonial.quote }} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{testimonial.author}</h3>
                  <p className="text-gray-400">{testimonial.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
} 