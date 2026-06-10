import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Command, CheckCircle2, Calendar, FileText } from 'lucide-react';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-navy-900/60 backdrop-blur-sm z-50 flex items-start justify-center pt-[15vh] px-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              onClick={e => e.stopPropagation()}
              className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-gray-100"
            >
              <div className="flex items-center px-4 border-b border-gray-100">
                <Search className="w-5 h-5 text-brand-500" />
                <input 
                  ref={inputRef}
                  type="text" 
                  placeholder="무엇이든 검색해보세요..." 
                  className="w-full px-4 py-5 outline-none text-lg bg-transparent text-navy-900 placeholder:text-gray-400"
                />
                <div className="flex gap-1 text-xs text-gray-400 border border-gray-200 px-2 py-1 rounded bg-gray-50 items-center font-medium">
                  esc
                </div>
              </div>

              <div className="p-2 space-y-4 max-h-[60vh] overflow-y-auto">
                <div>
                  <h4 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2 mt-4">최근 검색</h4>
                  <div className="space-y-1">
                    <button className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 rounded-xl transition-colors text-left group">
                      <FileText className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />
                      <span className="text-navy-900 flex-1 font-medium">1분기 마케팅 기획서.pdf</span>
                      <span className="text-xs text-gray-400">파일</span>
                    </button>
                    <button className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 rounded-xl transition-colors text-left group">
                      <CheckCircle2 className="w-5 h-5 text-gray-400 group-hover:text-green-500" />
                      <span className="text-navy-900 flex-1 font-medium">결제 모듈 페이지 랜딩</span>
                      <span className="text-xs text-brand-500 px-2 py-0.5 bg-brand-50 rounded-md">진행 중</span>
                    </button>
                    <button className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 rounded-xl transition-colors text-left group">
                      <Calendar className="w-5 h-5 text-gray-400 group-hover:text-purple-500" />
                      <span className="text-navy-900 flex-1 font-medium">전사 타운홀 미팅</span>
                      <span className="text-xs text-gray-400">일정</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1"><Command className="w-3.5 h-3.5" /> + K 로 열기</span>
                <span className="flex items-center gap-1">방향키로 이동</span>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
