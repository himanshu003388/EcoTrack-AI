import React, { useState, useEffect, memo } from 'react';
import { useAuth, apiFetch } from '../main';
import { useToast } from '../components/Toast';
import { useBeforeUnload, usePageTitle } from '../components/Hooks';
import {
  Car,
  Flame,
  Utensils,
  ShoppingBag,
  Plus,
  Search,
  RefreshCw,
  Trash2,
  HelpCircle,
  Sparkles,
  Lightbulb,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface ActivityHistoryItem {
  id: number;
  category: string;
  subcategory: string;
  quantity: number;
  unit: string;
  co2Emissions: number;
  timestamp: string;
  isRecurring: boolean;
  recurrencePeriod: string;
}

export const Tracker: React.FC = memo(() => {
  const { token, refreshUser } = useAuth();
  const { toast } = useToast();

  usePageTitle('Activity Tracker');

  const [category, setCategory] = useState<'transport' | 'energy' | 'food' | 'shopping_waste'>('transport');
  const [subcategory, setSubcategory] = useState('car_petrol');
  const [quantity, setQuantity] = useState<number>(10);
  const [unit, setUnit] = useState('km');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePeriod, setRecurrencePeriod] = useState<'daily' | 'weekly' | 'none'>('none');
  const [quantityError, setQuantityError] = useState<string | null>(null);

  const [history, setHistory] = useState<ActivityHistoryItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [filterCategory, setFilterCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const limit = 8;

  const [submitting, setSubmitting] = useState(false);

  const hasUnsavedChanges = quantity !== 10 || isRecurring;
  useBeforeUnload(hasUnsavedChanges);

  const subcategoryConfig: Record<
    'transport' | 'energy' | 'food' | 'shopping_waste',
    { name: string; unit: string; options: string[] }
  > = {
    transport: {
      name: 'Transportation',
      unit: 'km',
      options: ['car_petrol', 'car_diesel', 'car_ev', 'bike', 'walking', 'bus', 'train', 'flights', 'ride_sharing'],
    },
    energy: {
      name: 'Household Energy',
      unit: 'kWh',
      options: ['electricity', 'lpg', 'natural_gas', 'solar'],
    },
    food: {
      name: 'Diet',
      unit: 'meals',
      options: ['meat', 'dairy', 'vegetarian', 'vegan'],
    },
    shopping_waste: {
      name: 'Shopping & Waste',
      unit: 'kg',
      options: ['shopping', 'deliveries', 'waste', 'recycling'],
    },
  };

  const smartSuggestions = [
    { label: 'Petrol Commute (15 km)', category: 'transport', subcategory: 'car_petrol', quantity: 15, unit: 'km' },
    { label: 'Metro Train ride (8 km)', category: 'transport', subcategory: 'train', quantity: 8, unit: 'km' },
    { label: 'Walking Commute (2 km)', category: 'transport', subcategory: 'walking', quantity: 2, unit: 'km' },
    { label: 'Bus Ride (5 km)', category: 'transport', subcategory: 'bus', quantity: 5, unit: 'km' },
    { label: 'Meat-heavy Lunch', category: 'food', subcategory: 'meat', quantity: 1, unit: 'meals' },
    { label: 'Healthy Vegan Salad', category: 'food', subcategory: 'vegan', quantity: 1, unit: 'meals' },
    { label: 'Veggie Stir-fry Dinner', category: 'food', subcategory: 'vegetarian', quantity: 1, unit: 'meals' },
    { label: 'Dairy Breakfast (cereal+milk)', category: 'food', subcategory: 'dairy', quantity: 1, unit: 'meals' },
    { label: 'Electricity Load (12 kWh)', category: 'energy', subcategory: 'electricity', quantity: 12, unit: 'kWh' },
    { label: 'LPG Heating (2 kWh)', category: 'energy', subcategory: 'lpg', quantity: 2, unit: 'kWh' },
    {
      label: 'Online Shopping Delivery',
      category: 'shopping_waste',
      subcategory: 'deliveries',
      quantity: 1,
      unit: 'kg',
    },
    {
      label: 'Plastic Recycling (2.5 kg)',
      category: 'shopping_waste',
      subcategory: 'recycling',
      quantity: 2.5,
      unit: 'kg',
    },
  ];

  useEffect(() => {
    const defaultSub = subcategoryConfig[category].options[0];
    if (defaultSub !== undefined) {
      setSubcategory(defaultSub);
    }
    setUnit(subcategoryConfig[category].unit);
    if (category === 'transport') setQuantity(15);
    else if (category === 'energy') setQuantity(20);
    else if (category === 'food') setQuantity(1);
    else setQuantity(2);
    setQuantityError(null);
  }, [category]);

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    const tabNames = Object.keys(subcategoryConfig) as (typeof category)[];
    const currentIndex = tabNames.indexOf(category);
    let nextIndex = currentIndex;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % tabNames.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + tabNames.length) % tabNames.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = tabNames.length - 1;
    } else {
      return;
    }

    e.preventDefault();
    const nextCat = tabNames[nextIndex];
    if (nextCat !== undefined) {
      setCategory(nextCat);

      // Focus the next tab button after state transition
      setTimeout(() => {
        const nextButton = document.getElementById(`${nextCat}-tab`);
        if (nextButton) {
          nextButton.focus();
        }
      }, 0);
    }
  };

  const loadHistory = async (): Promise<void> => {
    setLoadingHistory(true);
    setHistoryError(null);
    try {
      const offset = (page - 1) * limit;
      let url = `/api/activities?limit=${limit}&offset=${offset}`;
      if (filterCategory) url += `&category=${filterCategory}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;

      const res = await apiFetch(url, {
        headers: token !== null ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.ok) {
        const json = (await res.json()) as { activities: ActivityHistoryItem[]; total: number };
        setHistory(json.activities);
        setTotalItems(json.total);
      } else {
        throw new Error('Failed to retrieve log history.');
      }
    } catch (err: unknown) {
      setHistoryError(err instanceof Error ? err.message : 'Failed to retrieve log history.');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    void loadHistory();
  }, [token, filterCategory, searchQuery, page]);

  const executeLog = async (
    cat: 'transport' | 'energy' | 'food' | 'shopping_waste',
    sub: string,
    qty: number,
    unt: string,
    recurFlag = false,
    recurPeriod: 'daily' | 'weekly' | 'none' = 'none',
  ): Promise<void> => {
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/activities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token !== null ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          category: cat,
          subcategory: sub,
          quantity: qty,
          unit: unt,
          isRecurring: recurFlag,
          recurrencePeriod: recurPeriod,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (res.ok) {
        toast('success', `Logged ${qty} ${unt} of ${sub.replace('_', ' ')}! (+10 XP)`);
        void confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.8 },
          colors: ['#1E3F20', '#10b981', '#38bdf8'],
        });
        void refreshUser();
        setPage(1);
        void loadHistory();
      } else {
        throw new Error(data.error ?? 'Failed to register footprint activity.');
      }
    } catch (err: unknown) {
      toast('error', err instanceof Error ? err.message : 'An error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (quantity <= 0) {
      setQuantityError('Quantity must be greater than 0');
      return;
    }
    setQuantityError(null);
    void executeLog(category, subcategory, quantity, unit, isRecurring, recurrencePeriod);
  };

  const handleSmartLog = (sug: (typeof smartSuggestions)[0]): void => {
    void executeLog(
      sug.category as 'transport' | 'energy' | 'food' | 'shopping_waste',
      sug.subcategory,
      sug.quantity,
      sug.unit,
    );
  };

  const handleDelete = async (id: number): Promise<void> => {
    try {
      const res = await apiFetch(`/api/activities/${id}`, {
        method: 'DELETE',
        headers: token !== null ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.ok) {
        toast('info', 'Activity deleted.');
        void loadHistory();
        void refreshUser();
      }
    } catch {
      toast('error', 'Failed to delete activity.');
    }
  };

  const getCategoryIcon = (catName: string): React.ReactNode => {
    switch (catName) {
      case 'transport':
        return <Car className="h-5 w-5" aria-hidden="true" />;
      case 'energy':
        return <Flame className="h-5 w-5" aria-hidden="true" />;
      case 'food':
        return <Utensils className="h-5 w-5" aria-hidden="true" />;
      default:
        return <ShoppingBag className="h-5 w-5" aria-hidden="true" />;
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
          Activity Tracker
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
          Log transport, energy, diet, and waste activities to track your carbon footprint.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6" role="region" aria-label="Log activity form">
          <div className="bg-white dark:bg-forest-900 border border-slate-100 dark:border-forest-800 p-6 rounded-[28px] shadow-sm flex flex-col gap-5 transition-colors duration-200">
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Plus className="h-5 w-5 text-forest-500" aria-hidden="true" />
              Log footprint
            </h2>

            <div
              className="grid grid-cols-4 gap-2"
              role="tablist"
              aria-label="Activity category"
              onKeyDown={handleTabKeyDown}
            >
              {(Object.keys(subcategoryConfig) as (typeof category)[]).map((catName) => (
                <button
                  key={catName}
                  id={`${catName}-tab`}
                  type="button"
                  role="tab"
                  aria-selected={category === catName}
                  aria-controls="category-panel"
                  tabIndex={category === catName ? 0 : -1}
                  onClick={() => setCategory(catName)}
                  className={`btn-press flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-150 ${
                    category === catName
                      ? 'bg-forest-500 text-white border-forest-500 shadow-sm'
                      : 'bg-slate-50 dark:bg-forest-800/60 border-slate-200/50 dark:border-forest-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-forest-800'
                  }`}
                  aria-label={subcategoryConfig[catName].name}
                >
                  {getCategoryIcon(catName)}
                  <span className="text-[10px] font-bold mt-1.5 truncate max-w-full">
                    {(catName.split('_')[0] ?? '').toUpperCase()}
                  </span>
                </button>
              ))}
            </div>

            <div id="category-panel" className="space-y-4" role="tabpanel" aria-labelledby={`${category}-tab`}>
              <form id="category-panel-form" onSubmit={handleSubmit}>
                <div>
                  <label
                    htmlFor="subcategory"
                    className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5"
                  >
                    Subcategory
                  </label>
                  <select
                    id="subcategory"
                    value={subcategory}
                    onChange={(e) => setSubcategory(e.target.value)}
                    className="block w-full px-3 py-2.5 border border-slate-200 dark:border-forest-700 rounded-xl text-sm focus:outline-none focus:border-forest-500 focus:ring-1 focus:ring-forest-500 bg-white dark:bg-forest-800 text-slate-900 dark:text-slate-100"
                  >
                    {subcategoryConfig[category].options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt.replace('_', ' ').toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="quantity"
                      className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5"
                    >
                      Quantity
                    </label>
                    <input
                      id="quantity"
                      type="number"
                      step="any"
                      value={quantity}
                      onChange={(e) => {
                        setQuantity(parseFloat(e.target.value) || 0);
                        setQuantityError(null);
                      }}
                      className={`block w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-1 tabular-nums bg-white dark:bg-forest-800 text-slate-900 dark:text-slate-100 ${
                        quantityError !== null && quantityError !== ''
                          ? 'border-red-300 dark:border-red-700 focus:border-red-500 focus:ring-red-500'
                          : 'border-slate-200 dark:border-forest-700 focus:border-forest-500 focus:ring-forest-500'
                      }`}
                      required
                      aria-required="true"
                      aria-invalid={quantityError !== null && quantityError !== ''}
                      aria-describedby={quantityError !== null && quantityError !== '' ? 'quantity-error' : undefined}
                    />
                    {quantityError !== null && quantityError !== '' && (
                      <p
                        id="quantity-error"
                        className="mt-1 text-xs text-red-500 font-medium"
                        role="alert"
                        aria-live="assertive"
                      >
                        {quantityError}
                      </p>
                    )}
                  </div>
                  <div>
                    <label
                      htmlFor="unit-display"
                      className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5"
                    >
                      Unit
                    </label>
                    <input
                      id="unit-display"
                      type="text"
                      value={unit}
                      className="block w-full px-3 py-2.5 border border-slate-100 dark:border-forest-700 bg-slate-50 dark:bg-forest-800/60 text-slate-500 dark:text-slate-400 rounded-xl text-sm"
                      disabled
                      aria-disabled="true"
                    />
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-forest-800/40 border border-slate-200/50 dark:border-forest-700 rounded-2xl">
                  <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isRecurring}
                      onChange={(e) => {
                        setIsRecurring(e.target.checked);
                        if (e.target.checked) setRecurrencePeriod('daily');
                        else setRecurrencePeriod('none');
                      }}
                      className="rounded text-forest-500 focus:ring-forest-500"
                    />
                    Recurring activity
                  </label>
                  {isRecurring && (
                    <div className="mt-3 animate-slide-up">
                      <label htmlFor="recurrence-period" className="sr-only">
                        Recurrence period
                      </label>
                      <select
                        id="recurrence-period"
                        value={recurrencePeriod}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                          setRecurrencePeriod(e.target.value as 'daily' | 'weekly' | 'none')
                        }
                        className="block w-full px-3 py-1.5 border border-slate-200 dark:border-forest-700 bg-white dark:bg-forest-800 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-forest-500 text-slate-900 dark:text-slate-100"
                      >
                        <option value="daily">DAILY</option>
                        <option value="weekly">WEEKLY</option>
                      </select>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-press w-full flex justify-center items-center gap-2 py-3 bg-gradient-to-r from-forest-500 to-forest-600 hover:from-forest-600 hover:to-forest-700 text-white rounded-2xl font-bold text-sm transition-all duration-150 shadow-sm disabled:opacity-50"
                  aria-busy={submitting}
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <span
                        className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                        aria-hidden="true"
                      ></span>
                      Saving&hellip;
                    </span>
                  ) : (
                    'Log activity'
                  )}
                </button>
              </form>
            </div>
          </div>

          <div
            className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-100 dark:border-amber-800/60 rounded-2xl"
            role="region"
            aria-label="Reduction swap suggestion"
          >
            <div className="flex items-start gap-2.5">
              <Lightbulb className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <h3 className="text-xs font-bold text-amber-800 dark:text-amber-300">
                  Simple Swap to Reduce Your Footprint
                </h3>
                <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-400 leading-relaxed">
                  {category === 'transport' &&
                    subcategory.startsWith('car') &&
                    'Choose public transit or cycling for this trip instead. Buses emit ~60% less CO₂ per passenger-km than cars.'}
                  {category === 'transport' &&
                    subcategory === 'bike' &&
                    'Excellent choice! Cycling has zero direct emissions. You are already making a great low-carbon decision.'}
                  {category === 'transport' &&
                    subcategory === 'walking' &&
                    'Walking is the most eco-friendly option. Zero emissions and great for your health too!'}
                  {category === 'transport' &&
                    subcategory === 'train' &&
                    'Trains are one of the most efficient transport modes. You are saving ~70% CO₂ compared to driving.'}
                  {category === 'transport' &&
                    subcategory === 'flights' &&
                    'Consider a train for short-haul routes. A single short flight can emit as much as 2 months of train travel.'}
                  {category === 'energy' &&
                    subcategory === 'electricity' &&
                    'Try reducing by 2 kWh today — switch off standby devices and use LED lighting. Saves ~0.76 kg CO₂ per kWh.'}
                  {category === 'energy' &&
                    subcategory === 'lpg' &&
                    'Consider switching to renewable energy or improving home insulation to reduce heating fuel consumption.'}
                  {category === 'energy' &&
                    subcategory === 'solar' &&
                    'Great choice! Solar energy is a clean, renewable source. You are building toward a net-zero home.'}
                  {category === 'food' &&
                    subcategory === 'meat' &&
                    'Swapping one meat meal for a plant-based alternative saves ~4.6 kg CO₂e. Try it next time!'}
                  {category === 'food' &&
                    (subcategory === 'vegetarian' || subcategory === 'vegan') &&
                    'Great choice! Plant-based meals have a fraction of the carbon footprint of meat-based meals.'}
                  {category === 'shopping_waste' &&
                    (subcategory === 'shopping' || subcategory === 'deliveries') &&
                    'Try buying second-hand or borrowing instead. Extending product lifespans cuts manufacturing emissions by up to 50%.'}
                  {category === 'shopping_waste' &&
                    subcategory === 'recycling' &&
                    'Recycling is fantastic! You are reducing landfill methane and saving raw material extraction emissions.'}
                </p>
              </div>
            </div>
          </div>

          <div
            className="bg-white dark:bg-forest-900 border border-slate-100 dark:border-forest-800 p-6 rounded-[28px] shadow-sm transition-colors duration-200"
            role="region"
            aria-label="Quick log presets"
          >
            <h3 className="font-display text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-forest-500" aria-hidden="true" />
              Quick log presets
            </h3>
            <div className="grid grid-cols-1 gap-1.5">
              {smartSuggestions.map((sug, i) => (
                <button
                  key={i}
                  onClick={() => handleSmartLog(sug)}
                  disabled={submitting}
                  className="btn-press w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-forest-800 border border-slate-100 dark:border-forest-800 rounded-2xl flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors disabled:opacity-50"
                  aria-label={`Quick log: ${sug.label}`}
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="p-1.5 bg-slate-100 dark:bg-forest-800 text-slate-600 dark:text-slate-400 rounded-lg shrink-0"
                      aria-hidden="true"
                    >
                      {getCategoryIcon(sug.category)}
                    </span>
                    <span className="truncate">{sug.label}</span>
                  </span>
                  <span className="text-forest-600 dark:text-forest-400 font-bold shrink-0 ml-2">+1 tap</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6" role="region" aria-label="Activity history">
          <div className="bg-white dark:bg-forest-900 border border-slate-100 dark:border-forest-800 rounded-[28px] shadow-sm p-6 transition-colors duration-200">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100 dark:border-forest-800">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Logged Activities History
              </h2>

              <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-none">
                  <span
                    className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400 pointer-events-none"
                    aria-hidden="true"
                  >
                    <Search className="h-4 w-4" />
                  </span>
                  <label htmlFor="search-logs" className="sr-only">
                    Search subcategory
                  </label>
                  <input
                    id="search-logs"
                    type="text"
                    placeholder="Search subcategory&hellip;"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPage(1);
                    }}
                    className="pl-8 pr-3 py-1.5 border border-slate-200 dark:border-forest-700 rounded-xl text-xs focus:outline-none focus:border-forest-500 focus:ring-1 focus:ring-forest-500 w-full sm:w-40 bg-white dark:bg-forest-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <label htmlFor="category-filter" className="sr-only">
                  Filter by category
                </label>
                <select
                  id="category-filter"
                  value={filterCategory}
                  onChange={(e) => {
                    setFilterCategory(e.target.value);
                    setPage(1);
                  }}
                  className="px-2.5 py-1.5 border border-slate-200 dark:border-forest-700 rounded-xl text-xs focus:outline-none focus:border-forest-500 bg-white dark:bg-forest-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="">All categories</option>
                  <option value="transport">Transportation</option>
                  <option value="energy">Energy</option>
                  <option value="food">Diet</option>
                  <option value="shopping_waste">Shopping &amp; Waste</option>
                </select>
              </div>
            </div>

            {loadingHistory ? (
              <div className="space-y-4 pt-4" role="status" aria-label="Loading activity history">
                <div className="h-10 bg-slate-100 dark:bg-forest-800 animate-pulse rounded-xl" aria-hidden="true"></div>
                <div
                  className="h-10 bg-slate-50 dark:bg-forest-800/60 animate-pulse rounded-xl"
                  aria-hidden="true"
                ></div>
                <div className="h-10 bg-slate-100 dark:bg-forest-800 animate-pulse rounded-xl" aria-hidden="true"></div>
                <span className="sr-only">Loading activities&hellip;</span>
              </div>
            ) : historyError !== null && historyError !== '' ? (
              <div className="py-8 text-center text-red-500 dark:text-red-400 font-semibold text-sm" role="alert">
                Error loading history: {historyError}
              </div>
            ) : history.length === 0 ? (
              <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-sm space-y-2">
                <HelpCircle className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600" aria-hidden="true" />
                <p>No activity logs found. Use the presets or form above to log your first activity!</p>
              </div>
            ) : (
              <div className="overflow-x-auto pt-4">
                <table
                  className="w-full text-left text-xs font-semibold text-slate-700 dark:text-slate-300"
                  role="table"
                  aria-label="Activity log history"
                >
                  <caption className="sr-only">Your logged activities</caption>
                  <thead>
                    <tr className="text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-forest-800">
                      <th className="py-3 pr-2 font-medium" scope="col">
                        Category
                      </th>
                      <th className="py-3 font-medium" scope="col">
                        Subcategory
                      </th>
                      <th className="py-3 text-right font-medium tabular-nums" scope="col">
                        Quantity
                      </th>
                      <th className="py-3 text-right font-medium tabular-nums" scope="col">
                        CO&shy;e (kg)
                      </th>
                      <th className="py-3 text-center font-medium" scope="col">
                        Recurrence
                      </th>
                      <th className="py-3 text-center font-medium" scope="col">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-forest-800/60">
                    {history.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50/50 dark:hover:bg-forest-800/40 transition-colors animate-fade-in"
                      >
                        <td className="py-3 pr-2">
                          <span className="flex items-center gap-2">
                            <span
                              className="p-1 bg-slate-100 dark:bg-forest-800 text-slate-600 dark:text-slate-400 rounded-lg shrink-0"
                              aria-hidden="true"
                            >
                              {getCategoryIcon(item.category)}
                            </span>
                            <span className="capitalize">{item.category.replace('_', ' ')}</span>
                          </span>
                        </td>
                        <td className="py-3 capitalize">{item.subcategory.replace('_', ' ')}</td>
                        <td className="py-3 text-right tabular-nums">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="py-3 text-right tabular-nums">
                          {item.co2Emissions > 0 ? (
                            <span className="text-amber-700 dark:text-amber-400 font-bold">{item.co2Emissions} kg</span>
                          ) : item.co2Emissions < 0 ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                              -{Math.abs(item.co2Emissions)} kg
                            </span>
                          ) : (
                            <span className="text-slate-400">0 kg</span>
                          )}
                        </td>
                        <td className="py-3 text-center">
                          {item.isRecurring ? (
                            <span className="px-2 py-0.5 bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-300 rounded-full text-[10px] font-bold">
                              {item.recurrencePeriod.toUpperCase()}
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">&ndash;</span>
                          )}
                        </td>
                        <td className="py-3 text-center">
                          <span className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => {
                                void executeLog(
                                  item.category as 'transport' | 'energy' | 'food' | 'shopping_waste',
                                  item.subcategory,
                                  item.quantity,
                                  item.unit,
                                );
                              }}
                              className="btn-press p-1.5 hover:bg-forest-50 dark:hover:bg-forest-800 text-forest-600 dark:text-forest-400 rounded-lg transition-colors"
                              aria-label={`Repeat: ${item.subcategory} ${item.quantity} ${item.unit}`}
                            >
                              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            <button
                              onClick={() => {
                                void handleDelete(item.id);
                              }}
                              className="btn-press p-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors"
                              aria-label={`Delete activity ${item.id}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-forest-800 mt-4 text-xs text-slate-500 dark:text-slate-400">
                  <span role="status" aria-live="polite" className="tabular-nums">
                    Showing {(page - 1) * limit + 1}&ndash;{Math.min(page * limit, totalItems)} of {totalItems}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="btn-press px-3 py-1.5 bg-slate-100 dark:bg-forest-800 hover:bg-slate-200 dark:hover:bg-forest-700 text-slate-600 dark:text-slate-300 rounded-lg disabled:opacity-40 transition-colors text-xs font-semibold"
                      aria-label="Previous page"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page * limit >= totalItems}
                      className="btn-press px-3 py-1.5 bg-slate-100 dark:bg-forest-800 hover:bg-slate-200 dark:hover:bg-forest-700 text-slate-600 dark:text-slate-300 rounded-lg disabled:opacity-40 transition-colors text-xs font-semibold"
                      aria-label="Next page"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
