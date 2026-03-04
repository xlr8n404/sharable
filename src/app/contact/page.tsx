'use client';

import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, MapPin, Phone } from 'lucide-react';
import { motion } from "framer-motion";

export default function ContactPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans selection:bg-white selection:text-black">
      <header className="max-w-3xl mx-auto w-full px-6 py-12">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-neutral-500 hover:text-white transition-colors mb-12"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-bold uppercase tracking-wider">Back</span>
        </button>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center text-center gap-12"
        >
          <div className="w-20 h-20 bg-neutral-900 rounded-3xl flex items-center justify-center border border-neutral-800">
            <Mail className="w-10 h-10 text-neutral-500" />
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-syne font-bold tracking-tight">Get in Touch</h1>
            <p className="text-xl text-neutral-400 max-w-lg mx-auto leading-relaxed">
              We're currently building our support and contact channels to better serve our growing community.
            </p>
          </div>
          
          <div className="px-8 py-3 bg-neutral-900 border border-neutral-800 rounded-full font-bold text-xs tracking-widest uppercase text-neutral-500 animate-pulse">
            Coming Soon
          </div>

          <div className="grid md:grid-cols-3 gap-12 pt-12 text-center md:text-left opacity-50 w-full border-t border-neutral-900">
            <div className="space-y-4">
              <div className="w-10 h-10 bg-neutral-900 rounded-2xl flex items-center justify-center border border-neutral-800 mx-auto md:mx-0">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold mb-1 text-white">Email</h3>
                <p className="text-sm text-neutral-500">support@sharable.com</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="w-10 h-10 bg-neutral-900 rounded-2xl flex items-center justify-center border border-neutral-800 mx-auto md:mx-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold mb-1 text-white">Office</h3>
                <p className="text-sm text-neutral-500">Global Tech Center</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="w-10 h-10 bg-neutral-900 rounded-2xl flex items-center justify-center border border-neutral-800 mx-auto md:mx-0">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold mb-1 text-white">Phone</h3>
                <p className="text-sm text-neutral-500">+1 (800) SHARABLE</p>
              </div>
            </div>
          </div>
        </motion.div>
      </header>
    </div>
  );
}
