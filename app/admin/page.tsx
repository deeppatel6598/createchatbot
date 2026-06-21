import { redirect } from "next/navigation";
import { ACTIVE_SLUG } from "@/lib/context";

/** Legacy single-tenant admin URL → the default clinic's dashboard. */
export default function AdminRedirect() {
  redirect(`/c/${ACTIVE_SLUG}/admin`);
}
