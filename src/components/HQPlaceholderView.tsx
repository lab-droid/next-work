import React from 'react';
import { Shield } from 'lucide-react';

interface HQPlaceholderViewProps {
  viewName: string;
}

export default function HQPlaceholderView({ viewName }: HQPlaceholderViewProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
      <div className="w-16 h-16 bg-brand-50 text-brand-500 rounded-2xl flex items-center justify-center mb-6">
        <Shield className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold text-navy-900 mb-2">{viewName}</h2>
      <p className="text-gray-500 max-w-md">
        본사 콘솔의 해당 메뉴는 현재 준비 중입니다. 향후 업데이트에서 제공될 예정입니다.
      </p>
    </div>
  );
}
