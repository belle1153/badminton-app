import { isAdmin } from "@/lib/adminAuth";
import AdminSidebar from "./AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await isAdmin();
  if (!admin) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col sm:flex-row min-h-screen">
      <AdminSidebar />
      <div className="flex-1">{children}</div>
    </div>
  );
}
