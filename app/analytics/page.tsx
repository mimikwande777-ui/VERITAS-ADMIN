import { redirect } from 'next/navigation';

export default function RootAnalyticsRedirect() {
  redirect('/admin/analytics');
}
