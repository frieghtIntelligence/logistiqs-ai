import { useState, useRef, useCallback, useEffect } from "react";

interface ProofOfDeliveryProps {
  loadId: string;
  onSubmit: (data: {
    recipientName: string;
    signatureBase64: string;
    photoBase64: string | null;
    notes: string;
  }) => Promise<void>;
  submitting: boolean;
}

export function ProofOfDelivery({ loadId, onSubmit, submitting }: ProofOfDeliveryProps) {
  const [recipientName, setRecipientName] = useState("");
  const [notes, setNotes] = useState("");
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [signatureBase64, setSignatureBase64] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasCtx, setCanvasCtx] = useState<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      setCanvasCtx(ctx);
    }
  }, []);

  const getCanvasPos = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      if ("touches" in e && e.touches.length > 0) {
        return {
          x: e.touches[0].clientX - rect.left,
          y: e.touches[0].clientY - rect.top,
        };
      }
      return {
        x: (e as React.MouseEvent).clientX - rect.left,
        y: (e as React.MouseEvent).clientY - rect.top,
      };
    },
    [],
  );

  const startDrawing = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault();
      if (!canvasCtx) return;
      const pos = getCanvasPos(e);
      canvasCtx.beginPath();
      canvasCtx.moveTo(pos.x, pos.y);
      setIsDrawing(true);
    },
    [canvasCtx, getCanvasPos],
  );

  const draw = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault();
      if (!canvasCtx || !isDrawing) return;
      const pos = getCanvasPos(e);
      canvasCtx.lineTo(pos.x, pos.y);
      canvasCtx.stroke();
    },
    [canvasCtx, isDrawing, getCanvasPos],
  );

  const stopDrawing = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setSignatureBase64(canvas.toDataURL("image/png"));
    }
  }, [isDrawing]);

  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvasCtx) return;
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureBase64(null);
  }, [canvasCtx]);

  const handlePhotoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleSubmit = async () => {
    if (!recipientName.trim() || !signatureBase64) {
      alert("Please fill in recipient name and provide a signature.");
      return;
    }
    await onSubmit({
      recipientName: recipientName.trim(),
      signatureBase64,
      photoBase64,
      notes: notes.trim(),
    });
    setShowConfirmation(true);
  };

  if (showConfirmation) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-10 w-10 text-emerald-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-white">Delivery Confirmed!</h3>
        <p className="mt-2 text-sm text-gray-400">
          Proof of delivery has been submitted for load #{loadId}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-800/50 bg-emerald-950/20 p-4 text-center">
        <p className="text-sm font-medium text-emerald-400">
          🎉 You&apos;ve arrived! Please complete the delivery confirmation below.
        </p>
      </div>

      {/* Recipient Name */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Recipient Name *
        </label>
        <input
          type="text"
          required
          placeholder="Full name of person receiving the shipment"
          value={recipientName}
          onChange={(e) => setRecipientName(e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-base text-white placeholder:text-gray-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none transition-colors"
        />
      </div>

      {/* Signature Pad */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Signature *
        </label>
        <p className="mb-2 text-xs text-gray-500">Sign in the box below using your finger</p>
        <div className="overflow-hidden rounded-xl border-2 border-dashed border-gray-600 bg-gray-800">
          <canvas
            ref={canvasRef}
            width={320}
            height={150}
            className="w-full touch-none"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
        </div>
        <button
          type="button"
          onClick={clearSignature}
          className="mt-2 text-xs text-gray-400 hover:text-gray-300 transition-colors"
        >
          Clear signature
        </button>
      </div>

      {/* Photo Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Photo (optional)
        </label>
        <p className="mb-2 text-xs text-gray-500">Take a photo of the delivered goods or paperwork</p>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 hover:border-gray-600 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.864 47.864 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
          </svg>
          <span className="text-sm text-gray-400">
            {photoBase64 ? "Photo captured ✓" : "Tap to take or select a photo"}
          </span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoUpload}
            className="hidden"
          />
        </label>
        {photoBase64 && (
          <div className="mt-2 overflow-hidden rounded-lg border border-gray-700">
            <img src={photoBase64} alt="Delivery proof" className="max-h-48 w-full object-cover" />
          </div>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Notes (optional)
        </label>
        <textarea
          rows={2}
          placeholder="Any delivery notes, damage reports, etc."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-base text-white placeholder:text-gray-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none transition-colors"
        />
      </div>

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || !recipientName.trim() || !signatureBase64}
        className="w-full rounded-xl bg-emerald-600 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-500 transition-all disabled:cursor-not-allowed disabled:opacity-50 min-h-[52px] flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Submitting…
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Confirm Delivery
          </>
        )}
      </button>
    </div>
  );
}
