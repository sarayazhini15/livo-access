export const PlaceholderBlock = ({ children, testid, dashed = true }) => {
  return (
    <div
      data-testid={testid}
      className={`w-full bg-[#111111] p-6 sm:p-8 flex flex-col items-center justify-center text-center ${
        dashed ? "border-4 border-dashed border-primary" : "border-4 border-white"
      }`}
    >
      {children}
    </div>
  );
};

export default PlaceholderBlock;
