import { AdminDashboard } from "@/app/components/AdminDashboard";

export default async function ClinicAdminPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <AdminDashboard slug={slug} />;
}
