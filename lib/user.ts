import { redirect } from "next/navigation";
import { requireAccount, requireAccountApi } from "@/lib/auth";
import { HttpError } from "@/lib/http";

export async function requireUser() {
  const identity = await requireAccount();
  if (identity.profile.role === "admin") redirect("/admin");
  return identity;
}

export async function requireApiUser() {
  const identity = await requireAccountApi();
  if (identity.profile.role === "admin")
    throw new HttpError(
      403,
      "Training is available with a member account. Your administrator account manages the gym catalog.",
    );
  return identity;
}
