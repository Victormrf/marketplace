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
      href={`/products?category=${encodeURIComponent(label.replace("/", ""))}`}
      className="p-6 border rounded-lg flex flex-col items-center hover:shadow transition cursor-pointer no-underline text-inherit"
    >
      <div className="mb-2 text-4xl">{icon}</div> {/* aumenta o ícone */}
      <p className="font-semibold text-lg text-slate-800">{label}</p>{" "}
      {/* aumenta o texto */}
    </Link>
  );
}
