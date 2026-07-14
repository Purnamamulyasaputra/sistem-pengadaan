'use client';
import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Plus, Trash2, Save } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Table } from '@/components/ui/Table';

export default function RecipeBuilderPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const router = useRouter();
  const isNew = params.id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

// Master Data
const [venues, setVenues] = useState<{ id: number; name: string }[]>([]);
const [availableIngredients, setAvailableIngredients] = useState<{ id: number; name: string; standard_cost_per_unit: number; default_unit: string }[]>([]);

// Form State
const [form, setForm] = useState({
  name: '',
  venue_id: '',
  source_sheet: 'Kitchen 2025',
  yield_amount: '1',
  yield_unit: 'pcs',
  x_factor_pct: '10', // as integer percentage for UI
});

const [ingredients, setIngredients] = useState<{
  id: string; // temp UI id
  ingredient_id: string;
  ingredient_name: string;
  quantity: string;
  unit: string;
  cost_per_unit: number;
  extension: number;
}[]>([]);

const loadMasterData = async () => {
  const [venueRes, ingRes] = await Promise.all([
    fetch('/api/hpp'), // Returns venues
    fetch('/api/hpp/ingredients?limit=1000') // Fetch all ingredients for dropdown
  ]);
  const venueData = await venueRes.json();
  const ingData = await ingRes.json();
  setVenues(venueData.venues ?? []);
  setAvailableIngredients(ingData.data ?? []);
};

const loadRecipe = async () => {
  try {
    const res = await fetch(`/api/hpp/recipes/${params.id}`);
    if (!res.ok) throw new Error('Recipe not found');
    const data = await res.json();

    setForm({
      name: data.recipe.name,
      venue_id: String(data.recipe.venue_id),
      source_sheet: data.recipe.source_sheet,
      yield_amount: String(data.recipe.yield),
      yield_unit: data.recipe.yield_unit || '',
      x_factor_pct: String((Number(data.recipe.x_factor_pct) * 100).toFixed(0)),
    });

    setIngredients(data.ingredients.map((ing: any) => ({
      id: Math.random().toString(36).substring(7),
      ingredient_id: String(ing.ingredient_id),
      ingredient_name: ing.ingredient_name || '',
      quantity: String(ing.quantity),
      unit: ing.unit || '',
      cost_per_unit: Number(ing.cost_per_unit),
      extension: Number(ing.extension),
    })));
  } catch (err: any) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};

useEffect(() => {
  loadMasterData().then(() => {
    if (!isNew) {
      loadRecipe();
    }
  });
}, [isNew]);

// Calculations
const subtotal = ingredients.reduce((sum, ing) => sum + ing.extension, 0);
const xFactorValue = subtotal * (Number(form.x_factor_pct) / 100);
const totalCost = subtotal + xFactorValue;

const handleAddIngredient = () => {
  setIngredients([...ingredients, {
    id: Math.random().toString(36).substring(7),
    ingredient_id: '',
    ingredient_name: '',
    quantity: '1',
    unit: '',
    cost_per_unit: 0,
    extension: 0,
  }]);
};

const handleRemoveIngredient = (id: string) => {
  setIngredients(ingredients.filter(ing => ing.id !== id));
};

const handleIngredientChange = (id: string, field: string, value: string) => {
  setIngredients(prev => prev.map(ing => {
    if (ing.id !== id) return ing;

    const updated = { ...ing, [field]: value };

    if (field === 'ingredient_name') {
      const selected = availableIngredients.find(a => a.name === value);
      if (selected) {
        updated.ingredient_id = String(selected.id);
        updated.unit = selected.default_unit || '';
        updated.cost_per_unit = Number(selected.standard_cost_per_unit) || 0;
      } else {
        updated.ingredient_id = '';
      }
    }

    // Recalculate extension
    updated.extension = Number(updated.quantity) * Number(updated.cost_per_unit);

    return updated;
  }));
};

