// Admin script for admin.html
$(function() {
  console.log('Admin script loaded');
  const store = window.RedLanternStore;

  let foodMenu = (store && store.getCachedMenu()) || [
    { id: 1, number: 1, name: '🍕 Pizza', desc: 'Cheese pizza', price: 12.99 },
    { id: 2, number: 2, name: '🍔 Burger', desc: 'Juicy burger', price: 10.99 },
    { id: 3, number: 3, name: '🍜 Pasta', desc: 'Italian pasta', price: 13.99 }
  ];

  let orders = (store && store.getCachedOrders()) || [];

  const adminPanel = $('#adminPanel');
  const adminLogoutBtn = $('#adminLogout');
  const adminCreateBtn = $('#adminCreateFood');
  const adminMenuList = $('#adminMenuList');
  const adminOrdersList = $('#adminOrdersList');
  const MAX_IMAGE_BYTES = 1024 * 1024; // 1 MB
  const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB hard cap before processing
  const MAX_IMAGE_DIMENSION = 800;
  const JPEG_QUALITY = 0.8;

  async function refreshDataFromStore() {
    if (!store) return;
    foodMenu = await store.getMenu();
    orders = await store.getOrders();
  }

  // --- Session expiry helpers ---
  function setAdminSession() {
    const exp = Date.now() + (30 * 60 * 1000); // 30 min expiry
    sessionStorage.setItem('isAdminLoggedIn', 'true');
    sessionStorage.setItem('adminSessionExpiry', exp);
  }

  function isAdminSessionValid() {
    const logged = sessionStorage.getItem('isAdminLoggedIn') === 'true';
    const expiry = parseInt(sessionStorage.getItem('adminSessionExpiry'), 10);
    return logged && expiry && Date.now() < expiry;
  }

  // Guard: only allow dashboard if logged in and not expired
  if (window.location.pathname.endsWith('admin-dashboard.html')) {
    if (!isAdminSessionValid()) {
      sessionStorage.removeItem('isAdminLoggedIn');
      sessionStorage.removeItem('adminSessionExpiry');
      window.location.href = 'admin-login.html';
      return;
    }
  }


  function renderAdminDashboard() {
    adminMenuList.empty();
    foodMenu.forEach(food => {
      const item = `
        <div class="card mb-2 bg-dark-2">
          <div class="card-body p-2">
            <div class="row align-items-center">
              <div class="col-3">
                ${food.image ? `<img src="${food.image}" alt="${food.name}" style="width:140px;height:140px;object-fit:cover;object-position:center;display:block;margin:auto;border-radius:10px;">` : ''}
              </div>
              <div class="col-4">
                <h6 class="mb-0">#${food.number} ${food.name}</h6>
                <small class="text-muted">£${food.price.toFixed(2)}</small>
              </div>
              <div class="col-5 text-end">
                <button class="btn btn-xs btn-danger delete-food" data-id="${food.id}">Delete</button>
              </div>
            </div>
          </div>
        </div>
      `;
      adminMenuList.append(item);
    });

    $('.delete-food').click(async function() {
      const id = $(this).data('id');
      if (confirm('Delete this item?')) {
        if (store) {
          await store.deleteMenuItem(id);
          await refreshDataFromStore();
        } else {
          foodMenu = foodMenu.filter(f => f.id != id);
          localStorage.setItem('foodMenu', JSON.stringify(foodMenu));
        }
        renderAdminDashboard();
      }
    });

    renderOrdersList();
  }

  function renderOrdersList() {
    adminOrdersList.empty();
    if (orders.length === 0) {
      adminOrdersList.html('<p class="text-muted">No orders yet</p>');
      return;
    }

    orders.forEach((order, idx) => {
      const itemsHtml = order.items.map(item =>
        `${item.name} x${item.qty} (£${(item.price * item.qty).toFixed(2)})`
      ).join('<br>');

      const orderHtml = `
        <div class="card mb-2 bg-dark-2">
          <div class="card-body p-2">
            <div><strong>Order #${idx + 1}</strong></div>
            <small class="text-muted">${new Date(order.date).toLocaleString()}</small>
            <div class="mt-1">${itemsHtml}</div>
            <div class="mt-1"><strong>Total: £${order.total.toFixed(2)}</strong></div>
          </div>
        </div>
      `;
      adminOrdersList.append(orderHtml);
    });
  }

  adminLogoutBtn.click(function() {
    sessionStorage.removeItem('isAdminLoggedIn');
    window.location.href = 'admin-login.html';
  });

  function dataUrlSizeBytes(dataUrl) {
    const base64 = dataUrl.split(',')[1] || '';
    return Math.ceil((base64.length * 3) / 4);
  }

  function resizeAndCompressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read image file.'));
      reader.onload = function(e) {
        const img = new Image();
        img.onerror = () => reject(new Error('Could not decode image file.'));
        img.onload = function() {
          const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(img.width, img.height));
          const width = Math.max(1, Math.round(img.width * scale));
          const height = Math.max(1, Math.round(img.height * scale));

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not process image.'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
          resolve(compressedDataUrl);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  adminCreateBtn.click(async function() {
    const name = $('#adminFoodName').val().trim();
    const desc = $('#adminFoodDesc').val().trim();
    const price = $('#adminFoodPrice').val().trim();
    const imageInput = $('#adminFoodImage')[0];
    if (!name || !price) {
      alert('Please fill in all required fields');
      return;
    }
    let imageData = null;
    if (imageInput && imageInput.files && imageInput.files[0]) {
      const imageFile = imageInput.files[0];
      if (imageFile.size > MAX_UPLOAD_BYTES) {
        alert('Image is too large. Please choose an image under 8 MB.');
        return;
      }

      try {
        imageData = await resizeAndCompressImage(imageFile);
      } catch (err) {
        alert('Could not process image. Please try a different file.');
        return;
      }

      if (dataUrlSizeBytes(imageData) > MAX_IMAGE_BYTES) {
        alert('Processed image is still too large. Please choose a smaller image.');
        return;
      }
    }

    const newFood = {
      id: Math.max(...foodMenu.map(f => f.id), 0) + 1,
      number: Math.max(...foodMenu.map(f => f.number || 0), 0) + 1,
      name: name,
      desc: desc || 'Delicious food',
      price: parseFloat(price)
    };

    if (imageData) {
      newFood.image = imageData;
    }

    try {
      if (store) {
        await store.createMenuItem(newFood);
        await refreshDataFromStore();
      } else {
        foodMenu.push(newFood);
        localStorage.setItem('foodMenu', JSON.stringify(foodMenu));
      }
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        alert('Storage is full. Please remove some existing menu images.');
        return;
      }
      throw e;
    }

    $('#adminFormFood')[0].reset();
    renderAdminDashboard();
    alert('✓ Food item created!');
  });

  (async function initAdminDashboard() {
    await refreshDataFromStore();
    setAdminSession();
    renderAdminDashboard();
  })();
});
