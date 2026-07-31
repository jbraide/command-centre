'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  BrainCircuit,
  Plus,
  Trash2,
  Save,
  X,
  Loader2,
  Search,
  Pencil,
  Check,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Memory {
  id: string;
  userId: string;
  key: string;
  value: string;
  category: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MemoriesResponse {
  memories: Memory[];
  total: number;
}

type CategoryTab = 'all' | 'persona' | 'business' | 'content' | 'general';

const CATEGORIES: { value: CategoryTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'persona', label: 'Persona' },
  { value: 'business', label: 'Business' },
  { value: 'content', label: 'Content' },
  { value: 'general', label: 'General' },
];

const CATEGORY_COLORS: Record<string, string> = {
  persona: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  business: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  content: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  general: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function categoryBadge(category: string | null) {
  if (!category) return null;
  const color = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.general;
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${color}`}>
      {category}
    </span>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MemoriesPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  /* Filters */
  const [activeCategory, setActiveCategory] = useState<CategoryTab>('all');
  const [search, setSearch] = useState('');

  /* New memory form */
  const [showNewForm, setShowNewForm] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newCategory, setNewCategory] = useState<string>('general');
  const [saving, setSaving] = useState(false);

  /* Inline editing */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKey, setEditKey] = useState('');
  const [editValue, setEditValue] = useState('');
  const [editCategory, setEditCategory] = useState<string>('');
  const [updating, setUpdating] = useState(false);

  /* Delete */
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchMemories = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (activeCategory !== 'all') params.set('category', activeCategory);
      const res = await fetch(`/api/memories?${params}`);
      if (!res.ok) throw new Error('Failed to load');
      const data: MemoriesResponse = await res.json();
      setMemories(data.memories);
      setTotal(data.total);
    } catch {
      toast.error('Failed to load memories');
    } finally {
      setLoading(false);
    }
  }, [activeCategory]);

  useEffect(() => {
    setLoading(true);
    fetchMemories();
  }, [fetchMemories]);

  // ── Create ─────────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!newKey.trim() || !newValue.trim()) {
      toast.error('Key and value are required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: newKey.trim(),
          value: newValue.trim(),
          category: newCategory,
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success('Memory saved');
      setNewKey('');
      setNewValue('');
      setNewCategory('general');
      setShowNewForm(false);
      fetchMemories();
    } catch {
      toast.error('Failed to save memory');
    } finally {
      setSaving(false);
    }
  };

  // ── Update ─────────────────────────────────────────────────────────────────

  const startEditing = (memory: Memory) => {
    setEditingId(memory.id);
    setEditKey(memory.key);
    setEditValue(memory.value);
    setEditCategory(memory.category ?? '');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditKey('');
    setEditValue('');
    setEditCategory('');
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    if (!editKey.trim() || !editValue.trim()) {
      toast.error('Key and value are required');
      return;
    }
    setUpdating(true);
    try {
      const res = await fetch(`/api/memories/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: editKey.trim(),
          value: editValue.trim(),
          category: editCategory || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to update');
      toast.success('Memory updated');
      cancelEditing();
      fetchMemories();
    } catch {
      toast.error('Failed to update memory');
    } finally {
      setUpdating(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/memories/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Memory deleted');
      setDeleteConfirmId(null);
      fetchMemories();
    } catch {
      toast.error('Failed to delete memory');
    } finally {
      setDeleting(false);
    }
  };

  // ── Filtered list (client-side search) ─────────────────────────────────────

  const filtered = memories.filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return m.key.toLowerCase().includes(q) || m.value.toLowerCase().includes(q);
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BrainCircuit className="w-7 h-7 text-blue-500" />
          <div>
            <h1 className="text-2xl font-bold">Memory Bank</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {total} fact{total !== 1 ? 's' : ''} stored
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowNewForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
        >
          {showNewForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showNewForm ? 'Cancel' : 'Add Memory'}
        </button>
      </div>

      {/* Note about AI */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-200">
        <p>
          <strong>Tip:</strong> You can also save memories by asking the AI during chat.
          Just say something like "remember that my brand voice is professional and witty" and the AI
          will use its <code className="text-xs bg-amber-100 dark:bg-amber-900/40 px-1 rounded">save_memory</code> tool automatically.
        </p>
      </div>

      {/* New memory form */}
      {showNewForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3 shadow-sm">
          <h3 className="font-semibold text-sm">New Memory</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Key (e.g. brand_voice)"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <textarea
              placeholder="Value (the fact to remember)"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              rows={1}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:col-span-1"
            />
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="persona">Persona</option>
              <option value="business">Business</option>
              <option value="content">Content</option>
              <option value="general">General</option>
            </select>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleCreate}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
          </div>
        </div>
      )}

      {/* Search and category tabs */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search memories by key or value..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Category tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                activeCategory === cat.value
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-16">
          <BrainCircuit className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">
            {memories.length === 0
              ? 'No memories yet. Add one above or ask the AI to remember something.'
              : 'No memories match your search.'}
          </p>
        </div>
      )}

      {/* Memory list */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((memory) => (
            <div
              key={memory.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              {editingId === memory.id ? (
                /* Inline edit mode */
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editKey}
                    onChange={(e) => setEditKey(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <textarea
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex items-center justify-between">
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">No category</option>
                      <option value="persona">Persona</option>
                      <option value="business">Business</option>
                      <option value="content">Content</option>
                      <option value="general">General</option>
                    </select>
                    <div className="flex gap-2">
                      <button
                        onClick={cancelEditing}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                      >
                        <X className="w-4 h-4" /> Cancel
                      </button>
                      <button
                        onClick={handleUpdate}
                        disabled={updating}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm disabled:opacity-50"
                      >
                        {updating ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* View mode */
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-sm truncate">{memory.key}</h3>
                        {categoryBadge(memory.category)}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 whitespace-pre-wrap">
                        {memory.value}
                      </p>
                      <p className="text-xs text-gray-400 mt-2">
                        Updated {formatDate(memory.updatedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => startEditing(memory)}
                        className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {deleteConfirmId === memory.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(memory.id)}
                            disabled={deleting}
                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Confirm delete"
                          >
                            {deleting ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            title="Cancel delete"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(memory.id)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
