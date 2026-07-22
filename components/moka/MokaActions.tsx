'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Link, Unlink, RefreshCw } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Toast } from '@/components/ui/Toast';

export function ConnectMokaButton() {
    const [isLoading, setIsLoading] = useState(false);

    const handleConnect = () => {
        setIsLoading(true);
        window.open('/api/moka/connect', '_blank');
        // Reset loading state after a short delay since we remain on the same page
        setTimeout(() => setIsLoading(false), 2000);
    };

    return (
        <button 
            onClick={handleConnect} 
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#016e3f] text-white rounded-md hover:bg-[#015933] transition-colors disabled:opacity-50"
        >
            {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Link className="w-3.5 h-3.5" />}
            Connect Moka Account
        </button>
    );
}

export function SyncMasterButton() {
    const [isSyncing, setIsSyncing] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
    const [toastOpen, setToastOpen] = useState(false);
    const router = useRouter();

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setToastMessage(message);
        setToastType(type);
        setToastOpen(true);
    };

    const handleSyncMaster = async () => {
        setIsSyncing(true);
        try {
            const bizRes = await fetch('/api/moka/sync/business', { method: 'POST' });
            if (!bizRes.ok) {
                const data = await bizRes.json();
                throw new Error(`Failed to sync profile: ${data.message || 'Server error'}`);
            }

            const itemRes = await fetch('/api/moka/sync/items', { method: 'POST' });
            if (!itemRes.ok) {
                const data = await itemRes.json();
                throw new Error(`Failed to sync products: ${data.message || 'Server error'}`);
            }
            const itemData = await itemRes.json();

            showToast(`Master sync successful! Profiles & ${itemData.message}`, 'success');
            router.refresh();
        } catch (error: any) {
            console.error(error);
            showToast(error.message || 'Network error occurred', 'error');
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <>
            <Toast 
                isOpen={toastOpen} 
                message={toastMessage} 
                type={toastType} 
                onClose={() => setToastOpen(false)} 
            />
            <button 
                onClick={handleSyncMaster} 
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white text-[#016e3f] border border-[#016e3f] rounded-md hover:bg-[#016e3f]/5 transition-colors disabled:opacity-50"
            >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                Sync Master Data
            </button>
        </>
    );
}

export function DisconnectAccountButton({ businessId, accountName }: { businessId: number, accountName: string }) {
    const [isLoading, setIsLoading] = useState(false);
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

    const handleDisconnect = async () => {
        setShowConfirm(false);
        setIsLoading(true);
        try {
            const res = await fetch('/api/moka/disconnect', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ business_id: businessId })
            });
            if (res.ok) {
                showToast(`Disconnected from ${accountName}`, 'success');
                router.refresh();
            } else {
                showToast('Failed to disconnect account', 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('System error occurred', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <Toast 
                isOpen={toastOpen} 
                message={toastMessage} 
                type={toastType} 
                onClose={() => setToastOpen(false)} 
            />
            <button 
                onClick={() => setShowConfirm(true)} 
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-red-200 text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors disabled:opacity-50"
            >
                {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
                Disconnect
            </button>

            <ConfirmDialog
                open={showConfirm}
                title={`Disconnect ${accountName}?`}
                message={`Are you sure you want to disconnect ${accountName}? The system will no longer fetch new transactions and menus for this account.`}
                confirmText="Yes, Disconnect"
                cancelText="Cancel"
                onConfirm={handleDisconnect}
                onCancel={() => setShowConfirm(false)}
                danger={true}
            />
        </>
    );
}
