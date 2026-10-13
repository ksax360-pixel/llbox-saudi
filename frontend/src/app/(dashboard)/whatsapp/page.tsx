import { redirect } from "next/navigation";

export default function WhatsAppRedirectPage() {
  redirect("/conversations?filter=text");
}