const handleSave = async () => {
  if (!form.name || !form.venue_id || ingredients.length === 0) {
    setError('Please fill in all required fields and add at least one ingredient.');
    return;
  }

  // Validate ingredients
  for (const ing of ingredients) {
    if (!ing.ingredient_id || Number(ing.quantity) <= 0) {
      setError('Please select an ingredient and enter a valid quantity for all rows.');
      return;
    }
  }

  setSaving(true);
  setError('');

  const payload = {
    ...form,
    venue_id: Number(form.venue_id),
    yield_amount: Number(form.yield_amount),
    x_factor_pct: Number(form.x_factor_pct) / 100,
    ingredients: ingredients.map(ing => ({
      ingredient_id: Number(ing.ingredient_id),
      quantity: Number(ing.quantity),
      unit: ing.unit,
      cost_per_unit: ing.cost_per_unit,
    }))
  };

  try {
    const res = await fetch(isNew ? '/api/hpp/recipes' : `/api/hpp/recipes/${params.id}`, {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to save recipe');
    }

    router.push('/hpp');
  } catch (err: any) {
    setError(err.message);
    setSaving(false);
  }
};

if (loading) return <div style={{ padding: 40, textAlign: 'center' }} className="muted">Loading recipe...</div>;

return (
  <section className="screen" style={{ paddingBottom: 100 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
      <button className="btn" onClick={() => router.push('/hpp')} style={{ display: 'flex', alignItems: 'center', padding: '8px 12px' }}>
        <ChevronLeft size={18} /> Back
      </button>
      <h2 style={{ margin: 0, color: 'var(--foreground)' }}>{isNew ? 'Create New Recipe' : 'Edit Recipe'}</h2>
    </div>

    {error && <div className="alert-banner alert-danger" style={{ marginBottom: 20 }}>{error}</div>}

    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-head"><h3>Recipe Details</h3></div>
      <div className="card-body">
        <div className="form-grid" style={{ marginBottom: 0, gap: '20px 24px' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <Input label="Recipe Name" required placeholder="e.g. Iced Caramel Latte" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={{ maxWidth: 500 }} />
          </div>
          <div className="form-group" style={{ maxWidth: 300 }}>
            <label className="req" style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'block', color: 'var(--muted)' }}>Venue / Location</label>
            <select className="input" value={form.venue_id} onChange={e => setForm(f => ({ ...f, venue_id: e.target.value }))}>
              <option value="">Select Venue...</option>
              {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ maxWidth: 300 }}>
            <label className="req" style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'block', color: 'var(--muted)' }}>Source Sheet (Grouping)</label>
            <select className="input" value={form.source_sheet} onChange={e => setForm(f => ({ ...f, source_sheet: e.target.value }))}>
              <option value="Bar 1">Bar 1</option>
              <option value="Bar 2">Bar 2</option>
              <option value="Kitchen 2025">Kitchen 2025</option>
              <option value="Turangga">Turangga</option>
            </select>
          </div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 16, maxWidth: 500 }}>
            <Input label="Yield Amount (Output)" type="number" min="0.1" step="0.1" required value={form.yield_amount} onChange={e => setForm(f => ({ ...f, yield_amount: e.target.value }))} style={{ flex: 1 }} />
            <Input label="Yield Unit" placeholder="e.g. pcs, gr, ml" value={form.yield_unit} onChange={e => setForm(f => ({ ...f, yield_unit: e.target.value }))} style={{ flex: 1 }} />
            <Input label="X-Factor (%)" type="number" min="0" step="1" required value={form.x_factor_pct} onChange={e => setForm(f => ({ ...f, x_factor_pct: e.target.value }))} style={{ flex: 1 }} />
          </div>
        </div>
      </div>
    </div>

    <div className="card" style={{ overflow: 'visible' }}>
      <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Ingredients</h3>
        <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '6px 12px' }} onClick={handleAddIngredient}>
          <Plus size={16} /> Add Ingredient
        </button>
      </div>
      <div className="card-body flush" style={{ overflow: 'visible' }}>
        <Table responsive={false} style={{ overflow: 'visible' }}>
          <thead>
            <tr>
              <th style={{ width: '40%' }}>Ingredient</th>
              <th style={{ width: '15%' }}>Qty</th>
              <th style={{ width: '15%' }}>Unit</th>
              <th className="right" style={{ width: '15%' }}>Cost/Unit</th>
              <th className="right" style={{ width: '15%' }}>Extension</th>
              <th style={{ width: '50px' }}></th>
            </tr>
          </thead>
          <tbody>
            {ingredients.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 40 }} className="muted">
                  No ingredients added yet. Click "Add Ingredient" to start.
                </td>
              </tr>
            ) : (
              ingredients.map((ing, idx) => (
                <tr key={ing.id}>
                  <td style={{ position: 'relative' }}>
                    <input
                      className="input"
                      placeholder="Type ingredient name..."
                      style={{ width: '100%', background: '#fff' }}
                      value={ing.ingredient_name}
                      onChange={e => handleIngredientChange(ing.id, 'ingredient_name', e.target.value)}
                      onFocus={() => setActiveDropdown(ing.id)}
                      onBlur={() => setTimeout(() => setActiveDropdown(null), 200)}
                    />
                    {activeDropdown === ing.id && (
                      <div style={{
                        position: 'absolute', bottom: '100%', left: 16, right: 16,
                        background: '#fff', border: '1px solid var(--border)',
                        boxShadow: '0 -4px 6px -1px rgb(0 0 0 / 0.1)', zIndex: 50,
                        maxHeight: 200, overflowY: 'auto', borderRadius: 4,
                        marginBottom: 4
                      }}>
                        {availableIngredients
                          .filter(a => a.name.toLowerCase().includes(ing.ingredient_name.toLowerCase()))
                          .map(a => (
                            <div
                              key={a.id}
                              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: '#1e293b' }}
                              onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                              onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                              onMouseDown={(e) => {
                                e.preventDefault(); // Prevent onBlur from firing before onClick
                                handleIngredientChange(ing.id, 'ingredient_name', a.name);
                                setActiveDropdown(null);
                              }}
                            >
                              {a.name}
                            </div>
                          ))}
                        {availableIngredients.filter(a => a.name.toLowerCase().includes(ing.ingredient_name.toLowerCase())).length === 0 && (
                          <div style={{ padding: '8px 12px', fontSize: 13, color: 'var(--muted)' }}>No ingredients found.</div>
                        )}
                      </div>
                    )}
                  </td>
                  <td>
                    <input className="input" type="number" min="0" step="0.1" style={{ width: '100%' }} value={ing.quantity} onChange={e => handleIngredientChange(ing.id, 'quantity', e.target.value)} />
                  </td>
                  <td>
                    <input className="input" type="text" style={{ width: '100%' }} value={ing.unit} onChange={e => handleIngredientChange(ing.id, 'unit', e.target.value)} />
                  </td>
                  <td className="right">
                    <input className="input right" type="number" min="0" step="1" style={{ width: '100px', marginLeft: 'auto' }} value={ing.cost_per_unit} onChange={e => handleIngredientChange(ing.id, 'cost_per_unit', e.target.value)} />
                  </td>
                  <td className="right" style={{ fontWeight: 600 }}>
                    Rp {Math.round(ing.extension).toLocaleString('id-ID')}
                  </td>
                  <td>
                    <button className="btn" style={{ padding: 6, color: '#dc2626' }} onClick={() => handleRemoveIngredient(ing.id)}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {ingredients.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={4} className="right" style={{ fontWeight: 600 }}>Raw Subtotal:</td>
                <td className="right" style={{ fontWeight: 600 }}>Rp {Math.round(subtotal).toLocaleString('id-ID')}</td>
                <td></td>
              </tr>
              <tr>
                <td colSpan={4} className="right muted">X-Factor ({form.x_factor_pct}%):</td>
                <td className="right muted">Rp {Math.round(xFactorValue).toLocaleString('id-ID')}</td>
                <td></td>
              </tr>
              <tr style={{ background: '#f8fafc' }}>
                <td colSpan={4} className="right" style={{ fontWeight: 700, fontSize: 16, color: '#016e3f' }}>Total COGS:</td>
                <td className="right" style={{ fontWeight: 700, fontSize: 16, color: '#016e3f' }}>Rp {Math.round(totalCost).toLocaleString('id-ID')}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </Table>
      </div>
    </div>

    {/* Floating Save Button */}
    <div style={{ position: 'fixed', bottom: 0, left: 240, right: 0, background: '#fff', borderTop: '1px solid var(--border)', padding: '16px 32px', display: 'flex', justifyContent: 'flex-end', zIndex: 100, boxShadow: '0 -4px 6px -1px rgb(0 0 0 / 0.05)' }}>
      <button className="btn btn-primary" style={{ padding: '10px 24px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }} onClick={handleSave} disabled={saving}>
        <Save size={18} />
        {saving ? 'Saving...' : 'Save Recipe'}
      </button>
    </div>
  </section>
);
}
