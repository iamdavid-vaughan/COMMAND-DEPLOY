'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { adminAPI } from '@/lib/api';
import {
  DollarSign,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff
} from 'lucide-react';

interface PricingTier {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  features: string[];
  limits: Record<string, any>;
  displayOrder: number;
  isActive: boolean;
  apiAccess: boolean;
  popular: boolean;
  contactSales: boolean;
  dfy: boolean;
  superAdminIncluded: boolean;
  billingOptions: string[];
  createdAt: string;
  updatedAt: string;
}

export default function AdminPricingPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTier, setEditingTier] = useState<PricingTier | null>(null);
  const [saving, setSaving] = useState(false);
  const [newFeature, setNewFeature] = useState('');

  useEffect(() => {
    // Check if user is super admin
    if (user && user.role !== 'super_admin') {
      router.push('/dashboard');
      return;
    }

    fetchTiers();
  }, [user, router]);

  const fetchTiers = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getPricingTiers();
      setTiers(response.data.tiers);
    } catch (error) {
      console.error('Failed to fetch pricing tiers:', error);
      alert('Failed to load pricing tiers');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (tier: PricingTier) => {
    setEditingTier({ ...tier });
  };

  const handleCancel = () => {
    setEditingTier(null);
    setNewFeature('');
  };

  const handleSave = async () => {
    if (!editingTier) return;

    try {
      setSaving(true);
      await adminAPI.updatePricingTier(editingTier.id, {
        name: editingTier.name,
        description: editingTier.description,
        monthlyPrice: editingTier.monthlyPrice,
        yearlyPrice: editingTier.yearlyPrice,
        features: editingTier.features,
        limits: editingTier.limits,
        displayOrder: editingTier.displayOrder,
        isActive: editingTier.isActive,
        apiAccess: editingTier.apiAccess,
        popular: editingTier.popular,
        contactSales: editingTier.contactSales,
        dfy: editingTier.dfy,
        superAdminIncluded: editingTier.superAdminIncluded,
        billingOptions: editingTier.billingOptions
      });

      await fetchTiers();
      setEditingTier(null);
      setNewFeature('');
      alert('Pricing tier updated successfully!');
    } catch (error: any) {
      console.error('Failed to update pricing tier:', error);
      alert(`Failed to update pricing tier: ${error.response?.data?.message || error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAddFeature = () => {
    if (!editingTier || !newFeature.trim()) return;

    setEditingTier({
      ...editingTier,
      features: [...editingTier.features, newFeature.trim()]
    });
    setNewFeature('');
  };

  const handleRemoveFeature = (index: number) => {
    if (!editingTier) return;

    setEditingTier({
      ...editingTier,
      features: editingTier.features.filter((_, i) => i !== index)
    });
  };

  const handleMoveFeature = (index: number, direction: 'up' | 'down') => {
    if (!editingTier) return;

    const newFeatures = [...editingTier.features];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newFeatures.length) return;

    [newFeatures[index], newFeatures[targetIndex]] = [newFeatures[targetIndex], newFeatures[index]];

    setEditingTier({
      ...editingTier,
      features: newFeatures
    });
  };

  if (!user || user.role !== 'super_admin') {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading pricing tiers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <DollarSign className="w-8 h-8 mr-3 text-blue-600" />
          Pricing Tier Management
        </h1>
        <p className="mt-2 text-gray-600">
          Manage subscription pricing tiers, features, and limits
        </p>
      </div>

      {/* Pricing Tiers Grid */}
      <div className="grid grid-cols-1 gap-6">
        {tiers.map((tier) => (
          <div
            key={tier.id}
            className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden"
          >
            <div className="p-6">
              {editingTier?.id === tier.id ? (
                // Edit Mode
                <div className="space-y-6">
                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tier ID
                      </label>
                      <input
                        type="text"
                        value={editingTier.id}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Name *
                      </label>
                      <input
                        type="text"
                        value={editingTier.name}
                        onChange={(e) => setEditingTier({ ...editingTier, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={editingTier.description || ''}
                      onChange={(e) => setEditingTier({ ...editingTier, description: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* Pricing */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Monthly Price ($)
                      </label>
                      <input
                        type="number"
                        value={editingTier.monthlyPrice || ''}
                        onChange={(e) => setEditingTier({
                          ...editingTier,
                          monthlyPrice: e.target.value ? parseFloat(e.target.value) : null
                        })}
                        placeholder="Leave empty for custom"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Yearly Price ($)
                      </label>
                      <input
                        type="number"
                        value={editingTier.yearlyPrice || ''}
                        onChange={(e) => setEditingTier({
                          ...editingTier,
                          yearlyPrice: e.target.value ? parseFloat(e.target.value) : null
                        })}
                        placeholder="Leave empty for N/A"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Display Order
                      </label>
                      <input
                        type="number"
                        value={editingTier.displayOrder}
                        onChange={(e) => setEditingTier({
                          ...editingTier,
                          displayOrder: parseInt(e.target.value) || 0
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Features */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Features / Bullet Points
                    </label>
                    <div className="space-y-2">
                      {editingTier.features.map((feature, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={feature}
                            onChange={(e) => {
                              const newFeatures = [...editingTier.features];
                              newFeatures[index] = e.target.value;
                              setEditingTier({ ...editingTier, features: newFeatures });
                            }}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                          />
                          <button
                            onClick={() => handleMoveFeature(index, 'up')}
                            disabled={index === 0}
                            className="p-2 text-gray-600 hover:text-blue-600 disabled:opacity-30"
                          >
                            <ChevronUp className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleMoveFeature(index, 'down')}
                            disabled={index === editingTier.features.length - 1}
                            className="p-2 text-gray-600 hover:text-blue-600 disabled:opacity-30"
                          >
                            <ChevronDown className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleRemoveFeature(index)}
                            className="p-2 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newFeature}
                          onChange={(e) => setNewFeature(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleAddFeature()}
                          placeholder="Add new feature..."
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                        <button
                          onClick={handleAddFeature}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" /> Add
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Toggles */}
                  <div className="grid grid-cols-3 gap-4">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={editingTier.isActive}
                        onChange={(e) => setEditingTier({ ...editingTier, isActive: e.target.checked })}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Active</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={editingTier.popular}
                        onChange={(e) => setEditingTier({ ...editingTier, popular: e.target.checked })}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Popular</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={editingTier.apiAccess}
                        onChange={(e) => setEditingTier({ ...editingTier, apiAccess: e.target.checked })}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">API Access</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={editingTier.contactSales}
                        onChange={(e) => setEditingTier({ ...editingTier, contactSales: e.target.checked })}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Contact Sales</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={editingTier.dfy}
                        onChange={(e) => setEditingTier({ ...editingTier, dfy: e.target.checked })}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Done For You</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={editingTier.superAdminIncluded}
                        onChange={(e) => setEditingTier({ ...editingTier, superAdminIncluded: e.target.checked })}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Super Admin</span>
                    </label>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <button
                      onClick={handleCancel}
                      disabled={saving}
                      className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <X className="w-4 h-4" /> Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              ) : (
                // View Mode
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-2xl font-bold text-gray-900">{tier.name}</h3>
                        {tier.popular && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded">
                            POPULAR
                          </span>
                        )}
                        {!tier.isActive && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded flex items-center gap-1">
                            <EyeOff className="w-3 h-3" /> INACTIVE
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600">{tier.description}</p>
                    </div>
                    <button
                      onClick={() => handleEdit(tier)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
                    >
                      <Edit2 className="w-4 h-4" /> Edit
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <div className="text-sm text-gray-500">Monthly Price</div>
                      <div className="text-xl font-bold text-gray-900">
                        {tier.monthlyPrice !== null ? `$${tier.monthlyPrice}` : 'Custom'}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Yearly Price</div>
                      <div className="text-xl font-bold text-gray-900">
                        {tier.yearlyPrice !== null ? `$${tier.yearlyPrice}` : 'N/A'}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Display Order</div>
                      <div className="text-xl font-bold text-gray-900">{tier.displayOrder}</div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="text-sm font-medium text-gray-700 mb-2">Features</div>
                    <ul className="list-disc list-inside space-y-1">
                      {tier.features.map((feature, index) => (
                        <li key={index} className="text-gray-600">{feature}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {tier.apiAccess && (
                      <span className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded">
                        API Access
                      </span>
                    )}
                    {tier.contactSales && (
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 text-sm rounded">
                        Contact Sales
                      </span>
                    )}
                    {tier.dfy && (
                      <span className="px-3 py-1 bg-orange-100 text-orange-700 text-sm rounded">
                        Done For You
                      </span>
                    )}
                    {tier.superAdminIncluded && (
                      <span className="px-3 py-1 bg-red-100 text-red-700 text-sm rounded">
                        Super Admin
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
