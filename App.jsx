import React, { useState, useMemo, useEffect, useCallback } from 'react';

// --- Utility Functions ---

// FIX #3: compute today inside a function so it never goes stale across midnight
const getToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const addDays = (base, n) => {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
};

const daysUntil = (dateStr) => {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - getToday()) / (1000 * 60 * 60 * 24));
};

const getStatus = (days) => {
  if (days > 30) return 'green';
  if (days >= 7) return 'yellow';
  return 'red';
};

const getDiscount = (days) => {
  if (days >= 7 && days <= 30) return 20;
  if (days < 7) return 30;
  return 0;
};

const fmt = (n) =>
  '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// --- Static seed data (wallet/orders only — inventory comes from backend) ---
const initialTxns = [
  { id: 1, label: 'Bought Frozen Peas from Market', sub: 'Marketplace purchase', amt: -63, date: 'Today', type: 'debit' },
  { id: 2, label: 'Wallet top-up', sub: 'Debit card', amt: 1000, date: 'Yesterday', type: 'credit' },
  { id: 3, label: 'Reward cashback', sub: '5% on ₹1,280 order', amt: 64, date: '2 days ago', type: 'credit' },
  { id: 4, label: 'Bought Yogurt from Market', sub: 'Marketplace purchase', amt: 126, date: '3 days ago', type: 'debit' },
  { id: 5, label: 'Sold Chicken Masala', sub: 'Marketplace sale', amt: 76, date: '4 days ago', type: 'credit' },
];

const initialOrders = [
  { id: 1, name: 'Frozen Peas (500g)', seller: 'Priya K.', orig: 90, paid: 63, date: 'Today', status: 'Delivered' },
  { id: 2, name: 'Greek Yogurt (500g)', seller: 'Ravi M.', orig: 180, paid: 126, date: '3 days ago', status: 'Delivered' },
];

// FIX #7 & #8: NavItem defined OUTSIDE the component so it isn't recreated on every render
const NavItem = ({ id, icon, label, activePanel, setActivePanel }) => (
  <div
    className={`flex items-center gap-2.5 px-5 py-2.5 text-sm cursor-pointer border-l-2 transition-all duration-150
      ${activePanel === id ? 'bg-gray-50 text-gray-900 border-[#639922]' : 'text-gray-500 border-transparent hover:bg-gray-50 hover:text-gray-900'}`}
    onClick={() => setActivePanel(id)}
    role="button"
    aria-current={activePanel === id ? 'page' : undefined}
  >
    <i className={`ti ${icon} text-lg`}></i> {label}
  </div>
);

