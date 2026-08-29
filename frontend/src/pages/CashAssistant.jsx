import { ScanLine, Banknote } from "lucide-react";
import ActionButton from "@/components/ActionButton";
import PlaceholderBlock from "@/components/PlaceholderBlock";

export default function CashAssistant() {
  return (
    <div className="space-y-8" data-testid="cash-assistant-screen">
      <header className="space-y-2">
        <p className="text-lg font-bold uppercase tracking-widest text-primary">Module</p>
        <h1 className="font-heading text-4xl sm:text-5xl font-black tracking-tight text-white">
          Cash Assistant
        </h1>
      </header>

      <PlaceholderBlock testid="cash-scan-area">
        <Banknote size={64} strokeWidth={2} className="text-primary mb-4" aria-hidden="true" />
        <p className="font-heading text-2xl sm:text-3xl font-bold text-white uppercase">
          Scan your cash
        </p>
        <p className="text-base sm:text-lg text-white mt-2">
          Hold your notes in front of the camera to identify them.
        </p>
      </PlaceholderBlock>

      <ActionButton icon={ScanLine} label="Scan Cash" testid="cash-scan-btn" variant="primary" />

      <section aria-label="Detected notes and total" className="space-y-3">
        <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-white">Detected Notes</h2>
        <div data-testid="cash-detected-area" className="border-4 border-white bg-[#111111] divide-y-4 divide-white">
          <div className="flex items-center justify-between p-5">
            <span className="text-xl sm:text-2xl font-bold text-white">No notes scanned yet</span>
            <span className="text-xl sm:text-2xl font-bold text-primary">—</span>
          </div>
        </div>
        <div
          data-testid="cash-total-area"
          className="flex items-center justify-between border-4 border-primary bg-primary text-black p-5"
        >
          <span className="font-heading text-2xl sm:text-3xl font-black uppercase">Total</span>
          <span className="font-heading text-2xl sm:text-3xl font-black">—</span>
        </div>
      </section>
    </div>
  );
}
