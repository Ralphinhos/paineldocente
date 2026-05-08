import React, { useState, FC } from 'react';
import { X, Copy, Sparkles, Loader2 } from 'lucide-react';

interface AIModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
}

export const AIModal: FC<AIModalProps> = ({ isOpen, onClose, title, content }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    if (!content || content === "Gerando análise..." || content.startsWith("❌ Erro")) return; // Adicionado startsWith para erro
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Erro ao copiar texto:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-300 dark:border-slate-700">
          <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-500 dark:text-cyan-400" />
            {title}
          </h3>
          <button 
            type="button"
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white text-2xl transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 text-slate-700 dark:text-gray-200">
          {content === "Gerando análise..." ? (
            <div className="flex items-center justify-center">
              <Loader2 className="h-5 w-5 mr-3 animate-spin text-cyan-500 dark:text-cyan-400" />
              {content}
            </div>
          ) : (
            <pre className="whitespace-pre-wrap leading-relaxed font-sans">Teste de conteúdo estático</pre> 
          ) } {/* Adicionado espaço antes do '}' */}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-300 dark:border-slate-700 text-right">
          <button
            type="button"
            onClick={handleCopy}
            className="bg-cyan-600 hover:bg-cyan-700 dark:bg-[#2b466d] dark:hover:bg-[#3c5f94] text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
            disabled={!content || content === "Gerando análise..." || content.startsWith("❌ Erro")}
          >
            <Copy className="w-4 h-4" />
            {copied ? 'Copiado!' : 'Copiar Texto'}
          </button>
        </div>
      </div>
    </div>
  );
};
