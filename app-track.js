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
  });

  // Driver rating functionality
  window.submitDriverRating = async function(orderId) {
    const selectedRating = document.querySelector(`.rating-stars[data-order-id="${orderId}"] .star-btn.selected`);
    if (!selectedRating) {
      toast('الرجاء اختيار تقييم', 'warning');
      return;
    }
    const rating = parseInt(selectedRating.dataset.rating);
    const { error } = await supabaseClient.from('orders').update({ driverrating: rating }).eq('id', orderId);
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
    ${o.status==='تم التوصيل'&&!o.driverRating?`<div class="driver-rating"><h3>قيّم السائق</h3><div class="rating-stars" data-order-id="${esc(o.id)}">${[1,2,3,4,5].map(i=>`<button class="star-btn" data-rating="${i}" aria-label="${i} نجوم">★</button>`).join('')}</div><button class="btn primary" onclick="submitDriverRating('${esc(o.id)}')">إرسال التقييم</button></div>`:''}
    ${o.driverRating?`<div class="driver-rating-display"><h3>تقييم السائق</h3><div class="rating-stars-display">${'★'.repeat(o.driverRating)}${'☆'.repeat(5-o.driverRating)}</div></div>`:''}`;
    
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
    const { data, error } = await supabaseClient
      .from('driver_locations')
      .select('*')
      .eq('order_id', orderId)
      .order('timestamp', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error loading driver location:', error);
      return;
    }

    console.log('Driver location data:', data);

    if (data && data.length > 0) {
      const location = data[0];
      console.log('Updating map with location:', location);
      updateDriverMap(location.latitude, location.longitude);
      calculateETA(location);
    } else {
      console.log('No driver location found yet');
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
