import { useNavigate, useLocation } from "react-router-dom";
import { ReceiptText, Banknote, Coins } from "lucide-react";

const items = [
  { to: "/bill-checker", label: "Bill", icon: ReceiptText, testid: "nav-bill-checker" },
  { to: "/cash-assistant", label: "Cash", icon: Banknote, testid: "nav-cash-assistant" },
  { to: "/change-checker", label: "Change", icon: Coins, testid: "nav-change-checker" },
];

export const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 w-full h-32 border-t-4 border-white bg-black z-50 grid grid-cols-3 gap-2 px-2 py-3"
      data-testid="bottom-nav"
    >
      {items.map(({ to, label, icon: Icon, testid }) => {
        const active = location.pathname === to;
        return (
          <button
            key={to}
            onClick={() => navigate(to)}
            data-testid={testid}
            aria-label={`Go to ${label} module`}
            aria-current={active ? "page" : undefined}
            className={`flex flex-col items-center justify-center gap-2 border-2 transition-colors duration-75 focus:outline-none focus:ring-4 focus:ring-primary focus:ring-offset-2 focus:ring-offset-black ${
              active
                ? "bg-primary text-black border-primary"
                : "bg-black text-white border-transparent hover:border-white"
            }`}
          >
            <Icon size={40} strokeWidth={2.5} aria-hidden="true" />
            <span className="font-heading text-lg sm:text-xl font-bold uppercase tracking-wide">
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
