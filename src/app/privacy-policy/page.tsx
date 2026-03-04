'use client';

import { useRouter } from "next/navigation";
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { motion } from "framer-motion";

export default function PrivacyPage() {
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
              <ShieldCheck className="w-3 h-3" />
              Legal
            </div>
            <h1 className="text-4xl font-syne font-bold tracking-tight">Privacy Policy</h1>
            <p className="text-neutral-500 text-sm">Last updated: {lastUpdated}</p>
          </div>

          <div className="space-y-12 text-neutral-400 leading-relaxed border-t border-neutral-900 pt-12">
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white">Overview</h2>
              <p>
                At Sharable, we prioritize your privacy. This policy explains how we collect, use, and protect your data.
              </p>
            </section>
            
            <section className="space-y-4">
              <h3 className="text-xl font-bold text-white">1. Data Collection</h3>
              <p>
                When you create an account on Sharable, we collect your username, email, and password. 
                We also store any content you share, including posts, messages, and profile information.
              </p>
              <ul className="list-disc list-inside text-neutral-500 space-y-2 pl-4">
                <li>Account details (Username, Email)</li>
                <li>Content shared (Posts, Images, Text)</li>
                <li>Usage data (Logs, Device information)</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h3 className="text-xl font-bold text-white">2. How We Use Data</h3>
              <p>
                We use your data to provide our services, improve performance, and maintain security. 
                We do not sell your personal information to third parties.
              </p>
            </section>

            <section className="space-y-4">
              <h3 className="text-xl font-bold text-white">3. Cookies & Advertising</h3>
              <p>
                We may use cookies to personalize your experience and show relevant advertisements, including those through Google AdSense. 
                Third-party vendors, including Google, use cookies to serve ads based on a user's prior visits to your website or other websites.
              </p>
            </section>

            <section className="space-y-4">
              <h3 className="text-xl font-bold text-white">4. Your Rights</h3>
              <p>
                You have the right to access, update, or delete your data at any time. 
                For inquiries, please reach out via our contact channels.
              </p>
            </section>
          </div>
        </motion.div>
      </header>
    </div>
  );
}
