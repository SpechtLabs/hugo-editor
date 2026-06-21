import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { GitHubMark } from "@/components/github-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  if (await auth()) redirect("/");
  const { callbackUrl } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Galerie-Editor</CardTitle>
          <CardDescription>Melde dich mit GitHub an, um die Galerie zu bearbeiten.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={async () => {
              "use server";
              await signIn("github", { redirectTo: callbackUrl || "/" });
            }}
          >
            <Button type="submit" className="w-full" size="lg">
              <GitHubMark className="size-5" />
              Mit GitHub anmelden
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
