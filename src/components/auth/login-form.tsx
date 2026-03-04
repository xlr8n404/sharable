'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  CircleUser, 
  Lock,
  LogIn,
  Eye,
  EyeOff
} from 'lucide-react';
import { Loader } from '@/components/ui/loader';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useLanguage } from '@/components/LanguageProvider';

interface LoginFormProps {
  onSuccess?: () => void;
  onSwitchToRegister?: () => void;
}

export function LoginForm({ onSuccess, onSwitchToRegister }: LoginFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('invalid_credentials'));
      }

        toast.success(t('welcome_back') + '!');
        if (onSuccess) {
          onSuccess();
        } else {
          // Use window.location.href to ensure a full refresh and cookie processing
          window.location.href = '/home';
        }
      } catch (error: any) {
      toast.error(error.message || t('invalid_credentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="w-full flex flex-col items-center gap-6"
    >
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">
          Log in
        </h1>
        <p className="text-neutral-500 text-sm">{t('enter_details_login')}</p>
      </div>

      <form onSubmit={handleLogin} className="w-full space-y-4">
        <div className="space-y-1.5 text-left">
          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.1em] ml-1">
            {t('username')}
          </label>
            <div className="relative">
              <CircleUser className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
              <input
                type="text"
                placeholder="username"
                required
                className="w-full h-[56px] bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl pl-12 pr-4 focus:border-foreground/20 focus:ring-0 transition-all placeholder:text-neutral-500 dark:placeholder:text-neutral-600 text-foreground"
                value={formData.username}
                onChange={(e) => {
                  const value = e.target.value.replace(/\s/g, '');
                  setFormData({ ...formData, username: value });
                }}
              />
            </div>
          </div>

          <div className="space-y-1.5 text-left">
            <div className="flex items-center justify-between ml-1">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.1em]">
                {t('password')}
              </label>
              <button type="button" className="text-[10px] text-neutral-500 hover:text-foreground transition-colors">
                {t('forgot')}
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                required
                className="w-full h-[56px] bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl pl-12 pr-12 focus:border-foreground/20 focus:ring-0 transition-all placeholder:text-neutral-500 dark:placeholder:text-neutral-600 text-foreground"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-[56px] bg-foreground text-background font-bold text-lg rounded-2xl mt-4 flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? (
              <Loader centered={false} className="text-background" />
            ) : (
              <>
                {t('log_in')}
                <LogIn className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        <p className="text-neutral-500 text-sm">
          {t('dont_have_account')}{' '}
          <button 
            onClick={onSwitchToRegister}
            className="text-foreground font-bold hover:underline underline-offset-4"
          >
            {t('create_one')}
          </button>
        </p>
    </motion.div>
  );
}
