'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Link, Unlink, RefreshCw } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Toast } from '@/components/ui/Toast';

export default function MokaConnectButton({ isConnected }: { isConnected: boolean }) {
    const [isLoading, setIsLoading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
    const [toastOpen, setToastOpen] = useState(false);
    const router = useRouter();

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setToastMessage(message);
        setToastType(type);
        setToastOpen(true);
    };

    const handleConnect = () => {
        setIsLoading(true);
        window.location.href = '/api/moka/connect';
    };

    const handleSyncMaster = async () => {
        setIsSyncing(true);
        try {
            // Fase 2: Sync Business & Outlets
            const bizRes = await fetch('/api/moka/sync/business', { method: 'POST' });
            if (!bizRes.ok) {
                const data = await bizRes.json();
                throw new Error(`Gagal sinkronisasi profil: ${data.message || 'Server error'}`);
            }

            // Fase 3: Sync Items
            const itemRes = await fetch('/api/moka/sync/items', { method: 'POST' });
            if (!itemRes.ok) {
                const data = await itemRes.json();
                throw new Error(`Gagal sinkronisasi produk: ${data.message || 'Server error'}`);
            }
            const itemData = await itemRes.json();

            showToast(`Sinkronisasi Master berhasil! Profil Outlet & ${itemData.message}`, 'success');
            router.refresh();
        } catch (error: any) {
            console.error(error);
            showToast(error.message || 'Terjadi kesalahan jaringan', 'error');
        } finally {
            setIsSyncing(false);
        }
    };

    const handleDisconnect = async () => {
        setShowConfirm(false);
        setIsLoading(true);
        try {
            const res = await fetch('/api/moka/disconnect', { method: 'POST' });
            if (res.ok) {
                showToast('Koneksi terputus', 'success');
                router.refresh();
            } else {
                showToast('Gagal memutuskan koneksi', 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Terjadi kesalahan sistem', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    if (isConnected) {
        return (
            <>
                <Toast 
                    isOpen={toastOpen} 
                    message={toastMessage} 
                    type={toastType} 
                    onClose={() => setToastOpen(false)} 
                />
                <div className="flex gap-3">
                    <button 
                        onClick={handleSyncMaster} 
                        disabled={isSyncing}
                        className="flex items-center gap-2 px-4 py-2 bg-[#016e3f] text-white rounded-md hover:bg-[#015933] transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                        Sinkronisasi Master
                    </button>
                    <button 
                        onClick={() => setShowConfirm(true)} 
                        disabled={isLoading || isSyncing}
                        className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                        {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
                        Putuskan Koneksi
                    </button>
                </div>

                <ConfirmDialog
                    open={showConfirm}
                    title="Putuskan Koneksi Moka?"
                    message="Apakah Anda yakin ingin memutuskan koneksi dengan Moka? Data sinkronisasi yang sudah ada di database tidak akan terhapus, tetapi sistem tidak bisa menarik data transaksi dan menu baru."
                    confirmText="Ya, Putuskan"
                    cancelText="Batal"
                    onConfirm={handleDisconnect}
                    onCancel={() => setShowConfirm(false)}
                    danger={true}
                />
            </>
        );
    }

    return (
        <button 
            onClick={handleConnect} 
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-[#016e3f] text-white rounded-md hover:bg-[#015933] transition-colors disabled:opacity-50"
        >
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4" />}
            Hubungkan ke Moka POS
        </button>
    );
}
