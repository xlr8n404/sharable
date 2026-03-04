'use client';

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

export default function CommunityGuidelines() {
  const router = useRouter();

  return (
    <div className="min-h-screen w-full bg-black text-white p-6 font-sans">
      <header className="max-w-3xl mx-auto py-12">
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
          className="space-y-8"
        >
          <h1 className="text-4xl font-syne font-bold">Community Guidelines</h1>
          
          <div className="space-y-6 text-neutral-400 leading-relaxed">
            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">1. Be Kind and Respectful</h2>
              <p>We're a global community. Treat others as you'd like to be treated. Harassment, bullying, or hate speech will not be tolerated.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">2. No Spam</h2>
              <p>Don't use Sharable to spam others or post misleading content. Authentic interaction is what makes this platform work.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">3. Protect Privacy</h2>
              <p>Don't post personal information about others without their consent. Respect everyone's right to privacy.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">4. Share Original Content</h2>
              <p>Post things you created or have the right to share. Respect intellectual property rights.</p>
            </section>
          </div>
        </motion.div>
      </header>
    </div>
  );
}
