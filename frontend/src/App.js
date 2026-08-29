import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { VoiceProvider } from "@/context/VoiceContext";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import BillChecker from "@/pages/BillChecker";
import CashAssistant from "@/pages/CashAssistant";
import ChangeChecker from "@/pages/ChangeChecker";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <VoiceProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/bill-checker" element={<BillChecker />} />
              <Route path="/cash-assistant" element={<CashAssistant />} />
              <Route path="/change-checker" element={<ChangeChecker />} />
            </Route>
          </Routes>
        </VoiceProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
