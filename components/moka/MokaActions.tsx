'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Link, Unlink, RefreshCw } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Toast } from '@/components/ui/Toast';

export function ConnectMokaButton() {
    const [isLoading, setIsLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [clientId, setClientId] = useState('');
    const [clientSecret, setClientSecret] = useState('');
    const [error, setError] = useState('');

    const handleOpenModal = () => {
        setClientId('');
        setClientSecret('');
        setError('');
        setShowModal(true);
    };

    const handleConnect = async () => {
        if (!clientId.trim() || !clientSecret.trim()) {
            setError('Client ID and Client Secret are required.');
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            const res = await fetch('/api/moka/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ client_id: clientId.trim(), client_secret: clientSecret.trim() }),
            });
            const data = await res.json();
            if (!res.ok || !data.auth_url) {
                setError(data.error || 'Failed to initiate connection.');
                setIsLoading(false);
                return;
            }
            setShowModal(false);
            window.open(data.auth_url, '_blank');
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <button
                onClick={handleOpenModal}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#016e3f] text-white rounded-md hover:bg-[#015933] transition-colors"
            >
                <Link className="w-3.5 h-3.5" />
                Connect Moka Account
            </button>

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
                        <h3 className="text-sm font-bold text-gray-900 mb-1">Connect Moka Private App</h3>
                        <p className="text-xs text-gray-500 mb-5">
                            Enter the Client ID and Client Secret from your Moka Developer Portal. Each account has its own unique credentials.
                        </p>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Client ID</label>
                                <input
                                    type="text"
                                    value={clientId}
                                    onChange={e => setClientId(e.target.value)}
                                    placeholder="Paste your Moka Client ID..."
                                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#016e3f]/30 focus:border-[#016e3f]"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Client Secret</label>
                                <input
                                    type="password"
                                    value={clientSecret}
                                    onChange={e => setClientSecret(e.target.value)}
                                    placeholder="Paste your Moka Client Secret..."
                                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#016e3f]/30 focus:border-[#016e3f]"
                                />
                            </div>
                            {error && <p className="text-xs text-red-500">{error}</p>}
                        </div>

                        <div className="flex items-center justify-end gap-2 mt-5">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConnect}
                                disabled={isLoading}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#016e3f] text-white rounded-md hover:bg-[#015933] transition-colors disabled:opacity-50"
                            >
                                {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Link className="w-3.5 h-3.5" />}
                                Authorize & Connect
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
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
