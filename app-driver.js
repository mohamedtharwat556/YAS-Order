(() => {
  console.log('app-driver.js loaded');
  const today = new Date();
  const fmtDate = d => new Date(d).toLocaleDateString('ar-EG',{year:'numeric',month:'2-digit',day:'2-digit'});
  const fmtTime = d => new Date(d).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'});
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

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

  let orders = [];
  let driverName = null;
  let showArchived = false;
  let currentDriverLocation = null;
  let locationUpdateInterval = null;
  let offlineQueue = [];
  let lastOrderCount = 0;

  console.log('Checking auth...');

  // Browser Notifications
  function requestNotificationPermission() {
    if ('Notification' in window) {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          console.log('Notification permission granted');
          new Notification('YAS Delivery', {
            body: 'تم تفعيل الإشعارات بنجاح!',
            icon: '🚗'
          });
        }
      });
    }
  }

  function showNotification(title, body, options = {}) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body: body,
        icon: options.icon || '🚗',
        badge: options.badge || '📦',
        tag: options.tag || 'yas-notification',
        requireInteraction: options.requireInteraction || false
      });
    }
  }

  // Check for new orders and notify
  function checkForNewOrders() {
    const currentOrderCount = orders.filter(o => o.driver === driverName && o.status === 'خرج للتوصيل').length;
    
    if (currentOrderCount > lastOrderCount) {
      const newOrdersCount = currentOrderCount - lastOrderCount;
      showNotification(
        'طلب جديد!',
        `لديك ${newOrdersCount} طلب${newOrdersCount > 1 ? 'ات' : ''} جديد للتحويل`,
        { requireInteraction: true }
      );
    }
    
    lastOrderCount = currentOrderCount;
  }

  // Calculate distance between two coordinates (Haversine formula)
  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
  }

  // Calculate estimated time of arrival (with dynamic speed based on traffic)
  function calculateETA(distance) {
    // Dynamic speed: 30-50 km/h based on time of day
    const hour = new Date().getHours();
    let avgSpeed = 40; // default

    // Lower speed during rush hours (7-9 AM, 5-7 PM)
    if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
      avgSpeed = 30;
    } else if (hour >= 22 || hour <= 5) {
      avgSpeed = 50; // Higher speed at night
    }

    const timeHours = distance / avgSpeed;
    const timeMinutes = Math.round(timeHours * 60);
    if (timeMinutes < 60) {
      return `${timeMinutes} دقيقة`;
    } else {
      const hours = Math.floor(timeMinutes / 60);
      const mins = timeMinutes % 60;
      return `${hours} ساعة ${mins > 0 ? mins + ' دقيقة' : ''}`;
    }
  }

  // Offline storage helper
  function saveToOfflineQueue(action) {
    offlineQueue.push(action);
    localStorage.setItem('driver_offline_queue', JSON.stringify(offlineQueue));
  }

  function loadOfflineQueue() {
    const stored = localStorage.getItem('driver_offline_queue');
    if (stored) {
      offlineQueue = JSON.parse(stored);
    }
  }

  async function processOfflineQueue() {
    if (offlineQueue.length === 0) return;

    for (const action of offlineQueue) {
      try {
        await action();
      } catch (error) {
        console.error('Error processing offline action:', error);
      }
    }

    offlineQueue = [];
    localStorage.removeItem('driver_offline_queue');
  }

  // Auto-update location every minute
  function startAutoLocationUpdate() {
    if (locationUpdateInterval) {
      clearInterval(locationUpdateInterval);
    }

    locationUpdateInterval = setInterval(async () => {
      if (!navigator.geolocation) return;

      navigator.geolocation.getCurrentPosition(async pos => {
        const loc = {
          lat: pos.coords.latitude.toFixed(5),
          lng: pos.coords.longitude.toFixed(5),
          at: new Date().toISOString()
        };

        const driverOrders = orders.filter(o => o.driver === driverName);

        // Update map
        updateMap(parseFloat(loc.lat), parseFloat(loc.lng));

        // Store current driver location
        currentDriverLocation = { lat: parseFloat(loc.lat), lng: parseFloat(loc.lng) };

        // Try to update, if offline save to queue
        try {
          for (const o of driverOrders) {
            const { error } = await supabaseClient
              .from('orders')
              .update({ location: loc })
              .eq('id', o.id);
            if (error) throw error;
          }
        } catch (error) {
          console.error('Error updating location (offline mode):', error);
          saveToOfflineQueue(async () => {
            for (const o of driverOrders) {
              await supabaseClient.from('orders').update({ location: loc }).eq('id', o.id);
            }
          });
        }
      }, err => {
        console.error('Auto location update error:', err);
      }, {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 0
      });
    }, 60000); // Update every 60 seconds

    toast('تم تفعيل التحديث التلقائي للموقع كل دقيقة');
  }

  async function loadOrders() {
    console.log('loadOrders called');
    console.log('supabaseClient:', supabaseClient);

    // Show loading overlay
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(loadingOverlay);

    const { data, error } = await supabaseClient
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    // Remove loading overlay
    loadingOverlay.remove();

    if (error) {
      console.error('Error loading orders:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      toast('حدث خطأ أثناء تحميل الطلبات. يرجى المحاولة مرة أخرى.', 'error');
      return;
    }
    orders = data || [];
    console.log('Orders loaded:', orders.length);
    checkForNewOrders();
    renderDriver();
  }
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  function toast(message, type = 'success'){
    const el=$('#toast');
    el.textContent=message;
    el.className='toast show ' + type;
    el.setAttribute('role', 'alert');
    el.setAttribute('aria-live', 'polite');

    // Better duration based on message length
    const duration = Math.max(3000, message.length * 50);
    setTimeout(()=>el.classList.remove('show'), duration);
  }
  function statusBadge(status){const statusClass={'تم طلبه':'s-new','تم الشحن':'s-shipped','خرج للتوصيل':'s-out','تم التوصيل':'s-done','تعذر التسليم':'s-failed'};return `<span class="status ${statusClass[status]||'s-new'}">${esc(status)}</span>`;}

  $('#toggle-archived-orders').addEventListener('click', () => {
    showArchived = !showArchived;
    const btn = $('#toggle-archived-orders');
    if (showArchived) {
      btn.textContent = 'عرض الطلبات النشطة';
      btn.classList.add('active');
      toast('عرض الأرشيف', 'success');
    } else {
      btn.textContent = 'عرض الأرشيف';
      btn.classList.remove('active');
      toast('عرض الطلبات النشطة', 'success');
    }
    renderDriver();
  });

  function renderDriver(){
    const auth = JSON.parse(localStorage.getItem('yas_auth') || '{}');
    driverName = auth.name || null;

    console.log('Auth data:', auth);
    console.log('Driver name from auth:', driverName);

    // Display driver name in header
    const nameDisplay = document.getElementById('driver-name-display');
    console.log('Name display element:', nameDisplay);
    if (nameDisplay && driverName) {
      nameDisplay.textContent = `مرحباً، ${driverName}`;
      nameDisplay.style.display = 'block';
      console.log('Updated name display to:', nameDisplay.textContent);
    } else {
      console.log('Name display element not found or no driver name');
    }

    if (!driverName) {
      $('#driver-orders').innerHTML = '<div class="panel">الرجاء تسجيل الدخول أولاً</div>';
      return;
    }

    console.log('All orders:', orders);
    console.log('Orders count:', orders.length);

    const list=orders.filter(o=>o.driver === driverName && (showArchived ? o.status === 'تم التوصيل' : o.status !== 'تم التوصيل'));

    console.log('Filtered orders:', list);
    console.log('Filtered orders count:', list.length);

    // Update stats (always show total stats regardless of archive view)
    const allDriverOrders = orders.filter(o => o.driver === driverName);
    $('#driver-total').textContent = allDriverOrders.length;
    $('#driver-pending').textContent = allDriverOrders.filter(o => ['تم طلبه', 'تم الشحن', 'خرج للتوصيل'].includes(o.status)).length;
    $('#driver-completed').textContent = allDriverOrders.filter(o => o.status === 'تم التوصيل').length;

    console.log('Stats updated - Total:', list.length, 'Pending:', $('#driver-pending').textContent, 'Completed:', $('#driver-completed').textContent);

    // Update dropdowns
    $('#photo-order-select').innerHTML='<option value="">اختر طلباً</option>'+list.map(o=>`<option value="${esc(o.id)}">${esc(o.id)} - ${esc(o.customer)}</option>`).join('');
    $('#signature-order-select').innerHTML='<option value="">اختر طلباً</option>'+list.map(o=>`<option value="${esc(o.id)}">${esc(o.id)} - ${esc(o.customer)}</option>`).join('');

    console.log('Dropdowns updated');

    const ordersHtml = list.length?list.map(o=>`<article class="driver-card"><div class="driver-card-top"><div><span class="order-code">${esc(o.id)}</span><h3>${esc(o.customer)}</h3><p>${esc(o.devicetype)} · ${esc(o.brand)}</p></div>${statusBadge(o.status)}</div><div class="driver-meta"><span>☎ ${esc(o.phone)}</span><span>⌖ ${esc(o.address)}</span><span>الدفع: ${esc(o.paymentmethod)}</span></div>${o.driverRating?`<div style="margin-bottom:10px;padding:8px;background:#f0fdf4;border-radius:6px;"><small>تقييم العميل:</small><br><span style="color:#f59e0b;font-size:18px;">${'★'.repeat(o.driverRating)}${'☆'.repeat(5-o.driverRating)}</span></div>`:''}<div class="driver-actions">${!showArchived ? `<select data-status-for="${esc(o.id)}" aria-label="تغيير الحالة">${['تم طلبه','تم الشحن','خرج للتوصيل','تم التوصيل','تعذر التسليم'].map(s=>`<option ${o.status===s?'selected':''}>${s}</option>`).join('')}</select><button class="btn primary" data-update-status="${esc(o.id)}">تحديث الحالة</button><button class="btn secondary" data-archive-order="${esc(o.id)}" style="background:#8b5cf6;">أرشفة</button>` : `<button class="btn primary" data-restore-order="${esc(o.id)}" style="background:#10b981;">استعادة</button>`}${o.maplink?`<a class="btn secondary" href="${esc(o.maplink)}" target="_blank" rel="noopener">فتح الخريطة</a>`:`<button class="btn secondary" data-address="${esc(o.id)}">عرض العنوان</button>`}<a class="btn secondary" style="background:#25D366;color:white;" href="https://wa.me/20${o.phone.replace(/\D/g,'')}?text=${encodeURIComponent(`مرحباً ${o.customer}، أنا ${driverName} سائق YAS. طلبك رقم ${o.id} في الطريق إليك.`)}" target="_blank" rel="noopener">واتساب</a></div><p class="subtext">آخر موقع للسائق: ${o.location?`${esc(o.location.lat)}, ${esc(o.location.lng)} · ${fmtTime(o.location.at)}`:'لم يتم تسجيل موقع بعد'}</p>${o.deliveryphoto?`<div style="margin-top:10px;"><small>صورة التسليم:</small><br><img src="${o.deliveryphoto}" alt="صورة التسليم" loading="lazy" style="max-width:100px;max-height:100px;border-radius:8px;margin-top:5px;cursor:pointer;" onclick="showImageModal('${o.deliveryphoto}')"></div>`:''}${o.signature?`<div style="margin-top:10px;"><small>توقيع العميل:</small><br><img src="${o.signature}" alt="توقيع العميل" loading="lazy" style="max-width:100px;max-height:100px;border-radius:8px;margin-top:5px;cursor:pointer;" onclick="showImageModal('${o.signature}')"></div>`:''}</article>`).join(''):'<div class="panel">لا توجد طلبات مسندة لك حتى الآن.</div>';

    console.log('Orders HTML generated, length:', ordersHtml.length);
    $('#driver-orders').innerHTML = ordersHtml;
    console.log('Orders HTML set to #driver-orders');
  }

  $('#today').textContent=today.toLocaleDateString('ar-EG',{weekday:'long',day:'numeric',month:'long'});
  
  $('#driver-orders').addEventListener('click',async e=>{
    const b=e.target.closest('[data-update-status]');
    if(b){
      const id=b.dataset.updateStatus;
      const o=orders.find(x=>x.id===id);
      const sel=$(`[data-status-for="${CSS.escape(id)}"]`);
      if(!o||!sel)return;
      o.status=sel.value;
      o.history=o.history||[];
      o.history.push({status:o.status,at:new Date().toISOString()});

      const { error } = await supabaseClient
        .from('orders')
        .update({ status: o.status, history: o.history })
        .eq('id', id);

      if(error){
        console.error('Error updating status:',error);
        toast('حدث خطأ أثناء تحديث الحالة','error');
        return;
      }

      await loadOrders();
      renderDriver();
      toast('تم تحديث الحالة بنجاح','success');
    }

    const archiveBtn=e.target.closest('[data-archive-order]');
    if(archiveBtn){
      const id=archiveBtn.dataset.archiveOrder;
      if(!confirm('هل تريد أرشفة هذا الطلب؟ سيختفي من القائمة النشطة.')) return;

      const o=orders.find(x=>x.id===id);
      if(!o) return;

      o.status='تم التوصيل';
      o.history=o.history||[];
      o.history.push({status:'تم التوصيل',at:new Date().toISOString(),note:'تمت الأرشفة بواسطة السائق'});

      const { error } = await supabaseClient
        .from('orders')
        .update({ status: o.status, history: o.history })
        .eq('id', id);

      if(error){
        console.error('Error archiving order:',error);
        toast('حدث خطأ أثناء أرشفة الطلب','error');
        return;
      }

      await loadOrders();
      renderDriver();
      toast('تم أرشفة الطلب بنجاح','success');
    }

    const restoreBtn=e.target.closest('[data-restore-order]');
    if(restoreBtn){
      const id=restoreBtn.dataset.restoreOrder;
      if(!confirm('هل تريد استعادة هذا الطلب من الأرشيف؟')) return;

      const o=orders.find(x=>x.id===id);
      if(!o) return;

      o.status='خرج للتوصيل';
      o.history=o.history||[];
      o.history.push({status:'خرج للتوصيل',at:new Date().toISOString(),note:'تمت الاستعادة بواسطة السائق'});

      const { error } = await supabaseClient
        .from('orders')
        .update({ status: o.status, history: o.history })
        .eq('id', id);

      if(error){
        console.error('Error restoring order:',error);
        toast('حدث خطأ أثناء استعادة الطلب','error');
        return;
      }

      await loadOrders();
      renderDriver();
      toast('تم استعادة الطلب بنجاح','success');
    }

    const a=e.target.closest('[data-address]');
    if(a){
      const o=orders.find(x=>x.id===a.dataset.address);
      if(o)toast(o.address);
    }
  });
  
  let watchId=null;
  let map = null;
  let driverMarker = null;
  let routeLayer = null;
  let customerMarker = null;
  let currentTileLayer = null;

  // Initialize map
  function initMap() {
    if (typeof L !== 'undefined' && document.getElementById('map')) {
      map = L.map('map').setView([30.0444, 31.2357], 13); // Default to Cairo

      // Default tile layer (OpenStreetMap)
      currentTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);
    }
  }

  // Toggle map view (Standard/Satellite)
  function toggleMapView(isSatellite) {
    if (!map || !currentTileLayer) return;

    map.removeLayer(currentTileLayer);

    if (isSatellite) {
      // Satellite view (using Esri World Imagery)
      currentTileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri'
      }).addTo(map);
    } else {
      // Standard view (OpenStreetMap)
      currentTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);
    }
  }

  // Draw route to customer using OSRM
  async function drawRouteToCustomer(driverLat, driverLng, customerAddress) {
    if (!map) return;

    // Remove existing route
    if (routeLayer) {
      map.removeLayer(routeLayer);
    }

    // Remove existing customer marker
    if (customerMarker) {
      map.removeLayer(customerMarker);
    }

    try {
      // For now, just show a straight line (can be upgraded to use OSRM API)
      const driverLatLng = [driverLat, driverLng];
      const customerLatLng = [30.0444, 31.2357]; // Default to Cairo center

      // Draw route line
      routeLayer = L.polyline([driverLatLng, customerLatLng], {
        color: '#2563eb',
        weight: 5,
        opacity: 0.7,
        dashArray: '10, 10'
      }).addTo(map);

      // Add customer marker
      customerMarker = L.marker(customerLatLng, {
        icon: L.divIcon({
          className: 'custom-marker',
          html: '<div style="background: #10b981; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 16px;">🏠</div>',
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        })
      }).addTo(map).bindPopup('موقع العميل');

      // Fit map to show both points
      const bounds = L.latLngBounds([driverLatLng, customerLatLng]);
      map.fitBounds(bounds, { padding: [50, 50] });

    } catch (error) {
      console.error('Error drawing route:', error);
    }
  }

  // Update map with driver location
  function updateMap(lat, lng) {
    if (!map) return;

    const latLng = [lat, lng];

    if (driverMarker) {
      driverMarker.setLatLng(latLng);
    } else {
      driverMarker = L.marker(latLng, {
        icon: L.divIcon({
          className: 'custom-marker',
          html: '<div style="background: #2563eb; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px; border: 3px solid white; box-shadow: 0 2px 10px rgba(0,0,0,0.3);">🚗</div>',
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        })
      }).addTo(map)
        .bindPopup('موقعك الحالي')
        .openPopup();
    }

    map.setView(latLng, 15);
  }

  // Initialize map when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMap);
  } else {
    initMap();
  }

  // Map view toggle buttons
  $('#map-standard').addEventListener('click', () => {
    toggleMapView(false);
    toast('تم التبديل للخريطة العادية');
  });

  $('#map-satellite').addEventListener('click', () => {
    toggleMapView(true);
    toast('تم التبديل للخريطة القمر الصناعي');
  });

  $('#update-location').addEventListener('click',async ()=>{
    const output=$('#location-result');
    if(!navigator.geolocation){
      output.textContent='المتصفح لا يدعم تحديد الموقع.';
      toast('ميزة الموقع غير مدعومة', 'warning');
      return;
    }
    output.textContent='جاري طلب إذن الموقع...';
    navigator.geolocation.getCurrentPosition(async pos=>{
      const loc={lat:pos.coords.latitude.toFixed(5),lng:pos.coords.longitude.toFixed(5),at:new Date().toISOString()};
      const driverOrders = orders.filter(o=>o.driver === driverName);

      // Update map
      updateMap(parseFloat(loc.lat), parseFloat(loc.lng));

      // Store current driver location
      currentDriverLocation = { lat: parseFloat(loc.lat), lng: parseFloat(loc.lng) };

      for (const o of driverOrders) {
        const { error } = await supabaseClient
          .from('orders')
          .update({ location: loc })
          .eq('id', o.id);
        if (error) console.error('Error updating location:', error);
      }

      output.textContent=`آخر تحديث: ${loc.lat}, ${loc.lng} · ${fmtTime(loc.at)}`;
      await loadOrders();
      toast('تم تسجيل الموقع على الطلبات المسندة');
    },err=>{
      output.textContent=err.code===1?'لم تسمح بالوصول للموقع. فعّل إذن الموقع وحاول تاني.':'تعذر تحديد الموقع. تأكد من إعدادات الجهاز والاتصال.';
    },{enableHighAccuracy:true,timeout:30000,maximumAge:0});
  });

  $('#auto-location').addEventListener('change',e=>{
    const output=$('#location-result');
    if(e.target.checked){
      if(!navigator.geolocation){
        output.textContent='المتصفح لا يدعم تحديد الموقع.';
        e.target.checked=false;
        toast('ميزة الموقع غير مدعومة', 'warning');
        return;
      }
      output.textContent='جاري تفعيل التتبع التلقائي...';
      startAutoLocationUpdate();
    }else{
      if(locationUpdateInterval){
        clearInterval(locationUpdateInterval);
        locationUpdateInterval=null;
        output.textContent='تم إيقاف التتبع التلقائي';
        toast('تم إيقاف التتبع التلقائي');
      }
    }
  });

  $('#upload-photo').addEventListener('change',async e=>{
    const file=e.target.files[0];
    const orderId=$('#photo-order-select').value;
    if(!file){
      toast('اختر صورة أولاً', 'warning');
      return;
    }
    if(!orderId){
      toast('اختر طلباً أولاً', 'warning');
      return;
    }
    const reader=new FileReader();
    reader.onload=async ()=>{
      const base64=reader.result;
      const { error }=await supabaseClient.from('orders').update({deliveryphoto:base64}).eq('id',orderId);
      if(error){
        console.error('Error uploading photo:',error);
        toast('حدث خطأ أثناء رفع الصورة', 'error');
        return;
      }
      await loadOrders();
      toast('تم رفع الصورة بنجاح');
      $('#upload-result').textContent='تم رفع الصورة بنجاح';
    };
    reader.readAsDataURL(file);
  });

  // Signature canvas functionality
  const canvas=document.getElementById('signature-canvas');
  const ctx=canvas.getContext('2d');
  let isDrawing=false;
  let lastX=0;
  let lastY=0;

  canvas.addEventListener('mousedown',e=>{
    isDrawing=true;
    [lastX,lastY]=[e.offsetX,e.offsetY];
  });

  canvas.addEventListener('mousemove',e=>{
    if(!isDrawing)return;
    ctx.beginPath();
    ctx.moveTo(lastX,lastY);
    ctx.lineTo(e.offsetX,e.offsetY);
    ctx.strokeStyle='#000';
    ctx.lineWidth=2;
    ctx.stroke();
    [lastX,lastY]=[e.offsetX,e.offsetY];
  });

  canvas.addEventListener('mouseup',()=>isDrawing=false);
  canvas.addEventListener('mouseout',()=>isDrawing=false);

  // Touch support for mobile
  canvas.addEventListener('touchstart',e=>{
    e.preventDefault();
    const touch=e.touches[0];
    const rect=canvas.getBoundingClientRect();
    isDrawing=true;
    [lastX,lastY]=[touch.clientX-rect.left,touch.clientY-rect.top];
  });

  canvas.addEventListener('touchmove',e=>{
    e.preventDefault();
    if(!isDrawing)return;
    const touch=e.touches[0];
    const rect=canvas.getBoundingClientRect();
    const x=touch.clientX-rect.left;
    const y=touch.clientY-rect.top;
    ctx.beginPath();
    ctx.moveTo(lastX,lastY);
    ctx.lineTo(x,y);
    ctx.strokeStyle='#000';
    ctx.lineWidth=2;
    ctx.stroke();
    [lastX,lastY]=[x,y];
  });

  canvas.addEventListener('touchend',()=>isDrawing=false);

  $('#clear-signature').addEventListener('click',()=>{
    ctx.clearRect(0,0,canvas.width,canvas.height);
    toast('تم مسح التوقيع');
  });

  $('#save-signature').addEventListener('click',async ()=>{
    const orderId=$('#signature-order-select').value;
    if(!orderId){
      toast('اختر طلباً أولاً', 'warning');
      return;
    }
    const signatureData=canvas.toDataURL();
    const { error }=await supabaseClient.from('orders').update({signature:signatureData}).eq('id',orderId);
    if(error){
      console.error('Error saving signature:',error);
      toast('حدث خطأ أثناء حفظ التوقيع', 'error');
      return;
    }
    await loadOrders();
    toast('تم حفظ التوقيع بنجاح');
    $('#signature-result').textContent='تم حفظ التوقيع بنجاح';
    ctx.clearRect(0,0,canvas.width,canvas.height);
  });

  console.log('Starting loadOrders...');

  // Request notification permission on load
  requestNotificationPermission();

  // Load offline queue on startup
  loadOfflineQueue();

  // Process offline queue when online
  window.addEventListener('online', () => {
    toast('الإنترنت متصل، جاري معالجة البيانات المحفوظة...');
    processOfflineQueue();
  });

  // Load orders
  loadOrders();
})();
