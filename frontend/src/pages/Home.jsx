import { useNavigate } from "react-router-dom";
import { ReceiptText, Banknote, Coins, ChevronRight } from "lucide-react";

const modules = [
  {
    to: "/bill-checker",
    title: "Bill Checker",
    desc: "Read and verify any bill or receipt.",
    icon: ReceiptText,
    testid: "home-bill-checker",
  },
  {
    to: "/cash-assistant",
    title: "Cash Assistant",
    desc: "Identify notes and count your money.",
    icon: Banknote,
    testid: "home-cash-assistant",
  },
  {
    to: "/change-checker",
    title: "Change Checker",
    desc: "Confirm you received the right change.",
    icon: Coins,
    testid: "home-change-checker",
  },
];

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="space-y-10" data-testid="home-screen">
      <section className="space-y-4">
        <h1 className="font-heading text-5xl sm:text-6xl font-black tracking-tight text-white">
          LIVO
        </h1>
        <p className="text-xl sm:text-2xl font-bold text-primary leading-relaxed">
          See. Verify. Pay. Independently.
        </p>
        <p className="text-lg sm:text-xl text-white leading-relaxed">
          Choose a tool to get started.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-6" aria-label="Modules">
        {modules.map(({ to, title, desc, icon: Icon, testid }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            data-testid={testid}
            aria-label={`${title}. ${desc}`}
            className="group w-full min-h-[140px] flex items-center gap-5 bg-white text-black border-4 border-white p-6 text-left shadow-[6px_6px_0px_0px_#FFD600] active:translate-x-[6px] active:translate-y-[6px] active:shadow-none transition-transform duration-75 hover:bg-primary hover:border-primary focus:outline-none focus:ring-4 focus:ring-primary focus:ring-offset-4 focus:ring-offset-black"
          >
            <span className="shrink-0 flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-black text-primary border-2 border-black group-hover:bg-black">
              <Icon size={44} strokeWidth={2.5} aria-hidden="true" />
            </span>
            <span className="flex-1">
              <span className="block font-heading text-2xl sm:text-3xl font-extrabold uppercase tracking-wide">
                {title}
              </span>
              <span className="block text-base sm:text-lg font-medium mt-1">
                {desc}
              </span>
            </span>
            <ChevronRight size={40} strokeWidth={3} aria-hidden="true" className="shrink-0" />
          </button>
        ))}
      </section>
    </div>
  );
}