export default function KitchenVaultApp() {
  // --- State ---
  const [activePanel, setActivePanel] = useState('inventory');
  const [items, setItems] = useState([]);
  // FIX #2: start with empty listed items — no hardcoded IDs that may not exist
  const [listedItems, setListedItems] = useState([]);
  const [walletBalance, setWalletBalance] = useState(2450);
  const [tickets, setTickets] = useState(3);
  const [points, setPoints] = useState(480);
  const [txns, setTxns] = useState(initialTxns);
  const [orders, setOrders] = useState(initialOrders);

  const [searchQ, setSearchQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Loading / error state for backend fetch
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  // Modals & Notifications
  const [modals, setModals] = useState({ add: false, topup: false, buy: false, sell: false });
  const [buyTargetId, setBuyTargetId] = useState(null);
  const [notify, setNotify] = useState({ show: false, msg: '' });

  // Forms
  const [addForm, setAddForm] = useState({
    name: '', cat: 'Grains', price: '', qty: '', expiry: addDays(getToday(), 365),
  });
  const [topupAmt, setTopupAmt] = useState('');
  const [sellSelectId, setSellSelectId] = useState('');
  const [buyMethod, setBuyMethod] = useState('wallet');

  // --- Fetch items from backend on mount ---
  // FIX #9: use relative URL — works with the vite proxy (no hardcoded 127.0.0.1)
  useEffect(() => {
    setLoading(true);
    setFetchError(false);
    fetch('/items/')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setItems(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching items:', err);
        setFetchError(true);
        setLoading(false);
      });
  }, []);

  // --- Helpers ---
  const showNotification = useCallback((msg) => {
    setNotify({ show: true, msg });
    setTimeout(() => setNotify({ show: false, msg: '' }), 3000);
  }, []);

  // FIX: use functional update to avoid stale closure bugs when modals open rapidly
  const openModal = useCallback((key) => setModals((prev) => ({ ...prev, [key]: true })), []);
  const closeModal = useCallback((key) => setModals((prev) => ({ ...prev, [key]: false })), []);

  // --- Actions ---

  // FIX #1: POST to backend, use returned item (with real DB id) to update state
  // FIX #6: validate all required fields including price and qty
  const handleAddItem = async () => {
    if (!addForm.name.trim()) return showNotification('Please enter an item name');
    if (!addForm.price || parseFloat(addForm.price) < 0)
      return showNotification('Please enter a valid price');
    if (!addForm.qty.trim()) return showNotification('Please enter a quantity');
    if (!addForm.expiry) return showNotification('Please select an expiry date');

    try {
      const res = await fetch('/items/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addForm.name.trim(),
          cat: addForm.cat,
          price: parseFloat(addForm.price),
          qty: addForm.qty.trim(),
          expiry: addForm.expiry,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return showNotification(err.detail?.[0]?.msg || 'Failed to add item');
      }
      const newItem = await res.json();
      setItems((prev) => [...prev, newItem]);
      closeModal('add');
      showNotification(`${newItem.name} added to inventory`);
      setAddForm({ name: '', cat: 'Grains', price: '', qty: '', expiry: addDays(getToday(), 365) });
    } catch {
      showNotification('Could not connect to server');
    }
  };

  // Delete item from backend and local state
  const handleDeleteItem = async (id) => {
    try {
      const res = await fetch(`/items/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) return showNotification('Failed to delete item');
      setItems((prev) => prev.filter((i) => i.id !== id));
      setListedItems((prev) => prev.filter((i) => i !== id));
      showNotification('Item removed from inventory');
    } catch {
      showNotification('Could not connect to server');
    }
  };

  const quickSell = (id) => {
    if (!listedItems.includes(id)) setListedItems((prev) => [...prev, id]);
    const item = items.find((i) => i.id === id);
    showNotification(`${item.name} listed on marketplace`);
  };

  const delist = (id) => {
    setListedItems((prev) => prev.filter((i) => i !== id));
    showNotification('Listing removed');
  };

  const handleTopup = () => {
    const amt = parseFloat(topupAmt) || 0;
    if (amt <= 0) return showNotification('Enter a valid amount');
    setWalletBalance((prev) => prev + amt);
    setTxns((prev) => [
      { id: Date.now(), label: 'Wallet top-up', sub: 'Manual', amt, date: 'Just now', type: 'credit' },
      ...prev,
    ]);
    closeModal('topup');
    showNotification(`Wallet topped up by ${fmt(amt)}`);
    setTopupAmt('');
  };

  const confirmBuy = () => {
    // FIX #4: guard against item not found (e.g. stale buyTargetId after reload)
    const item = items.find((i) => i.id === buyTargetId);
    if (!item) return showNotification('Item no longer available');

    const discPrice = parseFloat(
      (item.price * (1 - getDiscount(daysUntil(item.expiry)) / 100)).toFixed(2)
    );

    if (buyMethod === 'wallet') {
      if (walletBalance < discPrice) return showNotification('Insufficient wallet balance');

      let newBalance = walletBalance - discPrice;
      // FIX #5: always compute points regardless of cashback branch
      const earnedPoints = Math.floor(discPrice / 10);
      const newPoints = points + earnedPoints;

      if (discPrice >= 1000) {
        const cashback = parseFloat((discPrice * 0.05).toFixed(2));
        newBalance += cashback;
        setTickets((t) => t + 1);
        // Now also shows points earned in cashback branch
        showNotification(
          `Bought! ₹${cashback.toFixed(2)} cashback + 1 ticket + ${earnedPoints} points earned`
        );
      } else {
        showNotification(`Bought via wallet! +${earnedPoints} points earned`);
      }

      setWalletBalance(newBalance);
      setPoints(newPoints);
      setTxns((prev) => [
        {
          id: Date.now(),
          label: `Bought ${item.name}`,
          sub: 'Marketplace purchase',
          amt: -discPrice,
          date: 'Just now',
          type: 'debit',
        },
        ...prev,
      ]);
    } else {
      showNotification(`Order placed! Paid ${fmt(discPrice)} via card`);
    }

    setOrders((prev) => [
      {
        id: Date.now(),
        name: item.name,
        seller: 'Marketplace',
        orig: item.price,
        paid: discPrice,
        date: 'Just now',
        status: 'Processing',
      },
      ...prev,
    ]);
    setListedItems((prev) => prev.filter((i) => i !== buyTargetId));
    closeModal('buy');
  };

  const redeemTicket = () => {
    if (tickets <= 0) return showNotification('No tickets available');
    setTickets((t) => t - 1);
    setWalletBalance((b) => b + 50);
    setTxns((prev) => [
      { id: Date.now(), label: 'Ticket redeemed', sub: '₹50 credited', amt: 50, date: 'Just now', type: 'credit' },
      ...prev,
    ]);
    showNotification('Ticket redeemed! ₹50 added to wallet');
  };

  const redeemPoints = () => {
    if (points < 100) return showNotification('Need at least 100 points to convert');
    const credit = parseFloat((points / 10).toFixed(2));
    setWalletBalance((b) => b + credit);
    setTxns((prev) => [
      {
        id: Date.now(),
        label: `${points} points converted`,
        sub: 'Points to cash',
        amt: credit,
        date: 'Just now',
        type: 'credit',
      },
      ...prev,
    ]);
    setPoints(0);
    showNotification(`${fmt(credit)} added from points`);
  };

  // --- Derived Data (useMemo) ---
  const inventoryToDisplay = useMemo(() => {
    let list = [...items].sort((a, b) => {
      const priority = { red: 0, yellow: 1, green: 2 };
      return priority[getStatus(daysUntil(a.expiry))] - priority[getStatus(daysUntil(b.expiry))];
    });
    if (statusFilter !== 'all') list = list.filter((i) => getStatus(daysUntil(i.expiry)) === statusFilter);
    if (searchQ) list = list.filter((i) => i.name.toLowerCase().includes(searchQ.toLowerCase()));
    return list;
  }, [items, statusFilter, searchQ]);

  const marketItems = useMemo(
    () => items.filter((i) => listedItems.includes(i.id)),
    [items, listedItems]
  );

  // FIX #7: derive real stats from items state
  const inventoryStats = useMemo(() => {
    const totalSpending = items.reduce((sum, i) => sum + i.price, 0);
    const expiringSoon = items.filter((i) => {
      const d = daysUntil(i.expiry);
      return d >= 0 && d <= 7;
    }).length;
    const expired = items.filter((i) => daysUntil(i.expiry) < 0).length;
    return { totalSpending, expiringSoon, expired };
  }, [items]);

  // FIX #8: derive real analytics from items state
  const analytics = useMemo(() => {
    const cats = {};
    let total = 0;
    items.forEach((i) => {
      cats[i.cat] = (cats[i.cat] || 0) + i.price;
      total += i.price;
    });
    const sortedCats = Object.entries(cats).sort((a, b) => b[1] - a[1]);
    const topItems = [...items].sort((a, b) => b.price - a.price).slice(0, 5);
    const avgPerItem = items.length ? total / items.length : 0;
    return { sortedCats, topItems, total, avgPerItem };
  }, [items]);

  const unlistedItemsExpiring = useMemo(
    () => items.filter((i) => !listedItems.includes(i.id) && getDiscount(daysUntil(i.expiry)) > 0),
    [items, listedItems]
  );

  // --- Render ---
  return (
    <div className="flex h-screen min-h-[600px] bg-gray-100 font-sans text-gray-900">

      {/* SIDEBAR */}
      <aside className="w-[220px] bg-white border-r border-gray-200 flex flex-col py-5 shrink-0">
        <div className="px-5 pb-5 border-b border-gray-200 mb-3">
          <div className="text-base font-medium flex items-center text-gray-900">
            <i className="ti ti-salad text-[#639922] mr-1.5"></i>KitchenVault
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Inventory & Marketplace</div>
        </div>

        <span className="px-5 pt-3 pb-1 text-[11px] text-gray-400 tracking-wider uppercase">Inventory</span>
        <NavItem id="inventory" icon="ti-package" label="My Inventory" activePanel={activePanel} setActivePanel={setActivePanel} />
        <NavItem id="analytics" icon="ti-chart-bar" label="Spending Analytics" activePanel={activePanel} setActivePanel={setActivePanel} />

        <span className="px-5 pt-3 pb-1 text-[11px] text-gray-400 tracking-wider uppercase">Marketplace</span>
        <NavItem id="market" icon="ti-shopping-cart" label="Buy Items" activePanel={activePanel} setActivePanel={setActivePanel} />
        <NavItem id="sell" icon="ti-tag" label="Sell Items" activePanel={activePanel} setActivePanel={setActivePanel} />

        <span className="px-5 pt-3 pb-1 text-[11px] text-gray-400 tracking-wider uppercase">Account</span>
        <NavItem id="wallet" icon="ti-wallet" label="Wallet & Rewards" activePanel={activePanel} setActivePanel={setActivePanel} />
        <NavItem id="orders" icon="ti-receipt" label="Orders" activePanel={activePanel} setActivePanel={setActivePanel} />

        <div className="mt-auto mx-4 bg-gray-50 border border-gray-200 rounded-xl p-4">
          <div className="text-[11px] text-gray-500">Wallet Balance</div>
          <div className="text-2xl font-medium text-gray-900 my-1">{fmt(walletBalance)}</div>
          <div className="mb-2.5">
            <span className="text-[11px] bg-[#EAF3DE] text-[#3B6D11] px-2 py-0.5 rounded-full">🎟 {tickets} tickets</span>
          </div>
          <button
            onClick={() => openModal('topup')}
            className="w-full p-1.5 bg-transparent border border-gray-300 rounded-lg text-sm flex items-center justify-center gap-1.5 hover:bg-gray-100 transition"
          >
            <i className="ti ti-plus text-sm"></i> Top up
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto p-6">

        {/* INVENTORY PANEL */}
        {activePanel === 'inventory' && (
          <div className="animate-[fadeIn_0.2s_ease-out]">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-xl font-medium">My Inventory</h1>
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
                  <i className="ti ti-search text-gray-400"></i>
                  <input
                    type="text" placeholder="Search items…"
                    className="border-none bg-transparent outline-none text-sm w-40"
                    value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
                  />
                </div>
                <button
                  onClick={() => openModal('add')}
                  className="px-4 py-2 bg-[#639922] hover:bg-[#3B6D11] text-white rounded-lg text-sm flex items-center gap-1.5 transition"
                >
                  <i className="ti ti-plus text-base"></i> Add Item
                </button>
              </div>
            </div>

            {/* FIX #7: stats derived from real items state */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="text-xs text-gray-500 mb-1.5">Total Value</div>
                <div className="text-2xl font-medium">{fmt(inventoryStats.totalSpending)}</div>
                <div className="text-[11px] text-[#3B6D11] mt-1">{items.length} items</div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="text-xs text-gray-500 mb-1.5">Expiring Soon</div>
                <div className="text-2xl font-medium text-[#854F0B]">{inventoryStats.expiringSoon}</div>
                <div className="text-[11px] text-[#854F0B] mt-1">within 7 days</div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="text-xs text-gray-500 mb-1.5">Expired</div>
                <div className="text-2xl font-medium text-[#A32D2D]">{inventoryStats.expired}</div>
                <div className="text-[11px] text-[#A32D2D] mt-1">list on market</div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="text-xs text-gray-500 mb-1.5">Listed on Market</div>
                <div className="text-2xl font-medium text-[#3B6D11]">{listedItems.length}</div>
                <div className="text-[11px] text-[#3B6D11] mt-1">active listings</div>
              </div>
            </div>

            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-1.5 text-sm text-gray-500"><div className="w-2.5 h-2.5 rounded-full bg-[#639922]"></div>Fresh (&gt;30 days)</div>
              <div className="flex items-center gap-1.5 text-sm text-gray-500"><div className="w-2.5 h-2.5 rounded-full bg-[#EF9F27]"></div>Expiring (7–30 days)</div>
              <div className="flex items-center gap-1.5 text-sm text-gray-500"><div className="w-2.5 h-2.5 rounded-full bg-[#E24B4A]"></div>Critical (&lt;7 days)</div>
            </div>

            <div className="flex gap-2 mb-5 flex-wrap">
              {[{ id: 'all', l: 'All Items' }, { id: 'green', l: '🟢 Fresh' }, { id: 'yellow', l: '🟡 Expiring' }, { id: 'red', l: '🔴 Critical' }].map((t) => (
                <button key={t.id} onClick={() => setStatusFilter(t.id)}
                  className={`px-3.5 py-1.5 rounded-full border text-sm transition-colors ${statusFilter === t.id ? 'bg-gray-100 border-gray-300 text-gray-900' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                  {t.l}
                </button>
              ))}
            </div>

            {/* Loading / error states */}
            {loading && (
              <div className="text-center py-16 text-gray-400 text-sm">Loading inventory…</div>
            )}
            {fetchError && !loading && (
              <div className="text-center py-16 text-[#A32D2D] text-sm">
                Could not connect to the backend. Make sure FastAPI is running on port 8000.
              </div>
            )}

            {!loading && !fetchError && (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
                {inventoryToDisplay.length === 0 && (
                  <div className="col-span-full text-center py-16 text-gray-400 text-sm">
                    No items found. Add your first item!
                  </div>
                )}
                {inventoryToDisplay.map((item) => {
                  const days = daysUntil(item.expiry);
                  const st = getStatus(days);
                  const disc = getDiscount(days);
                  const isListed = listedItems.includes(item.id);
                  const expLabel = days < 0 ? 'Expired' : days === 0 ? 'Expires today' : `${days}d left`;

                  return (
                    <div key={item.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-gray-300 transition group cursor-pointer flex flex-col">
                      <div className={`h-1 ${st === 'green' ? 'bg-[#639922]' : st === 'yellow' ? 'bg-[#EF9F27]' : 'bg-[#E24B4A]'}`}></div>
                      <div className="p-4 flex-1">
                        <div className="font-medium text-sm mb-1">{item.name}</div>
                        <div className="text-xs text-gray-500 mb-2.5">{item.cat}</div>
                        <div className="flex justify-between items-center mb-2">
                          <div className="font-medium">{fmt(item.price)}</div>
                          <div className="text-xs text-gray-500">{item.qty}</div>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium 
                            ${st === 'green' ? 'bg-[#EAF3DE] text-[#3B6D11]' : st === 'yellow' ? 'bg-[#FAEEDA] text-[#854F0B]' : 'bg-[#FCEBEB] text-[#A32D2D]'}`}>
                            <i className="ti ti-clock text-[11px]"></i> {expLabel}
                          </span>
                          {disc > 0 && <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#FAEEDA] text-[#854F0B]">-{disc}% on market</span>}
                        </div>
                      </div>
                      <div className="px-4 pb-4 flex gap-1.5">
                        {/* FIX: aria-label on icon-only button */}
                        <button
                          onClick={() => setActivePanel('analytics')}
                          aria-label="View analytics"
                          className="flex-1 py-1.5 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 flex items-center justify-center"
                        >
                          <i className="ti ti-chart-bar text-sm"></i>
                        </button>
                        {disc > 0 && !isListed ? (
                          <button onClick={() => quickSell(item.id)} className="flex-[3] py-1.5 border border-[#EF9F27] text-[#854F0B] rounded-lg text-xs hover:bg-[#FAEEDA] flex items-center justify-center gap-1 transition">
                            <i className="ti ti-tag text-sm"></i> Sell
                          </button>
                        ) : isListed ? (
                          <button disabled className="flex-[3] py-1.5 border border-gray-200 text-gray-400 rounded-lg text-xs flex items-center justify-center gap-1 opacity-60 cursor-not-allowed">
                            <i className="ti ti-check text-sm"></i> Listed
                          </button>
                        ) : (
                          // Delete button for fresh items not expiring yet
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            aria-label="Delete item"
                            className="flex-[3] py-1.5 border border-gray-200 text-gray-400 rounded-lg text-xs hover:bg-[#FCEBEB] hover:text-[#A32D2D] hover:border-[#F09595] flex items-center justify-center gap-1 transition"
                          >
                            <i className="ti ti-trash text-sm"></i> Remove
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ANALYTICS PANEL */}
        {activePanel === 'analytics' && (
          <div className="animate-[fadeIn_0.2s_ease-out]">
            <h1 className="text-xl font-medium mb-6">Spending Analytics</h1>
            {/* FIX #8: derive stats from real items */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="text-xs text-gray-500 mb-1.5">Total Inventory Value</div>
                <div className="text-2xl font-medium">{fmt(analytics.total)}</div>
                <div className="text-[11px] text-gray-500 mt-1">{items.length} items tracked</div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="text-xs text-gray-500 mb-1.5">Avg. per Item</div>
                <div className="text-2xl font-medium">{fmt(analytics.avgPerItem)}</div>
                <div className="text-[11px] text-gray-500 mt-1">across {items.length} items</div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="text-xs text-gray-500 mb-1.5">Categories</div>
                <div className="text-2xl font-medium">{analytics.sortedCats.length}</div>
                <div className="text-[11px] text-[#3B6D11] mt-1">in inventory</div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
              <h2 className="font-medium mb-4">Spending by category</h2>
              {analytics.sortedCats.length === 0 && (
                <div className="text-sm text-gray-400">No data yet. Add items to see analytics.</div>
              )}
              {analytics.sortedCats.map(([cat, amt]) => (
                <div key={cat} className="mb-3">
                  <div className="flex justify-between text-sm text-gray-500 mb-1">
                    <span>{cat}</span><span className="text-gray-900 font-medium">{fmt(amt)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#639922] rounded-full" style={{ width: `${Math.round((amt / analytics.total) * 100)}%` }}></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="font-medium mb-4">Most expensive items</h2>
              {analytics.topItems.length === 0 && (
                <div className="text-sm text-gray-400">No items yet.</div>
              )}
              {analytics.topItems.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-400 w-5">#{idx + 1}</span>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{item.name}</div>
                    <div className="text-xs text-gray-500">{item.cat} · {item.qty}</div>
                  </div>
                  <div className="text-base font-medium">{fmt(item.price)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MARKETPLACE BUY */}
        {activePanel === 'market' && (
          <div className="animate-[fadeIn_0.2s_ease-out]">
            <h1 className="text-xl font-medium mb-6">Marketplace — Buy Items</h1>
            <div className="bg-[#EAF3DE] rounded-lg p-3 text-sm text-[#3B6D11] mb-6 flex items-center gap-2">
              <i className="ti ti-award text-lg"></i>
              <span>Spend ₹1,000+ and pay via wallet to get <strong>5% cashback</strong> + a reward ticket!</span>
            </div>

            {marketItems.length === 0 ? (
              <div className="text-gray-500 text-sm">No items listed for sale yet. Go to "Sell Items" to list expiring stock.</div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
                {marketItems.map((item) => {
                  const days = daysUntil(item.expiry);
                  const disc = getDiscount(days);
                  const discPrice = (item.price * (1 - disc / 100)).toFixed(2);
                  const st = getStatus(days);

                  return (
                    <div key={item.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
                      <div className={`h-1 ${st === 'green' ? 'bg-[#639922]' : st === 'yellow' ? 'bg-[#EF9F27]' : 'bg-[#E24B4A]'}`}></div>
                      <div className="p-4 pb-2">
                        <div className="font-medium text-sm">{item.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{item.cat} · {item.qty}</div>
                        <div className="mt-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] 
                             ${st === 'green' ? 'bg-[#EAF3DE] text-[#3B6D11]' : st === 'yellow' ? 'bg-[#FAEEDA] text-[#854F0B]' : 'bg-[#FCEBEB] text-[#A32D2D]'}`}>
                            <i className="ti ti-clock text-[11px]"></i> {days}d left
                          </span>
                        </div>
                      </div>
                      <div className="px-4 py-2 flex items-center gap-2 border-t border-gray-100 mt-2">
                        <span className="text-xs text-gray-400 line-through">{fmt(item.price)}</span>
                        <span className="text-base font-medium text-[#3B6D11]">{fmt(discPrice)}</span>
                        <span className="ml-auto bg-[#EAF3DE] text-[#3B6D11] text-[11px] px-2 py-0.5 rounded-full font-medium">-{disc}%</span>
                      </div>
                      <div className="p-3 pt-2 mt-auto">
                        <button onClick={() => { setBuyTargetId(item.id); openModal('buy'); }}
                          className="w-full py-1.5 bg-[#639922] hover:bg-[#3B6D11] text-white rounded-lg text-sm flex items-center justify-center gap-1.5 transition">
                          <i className="ti ti-shopping-cart text-sm"></i> Buy via Wallet
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* MARKETPLACE SELL */}
        {activePanel === 'sell' && (
          <div className="animate-[fadeIn_0.2s_ease-out]">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-xl font-medium">Sell Items</h1>
              <button onClick={() => {
                if (unlistedItemsExpiring.length > 0) setSellSelectId(unlistedItemsExpiring[0].id);
                openModal('sell');
              }} className="px-4 py-2 bg-[#639922] hover:bg-[#3B6D11] text-white rounded-lg text-sm flex items-center gap-1.5 transition">
                <i className="ti ti-plus text-base"></i> List Item
              </button>
            </div>

            <div className="bg-[#FAEEDA] rounded-lg p-3 text-sm text-[#854F0B] mb-6 flex items-center gap-2">
              <i className="ti ti-info-circle text-lg"></i>
              <span>Items expiring in 7–30 days get <strong>20% discount</strong>. Expiring &lt;7 days get <strong>30% discount</strong> automatically.</span>
            </div>

            {marketItems.length === 0 ? (
              <div className="text-gray-500 text-sm">No active listings. List items expiring soon to sell them.</div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
                {marketItems.map((item) => {
                  const days = daysUntil(item.expiry);
                  const disc = getDiscount(days);
                  const discPrice = (item.price * (1 - disc / 100)).toFixed(2);
                  const st = getStatus(days);

                  return (
                    <div key={item.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
                      <div className={`h-1 ${st === 'green' ? 'bg-[#639922]' : st === 'yellow' ? 'bg-[#EF9F27]' : 'bg-[#E24B4A]'}`}></div>
                      <div className="p-4 pb-2">
                        <div className="font-medium text-sm">{item.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{item.cat} · {item.qty}</div>
                        <div className="mt-2 text-[11px] text-gray-500">
                          {days}d left · -{disc}% discount applied
                        </div>
                      </div>
                      <div className="px-4 py-2 flex items-center gap-2 border-t border-gray-100 mt-2">
                        <span className="text-xs text-gray-400 line-through">{fmt(item.price)}</span>
                        <span className="text-base font-medium text-gray-900">{fmt(discPrice)}</span>
                        <span className="ml-auto bg-gray-100 text-gray-600 text-[11px] px-2 py-0.5 rounded-full">Listed</span>
                      </div>
                      <div className="p-3 pt-2 mt-auto">
                        <button onClick={() => delist(item.id)}
                          className="w-full py-1.5 border border-[#F09595] text-[#A32D2D] rounded-lg text-sm flex items-center justify-center gap-1.5 hover:bg-[#FCEBEB] transition">
                          <i className="ti ti-x text-sm"></i> Remove listing
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* WALLET PANEL */}
        {activePanel === 'wallet' && (
          <div className="animate-[fadeIn_0.2s_ease-out] max-w-[520px]">
            <h1 className="text-xl font-medium mb-6">Wallet & Rewards</h1>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-5">
              <div className="text-sm text-gray-500 mb-1.5">Available Balance</div>
              <div className="text-4xl font-medium text-gray-900">{fmt(walletBalance)}</div>
              <div className="flex gap-2 mt-3">
                <span className="text-xs bg-[#EAF3DE] text-[#3B6D11] px-2.5 py-1 rounded-full">🎟 {tickets} reward tickets</span>
                <span className="text-xs bg-[#EEEDFE] text-[#3C3489] px-2.5 py-1 rounded-full">⭐ {points} points</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div onClick={() => openModal('topup')} className="bg-white border border-gray-200 rounded-xl p-3.5 flex flex-col items-center gap-2 cursor-pointer hover:bg-gray-50 transition text-sm">
                <i className="ti ti-plus-circle text-2xl text-gray-500"></i>Top up wallet
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-3.5 flex flex-col items-center gap-2 cursor-pointer hover:bg-gray-50 transition text-sm">
                <i className="ti ti-send text-2xl text-gray-500"></i>Send money
              </div>
            </div>

            <h2 className="font-medium mb-3">Reward Offers</h2>
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#EAF3DE] flex items-center justify-center shrink-0"><i className="ti ti-percentage text-xl text-[#3B6D11]"></i></div>
              <div className="flex-1">
                <div className="text-sm font-medium">5% off on orders above ₹1,000</div>
                <div className="text-xs text-gray-500 mt-0.5">Pay via KitchenVault wallet & get instant cashback</div>
              </div>
              <button className="px-3.5 py-1.5 rounded-lg border border-[#639922] text-[#639922] text-xs hover:bg-[#EAF3DE] transition">Active</button>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#EAF3DE] flex items-center justify-center shrink-0"><i className="ti ti-ticket text-xl text-[#3B6D11]"></i></div>
              <div className="flex-1">
                <div className="text-sm font-medium">Redeem reward ticket</div>
                <div className="text-xs text-gray-500 mt-0.5">{tickets} tickets available — get ₹50 off</div>
              </div>
              <button onClick={redeemTicket} className="px-3.5 py-1.5 rounded-lg border border-[#639922] text-[#639922] text-xs hover:bg-[#EAF3DE] transition">Redeem</button>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#EEEDFE] flex items-center justify-center shrink-0"><i className="ti ti-star text-xl text-[#534AB7]"></i></div>
              <div className="flex-1">
                <div className="text-sm font-medium">{points} points → ₹{Math.floor(points / 10)} credit</div>
                <div className="text-xs text-gray-500 mt-0.5">Earn 1 point per ₹10 spent via wallet</div>
              </div>
              <button onClick={redeemPoints} className="px-3.5 py-1.5 rounded-lg border border-[#639922] text-[#639922] text-xs hover:bg-[#EAF3DE] transition">Convert</button>
            </div>

            <h2 className="font-medium mb-3">Recent Transactions</h2>
            <div className="flex flex-col">
              {txns.map((t) => (
                <div key={t.id} className="flex items-center gap-3 py-2.5 border-b border-gray-200 last:border-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${t.type === 'credit' ? 'bg-[#EAF3DE]' : 'bg-[#FCEBEB]'}`}>
                    <i className={`ti ${t.type === 'credit' ? 'ti-arrow-down-left text-[#3B6D11]' : 'ti-arrow-up-right text-[#A32D2D]'}`}></i>
                  </div>
                  <div>
                    <div className="text-sm text-gray-900">{t.label}</div>
                    <div className="text-xs text-gray-500">{t.sub} · {t.date}</div>
                  </div>
                  <div className={`ml-auto font-medium text-sm ${t.type === 'credit' ? 'text-[#3B6D11]' : 'text-[#A32D2D]'}`}>
                    {t.type === 'credit' ? '+' : '-'}{fmt(Math.abs(t.amt))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ORDERS PANEL */}
        {activePanel === 'orders' && (
          <div className="animate-[fadeIn_0.2s_ease-out]">
            <h1 className="text-xl font-medium mb-6">My Orders</h1>
            <div className="flex flex-col gap-3">
              {orders.map((o) => (
                <div key={o.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#EAF3DE] rounded-lg flex items-center justify-center">
                    <i className="ti ti-package text-xl text-[#3B6D11]"></i>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{o.name}</div>
                    <div className="text-xs text-gray-500">From: {o.seller} · {o.date}</div>
                  </div>
                  <div className="text-right mr-3">
                    <div className="text-base font-medium">{fmt(o.paid)}</div>
                    <div className="text-xs text-gray-400 line-through">{fmt(o.orig)}</div>
                  </div>
                  <span className="bg-[#EAF3DE] text-[#3B6D11] text-xs px-2.5 py-1 rounded-full">{o.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* --- MODALS --- */}

      {/* Add Item Modal */}
      {modals.add && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-[fadeIn_0.15s_ease-out]">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-[360px]">
            <div className="text-base font-medium flex justify-between items-center mb-5">
              Add inventory item
              <button onClick={() => closeModal('add')} className="text-gray-400 hover:text-gray-600"><i className="ti ti-x text-lg"></i></button>
            </div>
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1.5">Item name *</label>
              <input type="text" className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-[#639922]/10"
                placeholder="e.g. Basmati Rice" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} />
            </div>
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1.5">Category</label>
              <select className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none" value={addForm.cat} onChange={(e) => setAddForm({ ...addForm, cat: e.target.value })}>
                <option>Grains</option><option>Dairy</option><option>Vegetables</option><option>Fruits</option><option>Spices</option><option>Beverages</option><option>Frozen</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Price (₹) *</label>
                <input type="number" min="0" className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none"
                  placeholder="0" value={addForm.price} onChange={(e) => setAddForm({ ...addForm, price: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Quantity *</label>
                <input type="text" className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none"
                  placeholder="e.g. 2 kg" value={addForm.qty} onChange={(e) => setAddForm({ ...addForm, qty: e.target.value })} />
              </div>
            </div>
            <div className="mb-5">
              <label className="block text-xs text-gray-500 mb-1.5">Expiry date *</label>
              <input type="date" className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none"
                value={addForm.expiry} onChange={(e) => setAddForm({ ...addForm, expiry: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => closeModal('add')} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50">Cancel</button>
              <button onClick={handleAddItem} className="flex-1 py-2 bg-[#639922] text-white rounded-lg text-sm hover:bg-[#3B6D11]">Add item</button>
            </div>
          </div>
        </div>
      )}

      {/* Topup Modal */}
      {modals.topup && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-[360px]">
            <div className="text-base font-medium flex justify-between items-center mb-5">
              Top up wallet
              <button onClick={() => closeModal('topup')} className="text-gray-400 hover:text-gray-600"><i className="ti ti-x text-lg"></i></button>
            </div>
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1.5">Amount (₹)</label>
              <input type="number" className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none"
                placeholder="Enter amount" value={topupAmt} onChange={(e) => setTopupAmt(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[500, 1000, 2000].map((v) => (
                <button key={v} onClick={() => setTopupAmt(v.toString())}
                  className="py-1.5 border border-gray-200 bg-gray-50 rounded-full text-xs text-gray-600 hover:bg-gray-100">
                  ₹{v.toLocaleString()}
                </button>
              ))}
            </div>
            <div className="mb-5">
              <label className="block text-xs text-gray-500 mb-1.5">Payment method</label>
              <select className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none">
                <option>Debit Card</option><option>Credit Card</option><option>Net Banking</option><option>UPI (to wallet)</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => closeModal('topup')} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-500">Cancel</button>
              <button onClick={handleTopup} className="flex-1 py-2 bg-[#639922] text-white rounded-lg text-sm">Top up</button>
            </div>
          </div>
        </div>
      )}

      {/* Buy Confirm Modal */}
      {modals.buy && (() => {
        const item = items.find((i) => i.id === buyTargetId);
        // FIX #4: guard — don't render if item is gone
        if (!item) return null;
        const days = daysUntil(item.expiry);
        const disc = getDiscount(days);
        const discPrice = (item.price * (1 - disc / 100)).toFixed(2);

        return (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl border border-gray-200 p-6 w-[360px]">
              <div className="text-base font-medium flex justify-between items-center mb-4">
                Confirm purchase
                <button onClick={() => closeModal('buy')} className="text-gray-400 hover:text-gray-600"><i className="ti ti-x text-lg"></i></button>
              </div>
              <div className="flex justify-between items-center mb-3">
                <div><div className="text-sm font-medium">{item.name}</div><div className="text-xs text-gray-500">{item.qty} · {days}d until expiry</div></div>
                <div className="text-right"><div className="text-lg font-medium">{fmt(discPrice)}</div><div className="text-xs text-gray-400 line-through">{fmt(item.price)}</div></div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-500 mb-4">
                You save: <strong className="text-[#3B6D11]">{fmt(item.price - discPrice)} ({disc}% off)</strong>
              </div>
              <div className="bg-[#EAF3DE] text-[#3B6D11] rounded-lg p-2.5 text-xs mb-4 flex gap-2">
                <i className="ti ti-award text-sm shrink-0"></i> Pay via wallet to earn reward points & 5% off if total &gt; ₹1,000
              </div>
              <div className="mb-5">
                <label className="block text-xs text-gray-500 mb-1.5">Pay via</label>
                <select className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none"
                  value={buyMethod} onChange={(e) => setBuyMethod(e.target.value)}>
                  <option value="wallet">KitchenVault Wallet ({fmt(walletBalance)} available)</option>
                  <option value="card">Debit/Credit Card</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={() => closeModal('buy')} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-500">Cancel</button>
                <button onClick={confirmBuy} className="flex-1 py-2 bg-[#639922] text-white rounded-lg text-sm">Pay & Buy</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Sell Modal */}
      {modals.sell && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-[360px]">
            <div className="text-base font-medium flex justify-between items-center mb-5">
              List item for sale
              <button onClick={() => closeModal('sell')} className="text-gray-400 hover:text-gray-600"><i className="ti ti-x text-lg"></i></button>
            </div>
            <div className="mb-5">
              <label className="block text-xs text-gray-500 mb-1.5">Select inventory item (Expiring soon)</label>
              <select className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none"
                value={sellSelectId} onChange={(e) => setSellSelectId(Number(e.target.value))}>
                {unlistedItemsExpiring.length === 0 && <option value="">No items available to sell</option>}
                {unlistedItemsExpiring.map((i) => (
                  <option key={i.id} value={i.id}>{i.name} ({getDiscount(daysUntil(i.expiry))}% off)</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => closeModal('sell')} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-500">Cancel</button>
              {/* FIX: disable checks both list emptiness AND that an item is actually selected */}
              <button
                onClick={() => { if (sellSelectId) { quickSell(sellSelectId); closeModal('sell'); } }}
                disabled={!unlistedItemsExpiring.length || !sellSelectId}
                className="flex-1 py-2 bg-[#639922] text-white rounded-lg text-sm disabled:opacity-50"
              >
                List item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Toast */}
      {notify.show && (
        <div className="fixed bottom-6 right-6 bg-white border border-gray-200 border-l-[3px] border-l-[#639922] rounded-lg px-4 py-3 text-sm shadow-lg z-[200] animate-[slideIn_0.2s_ease-out]">
          {notify.msg}
        </div>
      )}
    </div>
  );
}