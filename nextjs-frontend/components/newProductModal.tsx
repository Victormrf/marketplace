import { Dialog, DialogContent } from "@/components/ui/dialog";
import ProductForm from "./productForm";
import { DialogHeader, DialogTitle } from "./ui/dialog";

interface NewProductModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NewProductModal({ isOpen, onClose }: NewProductModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Produto</DialogTitle>
        </DialogHeader>
        <ProductForm onSuccess={onClose} />
      </DialogContent>
    </Dialog>
  );
}
