'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Filter, RefreshCw, Download, Search, DollarSign, ShoppingCart, Percent, TrendingUp, TrendingDown, Store } from 'lucide-react';
import { Toast } from '@/components/ui/Toast';
import { useRouter } from 'next/navigation';

interface Outlet {
    id: string;
    name: string;
}

interface SalesItem {
    name: string;
    sku: string | null;
    category_name: string;
    item_sold: number;
    gross_sales: number;
    net_sales: number;
    discount: number;
    refund: number;
    cogs: number;
}

interface Props {
    outlets: Outlet[];
    lastSync: Date | null;
    initialSalesData: SalesItem[];
    initialStartDate: string;
    initialEndDate: string;
    initialOutletId: string;
}

export default function SalesReportClient({ outlets, lastSync, initialSalesData, initialStartDate, initialEndDate, initialOutletId }: Props) {
    const router = useRouter();
    const [selectedOutlet, setSelectedOutlet] = useState<string>(initialOutletId);
    const [startDate, setStartDate] = useState(initialStartDate);
    const [endDate, setEndDate] = useState(initialEndDate);
    const [isSyncing, setIsSyncing] = useState(false);
    const [tab, setTab] = useState('sales');
    
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
    const [toastOpen, setToastOpen] = useState(false);

    const [searchTerm, setSearchTerm] = useState('');
    const [isFiltering, setIsFiltering] = useState(false);

    // Calculate KPIs
    const filteredData = initialSalesData.filter(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const totalUnitsSold = filteredData.reduce((sum, item) => sum + item.item_sold, 0);
    const totalGrossSales = filteredData.reduce((sum, item) => sum + item.gross_sales, 0);
    const totalNetSales = filteredData.reduce((sum, item) => sum + item.net_sales, 0);
    const totalRefund = filteredData.reduce((sum, item) => sum + item.refund, 0);
    
    // Average margin calculation (Net Sales - COGS) / Net Sales
    const totalCogs = filteredData.reduce((sum, item) => sum + item.cogs, 0);
    const avgMargin = totalNetSales > 0 ? ((totalNetSales - totalCogs) / totalNetSales) * 100 : 0;

    const formatRp = (val: number) => 'Rp ' + val.toLocaleString('id-ID');

    const showToast = (message: string, type: 'success' | 'error' | 'info') => {
        setToastMessage(message);
        setToastType(type);
        setToastOpen(true);
    };

    const handleFilter = () => {
        setIsFiltering(true);
        router.push(`/sales-report?startDate=${startDate}&endDate=${endDate}&outletId=${selectedOutlet}`);
        // simulate loading state finish after a short delay since router.push doesn't return a promise in App Router
        setTimeout(() => setIsFiltering(false), 1000);
    };

    const handleSync = async () => {
        setIsFiltering(true);
        setIsSyncing(true);
        try {
            const res = await fetch('/api/moka/sync/sales', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    start_date: startDate,
                    end_date: endDate,
                    outlet_id: selectedOutlet || undefined
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Gagal sinkronisasi data.');
            
            showToast(data.message || 'Sinkronisasi berhasil', 'success');
            // Refresh to load new data
            router.refresh();
        } catch (error: any) {
            showToast(error.message, 'error');
        } finally {
            setIsSyncing(false);
            setIsFiltering(false);
        }
    };

    const tabDefs = [
        { key: 'sales', label: 'Item Sales' },
        { key: 'cogs', label: 'COGS Comparison' },
        { key: 'top', label: 'Top Products' }
    ];

    return (
        <div className="space-y-4">
            {/* Header Card with KPIs */}
            <div className="card">
                <div className="card-head flex justify-between items-center">
                    <div>
                        <h3>Laporan Penjualan (Moka POS)</h3>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={handleSync}
                            disabled={isSyncing}
                            className="btn btn-primary"
                        >
                            <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} /> 
                            {isSyncing ? 'Menarik...' : 'Tarik Data Moka'}
                        </button>
                    </div>
                </div>

                {/* Stats Row */}
                <div style={{ display: 'flex', gap: 0, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                    {[
                        { label: 'Total Units Sold', value: totalUnitsSold.toLocaleString('id-ID'), iconColor: '#475569', icon: ShoppingCart },
                        { label: 'Gross Sales', value: formatRp(totalGrossSales), iconColor: '#475569', icon: DollarSign },
                        { label: 'Net Sales', value: formatRp(totalNetSales), iconColor: '#15803d', icon: TrendingUp },
                        { label: 'Avg Margin', value: avgMargin.toFixed(1) + '%', iconColor: '#15803d', icon: Percent },
                        { label: 'Total Refund', value: formatRp(totalRefund), iconColor: '#b91c1c', icon: TrendingDown },
                    ].map((s, i) => {
                        const Icon = s.icon;
                        return (
                            <div key={i} style={{
                                flex: '1 1 140px', padding: '12px 16px', borderRight: i < 4 ? '1px solid var(--border)' : 'none',
                                display: 'flex', flexDirection: 'column', gap: 4
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Icon size={14} strokeWidth={2.5} style={{ color: s.iconColor }} />
                                    <div className="muted" style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>{s.label}</div>
                                </div>
                                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--foreground)' }}>{s.value}</div>
                            </div>
                        );
                    })}
                </div>

                {/* Sync Info Row */}
                <div style={{ display: 'flex', gap: 16, padding: '12px 20px', borderTop: '1px solid var(--border)', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                            background: '#016e3f', color: '#ffffff',
                            padding: '2px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600,
                        }}>Status</span>
                        <span className="muted" style={{ fontSize: 12 }}>
                            Terakhir ditarik: {lastSync ? new Date(lastSync).toLocaleString('id-ID') : 'Belum pernah ditarik'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Main Content Card */}
            <div className="card">
                {/* Tabs */}
                <div className="tabs" style={{ marginBottom: 0 }}>
                    {tabDefs.map(t => (
                        <button
                            key={t.key}
                            className={`tab${tab === t.key ? ' active' : ''}`}
                            onClick={() => setTab(t.key)}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Filters Row */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 200, maxWidth: 300 }}>
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Cari nama item..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="input"
                            style={{ paddingLeft: '36px', width: '100%' }}
                        />
                    </div>
                    
                    <select 
                        value={selectedOutlet}
                        onChange={(e) => {
                            setSelectedOutlet(e.target.value);
                            setIsFiltering(true);
                            router.push(`/sales-report?startDate=${startDate}&endDate=${endDate}&outletId=${e.target.value}`);
                            setTimeout(() => setIsFiltering(false), 1000);
                        }}
                        className="input"
                        style={{ width: '200px' }}
                    >
                        <option value="">Semua Outlet</option>
                        {outlets.map(o => (
                            <option key={o.id} value={o.id}>{o.name}</option>
                        ))}
                    </select>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input 
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="input"
                        />
                        <span className="muted">s/d</span>
                        <input 
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="input"
                        />
                    </div>
                    
                    <button onClick={handleFilter} disabled={isFiltering} className="btn btn-outline" style={{ height: 38 }}>
                        <Filter size={14} className={isFiltering ? 'animate-spin' : ''} /> {isFiltering ? 'Memuat...' : 'Terapkan Filter'}
                    </button>

                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="muted" style={{ fontSize: 13 }}>{filteredData.length} items found</span>
                    </div>
                </div>

                {/* Data Table */}
                <div className="table-responsive">
                    {filteredData.length === 0 ? (
                        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                            <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-lg font-bold text-gray-900 mb-2 font-['Cabin']">Tidak Ada Data</h3>
                            <p className="text-sm text-gray-500 max-w-md mx-auto">
                                Belum ada data penjualan pada rentang tanggal ini atau kata kunci tidak ditemukan. Silakan sesuaikan filter Anda atau klik "Tarik Data Moka".
                            </p>
                        </div>
                    ) : (
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>KATEGORI</th>
                                    <th>NAMA ITEM / VARIAN</th>
                                    <th>SKU</th>
                                    <th style={{ textAlign: 'right' }}>UNIT TERJUAL</th>
                                    <th style={{ textAlign: 'right' }}>GROSS SALES</th>
                                    <th style={{ textAlign: 'right' }}>NET SALES</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredData.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="muted">{item.category_name}</td>
                                        <td style={{ fontWeight: 600 }}>{item.name}</td>
                                        <td className="muted">{item.sku || '-'}</td>
                                        <td style={{ textAlign: 'right' }}>{item.item_sold.toLocaleString('id-ID')}</td>
                                        <td style={{ textAlign: 'right' }}>{formatRp(item.gross_sales)}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--foreground)' }}>{formatRp(item.net_sales)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            <Toast 
                isOpen={toastOpen}
                message={toastMessage}
                type={toastType}
                onClose={() => setToastOpen(false)}
            />
        </div>
    );
}
