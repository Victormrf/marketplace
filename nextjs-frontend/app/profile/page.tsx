"use client";

import { useState, useEffect } from "react";
import { Edit, Mail, Calendar, Star, MapPin, Phone, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserProfile } from "@/components/profileForm";
import { ProfileFormModal } from "@/components/profileModal";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchUserProfile() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me`, {
          method: "GET",
          credentials: "include",
        });
        if (!res.ok) throw new Error("Error fetching user");
        const userData = await res.json();

        if (userData.role === "CUSTOMER") {
          const customerRes = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/customers/`,
            {
              method: "GET",
              credentials: "include",
            }
          );
          if (!customerRes.ok)
            throw new Error("Error fetching customer profile");
          const customerData = await customerRes.json();

          console.log({
            user: userData,
            customer: customerData.profile,
          });

          setUserProfile({
            user: userData,
            customer: customerData.profile,
          });
        } else {
          const sellerRes = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/sellers/`,
            {
              method: "GET",
              credentials: "include",
            }
          );
          if (!sellerRes.ok) throw new Error("Error fetching customer profile");
          const sellerData = await sellerRes.json();

          setUserProfile({
            user: userData,
            seller: sellerData.profile,
          });
        }
      } catch (error) {
        console.error(error);
      }
    }
    fetchUserProfile();
  }, []);

  const handleProfileUpdate = async () => {
    router.refresh();
    setIsEditModalOpen(false);
  };

  if (!userProfile) {
    return <div>Loading...</div>;
  }

  const isCustomer = userProfile.user.role === "CUSTOMER";
  const isSeller = userProfile.user.role === "SELLER";

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div className="container py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-slate-800">My Profile</h1>
          <Button onClick={() => setIsEditModalOpen(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit profile
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage
                  src={isSeller ? userProfile.seller?.logo : undefined}
                />
                <AvatarFallback className="text-lg text-slate-800">
                  {userProfile.user.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <CardTitle className="text-2xl">
                  {userProfile.user.name}
                </CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {userProfile.user.email}
                </CardDescription>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Member since {formatDate(userProfile.user.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {isCustomer && userProfile.customer && (
          <Card>
            <CardHeader>
              <CardTitle>Delivery informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-3" />
                <div>
                  <p className="font-medium">Address</p>
                  <p className="text-muted-foreground">
                    {userProfile.customer.address || "Not informed"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Phone</p>
                  <p className="text-muted-foreground">
                    {userProfile.customer.phone || "Not informed"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isSeller && userProfile.seller && (
          <Card>
            <CardHeader>
              <CardTitle>Store information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Store className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Store name</p>
                  <p className="text-muted-foreground">
                    {userProfile.seller.storeName}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Star className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Rating</p>
                  <p className="text-muted-foreground">
                    {userProfile.seller.rating.toFixed(1)} stars
                  </p>
                </div>
              </div>
              {userProfile.seller.description && (
                <div>
                  <p className="font-medium mb-2">Description</p>
                  <p className="text-muted-foreground">
                    {userProfile.seller.description}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <ProfileFormModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          userProfile={userProfile}
          onProfileUpdate={handleProfileUpdate}
        />
      </div>
    </div>
  );
}
