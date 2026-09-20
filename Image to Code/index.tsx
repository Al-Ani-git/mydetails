import { BottomPanel } from './components/BottomPanel';
import { MapBackdrop } from './components/MapBackdrop';
import { MapControls } from './components/MapControls';
import { NavHeader } from './components/NavHeader';

const App = () => {
  return (
    <main className="relative mx-auto h-[100dvh] min-h-[620px] max-w-[430px] overflow-hidden bg-[#172536] font-sans text-white">
      <MapBackdrop />
      <NavHeader />
      <MapControls />
      <BottomPanel />
    </main>
  );
};

export default App;
