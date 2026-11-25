"use client";

/**
 * Lecture du QR code de retrait par la caméra du navigateur (bibliothèque qr-scanner),
 * avec saisie manuelle du code de secours si la caméra est indisponible.
 */

import { Camera, CameraOff, Keyboard, ScanLine } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function QrScannerPanel({ onCode, busy }: { onCode: (code: string) => void; busy: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  // Dernière version du callback, lue par le scanner sans le redémarrer.
  const onCodeRef = useRef(onCode);
  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  useEffect(() => {
    if (!active || !videoRef.current) return;
    let stopped = false;
    let scanner: { start: () => Promise<void>; stop: () => void; destroy: () => void } | null = null;
    let lastCode = "";

    (async () => {
      // Import dynamique : la bibliothèque n'existe que côté navigateur.
      const QrScanner = (await import("qr-scanner")).default;
      if (stopped || !videoRef.current) return;
      const instance = new QrScanner(
        videoRef.current,
        (result) => {
          if (result.data && result.data !== lastCode) {
            lastCode = result.data;
            onCodeRef.current(result.data);
          }
        },
        { returnDetailedScanResult: true, highlightScanRegion: true, highlightCodeOutline: true, preferredCamera: "environment" },
      );
      scanner = instance;
      try {
        await instance.start();
      } catch {
        setCameraError("Caméra indisponible. Autorise l'accès à la caméra ou saisis le code de secours.");
        setActive(false);
      }
    })();

    return () => {
      stopped = true;
      scanner?.stop();
      scanner?.destroy();
    };
  }, [active]);

  return (
    <div className="surface bg-card p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-xl font-bold"><ScanLine className="size-5 text-primary" /> Scanner un QR code</h2>
      <p className="mt-1 text-sm text-muted-foreground">Le propriétaire te présente son billet de retrait.</p>

      <div className="relative mt-4 aspect-square w-full overflow-hidden rounded-2xl border border-border bg-[#0E1A16]">
        <video ref={videoRef} className={active ? "size-full object-cover" : "hidden"} muted playsInline aria-label="Flux de la caméra" />
        {!active && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-[#EAF3EF]">
            <div>
              <Camera className="mx-auto size-10 text-glow-400" />
              <p className="mt-3 text-sm">{cameraError ?? "La caméra s'allume quand tu lances le scan."}</p>
            </div>
          </div>
        )}
      </div>
      <Button
        type="button"
        className="mt-4 w-full"
        variant={active ? "outline" : "highlight"}
        onClick={() => {
          setCameraError(null);
          setActive((v) => !v);
        }}
      >
        {active ? <><CameraOff /> Arrêter la caméra</> : <><Camera /> Lancer le scan</>}
      </Button>

      <form
        className="mt-6 space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (manual.trim()) onCode(manual.trim());
        }}
      >
        <label htmlFor="manual-code" className="flex items-center gap-2 text-sm font-semibold"><Keyboard className="size-4" /> Ou saisis le code de secours</label>
        <div className="flex gap-2">
          <Input
            id="manual-code"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="XXXX-XXXX-XXXX"
            className="font-mono tracking-widest uppercase"
            autoComplete="off"
            spellCheck={false}
          />
          <Button type="submit" variant="outline" disabled={busy || manual.trim().length < 8}>Vérifier</Button>
        </div>
      </form>
    </div>
  );
}
