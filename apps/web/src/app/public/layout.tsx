import DashboardLayout from '../../components/DashboardLayout';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
