'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Link2, Link2Off, CheckCircle, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import MapRecipeModal from './MapRecipeModal';

export default function MokaCatalogTableClient({ 
    items, 
    recipes, 
    outletsGrouped, 
    activeOutletId,
    activeSearch,
    activeStatus
}: { 
    items: any[], 
    recipes: any[],
    outletsGrouped?: Record<string, any[]>,
    activeOutletId?: string,
    activeSearch?: string,
    activeStatus?: string
}) {
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any | null>(null);
    
    const [searchInput, setSearchInput] = useState(activeSearch || '');
    
    const router = useRouter();

    const toggleRow = (id: string) => {
        setExpandedRows(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const updateFilters = (outletId: string, search: string, status: string) => {
        const params = new URLSearchParams();
        if (outletId) params.set('outlet_id', outletId);
        if (search) params.set('search', search);
        if (status && status !== 'all') params.set('status', status);
        const qs = params.toString();
        router.push(qs ? `?${qs}` : '?');
    };

    const handleOutletChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        updateFilters(e.target.value, activeSearch || '', activeStatus || 'all');
    };

    const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        updateFilters(activeOutletId || '', activeSearch || '', e.target.value);
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        updateFilters(activeOutletId || '', searchInput, activeStatus || 'all');
    };

    return (
        <div className="flex flex-col">
            {/* Filter Toolbar */}
            <div className="bg-white px-4 py-3 border-b border-gray-200 flex flex-col sm:flex-row gap-3 justify-between items-center">
                <div className="flex flex-wrap items-center gap-2">
                    <form onSubmit={handleSearch} className="relative" style={{ width: '220px', minWidth: '220px' }}>
                        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search item name..."
                            value={searchInput}
                            onChange={(e) => {
                                const val = e.target.value;
                                setSearchInput(val);
                                updateFilters(activeOutletId || '', val, activeStatus || 'all');
                            }}
                            className="w-full text-xs border border-gray-200 rounded-md pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#016e3f] focus:border-[#016e3f] bg-white shadow-sm"
                        />
                        <button type="submit" className="hidden">Search</button>
                    </form>

                    {outletsGrouped && Object.keys(outletsGrouped).length > 0 && (
                        <select
                            value={activeOutletId || ''}
                            onChange={handleOutletChange}
                            style={{ width: '145px', minWidth: '145px' }}
                            className="text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#016e3f] focus:border-[#016e3f] bg-white text-gray-700 shadow-sm"
                        >
                            <option value="">All Outlets</option>
                            {Object.entries(outletsGrouped).map(([bizName, outlets]) => (
                                <optgroup key={bizName} label={`--- ${bizName} ---`}>
                                    {outlets.map((o: any) => (
                                        <option key={o.id} value={o.id}>
                                            {o.name}
                                        </option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                    )}

                    <select
                        value={activeStatus || 'all'}
                        onChange={handleStatusChange}
                        style={{ width: '130px', minWidth: '130px' }}
                        className="text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#016e3f] focus:border-[#016e3f] bg-white text-gray-700 shadow-sm"
                    >
                        <option value="all">All Statuses</option>
                        <option value="mapped">Mapped</option>
                        <option value="unmapped">Unmapped</option>
                    </select>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-[11px] uppercase tracking-wider">
                            <th className="px-3 py-2 font-medium w-10 text-center"></th>
                            <th className="px-3 py-2 font-medium text-left">Item & Category</th>
                            <th className="px-3 py-2 font-medium text-left">Variant Info</th>
                            <th className="px-3 py-2 font-medium text-left">Mapping Status</th>
                            <th className="px-3 py-2 font-medium text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-[12px]">
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
                                        <td className="px-3 py-1.5" style={{ verticalAlign: 'middle' }}>
                                            <div className="flex justify-center items-center h-full">
                                                {hasVariants && (
                                                    <button className="text-gray-400 hover:text-gray-600 transition-colors inline-flex items-center justify-center">
                                                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-3 py-1.5" style={{ verticalAlign: 'middle' }}>
                                            <div className="flex flex-col justify-center h-full">
                                                <div className="font-medium text-gray-900 text-[12px] flex items-center gap-2">
                                                    {item.name}
                                                    {!activeOutletId && item.outlet_name && (
                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-gray-100 text-gray-500 border border-gray-200">
                                                            {item.outlet_name}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[11px] text-gray-500">{item.category}</div>
                                            </div>
                                        </td>
                                        <td className="px-3 py-1.5" style={{ verticalAlign: 'middle' }}>
                                            <div className="flex justify-start items-center h-full text-[11px] text-gray-600 font-medium">
                                                {variantCount} {variantCount === 1 ? 'Variant' : 'Variants'}
                                            </div>
                                        </td>
                                        <td className="px-3 py-1.5" style={{ verticalAlign: 'middle' }}>
                                            <div className="flex justify-start items-center h-full">
                                                {item.internal_recipe_id ? (
                                                    <div className="inline-flex flex-col items-start">
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-800 border border-green-200">
                                                            <CheckCircle className="w-3 h-3" />
                                                            Mapped
                                                        </span>
                                                        <div className="text-[10px] text-gray-500 mt-0.5">
                                                            {item.mapped_recipe_name}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-800 border border-red-200">
                                                        <Link2Off className="w-3 h-3" />
                                                        Unmapped
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-3 py-1.5" style={{ verticalAlign: 'middle' }}>
                                            <div className="flex justify-center items-center h-full">
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedItem(item);
                                                        setIsModalOpen(true);
                                                    }}
                                                    className="px-2 py-1 text-[11px] font-medium text-[#016e3f] bg-green-50 border border-green-200 rounded hover:bg-green-100 transition-colors inline-flex items-center gap-1 cursor-pointer"
                                                >
                                                    <Link2 className="w-3 h-3" />
                                                    {item.internal_recipe_id ? 'Edit' : 'Map'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>

                                    {/* Baris Varian (Expandable) */}
                                    {isExpanded && hasVariants && (
                                        <tr>
                                            <td colSpan={5} className="p-0 border-0">
                                                <div className="bg-white border-b border-gray-100 py-2.5 px-4 shadow-inner">
                                                    <div className="pl-8 pr-4">
                                                        {/* Header Grid */}
                                                        <div className="grid grid-cols-12 gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider pb-1.5 border-b border-gray-100 mb-1.5">
                                                            <div className="col-span-5">Variant Name</div>
                                                            <div className="col-span-3 text-left">Selling Price</div>
                                                            <div className="col-span-4 text-left">POS Stock</div>
                                                        </div>
                                                        {/* Data Grid */}
                                                        <div className="space-y-1.5">
                                                            {item.variants.map((v: any) => (
                                                                <div key={v.id} className="grid grid-cols-12 gap-4 items-center">
                                                                    <div className="col-span-5 text-[12px] font-medium text-gray-700">
                                                                        {v.name || 'Regular'}
                                                                    </div>
                                                                    <div className="col-span-3 text-[12px] text-gray-900 text-left font-medium">
                                                                        Rp {Number(v.price).toLocaleString('id-ID')}
                                                                    </div>
                                                                    <div className="col-span-4 text-[12px] text-gray-600 text-left">
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
        </div>
    );
}
