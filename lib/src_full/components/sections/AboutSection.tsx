"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect, ReactNode } from "react";

// Define a type for the service object
interface ServiceItem {
  title: string;
  description: string;
  icon: ReactNode;
  metric: number;
  metricPrefix?: string;
  metricSuffix?: string;
  metricLabel: string;
  gradient: string;
  glowColor: string;
  borderColor: string;
}

// Count-up animation hook
function useCountUp(end: number, duration: number = 2000) {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);

  const startCountUp = () => {
    if (hasStarted) return;
    setHasStarted(true);

    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      setCount(Math.floor(end * progress));

      if (progress >= 1) {
        clearInterval(timer);
        setCount(end);
      }
    }, 16);
  };

  return { count, startCountUp };
}

// Create a separate component for service card to use hooks properly
function ServiceCard({
  service,
  index,
  isInView,
}: {
  service: ServiceItem;
  index: number;
  isInView: boolean;
}) {
  const { count: animatedCount, startCountUp } = useCountUp(service.metric, 2000);

  useEffect(() => {
    if (isInView) {
      const timer = setTimeout(() => startCountUp(), 500 + index * 200);
      return () => clearTimeout(timer);
    }
  }, [index, startCountUp, isInView]);

  return (
    <motion.div
      className="group relative"
      variants={{
        hidden: {
          opacity: 0,
          y: 50,
          scale: 0.9,
        },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: {
            type: "spring",
            stiffness: 100,
            damping: 15,
            duration: 0.6,
          },
        },
      }}
      whileHover={{
        y: -8,
        transition: { type: "spring", stiffness: 400 },
      }}
    >
      <motion.div
        className={`absolute inset-0 bg-gradient-to-r ${service.glowColor} rounded-2xl blur-xl transition-all duration-300 opacity-0 group-hover:opacity-100`}
      />

      <div
        className={`relative bg-white/80 backdrop-blur-xl rounded-2xl p-6 lg:p-8 shadow-xl hover:shadow-2xl transition-all duration-300 border border-white/20 ${service.borderColor}`}
      >
        <div className="flex items-center justify-between mb-6">
          <motion.div
            className={`w-12 h-12 lg:w-14 lg:h-14 bg-gradient-to-br ${service.gradient} rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300`}
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            {service.icon}
          </motion.div>

          <div className="text-right">
            <motion.div
              className={`text-2xl lg:text-3xl font-black bg-gradient-to-r ${service.gradient
                .replace("from-", "from-")
                .replace("to-", "to-")} bg-clip-text text-transparent`}
              key={animatedCount}
              initial={{ scale: 1.2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              {service.metricPrefix || ""}
              {animatedCount}
              {service.metricSuffix || ""}
            </motion.div>
            <div className="text-xs lg:text-sm text-slate-500 font-medium">
              {service.metricLabel}
            </div>
          </div>
        </div>

        <motion.h3
          className="text-lg lg:text-xl font-bold text-slate-900 mb-3 group-hover:text-violet-700 transition-colors"
          whileHover={{ x: 2 }}
          transition={{ type: "spring", stiffness: 400 }}
        >
          {service.title}
        </motion.h3>

        <p className="text-slate-600 leading-relaxed text-sm lg:text-base">
          {service.description}
        </p>

        <motion.div
          className="mt-4 flex items-center text-sm font-medium text-violet-600 opacity-0 group-hover:opacity-100 transition-all duration-300"
          whileHover={{ x: 5 }}
          transition={{ type: "spring", stiffness: 400 }}
        >
          <span>Lær mer</span>
          <motion.svg
            className="w-4 h-4 ml-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            whileHover={{ x: 3 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </motion.svg>
        </motion.div>
      </div>
    </motion.div>
  );
}

export default function AboutSection() {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.3 });

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3,
      },
    },
  };

  const services: ServiceItem[] = [
    {
      title: "Lynrask Ytelse",
      description:
        "Våre AI-drevne løsninger leverer resultater på sekunder, ikke timer. Optimaliser dine HR-prosesser med markedets raskeste teknologi.",
      icon: (
        <motion.svg
          className="w-6 h-6 lg:w-7 lg:h-7 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          whileHover={{ scale: 1.2, rotate: 15 }}
          transition={{ type: "spring", stiffness: 400 }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </motion.svg>
      ),
      metric: 99.9,
      metricSuffix: "%",
      metricLabel: "Uptime",
      gradient: "from-blue-500 to-cyan-600",
      glowColor: "from-blue-500/20 to-cyan-500/20",
      borderColor: "group-hover:border-blue-200/50",
    },
    {
      title: "Enterprise Sikkerhet",
      description:
        "GDPR-kompatible løsninger med end-to-end kryptering. Dine sensitive HR-data er beskyttet med militær-grade sikkerhet.",
      icon: (
        <motion.svg
          className="w-6 h-6 lg:w-7 lg:h-7 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          whileHover={{ scale: 1.2, y: -2 }}
          transition={{ type: "spring", stiffness: 400 }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </motion.svg>
      ),
      metric: 2,
      metricPrefix: "SOC ",
      metricLabel: "Compliant",
      gradient: "from-emerald-500 to-green-600",
      glowColor: "from-emerald-500/20 to-green-500/20",
      borderColor: "group-hover:border-emerald-200/50",
    },
    {
      title: "Cutting-Edge AI",
      description:
        "Avancerte maskinlæringsalgoritmer som lærer og tilpasser seg din organisasjon for kontinuerlig forbedring og innovasjon.",
      icon: (
        <motion.svg
          className="w-6 h-6 lg:w-7 lg:h-7 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          whileHover={{ rotate: 360 }}
          transition={{ duration: 0.6 }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </motion.svg>
      ),
      metric: 94,
      metricSuffix: "%",
      metricLabel: "AI Powered",
      gradient: "from-violet-500 to-purple-600",
      glowColor: "from-violet-500/20 to-purple-500/20",
      borderColor: "group-hover:border-violet-200/50",
    },
  ];

  return (
    <section
      ref={sectionRef}
      id="about"
      className="py-16 lg:py-20 px-6 lg:px-8 bg-gradient-to-b from-[#ecf2fa] via-slate-50/50 to-white relative overflow-hidden"
    >
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute top-20 right-10 w-72 h-72 bg-blue-100/20 rounded-full blur-3xl"
          animate={{
            x: [0, 20, 0],
            y: [0, -15, 0],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute bottom-20 left-10 w-80 h-80 bg-violet-100/30 rounded-full blur-3xl"
          animate={{
            x: [0, -25, 0],
            y: [0, 20, 0],
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div
          className="text-center mb-12 lg:mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
        >
          <motion.div
            className="inline-flex items-center gap-3 px-5 py-3 rounded-full bg-white/70 backdrop-blur-md shadow-lg border border-white/20 text-sm font-semibold text-slate-700 mb-6 hover:shadow-xl transition-all duration-300"
            whileHover={{ scale: 1.05, y: -2 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            <motion.div
              className="w-2 h-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <motion.svg
              className="w-4 h-4 text-slate-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.5 }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </motion.svg>
            <span>About Us</span>
          </motion.div>

          <motion.h2
            className="text-4xl lg:text-6xl font-black text-slate-900 mb-6 tracking-tight"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            Hvem er{" "}
            <motion.span
              className="bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              Vi?
            </motion.span>
          </motion.h2>

          <motion.p
            className="text-slate-600 text-lg lg:text-xl max-w-3xl mx-auto leading-relaxed font-medium"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            Vi revolusjonerer HR-bransjen gjennom{" "}
            <span className="text-violet-600 font-semibold">
              intelligente løsninger
            </span>{" "}
            som kombinerer kunstig intelligens med menneskelig ekspertise for å
            skape fremtidens arbeidsplasser.
          </motion.p>
        </motion.div>

        {/* Enhanced Dashboard-style Feature Cards with Animations */}
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8"
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          {services.map((service, idx) => (
            <ServiceCard
              key={idx}
              service={service}
              index={idx}
              isInView={isInView}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
}