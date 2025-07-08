"use client";

import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import EditProfilePage from "@/components/profileForm";
import { DialogTitle } from "@radix-ui/react-dialog";
import { UserProfile } from "@/types/user";

interface ProfileFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
  onProfileUpdate: () => void;
}

export function ProfileFormModal({
  isOpen,
  onClose,
  userProfile,
  onProfileUpdate,
}: ProfileFormModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>
        <EditProfilePage
          userProfile={userProfile}
          onSuccess={() => {
            onProfileUpdate();
            onClose();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
