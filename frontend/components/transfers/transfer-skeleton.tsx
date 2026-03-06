import { Skeleton } from "@/components/ui/skeleton"

interface TransferSkeletonProps {
  count?: number
}

export function TransferSkeleton({ count = 3 }: TransferSkeletonProps) {
  return (
    <div className="grid gap-3">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="glass-card rounded-3xl p-4 md:p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-9 w-9 rounded-2xl" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
              <div className="grid gap-2 md:grid-cols-3">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
            <Skeleton className="h-7 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}
