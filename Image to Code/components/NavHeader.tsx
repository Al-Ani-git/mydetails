import { ArrowLeft, Mic } from 'lucide-react';

export const NavHeader = () => (
  <>
    <section className="absolute left-1 top-5 z-10 w-[calc(100%-10px)] overflow-hidden rounded-tl-3xl rounded-br-xl rounded-tr-md bg-[#07863f] shadow-lg">
      <div className="flex h-[74px] items-center px-5">
        <ArrowLeft size={38} strokeWidth={3.1} />
        <div className="ml-5 flex items-baseline gap-1"><span className="text-[25px] font-bold">Lowell</span><span className="text-sm">St</span></div>
        <button className="ml-auto grid h-12 w-12 place-items-center rounded-full bg-white text-[#4285f4] shadow"><Mic size={25} strokeWidth={2.5} /></button>
      </div>
      <div className="flex items-center gap-1 px-4 pb-2 text-[20px] font-semibold"><span>0.4</span><span className="text-[12px]">mi</span></div>
    </section>
    <div className="absolute left-2 top-[94px] z-10 rounded-br-md bg-[#08793d] px-2 py-2 text-[14px] font-medium shadow">Then <span className="ml-1 text-lg">↗</span></div>
    <div className="absolute right-0 top-[119px] z-10 rounded-l-xl bg-[#3877e7] px-4 py-2 text-sm font-semibold shadow">↩ Lowell St</div>
  </>
);
