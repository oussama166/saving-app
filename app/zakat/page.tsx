"use client";

import { useEffect, useState } from "react";
import { Gem, Info } from "lucide-react";
import FeatureGate from "../components/FeatureGate";

// Dupliqué depuis lib/zakat.ts (constantes pures) plutôt qu'importé
// directement : ce fichier est un composant client, et lib/zakat.ts importe
// aussi prisma/getEnrichedPortfolioAssets (code serveur uniquement) — un
// import direct enverrait Prisma dans le bundle navigateur.
const NISAB_GOLD_GRAMS = 85;
const NISAB_SILVER_GRAMS = 595;
const ZAKAT_RATE = 0.025;

interface Breakdown {
  cashAndBankBalances: number;
  portfolioValue: number;
  totalDebts: number;
  zakatableWealth: number;
}

const fmt = (n: number) => `${n.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} DH`;

export default function ZakatPage() {
  return (
    <FeatureGate featureKey="zakat" featureName="Zakat">
      <ZakatPageContent />
    </FeatureGate>
  );
}

function ZakatPageContent() {
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [basis, setBasis] = useState<"gold" | "silver">("gold");
  const [goldPrice, setGoldPrice] = useState("900"); // DH/gramme — indicatif, à mettre à jour toi-même
  const [silverPrice, setSilverPrice] = useState("11");

  useEffect(() => {
    fetch("/api/zakat")
      .then((res) => res.json())
      .then((result) => {
        if (result.success) setBreakdown(result.data);
      })
      .catch((err) => console.error("Zakat fetch error:", err))
      .finally(() => setLoading(false));
  }, []);

  const pricePerGram = Number(basis === "gold" ? goldPrice : silverPrice) || 0;
  const nisabGrams = basis === "gold" ? NISAB_GOLD_GRAMS : NISAB_SILVER_GRAMS;
  const nisabValue = pricePerGram * nisabGrams;
  const zakatableWealth = breakdown?.zakatableWealth ?? 0;
  const eligible = pricePerGram > 0 && zakatableWealth >= nisabValue;
  const zakatDue = eligible ? zakatableWealth * ZAKAT_RATE : 0;

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8 font-sans bg-page text-body">
      <div className="mx-auto space-y-8 max-w-3xl">
        <div className="flex items-center gap-4 p-6 border bg-surface rounded-2xl border-line">
          <div className="p-3 border bg-emerald-600/20 rounded-xl border-emerald-500/20">
            <Gem className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight uppercase text-ink">Calculateur de Zakat</h1>
            <p className="text-subtle text-sm mt-0.5">
              Estimation de la Zakat al-Mal (2,5%) due sur ton patrimoine, basée sur le nisab (or ou argent).
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 flex gap-3">
          <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-xs text-body-soft leading-relaxed">
            Estimation simplifiée et informative, pas un avis religieux ni fiscal. Elle compte l&apos;intégralité de
            tes liquidités et de ton portfolio, moins tes dettes actives (voir page Dettes & Prêts) — sans distinguer
            biens personnels et actifs commerciaux, et sans tenir compte de la durée de possession (hawl, un an
            lunaire). Ajuste les montants ci-dessous selon ta situation, et vérifie auprès d&apos;un érudit de
            confiance pour une décision définitive.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-12 h-12 border-b-2 border-emerald-500 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="p-6 border bg-surface rounded-2xl border-line space-y-3">
              <h2 className="text-sm font-black tracking-tight uppercase text-ink">Ton patrimoine</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-surface-alt/50 border border-line/50">
                  <p className="text-[10px] text-subtle font-bold uppercase tracking-widest">Liquidités</p>
                  <p className="text-lg font-black text-ink mt-1">{fmt(breakdown?.cashAndBankBalances ?? 0)}</p>
                </div>
                <div className="p-3 rounded-xl bg-surface-alt/50 border border-line/50">
                  <p className="text-[10px] text-subtle font-bold uppercase tracking-widest">Portfolio</p>
                  <p className="text-lg font-black text-ink mt-1">{fmt(breakdown?.portfolioValue ?? 0)}</p>
                </div>
                <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/20">
                  <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest">Dettes actives</p>
                  <p className="text-lg font-black text-red-400 mt-1">− {fmt(breakdown?.totalDebts ?? 0)}</p>
                </div>
              </div>
              <div className="pt-3 border-t border-line-subtle flex items-center justify-between">
                <p className="text-sm font-bold text-body-soft">Patrimoine zakatable</p>
                <p className="text-xl font-black text-ink">{fmt(zakatableWealth)}</p>
              </div>
            </div>

            <div className="p-6 border bg-surface rounded-2xl border-line space-y-4">
              <h2 className="text-sm font-black tracking-tight uppercase text-ink">Seuil (Nisab)</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setBasis("gold")}
                  className={`flex-1 px-3 py-2.5 text-sm font-bold rounded-xl border transition-colors ${
                    basis === "gold"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      : "border-line text-body-soft hover:bg-surface-alt"
                  }`}
                >
                  Or ({NISAB_GOLD_GRAMS}g)
                </button>
                <button
                  onClick={() => setBasis("silver")}
                  className={`flex-1 px-3 py-2.5 text-sm font-bold rounded-xl border transition-colors ${
                    basis === "silver"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      : "border-line text-body-soft hover:bg-surface-alt"
                  }`}
                >
                  Argent ({NISAB_SILVER_GRAMS}g)
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-subtle">
                  Prix du {basis === "gold" ? "gramme d'or" : "gramme d'argent"} (DH) — à mettre à jour toi-même
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={basis === "gold" ? goldPrice : silverPrice}
                  onChange={(e) =>
                    basis === "gold" ? setGoldPrice(e.target.value) : setSilverPrice(e.target.value)
                  }
                  className="w-full sm:w-56 bg-page border border-line text-body rounded-lg p-3 focus:border-emerald-500 outline-none transition-colors text-sm"
                />
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-body-soft">Valeur du nisab</span>
                <span className="font-bold text-ink">{fmt(nisabValue)}</span>
              </div>
            </div>

            <div
              className={`p-6 border rounded-2xl space-y-2 ${
                eligible ? "border-emerald-500/30 bg-emerald-500/5" : "border-line bg-surface"
              }`}
            >
              <p className="text-xs font-bold uppercase tracking-widest text-subtle">
                {eligible ? "Zakat due (2,5%)" : "Zakat non due"}
              </p>
              <p className={`text-3xl font-black ${eligible ? "text-emerald-400" : "text-ink"}`}>{fmt(zakatDue)}</p>
              <p className="text-xs text-subtle">
                {eligible
                  ? `Ton patrimoine (${fmt(zakatableWealth)}) dépasse le nisab (${fmt(nisabValue)}).`
                  : `Ton patrimoine (${fmt(zakatableWealth)}) est sous le nisab (${fmt(nisabValue)}) — pas de zakat due sur la richesse cette année.`}
              </p>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
