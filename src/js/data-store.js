(function(window) {
  const DEFAULT_MENU = [
    { id: 1, number: 1, name: '🍕 Pizza', desc: 'Cheese pizza', price: 12.99 },
    { id: 2, number: 2, name: '🍔 Burger', desc: 'Juicy burger', price: 10.99 },
    { id: 3, number: 3, name: '🍜 Pasta', desc: 'Italian pasta', price: 13.99 }
  ];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.warn('Could not parse localStorage key:', key, e);
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function normalizeMenu(items) {
    if (!Array.isArray(items)) return [];

    const sorted = [...items].sort((a, b) => {
      const aNum = Number(a.number || a.id || 0);
      const bNum = Number(b.number || b.id || 0);
      return aNum - bNum;
    });

    return sorted.map((item, idx) => ({
      id: Number(item.id || idx + 1),
      number: Number(item.number || idx + 1),
      name: item.name || 'Unnamed item',
      desc: item.desc || item.description || 'Delicious food',
      price: Number(item.price || 0),
      image: item.image || null
    }));
  }

  function getBackendConfig() {
    const cfg = window.RED_LANTERN_BACKEND || {};
    const supabaseUrl = (cfg.supabaseUrl || '').trim().replace(/\/$/, '');
    const anonKey = (cfg.anonKey || '').trim();
    const enabled = !!(supabaseUrl && anonKey);

    return {
      enabled,
      supabaseUrl,
      anonKey,
      menuTable: cfg.menuTable || 'menu_items',
      ordersTable: cfg.ordersTable || 'orders'
    };
  }

  async function supabaseRequest(method, table, query, body) {
    const cfg = getBackendConfig();
    if (!cfg.enabled) throw new Error('Backend not configured');

    const url = cfg.supabaseUrl + '/rest/v1/' + table + (query || '');
    const headers = {
      apikey: cfg.anonKey,
      Authorization: 'Bearer ' + cfg.anonKey,
      'Content-Type': 'application/json'
    };

    // Ask Supabase to return inserted rows on writes.
    if (method === 'POST' || method === 'PATCH') {
      headers.Prefer = 'return=representation';
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error('Supabase request failed (' + response.status + '): ' + errText);
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  const RedLanternStore = {
    isBackendConfigured: function() {
      return getBackendConfig().enabled;
    },

    getCachedMenu: function() {
      const localMenu = readJson('foodMenu', null);
      if (Array.isArray(localMenu) && localMenu.length) {
        return normalizeMenu(localMenu);
      }
      return clone(DEFAULT_MENU);
    },

    getCachedOrders: function() {
      const localOrders = readJson('orders', []);
      return Array.isArray(localOrders) ? localOrders : [];
    },

    async getMenu() {
      if (this.isBackendConfigured()) {
        try {
          const cfg = getBackendConfig();
          const rows = await supabaseRequest(
            'GET',
            cfg.menuTable,
            '?select=id,number,name,description,price,image&order=number.asc,id.asc'
          );
          const normalized = normalizeMenu(rows || []);
          if (normalized.length) {
            writeJson('foodMenu', normalized);
            return normalized;
          }
        } catch (e) {
          console.warn('Falling back to local menu data:', e);
        }
      }

      const localMenu = readJson('foodMenu', null);
      if (Array.isArray(localMenu) && localMenu.length) {
        return normalizeMenu(localMenu);
      }

      const defaults = clone(DEFAULT_MENU);
      writeJson('foodMenu', defaults);
      return defaults;
    },

    async createMenuItem(item) {
      const normalizedItem = {
        number: Number(item.number),
        name: String(item.name || '').trim(),
        description: String(item.desc || item.description || '').trim() || 'Delicious food',
        price: Number(item.price || 0),
        image: item.image || null
      };

      if (this.isBackendConfigured()) {
        try {
          const cfg = getBackendConfig();
          const rows = await supabaseRequest('POST', cfg.menuTable, '', normalizedItem);
          const inserted = normalizeMenu(rows || []);
          if (inserted.length) {
            const latestMenu = await this.getMenu();
            writeJson('foodMenu', latestMenu);
            return inserted[0];
          }
        } catch (e) {
          console.warn('Backend create failed, storing locally:', e);
        }
      }

      const localMenu = normalizeMenu(readJson('foodMenu', clone(DEFAULT_MENU)));
      const localItem = {
        id: Math.max(0, ...localMenu.map(i => Number(i.id || 0))) + 1,
        number: normalizedItem.number || Math.max(0, ...localMenu.map(i => Number(i.number || 0))) + 1,
        name: normalizedItem.name,
        desc: normalizedItem.desc,
        price: normalizedItem.price,
        image: normalizedItem.image
      };
      localMenu.push(localItem);
      writeJson('foodMenu', localMenu);
      return localItem;
    },

    async deleteMenuItem(id) {
      if (this.isBackendConfigured()) {
        try {
          const cfg = getBackendConfig();
          await supabaseRequest('DELETE', cfg.menuTable, '?id=eq.' + encodeURIComponent(id));
          const latestMenu = await this.getMenu();
          writeJson('foodMenu', latestMenu);
          return;
        } catch (e) {
          console.warn('Backend delete failed, deleting locally:', e);
        }
      }

      const localMenu = normalizeMenu(readJson('foodMenu', clone(DEFAULT_MENU)));
      const nextMenu = localMenu.filter(i => Number(i.id) !== Number(id));
      writeJson('foodMenu', nextMenu);
    },

    async getOrders() {
      if (this.isBackendConfigured()) {
        try {
          const cfg = getBackendConfig();
          const rows = await supabaseRequest(
            'GET',
            cfg.ordersTable,
            '?select=id,items,total,date&order=date.desc,id.desc'
          );

          const normalizedOrders = (rows || []).map(function(row) {
            return {
              id: row.id,
              items: Array.isArray(row.items) ? row.items : [],
              total: Number(row.total || 0),
              date: row.date || new Date().toISOString()
            };
          });
          writeJson('orders', normalizedOrders);
          return normalizedOrders;
        } catch (e) {
          console.warn('Falling back to local orders data:', e);
        }
      }

      const localOrders = readJson('orders', []);
      return Array.isArray(localOrders) ? localOrders : [];
    },

    async createOrder(order) {
      const normalizedOrder = {
        items: Array.isArray(order.items) ? order.items : [],
        total: Number(order.total || 0),
        date: order.date || new Date().toISOString()
      };

      if (this.isBackendConfigured()) {
        try {
          const cfg = getBackendConfig();
          const rows = await supabaseRequest('POST', cfg.ordersTable, '', normalizedOrder);
          const createdOrder = Array.isArray(rows) && rows.length ? rows[0] : normalizedOrder;

          const cached = readJson('orders', []);
          const next = [
            {
              id: createdOrder.id,
              items: Array.isArray(createdOrder.items) ? createdOrder.items : normalizedOrder.items,
              total: Number(createdOrder.total || normalizedOrder.total),
              date: createdOrder.date || normalizedOrder.date
            },
            ...cached
          ];
          writeJson('orders', next);
          return createdOrder;
        } catch (e) {
          console.warn('Backend order create failed, storing locally:', e);
        }
      }

      const localOrders = readJson('orders', []);
      localOrders.push(normalizedOrder);
      writeJson('orders', localOrders);
      return normalizedOrder;
    }
  };

  window.RedLanternStore = RedLanternStore;
})(window);
