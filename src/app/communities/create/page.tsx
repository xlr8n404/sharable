'use client';
import { useNavBack } from '@/components/NavigationHistoryProvider';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Upload, ImageOff } from 'lucide-react';
import { toast } from 'sonner';
import { BottomNav } from '@/components/BottomNav';

export default function CreateCommunityPage() {
  const router = useRouter();
  const { goBack } = useNavBack();
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    description: '',
    avatar_url: '',
    cover_url: '',
    is_private: false,
  });
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const getUser = async () => {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      if (!data.user) {
        router.push('/login');
      } else {
        setCurrentUser(data.user);
      }
    };
    getUser();
  }, [router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as any;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'avatar_url' | 'cover_url') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          [field]: reader.result as string,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Community name is required');
      return;
    }

    if (!formData.username.trim()) {
      toast.error('Community username is required');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/communities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          creator_id: currentUser.id,
        }),
      });

      if (res.ok) {
        const { data } = await res.json();
        toast.success('Community created successfully!');
        router.push(`/community/${data.id}`);
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to create community');
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center gap-4 px-4 bg-background">
        <button
          onClick={() => goBack()}
          className="p-2 hover:bg-accent rounded-full transition-colors"
        >
          <ArrowLeft size={24} strokeWidth={1.5} />
        </button>
        <h1 className="text-xl font-bold font-[family-name:var(--font-syne)]">Create Community</h1>
      </header>

      <main className="w-full pt-20 px-4">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Profile Picture Upload */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">Community Profile Picture</label>
            <div className="relative w-20 h-20">
              {formData.avatar_url ? (
                <img
                  src={formData.avatar_url}
                  alt="Community avatar"
                  className="w-20 h-20 rounded-full object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                  <ImageOff size={32} className="text-muted-foreground" strokeWidth={1.5} />
                </div>
              )}
              <label className="absolute bottom-0 right-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center cursor-pointer hover:bg-primary/90 transition-colors">
                <Upload size={16} strokeWidth={2} />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'avatar_url')}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Cover Photo Upload */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">Cover Photo</label>
            <div className="relative w-full h-32 rounded-lg overflow-hidden">
              {formData.cover_url ? (
                <img
                  src={formData.cover_url}
                  alt="Community cover"
                  className="w-full h-32 object-cover"
                />
              ) : (
                <div className="w-full h-32 bg-muted flex items-center justify-center">
                  <ImageOff size={40} className="text-muted-foreground" strokeWidth={1.5} />
                </div>
              )}
              <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                <Upload size={24} className="text-white" strokeWidth={2} />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'cover_url')}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Name & Username */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Full Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Community name"
                className="w-full px-4 py-3 bg-muted rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder-muted-foreground"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Username *</label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                placeholder="@username"
                className="w-full px-4 py-3 bg-muted rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder-muted-foreground"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Tell us about your community..."
              rows={4}
              className="w-full px-4 py-3 bg-muted rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder-muted-foreground resize-none"
            />
          </div>

          {/* Privacy Setting */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-foreground">Privacy Setting</label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-accent transition-colors">
                <input
                  type="radio"
                  name="privacy"
                  value="public"
                  checked={!formData.is_private}
                  onChange={() => setFormData(prev => ({ ...prev, is_private: false }))}
                  className="w-4 h-4"
                />
                <div>
                  <div className="font-medium text-foreground">Public</div>
                  <div className="text-xs text-muted-foreground">Anyone can view posts and interact</div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-accent transition-colors">
                <input
                  type="radio"
                  name="privacy"
                  value="private"
                  checked={formData.is_private}
                  onChange={() => setFormData(prev => ({ ...prev, is_private: true }))}
                  className="w-4 h-4"
                />
                <div>
                  <div className="font-medium text-foreground">Private</div>
                  <div className="text-xs text-muted-foreground">Only members can view posts and interact</div>
                </div>
              </label>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-6">
            <button
              type="button"
              onClick={() => goBack()}
              className="flex-1 px-4 py-3 border border-border rounded-lg text-foreground hover:bg-accent transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </main>

      <BottomNav />
    </div>
  );
}
