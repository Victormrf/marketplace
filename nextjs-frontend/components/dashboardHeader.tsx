import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Image from "next/image";

export default function DashboardHeader({
  storeName,
  userEmail,
}: {
  storeName: string;
  userEmail: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex flex-wrap items-center justify-between gap-y-4">
      {/* Logo + Nome da loja */}
      <div className="flex items-center gap-4">
        <div className="rounded-full overflow-hidden">
          <Image
            src="/v-market-logo.png"
            alt="Logo da Loja"
            height={56}
            width={56}
          />
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
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
}
