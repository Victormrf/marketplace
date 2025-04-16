import Link from "next/link";

export default function CategoryCard({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={`/products?category=${encodeURIComponent(label)}`}
      className="p-4 border rounded-lg flex flex-col items-center hover:shadow transition cursor-pointer no-underline text-inherit"
    >
      <div className="mb-2 text-gray-700">{icon}</div>
      <p className="font-medium">{label}</p>
    </Link>
  );
}
