"use client";

/**
 * Avis de recherche partageable (WhatsApp, Facebook, statut…).
 *
 * Orea dessine une affiche aux couleurs de la charte sur un <canvas> : type de pièce,
 * INITIALES seulement, commune, et un QR code qui mène au formulaire « J'ai trouvé ».
 * Quiconque tombe sur la pièce scanne l'affiche et la déclare en 1 minute.
 * Aucune donnée sensible : ni nom complet, ni numéro, ni photo.
 */

import { Download, Megaphone, Share2 } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { atCommune, COMMUNE_LABEL } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { LostReport } from "@/lib/types";

const W = 1080;
const H = 1350;
const INK = "#0E1A16";
const ORANGE = "#F08A24";
const EMERALD = "#0F5C47";
const MINT = "#B5E8D4";

function initialsOf(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[\s'-]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((w) => `${w[0].toUpperCase()}.`)
    .join(" ");
}

function cssFont(variable: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value || fallback;
}

function pin(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, body: string, ring: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 140, s / 140);
  ctx.fillStyle = body;
  ctx.fill(new Path2D("M70 0C108.66 0 140 31.34 140 70C140 104.5 109.6 134 79.6 170.6C74.6 176.7 65.4 176.7 60.4 170.6C30.4 134 0 104.5 0 70C0 31.34 31.34 0 70 0Z"));
  ctx.fillStyle = ring;
  ctx.beginPath();
  ctx.arc(70, 70, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ORANGE;
  ctx.beginPath();
  ctx.arc(70, 70, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

async function drawPoster(canvas: HTMLCanvasElement, lost: LostReport) {
  await document.fonts.ready;
  const heading = cssFont("--font-sora", "Arial");
  const body = cssFont("--font-inter", "Arial");
  const ctx = canvas.getContext("2d")!;
  canvas.width = W;
  canvas.height = H;

  // Fond et formes du collage
  ctx.fillStyle = ORANGE;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = EMERALD;
  ctx.beginPath();
  ctx.arc(W - 120, 140, 300, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = MINT;
  ctx.beginPath();
  ctx.arc(110, H - 120, 190, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(W - 110, H - 110, 34, 0, Math.PI * 2);
  ctx.stroke();

  // Logo
  pin(ctx, 80, 72, 62, INK, "#FFFFFF");
  ctx.fillStyle = INK;
  ctx.font = `800 64px ${heading}`;
  ctx.fillText("orea", 160, 136);

  // Titre
  ctx.font = `700 34px ${body}`;
  ctx.fillText("AVIS DE RECHERCHE", 80, 290);
  ctx.font = `800 118px ${heading}`;
  const docLine = lost.doc_type === "cni" ? "CNI perdue" : `${lost.doc_type_label}`;
  const words = docLine.split(" ");
  let line = "";
  let y = 410;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > W - 160) {
      ctx.fillText(line, 76, y);
      line = word;
      y += 120;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, 76, y);
  if (lost.doc_type !== "cni") {
    y += 120;
    ctx.fillText("perdue", 76, y);
  }

  // Carte d'informations
  const cardY = y + 60;
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, 76, cardY, W - 152, 300, 48);
  ctx.fillStyle = INK;
  ctx.font = `600 34px ${body}`;
  ctx.fillText("Titulaire (initiales)", 130, cardY + 80);
  ctx.font = `800 76px ${heading}`;
  ctx.fillText(initialsOf(lost.holder_name), 130, cardY + 165);
  ctx.font = `500 36px ${body}`;
  const where = lost.commune_lost ? `Perdue ${atCommune(lost.commune_lost, COMMUNE_LABEL[lost.commune_lost] ?? "")}` : "Perdue à Abidjan";
  const when = lost.lost_on ? ` · le ${formatDate(lost.lost_on, false)}` : "";
  ctx.fillText(`${where}${when}`, 130, cardY + 240);

  // QR code vers le formulaire « J'ai trouvé »
  const qrY = cardY + 340;
  const qr = document.createElement("canvas");
  await QRCode.toCanvas(qr, `${window.location.origin}/declarer/trouve`, {
    margin: 1,
    width: 240,
    color: { dark: INK, light: "#FFFFFF" },
  });
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, 76, qrY, 280, 280, 36);
  ctx.drawImage(qr, 96, qrY + 20, 240, 240);
  ctx.fillStyle = INK;
  ctx.font = `800 46px ${heading}`;
  ctx.fillText("Tu l'as trouvée ?", 400, qrY + 90);
  ctx.font = `500 32px ${body}`;
  ["Scanne ce code et déclare-la", "en 1 minute. Son propriétaire", "sera prévenu automatiquement."].forEach((l, i) =>
    ctx.fillText(l, 400, qrY + 150 + i * 44),
  );

  ctx.font = `600 28px ${body}`;
  ctx.fillStyle = INK;
  ctx.fillText("orea · pièces perdues & retrouvées à Abidjan", 80, H - 50);
}

export function SharePoster({ lost, className }: { lost: LostReport; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const id = requestAnimationFrame(() => {
      if (!canvasRef.current) return;
      drawPoster(canvasRef.current, lost).then(() => !cancelled && setReady(true));
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [open, lost]);

  const blob = () =>
    new Promise<Blob>((resolve, reject) =>
      canvasRef.current?.toBlob((b) => (b ? resolve(b) : reject(new Error("image"))), "image/png"),
    );
  const share = async () => {
    const text = `Avis de recherche Orea : ${lost.doc_type_label} perdue. Tu l'as trouvée ? Déclare-la ici : ${window.location.origin}/declarer/trouve`;
    const file = new File([await blob()], "avis-de-recherche-orea.png", { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text, title: "Avis de recherche Orea" });
      } catch {
        /* partage annulé */
      }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
      toast.info("Ajoute l'affiche téléchargée à ton message WhatsApp.");
      await download();
    }
  };

  const download = async () => {
    const url = URL.createObjectURL(await blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = "avis-de-recherche-orea.png";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setReady(false); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          <Megaphone /> Avis de recherche
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-[2rem] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">Ton avis de recherche</DialogTitle>
          <DialogDescription>
            Partage-le dans tes groupes WhatsApp : celui qui trouve ta pièce scanne le code et la déclare. Seules tes
            initiales apparaissent.
          </DialogDescription>
        </DialogHeader>
        <canvas
          ref={canvasRef}
          className="aspect-[4/5] w-full rounded-2xl bg-highlight shadow-lg"
          aria-label={`Affiche : ${lost.doc_type_label} perdue, initiales ${initialsOf(lost.holder_name)}`}
        />
        <div className="grid grid-cols-2 gap-2">
          <Button variant="highlight" onClick={share} disabled={!ready}>
            <Share2 /> Partager
          </Button>
          <Button variant="outline" onClick={download} disabled={!ready}>
            <Download /> Télécharger
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
