import { GitFork, X } from 'lucide-react';

export const BottomPanel = () => (
  <section className="absolute bottom-0 z-30 h-[72px] w-full rounded-t-[28px] bg-black shadow-[0_-2px_8px_rgba(0,0,0,.8)]">
    <div className="absolute left-1/2 top-5 h-1 w-5 -translate-x-1/2 rounded bg-[#889999]" />
    <button className="absolute left-2 top-[27px] grid h-12 w-12 place-items-center rounded-full border border-[#49515a] text-white"><X size={29} /></button>
    <div className="pt-7 text-center"><p className="text-[21px] font-medium leading-5 text-[#86d89a]">1 min</p><p className="mt-2 text-[11px] text-[#a0a0a0]">0.4 mi · 20:17</p></div>
    <button className="absolute right-2 top-[27px] grid h-12 w-12 place-items-center rounded-full border border-[#49515a] text-white"><GitFork size={26} /></button>
  </section>
);
