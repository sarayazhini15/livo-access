import { Outlet } from "react-router-dom";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";

export const Layout = () => {
  return (
    <div className="h-screen flex flex-col bg-black overflow-hidden">
      <Header />
      <main
        className="livo-scroll flex-1 overflow-y-auto mt-24 mb-32 px-5 py-8 sm:px-10 sm:py-12"
        data-testid="main-content"
      >
        <div className="max-w-3xl mx-auto w-full">
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  );
};

export default Layout;
