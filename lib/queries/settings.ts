import { query } from '../db';

export async function getSettings() {
  const res = await query('SELECT key, value FROM system_settings');
  const settings: Record<string, string> = {};
  for (const row of res.rows) {
    settings[row.key] = row.value;
  }
  return settings;
}

export async function updateSetting(key: string, value: string) {
  await query(
    `INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
    [key, value]
  );
}

export async function updateSettings(settings: Record<string, string>) {
  for (const [key, value] of Object.entries(settings)) {
    await updateSetting(key, value);
  }
}
