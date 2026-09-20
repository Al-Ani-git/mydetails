import { Compass, MessageCirclePlus, Search, Volume2 } from 'lucide-react';

const RoundButton = ({ children }: { children: React.ReactNode }) => <button className="grid h-12 w-12 place-items-center rounded-full border border-[#66717d] bg-black text-white shadow-lg">{children}</button>;

export const MapControls = () => (
  <aside className="absolute right-3 top-[110px] z-20 flex flex-col gap-4">
    <RoundButton><Search size={27} strokeWidth={2.3} /></RoundButton>
    <RoundButton><Volume2 size={25} fill="white" /></RoundButton>
    <RoundButton><Compass size={27} className="fill-[#e63128] text-white" /></RoundButton>
    <RoundButton><MessageCirclePlus size={24} /></RoundButton>
  </aside>
);
