'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Link2, Link2Off, CheckCircle } from 'lucide-react';
import MapRecipeModal from './MapRecipeModal';

export default function MokaCatalogTableClient({ items, recipes }: { items: any[], recipes: any[] }) {
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any | null>(null);

    const toggleRow = (id: string) => {
        setExpandedRows(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-[11px] uppercase tracking-wider">
                        <th className="px-3 py-3 font-medium w-10 text-center"></th>
                        <th className="px-3 py-3 font-medium text-left">Item & Kategori</th>
                        <th className="px-3 py-3 font-medium text-left">Informasi Varian</th>
                        <th className="px-3 py-3 font-medium text-left">Status Pemetaan</th>
                        <th className="px-3 py-3 font-medium text-right">Aksi</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                    {items.map((item: any) => {
                        const isExpanded = !!expandedRows[item.id];
                        const variantCount = item.variants?.length || 0;
                        const hasVariants = variantCount > 0;

                        return (
                            <React.Fragment key={item.id}>
                                {/* Baris Induk */}
                                <tr 
                                    className={`hover:bg-gray-50/50 transition-colors ${hasVariants ? 'cursor-pointer' : ''} ${isExpanded ? 'bg-gray-50/50' : ''}`}
                                    onClick={() => hasVariants && toggleRow(item.id)}
                                >
                                    <td className="px-3 py-2" style={{ verticalAlign: 'middle' }}>
                                        <div className="flex justify-center items-center h-full">
                                            {hasVariants && (
                                                <button className="text-gray-400 hover:text-gray-600 transition-colors inline-flex items-center justify-center">
                                                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2" style={{ verticalAlign: 'middle' }}>
                                        <div className="flex flex-col justify-center h-full">
                                            <div className="font-medium text-gray-900 text-sm">{item.name}</div>
                                            <div className="text-[11px] text-gray-500">{item.category}</div>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2" style={{ verticalAlign: 'middle' }}>
                                        <div className="flex justify-start items-center h-full text-xs text-gray-600 font-medium">
                                            {variantCount} Varian
                                        </div>
                                    </td>
                                    <td className="px-3 py-2" style={{ verticalAlign: 'middle' }}>
                                        <div className="flex justify-start items-center h-full">
                                            {item.internal_recipe_id ? (
                                                <div className="inline-flex flex-col items-start">
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-800 border border-green-200">
                                                        <CheckCircle className="w-3 h-3" />
                                                        Tertaut
                                                    </span>
                                                    <div className="text-[10px] text-gray-500 mt-0.5">
                                                        {item.mapped_recipe_name}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-800 border border-red-200">
                                                    <Link2Off className="w-3 h-3" />
                                                    Belum Ditautkan
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2" style={{ verticalAlign: 'middle' }}>
                                        <div className="flex justify-end items-center h-full">
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedItem(item);
                                                    setIsModalOpen(true);
                                                }}
                                                className="px-2.5 py-1 text-[11px] font-medium text-[#016e3f] bg-green-50 border border-green-200 rounded hover:bg-green-100 transition-colors inline-flex items-center gap-1 cursor-pointer"
                                            >
                                                <Link2 className="w-3 h-3" />
                                                {item.internal_recipe_id ? 'Ubah' : 'Tautkan'}
                                            </button>
                                        </div>
                                    </td>
                                </tr>

                                {/* Baris Varian (Expandable) */}
                                {isExpanded && hasVariants && (
                                    <tr>
                                        <td colSpan={5} className="p-0 border-0">
                                            <div className="bg-white border-b border-gray-100 py-3 px-4 shadow-inner">
                                                <div className="pl-8 pr-4">
                                                    {/* Header Grid */}
                                                    <div className="grid grid-cols-12 gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider pb-2 border-b border-gray-100 mb-2">
                                                        <div className="col-span-5">Nama Varian</div>
                                                        <div className="col-span-3 text-left">Harga Jual</div>
                                                        <div className="col-span-4 text-left">Stok POS</div>
                                                    </div>
                                                    {/* Data Grid */}
                                                    <div className="space-y-2">
                                                        {item.variants.map((v: any) => (
                                                            <div key={v.id} className="grid grid-cols-12 gap-4 items-center">
                                                                <div className="col-span-5 text-[13px] font-medium text-gray-700">
                                                                    {v.name || 'Regular'}
                                                                </div>
                                                                <div className="col-span-3 text-[13px] text-gray-900 text-left font-medium">
                                                                    Rp {Number(v.price).toLocaleString('id-ID')}
                                                                </div>
                                                                <div className="col-span-4 text-[13px] text-gray-600 text-left">
                                                                    {v.in_stock}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>

            <MapRecipeModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setSelectedItem(null);
                }}
                mokaItem={selectedItem}
                recipes={recipes}
            />
        </div>
    );
}
