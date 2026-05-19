'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen, FileText } from 'lucide-react';
import Link from 'next/link';

interface CreateBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateBottomSheet({ isOpen, onClose }: CreateBottomSheetProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/30 z-40"
          />
          
          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-neutral-900 rounded-t-[16px]"
          >
            <div className="max-w-xl mx-auto w-full px-6 py-6">
              {/* Grabber */}
              <div className="flex justify-center pt-2 pb-6">
                <div className="bg-neutral-300 dark:bg-neutral-600 rounded-full" style={{ width: '48px', height: '8px' }} />
              </div>

              {/* Title */}
              <h2 className="text-xl font-bold mb-2 text-foreground">Create</h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">Share your thoughts and stories with the community</p>

              {/* Options */}
              <div className="space-y-3 mb-6">
                <Link
                  href="/create/post"
                  onClick={onClose}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">Create Post</p>
                    <p className="text-sm text-neutral-500">Share your thoughts with the community</p>
                  </div>
                </Link>

                {/* Story option - disabled for now */}
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800 opacity-50 cursor-not-allowed">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">Create Story</p>
                    <p className="text-sm text-neutral-500">Coming soon</p>
                  </div>
                </div>
              </div>

              {/* Close button */}
              <button
                onClick={onClose}
                className="w-full py-3 text-center text-neutral-500 dark:text-neutral-400 font-medium hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
