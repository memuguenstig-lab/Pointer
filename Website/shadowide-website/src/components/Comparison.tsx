'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';

export default function Comparison() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const features = [
    {
      feature: "Open Source",
      shadowide: "✓ Fully open-source",
      others: "✗ Proprietary",
    },
    {
      feature: "Local Processing",
      shadowide: "✓ Runs entirely on your machine",
      others: "✗ Cloud-based",
    },
    {
      feature: "Privacy",
      shadowide: "✓ Code never leaves your device",
      others: "✗ Code sent to external servers",
    },
    {
      feature: "Internet Required",
      shadowide: "✓ Works completely offline",
      others: "✗ Requires constant connection",
    },
    {
      feature: "Usage Limits",
      shadowide: "✓ No throttling or limits",
      others: "✗ Usage quotas and limits",
    },
    {
      feature: "Customization",
      shadowide: "✓ Fully customizable",
      others: "✗ Limited customization",
    },
  ];

  return (
    <section 
      id="comparison"
      ref={ref}
      className="relative py-24 overflow-hidden bg-gradient-to-b from-primary/5 to-transparent"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(106,17,203,0.1),transparent_50%)]"></div>
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            How ShadowIDE{" "}
            <span className="text-primary">Stands Out</span>
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            See how ShadowIDE compares to traditional AI coding assistants
          </p>
        </motion.div>

        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="border-b border-white/10">
                <th className="py-4 px-6 text-left text-gray-300 font-semibold">Feature</th>
                <th className="py-4 px-6 text-left text-primary font-semibold">ShadowIDE</th>
                <th className="py-4 px-6 text-left text-gray-400 font-semibold">Other AI Assistants</th>
              </tr>
            </thead>
            <tbody>
              {features.map((item, index) => (
                <motion.tr
                  key={item.feature}
                  initial={{ opacity: 0, y: 20 }}
                  animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 0 }}
                  transition={{ duration: 0.8, ease: "easeOut", delay: index * 0.1 }}
                  className="border-b border-white/5 hover:bg-white/5"
                >
                  <td className="py-4 px-6 text-gray-300">{item.feature}</td>
                  <td className="py-4 px-6 text-primary">{item.shadowide}</td>
                  <td className="py-4 px-6 text-gray-400">{item.others}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
} 