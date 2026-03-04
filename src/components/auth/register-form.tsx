'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  CircleUser, 
  Calendar, 
  Camera, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  Lock,
  UserCircle2,
  Eye,
  EyeOff,
  XCircle
} from 'lucide-react';
import { Loader } from '@/components/ui/loader';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface RegisterFormProps {
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
}

export function RegisterForm({ onSuccess, onSwitchToLogin }: RegisterFormProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    dob: '',
    gender: '',
    avatar: null as File | null,
    avatarUrl: '',
    password: '',
  });

  useEffect(() => {
    if (formData.username.length < 3) {
      setUsernameStatus('idle');
      return;
    }

    const timer = setTimeout(async () => {
      setUsernameStatus('checking');
      try {
        const res = await fetch(`/api/auth/check-username?username=${formData.username}`);
        const data = await res.json();
        setUsernameStatus(data.available ? 'available' : 'taken');
      } catch {
        setUsernameStatus('idle');
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.username]);

  const handleNext = () => {
    if (step === 1 && usernameStatus === 'taken') {
      toast.error('Username is already taken');
      return;
    }
    setStep(s => s + 1);
  };
  const handlePrev = () => setStep(s => s - 1);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFormData({ 
        ...formData, 
        avatar: file, 
        avatarUrl: URL.createObjectURL(file) 
      });
    }
  };

  const handleRegister = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
          fullName: formData.fullName,
          dob: formData.dob || null,
          gender: formData.gender,
          avatarUrl: '',
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create account');
      }

      if (formData.avatar && data.userId) {
        const fileExt = formData.avatar.name.split('.').pop();
        const fileName = `${data.userId}-${Math.random()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, formData.avatar);
        
        if (!uploadError) {
          await supabase.from('profiles').update({ avatar_url: fileName }).eq('id', data.userId);
        }
      }

      toast.success('Account created successfully!');
      if (onSuccess) {
        onSuccess();
      } else {
        // Use window.location.href to ensure a full refresh and cookie processing
        window.location.href = '/home';
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      toast.error(error.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const canProceedStep1 = formData.fullName && formData.username.length >= 3 && formData.dob && formData.gender && usernameStatus === 'available';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="w-full flex flex-col items-center gap-6"
    >
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Create Account</h1>
        <p className="text-neutral-500 text-sm">Step {step} of 3</p>
      </div>

      <div className="w-full">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex flex-col gap-4 text-left"
            >
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.1em] ml-1">Full Name</label>
                  <div className="relative">
                    <UserCircle2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
                    <input
                      type="text"
                      placeholder="Full Name"
                      maxLength={20}
                      className="w-full h-[56px] bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl pl-12 pr-4 focus:border-foreground/20 focus:ring-0 transition-all placeholder:text-neutral-500 dark:placeholder:text-neutral-600 text-foreground"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.1em] ml-1">Username</label>
                  <div className="relative">
                    <CircleUser className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
                    <input
                      type="text"
                      placeholder="username"
                      maxLength={15}
                      className={`w-full h-[56px] bg-neutral-100 dark:bg-neutral-900 border rounded-2xl pl-12 pr-12 focus:ring-0 transition-all placeholder:text-neutral-500 dark:placeholder:text-neutral-600 text-foreground ${
                        usernameStatus === 'taken' 
                          ? 'border-red-500/50 focus:border-red-500' 
                          : usernameStatus === 'available'
                            ? 'border-green-500/50 focus:border-green-500'
                            : 'border-neutral-200 dark:border-neutral-800 focus:border-foreground/20'
                      }`}
                      value={formData.username}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                        setFormData({ ...formData, username: value });
                      }}
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      {usernameStatus === 'checking' && <Loader centered={false} className="text-neutral-500" />}
                      {usernameStatus === 'available' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                      {usernameStatus === 'taken' && <XCircle className="w-5 h-5 text-red-500" />}
                    </div>
                  </div>
                  {usernameStatus !== 'idle' && (
                    <p className={`text-[10px] ml-1 font-medium ${
                      usernameStatus === 'taken' ? 'text-red-500' : 'text-green-500'
                    }`}>
                      {usernameStatus === 'taken' ? 'Username is already taken' : 'Username is available'}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.1em] ml-1">Date of Birth</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500 pointer-events-none" />
                    <input
                      type="date"
                      className="w-full h-[56px] bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl pl-12 pr-4 focus:border-foreground/20 focus:ring-0 transition-all text-foreground [color-scheme:light] dark:[color-scheme:dark]"
                      value={formData.dob}
                      onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.1em] ml-1">Gender</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['Male', 'Female'].map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setFormData({ ...formData, gender: g })}
                        className={`h-[56px] rounded-2xl border font-bold transition-all ${
                          formData.gender === g
                            ? 'bg-foreground text-background border-foreground'
                            : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  disabled={!canProceedStep1}
                  onClick={handleNext}
                  className="w-full h-[56px] bg-foreground text-background font-bold text-lg rounded-2xl mt-4 flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  Continue
                  <ArrowRight className="w-5 h-5" />
                </button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex flex-col items-center gap-6"
              >
                <div className="relative group">
                  <div className="w-32 h-32 rounded-full bg-neutral-100 dark:bg-neutral-900 border-2 border-neutral-200 dark:border-neutral-800 overflow-hidden flex items-center justify-center">
                    {formData.avatarUrl ? (
                      <img src={formData.avatarUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <CircleUser className="w-16 h-16 text-neutral-300 dark:text-neutral-700" />
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 p-2 bg-foreground text-background rounded-full cursor-pointer hover:opacity-90 transition-all shadow-lg">
                    <Camera className="w-5 h-5" />
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                  </label>
                </div>

                <div className="text-center space-y-1">
                  <h3 className="text-xl font-bold text-foreground">{formData.fullName || 'Your Name'}</h3>
                  <p className="text-neutral-500">@{formData.username || 'username'}</p>
                </div>

                <div className="w-full grid grid-cols-2 gap-4 mt-4">
                  <button
                    onClick={handlePrev}
                    className="h-[56px] bg-transparent text-foreground border border-neutral-200 dark:border-neutral-800 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-neutral-100 dark:hover:bg-neutral-900 active:scale-[0.98] transition-all"
                  >
                    <ArrowLeft className="w-5 h-5" />
                    Back
                  </button>
                  <button
                    onClick={handleNext}
                    className="h-[56px] bg-foreground text-background rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                  >
                    Next
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex flex-col gap-4 text-left"
              >
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.1em] ml-1">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
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
                  <p className="text-[10px] text-neutral-500 ml-1">Must be at least 6 characters</p>
                </div>

                <div className="w-full flex flex-col gap-3 mt-4">
                  <button
                    disabled={loading || formData.password.length < 6}
                    onClick={handleRegister}
                    className="w-full h-[56px] bg-foreground text-background font-bold text-lg rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader centered={false} className="text-background" />
                    ) : (
                      <>
                        Complete Setup
                        <CheckCircle2 className="w-5 h-5" />
                      </>
                    )}
                  </button>

                  <button
                    disabled={loading}
                    onClick={handlePrev}
                    className="w-full h-[56px] bg-transparent text-neutral-500 font-bold rounded-2xl flex items-center justify-center gap-2 hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to profile
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="text-neutral-500 text-sm mt-2">
          Already have an account?{' '}
          <button 
            onClick={onSwitchToLogin}
            className="text-foreground font-bold hover:underline underline-offset-4"
          >
            Log in
          </button>
        </p>
    </motion.div>
  );
}
