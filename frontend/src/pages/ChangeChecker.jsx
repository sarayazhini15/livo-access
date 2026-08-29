import { ScanLine, Coins } from "lucide-react";
import ActionButton from "@/components/ActionButton";

export default function ChangeChecker() {
  return (
    <div className="space-y-8" data-testid="change-checker-screen">
      <header className="space-y-2">
        <p className="text-lg font-bold uppercase tracking-widest text-primary">Module</p>
        <h1 className="font-heading text-4xl sm:text-5xl font-black tracking-tight text-white">
          Change Checker
        </h1>
      </header>

      <div className="flex items-start gap-4 border-4 border-white bg-[#111111] p-6">
        <Coins size={56} strokeWidth={2} className="text-primary shrink-0" aria-hidden="true" />
        <p className="text-lg sm:text-xl text-white leading-relaxed">
          LIVO will compare the change you <span className="text-primary font-bold">expected</span> with
          the change you <span className="text-primary font-bold">received</span> and tell you if it is correct.
        </p>
      </div>

      <section aria-label="Change comparison" className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div
          data-testid="expected-change-area"
          className="border-4 border-white bg-[#111111] p-6 min-h-[160px] flex flex-col justify-between"
        >
          <span className="text-lg font-bold uppercase tracking-widest text-primary">Expected Change</span>
          <span className="font-heading text-3xl sm:text-4xl font-black text-white mt-4">—</span>
        </div>
        <div
          data-testid="received-change-area"
          className="border-4 border-white bg-[#111111] p-6 min-h-[160px] flex flex-col justify-between"
        >
          <span className="text-lg font-bold uppercase tracking-widest text-primary">Received Change</span>
          <span className="font-heading text-3xl sm:text-4xl font-black text-white mt-4">—</span>
        </div>
      </section>

      <div
        data-testid="change-result-area"
        className="border-4 border-dashed border-primary bg-[#111111] p-6 text-center"
      >
        <p className="text-xl sm:text-2xl font-bold text-white">
          The comparison result will appear here.
        </p>
      </div>

      <ActionButton icon={ScanLine} label="Scan Received Change" testid="change-scan-btn" variant="primary" />
    </div>
  );
}
