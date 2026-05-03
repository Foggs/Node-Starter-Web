import { Loader2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface SlowRequestHintProps {
  message?: string;
  onCancel?: () => void;
  cancelLabel?: string;
  className?: string;
}

/**
 * Non-blocking inline banner shown when a long-running request has exceeded
 * the "expected" duration. Optionally surfaces a Cancel button so users can
 * abort the in-flight request and recover (retry, re-record, etc).
 *
 * Uses role="status" + aria-live="polite" so assistive tech announces the
 * hint without interrupting the user.
 */
export function SlowRequestHint({
  message = "Still working — this is taking longer than usual.",
  onCancel,
  cancelLabel = "Cancel and retry",
  className,
}: SlowRequestHintProps) {
  return (
    <Card
      role="status"
      aria-live="polite"
      className={`border-amber-200 bg-amber-50 ${className ?? ""}`}
    >
      <CardContent className="pt-3 pb-3 flex items-center gap-3">
        <Loader2
          className="w-4 h-4 text-amber-600 animate-spin shrink-0"
          aria-hidden="true"
        />
        <p className="text-sm text-amber-800 flex-1 leading-snug">{message}</p>
        {onCancel && (
          <Button
            size="sm"
            variant="outline"
            className="border-amber-300 text-amber-800 hover:bg-amber-100 gap-1 shrink-0"
            onClick={onCancel}
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
            {cancelLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
