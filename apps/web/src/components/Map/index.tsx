import dynamic from 'next/dynamic';

const Map = dynamic(() => import('./Map'), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] w-full rounded-lg bg-gray-100 animate-pulse flex items-center justify-center">
      <span className="text-gray-400">جاري تحميل الخريطة...</span>
    </div>
  ),
});

export default Map;
