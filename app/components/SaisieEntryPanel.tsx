'use client';

import { useState } from 'react';
import TransactionForm, { type TransactionFormPrefill } from './TransactionForm';
import ReceiptScanPanel from './ReceiptScanPanel';

interface SubCategory {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
  type: string;
  subCategories?: SubCategory[];
}

interface SaisieEntryPanelProps {
  categories: Category[];
}

// Petit wrapper client : le scan de reçu et le formulaire manuel doivent
// partager un état (les champs lus sur la photo pré-remplissent le
// formulaire) — page.tsx étant un composant serveur, ce state ne peut pas
// vivre là-bas, d'où ce wrapper dédié.
export default function SaisieEntryPanel({ categories }: SaisieEntryPanelProps) {
  const [prefill, setPrefill] = useState<TransactionFormPrefill | null>(null);

  return (
    <>
      <ReceiptScanPanel onUse={setPrefill} />
      <TransactionForm categories={categories} prefill={prefill} onPrefillApplied={() => setPrefill(null)} />
    </>
  );
}
