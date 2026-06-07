import type { Metadata } from 'next';
import { SettingsPageClient } from './settings-page-client';

export const metadata: Metadata = {
  title: 'Settings — Purechess',
};

export default function SettingsPage() {
  return <SettingsPageClient />;
}
