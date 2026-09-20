import { MapPin } from 'lucide-react';

const Road = ({ className }: { className: string }) => <div className={`absolute rounded-full ${className}`} />;

export const MapBackdrop = () => {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#172536]">
      <div className="absolute inset-0 opacity-80 [background-image:linear-gradient(26deg,transparent_0%,transparent_47%,#43576c_47.4%,#43576c_48.3%,transparent_48.7%,transparent_100%),linear-gradient(155deg,transparent_0%,transparent_52%,#344a60_52.4%,#344a60_53.2%,transparent_53.7%,transparent_100%)] [background-size:190px_190px,240px_220px]" />
      <Road className="left-[45%] top-[-80px] h-[760px] w-[8px] rotate-[6deg] bg-[#788792]" />
      <Road className="left-[46%] top-[-80px] h-[770px] w-[2px] rotate-[6deg] bg-[#a3adb3]" />
      <Road className="left-[-15%] top-[250px] h-[7px] w-[130%] rotate-[-6deg] bg-[#667789]" />
      <Road className="left-[-15%] top-[255px] h-[2px] w-[130%] rotate-[-6deg] bg-[#99a4ac]" />
      <Road className="left-[-20%] top-[393px] h-[5px] w-[110%] rotate-[34deg] bg-[#51677a]" />
      <Road className="left-[0] top-[488px] h-[6px] w-[95%] rotate-[42deg] bg-[#61758a]" />
      <Road className="left-[20px] top-[321px] h-[3px] w-[105px] rotate-[-23deg] bg-[#456076]" />
      <div className="absolute left-[53%] top-[91px] h-[520px] w-[6px] rotate-[6deg] bg-[#03a9e8] shadow-[0_0_0_3px_rgba(0,153,226,.45)]" />
      <div className="absolute left-[55%] top-[112px] h-[385px] w-[2px] rotate-[6deg] bg-[#a8e9fc]" />
      <div className="absolute left-[54%] top-[123px] -translate-x-1/2 rotate-[6deg] text-[10px] font-semibold tracking-wide text-[#b4ebff] [writing-mode:vertical-rl]">Endicott St</div>
      <div className="absolute left-[35%] top-[145px] text-[11px] text-[#8b99aa]">Lowell St</div>
      <div className="absolute left-[16%] top-[422px] text-[13px] text-[#81a58a]">Farnham Park</div>
      <div className="absolute left-[55%] top-[379px] text-[11px] text-[#9fa9b5]">Parkview Ln</div>
      <div className="absolute left-[48%] top-[231px] text-[11px] text-[#9ba5b2]">Warren St</div>
      <div className="absolute left-[7%] top-[253px] text-[11px] text-[#9ba5b2]">Drake Way</div>
      <div className="absolute left-[5%] top-[313px] text-[11px] text-[#9ba5b2]">S. Berry St</div>
      <div className="absolute left-[48%] top-[109px] h-4 w-4 rounded-full border-2 border-white bg-[#e4eff4] shadow-lg" />
      <MapPin className="absolute left-[45%] top-[93px] fill-[#e5463e] text-[#bf2826]" size={26} />
      <div className="absolute left-[7%] top-[157px] text-[#aab9c2]"><MapPin size={17} fill="currentColor" /></div>
      <div className="absolute left-[53%] top-[442px] flex h-7 w-7 items-center justify-center rounded-full bg-[#9ac9a5] text-[#315e42]"><MapPin size={17} fill="currentColor" /></div>
      <div className="absolute bottom-[72px] left-1/2 -translate-x-1/2">
        <div className="h-0 w-0 border-x-[23px] border-b-[34px] border-x-transparent border-b-[#49a7e5] drop-shadow-[0_2px_2px_rgba(0,0,0,.5)]" />
      </div>
      <div className="absolute bottom-[26px] left-1/2 -translate-x-1/2 rounded-full bg-[#286cc0] px-3 py-1 text-[11px] font-bold shadow">Endicott St</div>
      <div className="absolute bottom-[76px] left-3 rounded-lg border-2 border-black bg-white p-1 shadow-lg">
        <div className="flex items-center gap-1 text-black"><span className="rounded border-2 border-black px-1 text-[21px] font-medium leading-8">25</span><span className="text-xl font-bold text-[#ffb000]">28</span></div><p className="text-right text-[10px] font-bold leading-none text-black">mph</p>
      </div>
    </div>
  );
};
