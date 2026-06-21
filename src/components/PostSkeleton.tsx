import { Skeleton } from "@/components/ui/skeleton";

export function PostSkeleton({ mediaCount }: { mediaCount?: 1 | 2 | 3 }) {
  return (
    <div className="w-full bg-background border-b border-black/[0.05] dark:border-white/[0.05] animate-pulse">
      <div className="px-4 pt-4 pb-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Left side: Profile photo 40px */}
            <div className="w-[40px] h-[40px] shrink-0">
              <Skeleton className="w-full h-full rounded-full bg-zinc-200 dark:bg-zinc-800" />
            </div>
            {/* Full name: 16px height, 160px width (Updated) */}
            <Skeleton className="h-[16px] w-[160px] bg-zinc-200 dark:bg-zinc-800" />
          </div>
          {/* Right side: Three dot icon 24x24 px */}
          <div className="w-[24px] h-[24px] shrink-0">
            <Skeleton className="w-full h-full rounded-full bg-zinc-100 dark:bg-zinc-900" />
          </div>
        </div>

        {/* Content lines: 3 lines, height 16px */}
        <div className="space-y-2 mb-4">
          <Skeleton className="h-[16px] w-[90%] bg-zinc-100 dark:bg-zinc-900" />
          <Skeleton className="h-[16px] w-full bg-zinc-100 dark:bg-zinc-900" />
          <Skeleton className="h-[16px] w-3/4 bg-zinc-100 dark:bg-zinc-900" />
        </div>

        {/* Interaction buttons */}
        <div className="flex items-center justify-between mt-6">
          {/* Left side: 160px width, 24px height (Updated) */}
          <Skeleton className="h-[24px] w-[160px] bg-zinc-100 dark:bg-zinc-900" />
          {/* Right side: 80px width, 24px height */}
          <Skeleton className="h-[24px] w-[80px] bg-zinc-100 dark:bg-zinc-900" />
        </div>
      </div>
    </div>
  );
}
