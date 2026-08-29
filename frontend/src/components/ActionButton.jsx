export const ActionButton = ({
  icon: Icon,
  label,
  onClick,
  testid,
  variant = "primary",
}) => {
  const styles =
    variant === "primary"
      ? "bg-primary text-black border-primary shadow-[6px_6px_0px_0px_#FFFFFF]"
      : "bg-white text-black border-white shadow-[6px_6px_0px_0px_#FFD600]";

  return (
    <button
      onClick={onClick}
      data-testid={testid}
      className={`w-full min-h-[88px] flex items-center justify-center gap-4 border-4 px-6 py-4 font-heading text-2xl sm:text-3xl font-bold uppercase tracking-wide active:translate-x-[6px] active:translate-y-[6px] active:shadow-none transition-transform duration-75 focus:outline-none focus:ring-4 focus:ring-primary focus:ring-offset-4 focus:ring-offset-black ${styles}`}
    >
      {Icon && <Icon size={40} strokeWidth={2.5} aria-hidden="true" />}
      <span>{label}</span>
    </button>
  );
};

export default ActionButton;
