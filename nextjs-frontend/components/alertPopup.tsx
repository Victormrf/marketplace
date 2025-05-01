import { TriangleAlert } from "lucide-react";

type AlertPopupProps = {
  message: string;
  action?: {
    href: string;
    text: string;
  };
  onClose: () => void;
  style?: React.CSSProperties;
};

export default function AlertPopup({
  message,
  action,
  onClose,
  style,
}: AlertPopupProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-lg  max-w-sm w-full p-4 relative"
        style={style}
      >
        <button
          className="absolute top-0.5 right-1 text-gray-400 hover:text-red-600 text-2xl"
          onClick={onClose}
          aria-label="Fechar"
        >
          &times;
        </button>
        <div className="flex items-center">
          <TriangleAlert className="text-yellow-400" size={28} />
          <div className="mx-4 h-8 border-l border-gray-300" />
          <div className="flex-1 text-slate-800 text-lg">{message}</div>
        </div>
        {action && (
          <div className="mt-4 flex justify-end gap-2">
            <a
              href={action.href}
              className="px-4 py-2 rounded bg-slate-700 text-white hover:bg-slate-900 transition"
            >
              {action.text}
            </a>
            <button
              className="px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300 transition"
              onClick={onClose}
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
