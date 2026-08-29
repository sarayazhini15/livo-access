import { Camera, Upload, ReceiptText } from "lucide-react";
import ActionButton from "@/components/ActionButton";
import PlaceholderBlock from "@/components/PlaceholderBlock";

export default function BillChecker() {
  return (
    <div className="space-y-8" data-testid="bill-checker-screen">
      <header className="space-y-2">
        <p className="text-lg font-bold uppercase tracking-widest text-primary">Module</p>
        <h1 className="font-heading text-4xl sm:text-5xl font-black tracking-tight text-white">
          Bill Checker
        </h1>
      </header>

      <PlaceholderBlock testid="bill-capture-area">
        <ReceiptText size={64} strokeWidth={2} className="text-primary mb-4" aria-hidden="true" />
        <p className="font-heading text-2xl sm:text-3xl font-bold text-white uppercase">
          Upload or capture a bill
        </p>
        <p className="text-base sm:text-lg text-white mt-2">
          Take a photo or upload an image of your bill or receipt.
        </p>
      </PlaceholderBlock>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <ActionButton icon={Camera} label="Take Photo" testid="bill-take-photo-btn" variant="primary" />
        <ActionButton icon={Upload} label="Upload Bill" testid="bill-upload-btn" variant="secondary" />
      </div>

      <section aria-label="Bill analysis result" className="space-y-3">
        <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-white">Result</h2>
        <div
          data-testid="bill-result-area"
          className="w-full min-h-[200px] border-4 border-white bg-[#111111] p-6 flex flex-col items-center justify-center text-center"
        >
          <p className="text-xl sm:text-2xl font-bold text-white">
            Your bill details will appear here.
          </p>
          <p className="text-base sm:text-lg text-primary mt-2">
            Totals, taxes and items will be read out for you.
          </p>
        </div>
      </section>
    </div>
  );
}
