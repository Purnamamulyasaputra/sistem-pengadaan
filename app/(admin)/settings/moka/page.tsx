import { getMokaToken } from '@/lib/queries/moka';
import { getSyncStatus } from '@/lib/queries/moka_sync';
import MokaConnectButton from '@/components/moka/MokaConnectButton';
import MokaToaster from '@/components/moka/MokaToaster';
import { SettingsTabs } from '@/components/ui/SettingsTabs';
import { CheckCircle, XCircle, AlertCircle, Database } from 'lucide-react';

export const metadata = {
    title: 'Integrasi Moka POS - Sunrise Daily',
};

export default async function MokaIntegrationPage(props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const searchParams = await props.searchParams;
    const token = await getMokaToken();
    const isConnected = !!token;
    
    const syncStatus = await getSyncStatus();

    const errorMsg = searchParams.error as string;
    const successMsg = searchParams.success as string;

    return (
        <section className="screen">
            <SettingsTabs />
            <MokaToaster errorMsg={errorMsg} successMsg={successMsg} />
            <div className="card" style={{ maxWidth: 768, margin: '0 auto', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                <div className="card-head" style={{ padding: '20px 24px' }}>
                    <div>
                        <h3 style={{ fontSize: 18, color: '#0f172a' }}>Integrasi Moka POS</h3>
                        <p className="text-muted" style={{ marginTop: 4, fontSize: 13 }}>
                            Kelola koneksi akun Moka POS ER Coffee Lab untuk sinkronisasi otomatis Master Item, Laporan Penjualan, dan Transaksi.
                        </p>
                    </div>
                </div>

                <div className="card-body" style={{ padding: 0 }}>
                <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isConnected ? 'bg-green-100' : 'bg-gray-100'}`}>
                            {isConnected ? (
                                <CheckCircle className="w-6 h-6 text-[#016e3f]" />
                            ) : (
                                <XCircle className="w-6 h-6 text-gray-400" />
                            )}
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-800">Status Koneksi</h2>
                            <p className={`text-sm font-medium ${isConnected ? 'text-[#016e3f]' : 'text-gray-500'}`}>
                                {isConnected ? 'Tersambung (ER Coffee Lab)' : 'Belum Tersambung'}
                            </p>
                        </div>
                    </div>
                    
                    <MokaConnectButton isConnected={isConnected} />
                </div>

                {isConnected && (
                    <div className="p-6 bg-gray-50 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                <Database className="w-4 h-4 text-gray-500" />
                                Informasi API Token
                            </h3>
                            <div className="space-y-3">
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Access Token (Disamarkan)</p>
                                    <code className="text-xs bg-white px-2 py-1 rounded border border-gray-200 text-gray-600 block truncate">
                                        {token.access_token.substring(0, 10)}*********************
                                    </code>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Izin Akses (Scope)</p>
                                    <div className="flex flex-wrap gap-1">
                                        {token.scope.split(' ').map((s: string) => (
                                            <span key={s} className="text-[10px] uppercase font-semibold tracking-wide bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100">
                                                {s}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">Status Sinkronisasi Terakhir</h3>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between items-center py-1 border-b border-gray-200 border-dashed">
                                    <span className="text-gray-600">Profil & Outlet</span>
                                    <span className={`italic ${syncStatus.business ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
                                        {syncStatus.business ? new Date(syncStatus.business).toLocaleString('id-ID') : 'Belum pernah disinkronkan'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center py-1 border-b border-gray-200 border-dashed">
                                    <span className="text-gray-600">Master Item / Menu</span>
                                    <span className={`italic ${syncStatus.items ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
                                        {syncStatus.items ? new Date(syncStatus.items).toLocaleString('id-ID') : 'Belum pernah disinkronkan'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center py-1 border-b border-gray-200 border-dashed">
                                    <span className="text-gray-600">Laporan Penjualan</span>
                                    <span className={`italic ${syncStatus.sales ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
                                        {syncStatus.sales ? new Date(syncStatus.sales).toLocaleString('id-ID') : 'Belum pernah disinkronkan'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center py-1">
                                    <span className="text-gray-600">Rincian Transaksi</span>
                                    <span className={`italic ${syncStatus.transactions ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
                                        {syncStatus.transactions ? new Date(syncStatus.transactions).toLocaleString('id-ID') : 'Belum pernah disinkronkan'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                </div>
            </div>
        </section>
    );
}
