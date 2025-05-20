import Image from "next/image";

export default function RefundsPage() {
  return (
    <div className="h-[calc(80vh-80px)] flex items-center justify-center">
      <div className="flex flex-col items-center">
        <p className="text-4xl font-semibold text-muted-foreground">
          Work in progress...
        </p>
        <Image
          src="/work_in_progress.png"
          alt="Work in progress"
          height={300}
          width={300}
          priority
        />
      </div>
    </div>
  );
}
