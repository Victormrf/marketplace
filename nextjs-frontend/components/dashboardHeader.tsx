import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Image from "next/image";

interface DashboardHeaderProps {
  storeLogo: string;
  storeName: string;
  userEmail: string;
  selectedTab: "overview" | "sales" | "customers";
  onTabChange: (tab: "overview" | "sales" | "customers") => void;
}

export default function DashboardHeader({
  storeLogo,
  storeName,
  userEmail,
  selectedTab,
  onTabChange,
}: DashboardHeaderProps) {
  return (
    <div className="relative bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex flex-wrap items-center justify-between gap-y-4">
      {/* Logo + Nome da loja */}
      <div className="flex items-center gap-4">
        <div className="rounded-full overflow-hidden">
          <Image src={storeLogo} alt="Logo da Loja" height={56} width={56} />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            {storeName}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {userEmail}
          </p>
        </div>
      </div>

      {/* Tabs de navegação */}
      <div className="absolute left-1/2 transform -translate-x-1/2">
        <Tabs
          value={selectedTab}
          onValueChange={(value) =>
            onTabChange(value as "overview" | "sales" | "customers")
          }
        >
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="sales">Sales</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
}
