import React, { useState } from 'react';
import { X, Search, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Toast } from '@/components/ui/Toast';

interface Recipe {
    id: number;
    name: string;
    category?: string;
}

interface MokaItem {
    id: string;
    name: string;
    category: string;
    internal_recipe_id?: number | null;
    mapped_recipe_name?: string | null;
}

interface MapRecipeModalProps {
    isOpen: boolean;
    onClose: () => void;
    mokaItem: MokaItem | null;
    recipes: Recipe[];
}

export default function MapRecipeModal({ isOpen, onClose, mokaItem, recipes }: MapRecipeModalProps) {
    const router = useRouter();
    const [search, setSearch] = useState('');
    const [selectedRecipeId, setSelectedRecipeId] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; isOpen: boolean }>({ message: '', type: 'info', isOpen: false });

    const showToast = (message: string, type: 'success' | 'error' | 'info') => {
        setToast({ message, type, isOpen: true });
    };

    const hideToast = () => {
        setToast(prev => ({ ...prev, isOpen: false }));
    };

    // Initialize selection when modal opens
    React.useEffect(() => {
        if (isOpen && mokaItem) {
            setSelectedRecipeId(mokaItem.internal_recipe_id || null);
            setSearch('');
            setIsSaving(false);
        }
    }, [isOpen, mokaItem]);

    if (!isOpen || !mokaItem) return null;

    const filteredRecipes = recipes.filter(r =>
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        (r.category && r.category.toLowerCase().includes(search.toLowerCase()))
    );

    const handleSave = async () => {
        if (!selectedRecipeId) {
            showToast("Silakan pilih resep terlebih dahulu.", "error");
            return;
        }

        setIsSaving(true);
        try {
            const res = await fetch('/api/moka/map-item', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    moka_item_id: mokaItem.id,
                    internal_recipe_id: selectedRecipeId
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Gagal menyimpan penautan.');
            }

            showToast("Berhasil menautkan item ke resep!", "success");

            setTimeout(() => {
                onClose();
                router.refresh();
            }, 1000);

        } catch (error: any) {
            showToast(error.message, "error");
            setIsSaving(false);
        }
    };

    const handleRemoveMapping = async () => {
        if (!confirm("Apakah Anda yakin ingin menghapus tautan item ini?")) return;

        setIsSaving(true);
        try {
            const res = await fetch('/api/moka/map-item', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    moka_item_id: mokaItem.id,
                    internal_recipe_id: null // Set to null to remove
                })
            });

            if (!res.ok) throw new Error('Gagal menghapus penautan.');

            showToast("Berhasil menghapus tautan.", "success");
            setTimeout(() => {
                onClose();
                router.refresh();
            }, 1000);
        } catch (error: any) {
            showToast(error.message, "error");
            setIsSaving(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-box w-full max-w-lg flex flex-col max-h-[90vh]">
                <div className="modal-header px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-white shrink-0">
                    <div>
                        <h4 className="text-lg font-bold text-gray-900 font-['Cabin']">Tautkan ke Master Resep</h4>
                        <p className="text-xs text-gray-500 mt-1">Pilih resep Sunrise Daily yang sesuai dengan item Moka ini.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="modal-body p-6 overflow-y-auto flex-1 bg-gray-50">
                    {/* Info Item Moka */}
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6">
                        <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Item Moka POS</div>
                        <div className="text-base font-semibold text-gray-900">{mokaItem.name}</div>
                        <div className="text-xs text-gray-500">{mokaItem.category || 'Uncategorized'}</div>
                    </div>

                    {/* Pilih Resep */}
                    <div className="space-y-3">
                        <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider flex items-center gap-2">
                            Pilih Master Resep
                        </label>

                        {/* Search Box */}
                        <div className="relative">
                            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Cari nama resep..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#016e3f] focus:ring-1 focus:ring-[#016e3f] transition-shadow"
                            />
                        </div>

                        {/* List Resep */}
                        <div className="bg-white border border-gray-200 rounded-xl max-h-60 overflow-y-auto shadow-sm divide-y divide-gray-100">
                            {filteredRecipes.length === 0 ? (
                                <div className="p-8 text-center text-gray-500 text-sm">
                                    Resep tidak ditemukan.
                                </div>
                            ) : (
                                filteredRecipes.map(recipe => (
                                    <div
                                        key={recipe.id}
                                        onClick={() => setSelectedRecipeId(recipe.id)}
                                        className={`p-3 flex items-center justify-between cursor-pointer transition-colors hover:bg-gray-50 ${selectedRecipeId === recipe.id ? 'bg-green-50/50' : ''}`}
                                    >
                                        <div>
                                            <div className="text-sm font-medium text-gray-900">{recipe.name}</div>
                                        </div>
                                        <div className="flex-shrink-0">
                                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${selectedRecipeId === recipe.id ? 'border-[#016e3f] bg-[#016e3f]' : 'border-gray-300 bg-white'}`}>
                                                {selectedRecipeId === recipe.id && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div className="modal-footer px-6 py-4 border-t border-gray-200 bg-white flex justify-between items-center shrink-0">
                    {mokaItem.internal_recipe_id ? (
                        <button
                            type="button"
                            onClick={handleRemoveMapping}
                            disabled={isSaving}
                            className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                        >
                            Hapus Tautan
                        </button>
                    ) : (
                        <div />
                    )}

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSaving}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                            Batal
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSaving || !selectedRecipeId || selectedRecipeId === mokaItem.internal_recipe_id}
                            className="px-5 py-2 text-sm font-medium text-white bg-[#016e3f] border border-[#016e3f] rounded-lg hover:bg-[#015933] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isSaving ? 'Menyimpan...' : 'Simpan Tautan'}
                        </button>
                    </div>
                </div>
            </div>

            <Toast
                isOpen={toast.isOpen}
                message={toast.message}
                type={toast.type}
                onClose={hideToast}
            />
        </div>
    );
}
