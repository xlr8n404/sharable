'use client';

import { useRouter } from "next/navigation";
import { ArrowLeft } from 'lucide-react';
import { motion } from "framer-motion";

export default function AboutPage() {
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
          className="space-y-12"
        >
          <div className="space-y-6">
            <h1 className="text-4xl font-syne font-bold tracking-tight">About Sharable</h1>
            <p className="text-xl text-neutral-400 leading-relaxed">
              Sharable is a modern social media platform designed for seamless sharing and authentic connections. 
              We believe that sharing should be simple, fast, and secure.
            </p>
          </div>

          <section className="space-y-6">
            <h2 className="text-2xl font-bold">Our Mission</h2>
            <p className="text-neutral-400 leading-relaxed">
              Our mission is to empower individuals to share their stories, moments, and ideas with the world 
              without the noise and complexity of traditional social media. We focus on a minimalist experience 
              that puts the content and the creator first.
            </p>
          </section>

          <section className="space-y-6">
            <h2 className="text-2xl font-bold">Why Sharable?</h2>
            <div className="grid gap-4">
              <div className="p-6 bg-neutral-900 rounded-2xl border border-neutral-800">
                <h3 className="font-bold mb-2">Simplicity</h3>
                <p className="text-neutral-500 text-sm">A clean interface that lets you focus on what matters most.</p>
              </div>
              <div className="p-6 bg-neutral-900 rounded-2xl border border-neutral-800">
                <h3 className="font-bold mb-2">Speed</h3>
                <p className="text-neutral-500 text-sm">Optimized for performance to ensure your content is delivered instantly.</p>
              </div>
              <div className="p-6 bg-neutral-900 rounded-2xl border border-neutral-800">
                <h3 className="font-bold mb-2">Privacy</h3>
                <p className="text-neutral-500 text-sm">We prioritize your data security and respect your digital privacy.</p>
              </div>
            </div>
          </section>
        </motion.div>
      </header>
    </div>
  );
}
