/* eslint-disable */
'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function LatencyComparison() {
  const ref = useRef(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: string; left: string; transform: string }>({ 
    top: '100%', 
    left: '50%', 
    transform: 'translateX(-50%)' 
  });

  useEffect(() => {
    if (showTooltip && tooltipRef.current) {
      const tooltip = tooltipRef.current;
      const rect = tooltip.getBoundingClientRect();
      
      // Check if tooltip would go off the right edge
      if (rect.right > window.innerWidth) {
        setTooltipPosition({
          top: '100%',
          left: 'auto',
          transform: 'translateX(-100%)'
        });
      }
      // Check if tooltip would go off the left edge
      else if (rect.left < 0) {
        setTooltipPosition({
          top: '100%',
          left: '0',
          transform: 'none'
        });
      }
      // Default centered position
      else {
        setTooltipPosition({
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)'
        });
      }
    }
  }, [showTooltip]);

  const data = [
    {
      name: "ShadowIDE",
      latency: 0.1, // 100ms
      color: "#8B5CF6", // Vibrant purple
      description: "Local processing means instant responses",
      model: "DeepSeek-R1-Distill-Qwen-7B",
      specs: "RTX 4090 FE 24GB, 192GB RAM, intel i9-14900K"
    },
    {
      name: "ChatGPT",
      latency: 0.8, // 800ms
      color: "#10a37f", // ChatGPT green
      description: "Cloud-based processing with network latency",
      model: "GPT-4o",
      specs: "Cloud-based processing"
    },
    {
      name: "Microsoft Copilot",
      latency: 1.2, // 1200ms
      color: "#0078d4", // Microsoft blue
      description: "Cloud processing with additional security checks",
      model: "Microsoft Prometheus",
      specs: "Cloud-based processing"
    },
    {
      name: "Claude AI",
      latency: 0.9, // 900ms
      color: "#5a67d8", // Claude indigo
      description: "Cloud-based processing with advanced capabilities",
      model: "Claude 3.7-Sonnet",
      specs: "Cloud-based processing"
    }
  ];

  const networkInfo = [
    { label: "Download Speed", value: "100 Mbps" },
    { label: "Upload Speed", value: "80 Mbps" },
    { label: "Ping", value: "10 ms" },
    { label: "Server Location", value: "Frankfurt, DE" },
  ];

  interface TooltipProps {
    active?: boolean;
    payload?: Array<{
      value: number;
    }>;
    label?: string;
  }

  const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
    if (active && payload && payload.length) {
      const item = data.find(d => d.name === label);
      return (
        <div className="bg-black/90 p-4 rounded-lg border border-white/10 backdrop-blur-sm">
          <p className="font-bold">{label}</p>
          <p className="text-gray-300">{payload[0].value}s latency</p>
          <p className="text-sm text-gray-400 mt-1">{item?.description}</p>
          <div className="mt-2 pt-2 border-t border-white/10">
            <p className="text-sm text-gray-300">Model: <span className="text-gray-400">{item?.model}</span></p>
            <p className="text-sm text-gray-300">Specs: <span className="text-gray-400">{item?.specs}</span></p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <section 
      id="latency"
      ref={ref}
      className="relative py-24 overflow-hidden bg-gradient-to-b from-primary/5 to-transparent"
    >
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            First Token{" "}
            <span className="text-primary">Latency</span>
          </h2>
          <div className="flex items-center justify-center gap-2 text-xl text-gray-300 max-w-3xl mx-auto">
            <p>See how ShadowIDE's local processing compares to cloud-based alternatives</p>
            <div className="relative">
              <button
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className="text-gray-500 hover:text-gray-300 transition-colors"
              >
                *
              </button>
              {showTooltip && (
                <motion.div
                  ref={tooltipRef}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute w-64 bg-black/90 p-4 rounded-lg border border-white/10 backdrop-blur-sm z-50"
                  style={{
                    top: tooltipPosition.top,
                    left: tooltipPosition.left,
                    transform: tooltipPosition.transform
                  }}
                >
                  <h3 className="font-bold mb-2 text-gray-300">Network Conditions</h3>
                  <div className="space-y-1">
                    {networkInfo.map((info, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span className="text-gray-400">{info.label}</span>
                        <span className="text-gray-300">{info.value}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    * These conditions may affect cloud-based services
                  </p>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
          className="h-[400px] w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{
                top: 20,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis 
                dataKey="name" 
                stroke="rgba(255,255,255,0.5)"
                tick={{ fill: 'rgba(255,255,255,0.7)' }}
              />
              <YAxis 
                stroke="rgba(255,255,255,0.5)"
                tick={{ fill: 'rgba(255,255,255,0.7)' }}
                label={{ 
                  value: 'Seconds', 
                  angle: -90, 
                  position: 'insideLeft',
                  fill: 'rgba(255,255,255,0.7)'
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="latency" 
                radius={[4, 4, 0, 0]}
                animationDuration={2000}
                animationBegin={0}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.4 }}
          className="mt-12 text-center text-gray-400"
        >
          <p>Lower latency means faster code suggestions and a smoother coding experience</p>
        </motion.div>
      </div>
    </section>
  );
} 