"use client";

import { Printer } from "lucide-react";

export default function PrintInvoiceButton() {
  return <button type="button" className="admin-primary-button invoice-print-button" onClick={() => window.print()}><Printer size={17} />Imprimer / enregistrer en PDF</button>;
}
