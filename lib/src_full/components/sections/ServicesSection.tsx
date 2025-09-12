"use client";

import { motion, useInView, AnimatePresence, Variants } from "framer-motion";
import { useRef, useState } from "react";

export default function ServicesSection() {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.2 });
  const [expandedService, setExpandedService] = useState<number | null>(0);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.3
      }
    }
  };

  const cardVariants: Variants = {
    hidden: { 
      opacity: 0, 
      y: 30,
      scale: 0.95 
    },
    visible: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15,
        duration: 0.6
      }
    }
  };

  const services = [
    {
      title: "AI Rekruttering",
      shortDesc: "Automatiser hele rekrutteringsprosessen med intelligente algoritmer",
      fullDesc: "Vår AI-drevne rekrutteringsmotor analyserer CV-er, matcher kandidater mot stillinger, og foreslår de beste kandidatene basert på ferdigheter, erfaring og kulturell fit. Spar opptil 80% tid på screening og øk kvaliteten på ansettelser.",
      icon: (
        <motion.svg 
          className="w-6 h-6 text-white" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
          whileHover={{ scale: 1.2, rotate: 15 }}
          transition={{ type: "spring", stiffness: 400 }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </motion.svg>
      ),
      features: [
        "Automatisk CV-parsing og analyse",
        "Intelligente kandidatmatch",
        "Bias-redusert screening",
        "Real-time kandidatranking"
      ],
      gradient: "from-blue-500 to-cyan-600",
      glowColor: "from-blue-500/20 to-cyan-500/20"
    },
    {
      title: "Smart Onboarding",
      shortDesc: "Personaliserte introduksjonsprogrammer som øker medarbeiderengasjement",
      fullDesc: "Lag skreddersydde onboarding-opplevelser som tilpasser seg hver enkelt medarbeiders rolle, erfaring og læringsstil. Vår AI optimerer prosessen kontinuerlig basert på feedback og resultater.",
      icon: (
        <motion.svg 
          className="w-6 h-6 text-white" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
          whileHover={{ rotate: 360 }}
          transition={{ duration: 0.6 }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </motion.svg>
      ),
      features: [
        "Personaliserte læringsforløp",
        "Automatiske check-in påminnelser",
        "Progress tracking og analytics",
        "Integrert buddy-system"
      ],
      gradient: "from-emerald-500 to-green-600",
      glowColor: "from-emerald-500/20 to-green-500/20"
    },
    {
      title: "Performance Analytics",
      shortDesc: "Avanserte analyser som avdekker skjulte talent-insights",
      fullDesc: "Få dyp innsikt i medarbeiderprestasjoner gjennom avanserte analytics og prediktive modeller. Identifiser høytytere, oppdage områder for forbedring, og ta datadrevne beslutninger for organisasjonsutvikling.",
      icon: (
        <motion.svg 
          className="w-6 h-6 text-white" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
          whileHover={{ scale: 1.1, y: -2 }}
          transition={{ type: "spring", stiffness: 400 }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </motion.svg>
      ),
      features: [
        "Real-time performance dashboards",
        "Prediktive talent-analyser",
        "360-graders feedback system",
        "Personaliserte utviklingsplaner"
      ],
      gradient: "from-violet-500 to-purple-600",
      glowColor: "from-violet-500/20 to-purple-500/20"
    },
    {
      title: "Learning & Development",
      shortDesc: "AI-kurert kompetanseutvikling tilpasset hver medarbeider",
      fullDesc: "Våre intelligente læringssystemer identifiserer kompetansegap og anbefaler personaliserte kursforløp. Med adaptive learning-teknologi sikrer vi optimal læring for hver enkelt medarbeider.",
      icon: (
        <motion.svg 
          className="w-6 h-6 text-white" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
          whileHover={{ scale: 1.2, rotate: -15 }}
          transition={{ type: "spring", stiffness: 400 }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </motion.svg>
      ),
      features: [
        "AI-kurerte læringsbaner",
        "Adaptive learning algorithms",
        "Skill gap analysis",
        "Sertifisering og badges"
      ],
      gradient: "from-orange-500 to-red-600",
      glowColor: "from-orange-500/20 to-red-500/20"
    }
  ];

  return (
    <section ref={sectionRef} id="tjenester" className="py-16 lg:py-24 px-6 lg:px-8 bg-gradient-to-b from-white via-slate-50/30 to-[#f8fafd] relative z-0 overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <motion.div 
          className="absolute top-1/4 left-0 w-96 h-96 bg-violet-100/20 rounded-full blur-3xl"
          animate={{ 
            x: [0, 50, 0],
            y: [0, -30, 0],
            scale: [1, 1.2, 1]
          }}
          transition={{ 
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div 
          className="absolute bottom-1/4 right-0 w-80 h-80 bg-blue-100/30 rounded-full blur-3xl"
          animate={{ 
            x: [0, -40, 0],
            y: [0, 25, 0]
          }}
          transition={{ 
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        <motion.div 
          className="text-center mb-12 lg:mb-20"
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
              className="w-2 h-2 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full"
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </motion.svg>
            <span>Våre Tjenester</span>
          </motion.div>
          
          <motion.h2 
            className="text-4xl lg:text-6xl font-black text-slate-900 mb-6 tracking-tight"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <motion.span 
              className="bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              AI-Powered
            </motion.span> HR-Løsninger
          </motion.h2>
          
          <motion.p 
            className="text-slate-600 text-lg lg:text-xl max-w-3xl mx-auto leading-relaxed font-medium"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            Fra rekruttering til utvikling – våre intelligente løsninger 
            <span className="text-violet-600 font-semibold"> automatiserer og optimaliserer</span> hele medarbeiderlivssyklusen.
          </motion.p>
        </motion.div>

        {/* Enhanced Accordion Services */}
        <motion.div 
          className="space-y-4 lg:space-y-6"
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          {services.map((service, index) => {
            const isExpanded = expandedService === index;
            
            return (
              <motion.div 
                key={index}
                className="group"
                variants={cardVariants}
                layout
              >
                <motion.div 
                  className={`relative cursor-pointer transition-all duration-300 ${
                    isExpanded 
                      ? 'bg-white/90 backdrop-blur-xl shadow-2xl' 
                      : 'bg-white/60 backdrop-blur-md shadow-lg hover:shadow-xl'
                  } rounded-2xl border border-white/20 overflow-hidden`}
                  onClick={() => setExpandedService(isExpanded ? null : index)}
                  whileHover={{ 
                    scale: isExpanded ? 1 : 1.02,
                    y: isExpanded ? 0 : -2
                  }}
                  transition={{ type: "spring", stiffness: 400 }}
                  layout
                >
                  {/* Gradient Glow Effect */}
                  <motion.div 
                    className={`pointer-events-none absolute inset-0 bg-gradient-to-r ${service.glowColor} rounded-2xl blur-xl transition-all duration-300 ${
                      isExpanded ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'
                    }`}
                  />
                  
                  {/* Service Header */}
                  <div className="relative p-6 lg:p-8">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 lg:gap-6 flex-1">
                        <motion.div 
                          className={`w-14 h-14 lg:w-16 lg:h-16 bg-gradient-to-br ${service.gradient} rounded-2xl flex items-center justify-center shadow-lg`}
                          whileHover={{ scale: 1.1, rotate: 5 }}
                          transition={{ type: "spring", stiffness: 400 }}
                        >
                          {service.icon}
                        </motion.div>
                        
                        <div className="flex-1">
                          <motion.h3 
                            className="text-xl lg:text-2xl font-bold text-slate-900 mb-2"
                            layout
                          >
                            {service.title}
                          </motion.h3>
                          <motion.p 
                            className="text-slate-600 text-sm lg:text-base leading-relaxed"
                            layout
                          >
                            {service.shortDesc}
                          </motion.p>
                        </div>
                      </div>
                      
                      <motion.div 
                        className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
                          isExpanded 
                            ? 'bg-violet-100 text-violet-600' 
                            : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
                        }`}
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <motion.svg 
                          className="w-5 h-5 lg:w-6 lg:h-6" 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </motion.svg>
                      </motion.div>
                    </div>
                  </div>

                  {/* Expandable Content */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <motion.div 
                          className="px-6 lg:px-8 pb-6 lg:pb-8 border-t border-slate-100/50"
                          initial={{ y: -20 }}
                          animate={{ y: 0 }}
                          transition={{ delay: 0.1, duration: 0.3 }}
                        >
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 pt-6">
                            <div>
                              <h4 className="text-lg font-bold text-slate-900 mb-4">Detaljert beskrivelse</h4>
                              <p className="text-slate-600 leading-relaxed mb-6">
                                {service.fullDesc}
                              </p>
                              <motion.div 
                                className="inline-flex items-center gap-2 px-4 py-2 bg-violet-100 text-violet-700 rounded-xl text-sm font-semibold hover:bg-violet-200 transition-colors cursor-pointer"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                              >
                                <span>Lær mer</span>
                                <motion.svg 
                                  className="w-4 h-4" 
                                  fill="none" 
                                  stroke="currentColor" 
                                  viewBox="0 0 24 24"
                                  whileHover={{ x: 2 }}
                                  transition={{ type: "spring", stiffness: 400 }}
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </motion.svg>
                              </motion.div>
                            </div>
                            
                            <div>
                              <h4 className="text-lg font-bold text-slate-900 mb-4">Nøkkelfunksjoner</h4>
                              <ul className="space-y-3">
                                {service.features.map((feature, featureIndex) => (
                                  <motion.li 
                                    key={featureIndex}
                                    className="flex items-center gap-3 text-slate-600"
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.2 + featureIndex * 0.1 }}
                                  >
                                    <motion.div 
                                      className={`w-2 h-2 bg-gradient-to-r ${service.gradient} rounded-full flex-shrink-0`}
                                      whileHover={{ scale: 1.5 }}
                                      transition={{ type: "spring", stiffness: 400 }}
                                    />
                                    <span className="text-sm lg:text-base">{feature}</span>
                                  </motion.li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}