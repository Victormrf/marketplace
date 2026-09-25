import LoginForm from "@/components/loginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  const safeReturnTo = returnTo?.startsWith("/") && !returnTo.startsWith("//")
    ? returnTo
    : undefined;

  return (
    <main>
      <LoginForm returnTo={safeReturnTo} />
    </main>
  );
}
