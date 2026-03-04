'use client';

import { useRouter } from "next/navigation";
import { ArrowLeft, Scale } from 'lucide-react';
import { motion } from "framer-motion";

export default function TermsPage() {
  const router = useRouter();
  const lastUpdated = "March 3, 2026";

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
          className="space-y-8"
        >
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-neutral-900 border border-neutral-800 rounded-full text-[10px] font-bold uppercase tracking-widest text-neutral-500">
              <Scale className="w-3 h-3" />
              Agreement
            </div>
            <h1 className="text-4xl font-syne font-bold tracking-tight">Terms of Service</h1>
            <p className="text-neutral-500 text-sm">Last updated: {lastUpdated}</p>
          </div>

          <div className="space-y-12 text-neutral-400 leading-relaxed border-t border-neutral-900 pt-12">
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white">1. Using Sharable</h2>
              <p>
                You must be at least 13 years old to use Sharable. You are responsible for your account and the content you post. 
                We reserve the right to suspend or terminate accounts that violate our guidelines.
              </p>
            </section>

            <section className="space-y-4">
              <h3 className="text-xl font-bold text-white">2. Content Guidelines</h3>
              <p>
                Users are prohibited from posting content that is illegal, harmful, threatening, abusive, or otherwise violates 
                community standards. Sharable reserves the right to remove any content at its sole discretion.
              </p>
            </section>

            <section className="space-y-4">
              <h3 className="text-xl font-bold text-white">3. Intellectual Property</h3>
              <p>
                You retain ownership of the content you share on Sharable. However, by posting content, 
                you grant us a worldwide, non-exclusive license to host, store, and distribute your content.
              </p>
            </section>

            <section className="space-y-4">
              <h3 className="text-xl font-bold text-white">4. Limitation of Liability</h3>
              <p>
                Sharable provides the platform "as-is" and is not responsible for any indirect, 
                incidental, or consequential damages arising from your use of the service.
              </p>
            </section>
          </div>
        </motion.div>
      </header>
    </div>
  );
}
