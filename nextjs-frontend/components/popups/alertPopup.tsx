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
      <div className="fixed z-50" style={style}>
        <div className="bg-white rounded-lg shadow-lg max-w-sm w-full p-4 relative">
          <div className="flex items-center">
            <TriangleAlert className="text-yellow-500" size={28} />
            {/* <div className="mx-4 h-8 border-l border-gray-300" /> */}
            <div className="mx-4 flex-1 text-slate-800 text-md">{message}</div>
          </div>
          {action && (
            <div className="mt-4 flex justify-between gap-2">
              <a
                href={action.href}
                className="flex-1 px-4 py-2 rounded bg-slate-700 text-white hover:bg-slate-900 transition"
              >
                {action.text}
              </a>
              <button
                className="flex-1 px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300 transition"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          )}
        </div>
        <div
          className="absolute left-1/4 -bottom-0.4 -translate-x-1/2 w-0 h-0"
          style={{ zIndex: 51 }}
        >
          {style && (
            <div
              className="w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-t-8 border-t-white"
              // Ajuste border-b-white para dark mode se necessário
            />
          )}
        </div>
      </div>
    </div>
  );
}
