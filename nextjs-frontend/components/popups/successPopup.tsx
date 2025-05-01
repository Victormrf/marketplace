import { CheckCircle2 } from "lucide-react";

type AlertPopupProps = {
  message: string;
  action?: {
    href: string;
    text: string;
  };
  onClose: () => void;
  style?: React.CSSProperties;
};

export default function SuccessPopup({
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
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-4 relative">
          <div className="flex items-center">
            <CheckCircle2 className="text-blue-500" size={28} />
            <div className="mx-4 h-8 border-l border-gray-300" />
            <div className="flex-1 text-slate-800 text-md">{message}</div>
          </div>
          {action && (
            <div className="mt-4 flex justify-begin gap-2">
              <a
                href={action.href}
                className="px-4 py-2 rounded underline text-slate-800 hover:no-underline transition"
              >
                {action.text}
              </a>
            </div>
          )}
        </div>
        <div
          className="absolute left-1/2 -bottom-0.4 -translate-x-1/2 w-0 h-0"
          style={{ zIndex: 51 }}
        >
          <div
            className="w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-t-8 border-t-white shadow-xl"
            // Ajuste border-b-white para dark mode se necessário
          />
        </div>
      </div>
    </div>
  );
}
