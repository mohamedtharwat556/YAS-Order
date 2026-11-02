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
    result.innerHTML=`<div class="tracking-result-head"><div><h3>طلبك ${esc(o.id)}</h3><p>آخر تحديث للحالة: ${fmtDate(o.history?.at(-1)?.at||o.receivedat)} · ${fmtTime(o.history?.at(-1)?.at||o.receivedat)}</p></div>${statusBadge(o.status)}</div>
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

    // Start live tracking
    startLiveTracking(o.id);
  }

  // Live tracking - auto-refresh every 30 seconds
  let trackingInterval = null;

  function startLiveTracking(orderId) {
    if (trackingInterval) {
      clearInterval(trackingInterval);
    }

    trackingInterval = setInterval(async () => {
      await loadOrders();
      const updatedOrder = orders.find(x => x.id === orderId);
      if (updatedOrder) {
        showTracking(updatedOrder);
      }
    }, 30000); // Update every 30 seconds
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
