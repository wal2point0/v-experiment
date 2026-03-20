// Voice Restaurant App
$(function() {
  // Data
  let foodMenu = JSON.parse(localStorage.getItem('foodMenu')) || [
    { id: 1, name: '🍕 Pizza', desc: 'Cheese pizza', price: 12.99 },
    { id: 2, name: '🍔 Burger', desc: 'Juicy burger', price: 10.99 },
    { id: 3, name: '🍜 Pasta', desc: 'Italian pasta', price: 13.99 }
  ];
  let cart = JSON.parse(localStorage.getItem('cart')) || [];
  let orders = JSON.parse(localStorage.getItem('orders')) || [];
  let isAdmin = false;
  
  // DOM selectors
  const intro = $('#introduction');
  const main = $('#mainContent');
  const adminPanel = $('#adminPanel');
  const cards = $('#cards');
  const cartBadge = $('#cartCount');
  const cartItems = $('#cartItems');
  const cartEmpty = $('#cartEmpty');
  const cartTotal = $('#cartTotal');
  const voiceStart = $('#voiceStartBtn');
  const voiceStatus = $('#voiceStatus');
  const finalSpan = $('#final_span');
  const interimSpan = $('#interim_span');
  
  // Admin elements
  const adminCreateBtn = $('#adminCreateFood');
  const adminLogoutBtn = $('#adminLogout');
  const adminLoginBtn = $('#adminLoginBtn');
  const adminMenuList = $('#adminMenuList');
  const adminOrdersList = $('#adminOrdersList');
  
  // Voice Recognition
  let recognition;
  let finalTranscript = '';
  
  function initVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      voiceStatus.text('⚠️ Voice not supported in this browser');
      voiceStart.prop('disabled', true);
      console.error('Speech Recognition API not available');
      return;
    }
    
    try {
      recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-GB';
      console.log('✓ Speech recognition initialized successfully');
    } catch (e) {
      console.error('Error initializing speech recognition:', e);
      voiceStatus.text('⚠️ Error initializing voice');
      voiceStart.prop('disabled', true);
      return;
    }
    
    recognition.onstart = function() {
      voiceStatus.text('🎤 Listening...');
      finalSpan.text('');
      interimSpan.text('');
    };
    
    recognition.onresult = function(event) {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interim += transcript;
        }
      }
      finalSpan.text(finalTranscript.trim());
      interimSpan.text(interim);
    };
    
    recognition.onend = function() {
      voiceStatus.text('✓ Done listening');
      if (finalTranscript.trim()) {
        processVoiceCommand(finalTranscript);
      }
      finalTranscript = '';
    };
    
    recognition.onerror = function(event) {
      voiceStatus.text('❌ Error: ' + event.error);
    };
  }
  
  function processVoiceCommand(text) {
    text = text.toLowerCase().trim();
    console.log('Processing voice command:', text);
    
    if (text.includes('add')) {
      console.log('User said "add" - looking for food items');
      let foundFood = null;
      
      // Try exact word match with food names
      for (let food of foodMenu) {
        const foodWords = food.name.toLowerCase().split(' ');
        for (let word of foodWords) {
          if (word.length > 2 && text.includes(word)) {
            foundFood = food;
            console.log('Matched food:', food.name);
            break;
          }
        }
        if (foundFood) break;
      }
      
      if (foundFood) {
        addToCart(foundFood);
        finalSpan.text('✓ Added ' + foundFood.name + ' to cart!');
        console.log('Added to cart:', foundFood.name);
      } else {
        finalSpan.text('❌ Could not find that item. Try: pizza, burger, or pasta');
        console.log('No matching food found in:', foodMenu.map(f => f.name));
      }
    } else if (text.includes('show') && text.includes('cart')) {
      new bootstrap.Modal(document.getElementById('modalCart')).show();
      finalSpan.text('📭 Opening cart...');
    } else if (text.includes('cart')) {
      new bootstrap.Modal(document.getElementById('modalCart')).show();
      finalSpan.text('📭 Opening cart...');
    } else if (text.includes('menu')) {
      finalSpan.text('📋 Here is our menu');
    } else {
      finalSpan.text('⚠️ Command not recognized. Try: "add pizza", "show cart", or "show menu"');
      console.log('Unrecognized command:', text);
    }
  }
  
  // Admin Login
  adminLoginBtn.click(function() {
    const username = $('#adminUsername').val();
    const password = $('#adminPassword').val();
    
    if (username === 'admin' && password === 'password') {
      isAdmin = true;
      intro.hide();
      adminPanel.show();
      main.hide();
      bootstrap.Modal.getInstance(document.getElementById('modalAdminLogin')).hide();
      renderAdminDashboard();
      alert('✓ Admin login successful!');
    } else {
      alert('❌ Invalid credentials');
    }
  });
  
  // Admin Logout
  adminLogoutBtn.click(function() {
    isAdmin = false;
    adminPanel.hide();
    intro.show();
    $('#fixedAdminButton').show();
    $('#adminUsername').val('');
    $('#adminPassword').val('');
  });
  
  // Admin Create Food
  adminCreateBtn.click(function() {
    const name = $('#adminFoodName').val().trim();
    const desc = $('#adminFoodDesc').val().trim();
    const price = $('#adminFoodPrice').val().trim();
    
    if (!name || !price) {
      alert('Please fill in all required fields');
      return;
    }
    
    const newFood = {
      id: Math.max(...foodMenu.map(f => f.id), 0) + 1,
      name: name,
      desc: desc || 'Delicious food',
      price: parseFloat(price)
    };
    
    foodMenu.push(newFood);
    localStorage.setItem('foodMenu', JSON.stringify(foodMenu));
    $('#adminFormFood')[0].reset();
    renderAdminDashboard();
    alert('✓ Food item created!');
  });
  
  // Render Admin Dashboard
  function renderAdminDashboard() {
    // Food menu list
    adminMenuList.empty();
    foodMenu.forEach(food => {
      const item = `
        <div class="card mb-2 bg-dark-2">
          <div class="card-body p-2">
            <div class="row align-items-center">
              <div class="col-7">
                <h6 class="mb-0">${food.name}</h6>
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
    
    $('.delete-food').click(function() {
      const id = $(this).data('id');
      if (confirm('Delete this item?')) {
        foodMenu = foodMenu.filter(f => f.id != id);
        localStorage.setItem('foodMenu', JSON.stringify(foodMenu));
        renderAdminDashboard();
        renderMenu();
      }
    });
    
    // Orders list
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
  
  // Add to cart
  function addToCart(food) {
    let item = cart.find(i => i.id == food.id);
    if (item) {
      item.qty++;
    } else {
      cart.push({...food, qty: 1});
    }
    saveCart();
    updateCart();
  }
  
  // Save cart to localStorage
  function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
  }
  
  // Update cart display
  function updateCart() {
    const total = cart.reduce((s, i) => s + i.qty, 0);
    cartBadge.text(total);
    
    if (cart.length === 0) {
      cartItems.empty();
      cartEmpty.show();
      cartTotal.text('£0.00');
    } else {
      cartEmpty.hide();
      cartItems.empty();
      
      cart.forEach(item => {
        const itemTotal = (item.price * item.qty).toFixed(2);
        const row = `
          <div class="card mb-2">
            <div class="card-body p-2">
              <div class="row align-items-center">
                <div class="col-5">
                  <h6 class="mb-0">${item.name}</h6>
                  <small>£${item.price.toFixed(2)}</small>
                </div>
                <div class="col-4">
                  <button class="btn btn-xs btn-outline qty-minus" data-id="${item.id}">−</button>
                  <span class="mx-1">${item.qty}</span>
                  <button class="btn btn-xs btn-outline qty-plus" data-id="${item.id}">+</button>
                </div>
                <div class="col-2">£${itemTotal}</div>
                <div class="col-1">
                  <button class="btn btn-xs btn-danger remove" data-id="${item.id}">✕</button>
                </div>
              </div>
            </div>
          </div>
        `;
        cartItems.append(row);
      });
      
      $('.qty-plus').click(function() {
        const id = $(this).data('id');
        const item = cart.find(i => i.id == id);
        if (item) item.qty++;
        saveCart();
        updateCart();
      });
      
      $('.qty-minus').click(function() {
        const id = $(this).data('id');
        const item = cart.find(i => i.id == id);
        if (item) {
          item.qty--;
          if (item.qty <= 0) cart = cart.filter(i => i.id != id);
        }
        saveCart();
        updateCart();
      });
      
      $('.remove').click(function() {
        const id = $(this).data('id');
        cart = cart.filter(i => i.id != id);
        saveCart();
        updateCart();
      });
      
      const sum = cart.reduce((s, i) => s + (i.price * i.qty), 0);
      cartTotal.text('£' + sum.toFixed(2));
    }
  }
  
  
  // Render menu
  function renderMenu() {
    cards.empty();
    foodMenu.forEach(food => {
      const card = `
        <div class="col">
          <div class="card food-card h-100">
            <div class="card-body text-center">
              <div style="font-size: 2rem; margin-bottom: 10px;">${food.name.split(' ')[0]}</div>
              <h5 class="card-title">${food.name}</h5>
              <p class="card-text text-muted">${food.desc}</p>
              <h6 class="text-warning">£${food.price.toFixed(2)}</h6>
            </div>
            <div class="card-footer bg-transparent">
              <button class="btn btn-sm btn-success w-100 add-btn" data-id="${food.id}">Add to Cart</button>
            </div>
          </div>
        </div>
      `;
      cards.append(card);
    });
    
    $('.add-btn').click(function() {
      const id = $(this).data('id');
      const food = foodMenu.find(f => f.id == id);
      addToCart(food);
    });
  }
  
  // Show main content
  $('#introButton').click(function() {
    intro.hide();
    main.fadeIn();
    $('#fixedAdminButton').hide();
    renderMenu();
  });
  
  voiceStart.click(function() {
    if (recognition) {
      finalTranscript = '';
      recognition.start();
    }
  });
  
  // Checkout
  $('#btnCheckout').click(function() {
    if (cart.length === 0) {
      alert('Your cart is empty');
      return;
    }
    const total = parseFloat(cartTotal.text().replace('£', ''));
    const order = {
      items: [...cart],
      total: total,
      date: new Date().toISOString()
    };
    
    orders.push(order);
    localStorage.setItem('orders', JSON.stringify(orders));
    
    alert('Thank you for your order! Total: £' + total.toFixed(2));
    cart = [];
    saveCart();
    updateCart();
  });
  
  // Init
  initVoice();
  updateCart();
});
