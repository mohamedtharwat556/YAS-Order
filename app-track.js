(() => {
  const fmtDate = d => new Date(d).toLocaleDateString('ar-EG',{year:'numeric',month:'2-digit',day:'2-digit'});
  const fmtTime = d => new Date(d).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'});
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const statusIndex = s => ['تم طلبه','تم الشحن','خرج للتوصيل','تم التوصيل'].indexOf(s);

  // Function to show image in modal
  window.showImageModal = function(imageUrl) {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:10000;cursor:pointer;';
    modal.innerHTML = `<img src="${imageUrl}" style="max-width:90%;max-height:90%;object-fit:contain;">`;
    modal.onclick = () => modal.remove();
    document.body.appendChild(modal);
  };

  // Initialize Lucide icons
  document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    
    // Request notification permission
    requestNotificationPermission();
  });

  // Browser Notifications
  function requestNotificationPermission() {
    if ('Notification' in window) {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          console.log('Notification permission granted');
          new Notification('YAS Order Tracking', {
            body: 'تم تفعيل الإشعارات بنجاح! ستنصرك عندما يقترب السائق.',
            icon: '🚗'
          });
        } else {
          console.log('Notification permission denied');
        }
      });
    } else {
      console.log('This browser does not support notifications');
    }
  }

  function showNotification(title, body, options = {}) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body: body,
        icon: options.icon || '🚗',
        sound: options.sound || 'default'
      });
    }
    
    // Also add to notification panel
    addNotificationToPanel(title, body);
  }

  // Notification Panel Management
  let notifications = [];

  function addNotificationToPanel(title, body) {
    const notification = {
      id: Date.now(),
      title: title,
      body: body,
      time: new Date(),
      read: false
    };
    
    notifications.unshift(notification);
    updateNotificationPanel();
    updateNotificationCount();
  }

  function updateNotificationPanel() {
    const list = document.getElementById('notification-list');
    if (!list) return;
    
    if (notifications.length === 0) {
      list.innerHTML = '<p class="empty-notifications">لا توجد إشعارات</p>';
      return;
    }
    
    list.innerHTML = notifications.map(n => `
      <div class="notification-item ${n.read ? '' : 'unread'}" onclick="markAsRead(${n.id})">
        <h4>${esc(n.title)}</h4>
        <p>${esc(n.body)}</p>
        <div class="time">${fmtTime(n.time)}</div>
      </div>
    `).join('');
  }

  function updateNotificationCount() {
    const countEl = document.getElementById('notification-count');
    if (!countEl) return;
    
    const unreadCount = notifications.filter(n => !n.read).length;
    
    if (unreadCount > 0) {
      countEl.textContent = unreadCount;
      countEl.classList.remove('hidden');
    } else {
      countEl.classList.add('hidden');
    }
  }

  function markAsRead(id) {
    const notification = notifications.find(n => n.id === id);
    if (notification) {
      notification.read = true;
      updateNotificationPanel();
      updateNotificationCount();
    }
  }

  window.toggleNotificationPanel = function() {
    const panel = document.getElementById('notification-panel');
    if (panel) {
      panel.classList.toggle('hidden');
    }
  };

  window.markAsRead = markAsRead;

  // Play notification sound
  function playNotificationSound() {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.play().catch(error => {
      console.log('Error playing sound:', error);
    });
  }

  // Driver rating functionality
  window.submitDriverRating = async function(orderId) {
    const selectedRating = document.querySelector(`.rating-stars[data-order-id="${orderId}"] .star-btn.selected`);
    if (!selectedRating) {
      toast('الرجاء اختيار تقييم', 'warning');
      return;
    }
    const rating = parseInt(selectedRating.dataset.rating);
    const { error } = await supabaseClient.from('orders').update({ driver_rating: rating }).eq('id', orderId);
    if (error) {
      console.error('Error submitting rating:', error);
      toast('حدث خطأ أثناء إرسال التقييم', 'error');
      return;
    }
    toast('تم إرسال التقييم بنجاح');
    await loadOrders();
    const o = orders.find(x => x.id === orderId);
    if (o) showTracking(o);
  };

  // Multiple ratings functionality
  window.submitMultipleRatings = async function(orderId) {
    const driverRating = document.querySelector(`#driver-rating .star-btn.selected`);
    const productRating = document.querySelector(`#product-rating .star-btn.selected`);
    const serviceRating = document.querySelector(`#service-rating .star-btn.selected`);

    if (!driverRating || !productRating || !serviceRating) {
      toast('الرجاء اختيار تقييم لجميع الفئات', 'warning');
      return;
    }

    const ratings = {
      driver_rating: parseInt(driverRating.dataset.rating),
      product_rating: parseInt(productRating.dataset.rating),
      service_rating: parseInt(serviceRating.dataset.rating)
    };

    const { error } = await supabaseClient.from('orders').update(ratings).eq('id', orderId);
    if (error) {
      console.error('Error submitting ratings:', error);
      toast('حدث خطأ أثناء إرسال التقييمات', 'error');
      return;
    }
    toast('تم إرسال التقييمات بنجاح');
    await loadOrders();
    const o = orders.find(x => x.id === orderId);
    if (o) showTracking(o);
  };

  // Handle star button clicks
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('star-btn')) {
      const rating = e.target.dataset.rating;
      const container = e.target.closest('.rating-stars');
      container.querySelectorAll('.star-btn').forEach((btn, index) => {
        btn.classList.toggle('selected', index < rating);
      });
    }
  });

  // Customer notes functionality
  let currentOrderId = null;
  
  window.saveCustomerNotes = async function() {
    const notes = document.getElementById('customer-notes').value;
    if (!notes.trim()) {
      toast('الرجاء كتابة ملاحظات', 'warning');
      return;
    }
    if (!currentOrderId) {
      toast('حدث خطأ: لم يتم تحديد الطلب', 'error');
      return;
    }
    const { error } = await supabaseClient.from('orders').update({ customernotes: notes }).eq('id', currentOrderId);
    if (error) {
      console.error('Error saving customer notes:', error);
      toast('حدث خطأ أثناء إرسال الملاحظات', 'error');
      return;
    }
    toast('تم إرسال الملاحظات بنجاح');
    document.getElementById('customer-notes').value = '';
  };

  let orders = [];
  async function loadOrders() {
    const { data, error } = await supabaseClient
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error loading orders:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      return;
    }
    // Normalize data from lowercase to camelCase for display
    orders = (data || []).map(o => ({
      ...o,
      mapLink: o.maplink || o.mapLink,
      deviceType: o.devicetype || o.deviceType,
      paymentMethod: o.paymentmethod || o.paymentMethod,
      paymentStatus: o.paymentstatus || o.paymentStatus,
      receivedAt: o.receivedat || o.receivedAt,
      deliveryPhoto: o.deliveryphoto || o.deliveryPhoto,
      driverRating: o.driverrating || o.driverRating,
      customerNotes: o.customernotes || o.customerNotes
    }));
  }
  
  const $ = s => document.querySelector(s);
  
  function toast(message, type = 'success'){const el=$('#toast');el.textContent=message;el.className='toast show ' + type;setTimeout(()=>el.classList.remove('show'),3000);}
  function statusBadge(status){const statusClass={'تم طلبه':'s-new','تم الشحن':'s-shipped','خرج للتوصيل':'s-out','تم التوصيل':'s-done','تعذر التسليم':'s-failed'};const carPositions={'تم طلبه':'0%','تم الشحن':'25%','خرج للتوصيل':'50%','تم التوصيل':'75%','تعذر التسليم':'100%'};return `<div class="status-container"><span class="status ${statusClass[status]||'s-new'}">${esc(status)}</span><div class="status-track"><div class="status-car" style="left: ${carPositions[status]||'0%'}"></div></div></div>`;}
  
  function showTracking(o){
    const result=$('#tracking-result'),idx=statusIndex(o.status);
    const stepNames=['تم طلبه','تم الشحن','خرج للتوصيل','تم التوصيل'];
    result.classList.remove('hidden');
    result.innerHTML=`<div class="tracking-result-head"><div><h3>طلبك ${esc(o.id)}</h3><p><small>العميل:</small> <b>${esc(o.customer)}</b></p><p>آخر تحديث للحالة: ${fmtDate(o.history?.at(-1)?.at||o.receivedat)} · ${fmtTime(o.history?.at(-1)?.at||o.receivedat)}</p></div>${statusBadge(o.status)}</div>
    <div class="timeline">${stepNames.map((s,i)=>{const complete=idx>=i&&o.status!=='تعذر التسليم',current=idx===i;return `<div class="timeline-step ${complete?'complete':''} ${current?'current':''}"><div class="timeline-dot">${i===idx?`<div class="timeline-car"></div>`:i+1}</div><b>${s}</b></div>`;}).join('')}</div>
    ${o.status==='تعذر التسليم'?'<p class="danger">تعذر تسليم الطلب. برجاء التواصل مع فريق خدمة العملاء.</p>':''}
    <div class="tracking-details"><div><small>الجهاز</small><b>${esc(o.devicetype)} · ${esc(o.brand)}</b></div><div><small>طريقة الدفع</small><b>${esc(o.paymentmethod)}</b></div><div><small>تاريخ الطلب</small><b>${fmtDate(o.receivedat)}</b></div><div><small>العنوان</small><b>${esc(o.address)}</b></div><div><small>السائق</small><b>${esc(o.driver||'سيتم تحديده')}</b></div>${o.driverphone?`<div><small>رقم السائق</small><b><a href="tel:${esc(o.driverphone)}">${esc(o.driverphone)}</a></b></div>`:''}<div><small>آخر موقع مُسجل</small><b>${o.location?`${esc(o.location.lat)}, ${esc(o.location.lng)}`:'لا يوجد تحديث موقع حتى الآن'}</b></div></div>
    ${o.location?`<p class="muted">آخر تحديث يدوي لموقع السائق: ${fmtTime(o.location.at)} · <a target="_blank" rel="noopener" href="https://maps.google.com/?q=${encodeURIComponent(o.location.lat+','+o.location.lng)}">عرض الموقع على الخريطة</a></p>`:''}
    ${o.status==='تم التوصيل' && (!o.driverRating || !o.productRating || !o.serviceRating)?`<div class="multiple-ratings"><h3>قيّم تجربتك</h3><p>قيّم السائق والمنتج والخدمة</p><div class="rating-section"><label>تقييم السائق</label><div id="driver-rating" class="rating-stars">${[1,2,3,4,5].map(i=>`<button class="star-btn" data-rating="${i}" aria-label="${i} نجوم">★</button>`).join('')}</div></div><div class="rating-section"><label>تقييم المنتج</label><div id="product-rating" class="rating-stars">${[1,2,3,4,5].map(i=>`<button class="star-btn" data-rating="${i}" aria-label="${i} نجوم">★</button>`).join('')}</div></div><div class="rating-section"><label>تقييم الخدمة</label><div id="service-rating" class="rating-stars">${[1,2,3,4,5].map(i=>`<button class="star-btn" data-rating="${i}" aria-label="${i} نجوم">★</button>`).join('')}</div></div><button class="btn primary" onclick="submitMultipleRatings('${esc(o.id)}')">إرسال التقييمات</button></div>`:''}
    ${o.driverRating || o.productRating || o.serviceRating?`<div class="ratings-display"><h3>تقييماتك</h3><div class="rating-item"><label>السائق:</label><div class="rating-stars-display">${'★'.repeat(o.driverRating||0)}${'☆'.repeat(5-(o.driverRating||0))}</div></div><div class="rating-item"><label>المنتج:</label><div class="rating-stars-display">${'★'.repeat(o.productRating||0)}${'☆'.repeat(5-(o.productRating||0))}</div></div><div class="rating-item"><label>الخدمة:</label><div class="rating-stars-display">${'★'.repeat(o.serviceRating||0)}${'☆'.repeat(5-(o.serviceRating||0))}</div></div></div>`:''}`;
    
    // Show customer notes section
    currentOrderId = o.id;
    const notesSection = document.getElementById('customer-notes-section');
    notesSection.classList.remove('hidden');

    // Show map container
    const mapContainer = document.getElementById('map-container');
    mapContainer.classList.remove('hidden');

    // Start live tracking
    startLiveTracking(o.id);

    // Load initial driver location
    loadDriverLocation(o.id);

    // If no driver location, show demo location for testing
    setTimeout(() => {
      if (!driverMarker) {
        console.log('No driver location found, showing demo location');
        updateDriverMap(30.0444, 31.2357);
        document.getElementById('eta-info').style.display = 'block';
        document.getElementById('eta-time').textContent = 'وضع تجريبي - لا يوجد موقع حقيقي';
      }
    }, 2000);
  }

  // Live tracking - auto-refresh every 30 seconds
  let trackingInterval = null;
  let map = null;
  let driverMarker = null;
  let customerMarker = null;

  function startLiveTracking(orderId) {
    if (trackingInterval) {
      clearInterval(trackingInterval);
    }

    trackingInterval = setInterval(async () => {
      await loadOrders();
      const updatedOrder = orders.find(x => x.id === orderId);
      if (updatedOrder) {
        showTracking(updatedOrder);
        await loadDriverLocation(orderId);
      }
    }, 30000); // Update every 30 seconds
  }

  // Load driver location from driver_locations table
  async function loadDriverLocation(orderId) {
    console.log('Loading driver location for order:', orderId);
    
    // First try to get from driver_locations table
    const { data, error } = await supabaseClient
      .from('driver_locations')
      .select('*')
      .eq('order_id', orderId)
      .order('timestamp', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error loading driver location:', error);
    }

    console.log('Driver location data from driver_locations:', data);

    if (data && data.length > 0) {
      const location = data[0];
      console.log('Updating map with location from driver_locations:', location);
      updateDriverMap(location.latitude, location.longitude);
      calculateETA(location);
    } else {
      console.log('No driver location in driver_locations, trying orders table...');
      
      // Fallback: get location from orders table
      const { data: orderData, error: orderError } = await supabaseClient
        .from('orders')
        .select('location')
        .eq('id', orderId)
        .single();

      if (orderError) {
        console.error('Error loading order location:', orderError);
        return;
      }

      console.log('Order location data:', orderData);

      if (orderData && orderData.location && orderData.location.lat) {
        const lat = parseFloat(orderData.location.lat);
        const lng = parseFloat(orderData.location.lng);
        console.log('Updating map with location from orders table:', lat, lng);
        updateDriverMap(lat, lng);
        
        // Calculate ETA from orders location
        calculateETA({
          latitude: lat,
          longitude: lng
        });
      } else {
        console.log('No location found in orders table either');
      }
    }
  }

  // Initialize map
  function initMap() {
    console.log('Initializing map...');
    if (map) {
      console.log('Map already initialized');
      return;
    }

    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
      console.error('Map container not found');
      return;
    }

    console.log('Map container found, creating map...');
    map = L.map('map').setView([30.0444, 31.2357], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    console.log('Map initialized successfully');
  }

  // Update driver marker on map
  function updateDriverMap(lat, lng) {
    console.log('Updating driver map with lat:', lat, 'lng:', lng);
    if (!map) initMap();

    if (driverMarker) {
      console.log('Updating existing marker');
      driverMarker.setLatLng([lat, lng]);
    } else {
      console.log('Creating new marker');
      driverMarker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: 'custom-marker',
          html: '🚗',
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        })
      }).addTo(map);
      driverMarker.bindPopup('السائق هنا');
    }

    map.setView([lat, lng], 13);
    console.log('Map updated successfully');
  }

  // Add customer marker
  function addCustomerMarker(lat, lng) {
    if (!map) initMap();

    if (customerMarker) {
      customerMarker.setLatLng([lat, lng]);
    } else {
      customerMarker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: 'custom-marker',
          html: '📍',
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        })
      }).addTo(map);
      customerMarker.bindPopup('موقع العميل');
    }
  }

  // Calculate distance between two points using Haversine formula
  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Calculate ETA (Estimated Time of Arrival)
  function calculateETA(driverLocation) {
    const etaInfo = document.getElementById('eta-info');
    const etaTime = document.getElementById('eta-time');

    if (!currentOrderId) return;

    const order = orders.find(x => x.id === currentOrderId);
    if (!order || !order.location) return;

    // Parse customer location from order
    const customerLat = parseFloat(order.location.lat);
    const customerLng = parseFloat(order.location.lng);

    if (!customerLat || !customerLng) return;

    // Add customer marker to map
    addCustomerMarker(customerLat, customerLng);

    // Calculate distance
    const distance = calculateDistance(
      driverLocation.latitude,
      driverLocation.longitude,
      customerLat,
      customerLng
    );

    // Estimate time (assuming average speed of 40 km/h)
    const avgSpeed = 40; // km/h
    const etaHours = distance / avgSpeed;
    const etaMinutes = Math.round(etaHours * 60);

    // Display ETA
    etaInfo.style.display = 'block';
    if (etaMinutes < 1) {
      etaTime.textContent = 'أقل من دقيقة';
    } else if (etaMinutes < 60) {
      etaTime.textContent = `${etaMinutes} دقيقة`;
    } else {
      const hours = Math.floor(etaMinutes / 60);
      const mins = etaMinutes % 60;
      etaTime.textContent = `${hours} ساعة و ${mins} دقيقة`;
    }

    // Check for proximity notification (500 meters = 0.5 km)
    checkProximityNotification(distance);
  }

  // Check if driver is close and send notification
  let notificationSent = false;
  function checkProximityNotification(distance) {
    const proximityThreshold = 0.5; // 500 meters in km

    if (distance <= proximityThreshold && !notificationSent) {
      console.log('Driver is within 500 meters, sending notification');
      showNotification(
        'السائق قريب! 🚗',
        'السائق على بعد أقل من 500 متر من موقعك. كن مستعداً لاستلام الطلب.',
        { icon: '🚗' }
      );
      playNotificationSound();
      notificationSent = true;
      toast('السائق قريب من موقعك! 🚗', 'success');
    } else if (distance > proximityThreshold) {
      // Reset notification flag if driver moves away
      notificationSent = false;
    }
  }
  
  // Check if order ID is in URL query
  const params = new URLSearchParams(window.location.search);
  const orderFromUrl = params.get('order');
  if(orderFromUrl){
    $('#order-input').value = orderFromUrl;
  }
  
  $('#tracking-form').addEventListener('submit',async e=>{
    e.preventDefault();
    await loadOrders();
    const form = e.target;
    const d=Object.fromEntries(new FormData(form).entries());
    const o=orders.find(x=>x.id.trim().toLowerCase()===d.orderId.trim().toLowerCase()&&x.phone.replace(/\D/g,'')===d.phone.replace(/\D/g,''));
    if(!o){
      $('#tracking-result').classList.add('hidden');
      toast('لم نتمكن من العثور على الطلب. راجع رقم الطلب والهاتف.');
      return;
    }
    showTracking(o);
  });
})();
