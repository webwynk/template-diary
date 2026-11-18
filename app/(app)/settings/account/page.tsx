import { signOut } from "@/actions/auth";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getCurrentUser } from "@/lib/auth";

export default async function AccountSettingsPage() {
  const user = await getCurrentUser();

  return (
    <section aria-labelledby="account-heading" className="space-y-8">
      <div>
        <h2 id="account-heading" className="text-xl font-semibold tracking-[-0.01em]">
          Account
        </h2>
        <p className="mt-1 text-muted-foreground">Your login for Template Diary.</p>
      </div>

      <div>
        <h3 className="text-sm font-medium">Email</h3>
        <p className="mt-1 text-muted-foreground">{user.email}</p>
      </div>

      <Separator />

      <div>
        <h3 className="text-base font-semibold">Change password</h3>
        <div className="mt-4">
          <ChangePasswordForm />
        </div>
      </div>

      <Separator />

      <form action={signOut}>
        <Button type="submit" variant="secondary">
          Sign out
        </Button>
      </form>
    </section>
  );
}
