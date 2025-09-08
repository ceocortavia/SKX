"use client";

import { useState } from "react";
import Button from "../ui/Button";

export default function ContactSection() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: ""
  });
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);
    setTimeout(() => {
      setIsSubmitted(false);
      setFormData({ name: "", email: "", message: "" });
    }, 3000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <section id="contact" className="py-16 lg:py-20 px-6 lg:px-8 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-10 right-10 w-72 h-72 bg-emerald-100/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 left-10 w-64 h-64 bg-violet-100/30 rounded-full blur-3xl"></div>
      </div>
      <div className="max-w-4xl mx-auto relative z-10">
        <div className="text-center mb-12 lg:mb-16">
          <div className="inline-flex items-center gap-3 px-5 py-3 rounded-full bg-white/70 backdrop-blur-md shadow-lg border border-white/20 text-sm font-semibold text-slate-700 mb-6 hover:shadow-xl transition-all duration-300">
            <div className="w-2 h-2 bg-gradient-to-r from-emerald-500 to-green-500 rounded-full"></div>
            <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span>Get In Touch</span>
          </div>
          <h2 className="text-4xl lg:text-6xl font-black text-slate-900 mb-6 tracking-tight">
            Kontakt <span className="bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">Oss</span>
          </h2>
          <p className="text-slate-600 text-lg lg:text-xl leading-relaxed font-medium max-w-2xl mx-auto">
            Klar for å revolusjonere dine HR-prosesser? La oss vise deg hvordan 
            <span className="text-emerald-600 font-semibold"> AI kan transformere</span> din organisasjon.
          </p>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 lg:p-12 shadow-xl border border-white/20">
          {!isSubmitted ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-semibold text-slate-900 mb-3">
                    Navn
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 lg:py-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 bg-white/60 backdrop-blur-sm text-sm lg:text-base"
                    placeholder="Ditt fulle navn"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-slate-900 mb-3">
                    E-post
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 lg:py-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 bg-white/60 backdrop-blur-sm text-sm lg:text-base"
                    placeholder="din@bedrift.no"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="message" className="block text-sm font-semibold text-slate-900 mb-3">
                  Melding
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows={5}
                  className="w-full px-4 py-3 lg:py-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 resize-none bg-white/60 backdrop-blur-sm text-sm lg:text-base"
                  placeholder="Fortell oss om dine HR-utfordringer og hvordan vi kan hjelpe..."
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button 
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 text-white px-6 lg:px-8 py-3 lg:py-4 text-base lg:text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                >
                  Send Melding
                </Button>
                <Button 
                  type="button"
                  className="bg-white/90 hover:bg-white text-slate-900 border border-slate-200 hover:border-slate-300 px-6 lg:px-8 py-3 lg:py-4 text-base lg:text-lg font-semibold rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  Book Demo
                </Button>
              </div>
            </form>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">
                Takk for din henvendelse!
              </h3>
              <p className="text-slate-600 text-lg">
                Vi kontakter deg innen 24 timer for å diskutere dine behov.
              </p>
            </div>
          )}
        </div>

        <div className="mt-10 lg:mt-12 text-center">
          <p className="text-slate-500 text-sm font-medium mb-6">
            Eller kontakt oss direkte
          </p>
          <div className="flex flex-col sm:flex-row gap-8 justify-center items-center">
            <a href="mailto:hei@skillexia.no" className="flex items-center text-slate-700 hover:text-emerald-600 transition-colors text-sm lg:text-base">
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              hei@skillexia.no
            </a>
            <a href="tel:+4740123456" className="flex items-center text-slate-700 hover:text-emerald-600 transition-colors text-sm lg:text-base">
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              +47 401 23 456
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}