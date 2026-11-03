(() => {
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

  let orders = [];
  async function loadOrders() {
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
    // Normalize data from lowercase to camelCase for display
    orders = (data || []).map(o => ({
      ...o,
      mapLink: o.maplink || o.mapLink,
      deviceType: o.devicetype || o.deviceType,
      paymentMethod: o.paymentmethod || o.paymentMethod,
      paymentStatus: o.paymentstatus || o.paymentStatus,
      receivedAt: o.receivedat || o.receivedAt,
      driverRating: o.driverrating || o.driver_rating,
      productRating: o.productrating || o.product_rating,
      serviceRating: o.servicerating || o.service_rating,
      customerNotes: o.customernotes || o.customerNotes
    }));
    renderSales();
    return orders;
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
  function statusBadge(status){const statusClass={'تم طلبه':'s-new','تم الشحن':'s-shipped','خرج للتوصيل':'s-out','تم التوصيل':'s-done','تعذر التسليم':'s-failed'};const carPositions={'تم طلبه':'0%','تم الشحن':'25%','خرج للتوصيل':'50%','تم التوصيل':'75%','تعذر التسليم':'100%'};return `<div class="status-container"><span class="status ${statusClass[status]||'s-new'}">${esc(status)}</span><div class="status-track"><div class="status-car" style="left: ${carPositions[status]||'0%'}"></div></div></div>`;}
  
  // Initialize Lucide icons
  document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    
    // Mobile menu toggle
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    
    if (mobileMenuToggle && sidebar && sidebarOverlay) {
      mobileMenuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        sidebarOverlay.classList.toggle('active');
      });
      
      sidebarOverlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('active');
      });
    }
    
    // Advanced filters toggle
    const toggleAdvancedFilters = document.getElementById('toggle-advanced-filters');
    const advancedFilters = document.getElementById('advanced-filters');
    
    if (toggleAdvancedFilters && advancedFilters) {
      toggleAdvancedFilters.addEventListener('click', () => {
        advancedFilters.classList.toggle('active');
      });
    }
  });
  function go(view){
    $$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${view}`));
    $$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
    const titles={dashboard:'لوحة الإحصائيات',sales:'لوحة إدارة الطلبات',new_order:'إنشاء طلب جديد',edit_order:'تعديل الطلب'};
    $('#page-title').textContent=titles[view]||'YAS';
    if(view==='sales')renderSales();
    if(view==='new_order'){
      setReceivedAt();
      updateProductQuantities('new');
    }
    if(view==='dashboard')renderDashboard();
  }
  window.go = go;
  function setReceivedAt(){const el=$('#received-at');if(el&&!el.value){const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());el.value=d.toISOString().slice(0,16);}}
  let showCompletedOnly = false;
  
  function renderSales(){
    const q=($('#order-search').value||'').trim().toLowerCase();
    const statusFilter=$('#status-filter').value;
    const paymentFilter=$('#payment-filter').value;
    const driverFilter=$('#driver-filter').value;
    
    // Advanced filters
    const dateFrom=$('#filter-date-from').value;
    const dateTo=$('#filter-date-to').value;
    const phoneFilter=$('#filter-phone').value;
    const multipleStatus=$('#filter-multiple-status').selectedOptions;
    const multipleStatusValues=Array.from(multipleStatus).map(opt=>opt.value);
    
    const filtered=orders.filter(o=>{
      // Filter out completed orders if showCompletedOnly is false
      if(showCompletedOnly && o.status!=='تم التوصيل') return false;
      
      const matchesSearch=!q||[o.id,o.customer,o.phone,o.brand].some(v=>String(v||'').toLowerCase().includes(q));
      const matchesStatus=!statusFilter||o.status===statusFilter;
      const matchesPayment=!paymentFilter||o.paymentmethod===paymentFilter;
      const matchesDriver=!driverFilter||o.driver===driverFilter;
      
      // Advanced filters
      let matchesDateRange=true;
      if(dateFrom||dateTo){
        const orderDate=new Date(o.receivedat);
        if(dateFrom) matchesDateRange=matchesDateRange&&orderDate>=new Date(dateFrom);
        if(dateTo) matchesDateRange=matchesDateRange&&orderDate<=new Date(dateTo+'T23:59:59');
      }
      
      const matchesPhone=!phoneFilter||String(o.phone||'').includes(phoneFilter);
      
      const matchesMultipleStatus=multipleStatusValues.length===0||multipleStatusValues.includes(o.status);
      
      return matchesSearch&&matchesStatus&&matchesPayment&&matchesDriver&&matchesDateRange&&matchesPhone&&matchesMultipleStatus;
    });
    $('#orders-table').innerHTML=filtered.map(o=>{
      const trackUrl=`${window.location.origin}/track.html?order=${o.id}`;
      const deliveryphotoHtml=o.deliveryphoto?`<img src="${o.deliveryphoto}" alt="صورة التسليم" loading="lazy" onclick="showImageModal('${o.deliveryphoto}')" style="width:30px;height:30px;border-radius:4px;cursor:pointer;margin-right:3px;" title="صورة التسليم">`:'';
      const signatureHtml=o.signature?`<img src="${o.signature}" alt="توقيع العميل" loading="lazy" onclick="showImageModal('${o.signature}')" style="width:30px;height:30px;border-radius:4px;cursor:pointer;" title="التوقيع">`:'';
      const ratingHtml=o.driverRating?`<span style="color:#f59e0b;font-size:16px;" title="السائق">${'★'.repeat(o.driverRating)}</span>`:'-';
      const productRatingHtml=o.productRating?`<span style="color:#10b981;font-size:16px;" title="المنتج">${'★'.repeat(o.productRating)}</span>`:'';
      const serviceRatingHtml=o.serviceRating?`<span style="color:#3b82f6;font-size:16px;" title="الخدمة">${'★'.repeat(o.serviceRating)}</span>`:'';
      const allRatingsHtml = (o.driverRating || o.productRating || o.serviceRating) ? 
        `<div style="display:flex;gap:5px;align-items:center;">${ratingHtml}${productRatingHtml}${serviceRatingHtml}</div>` : ratingHtml;
      const notesHtml=o.customerNotes?`<span style="color:var(--muted);font-size:12px;max-width:100px;display:inline-block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(o.customerNotes)}">${esc(o.customerNotes)}</span>`:'-';
      const whatsappUrl=`https://wa.me/2${o.phone.substring(1)}?text=${encodeURIComponent(`مرحباً ${o.customer}، طلبك رقم ${o.id} في الطريق. الحالة: ${o.status}`)}`;
      const emailUrl=`mailto:${o.phone}@example.com?subject=طلب ${o.id}&body=تفاصيل طلبك ${o.id}`;
      return `<tr><td><input type="checkbox" class="order-checkbox" data-id="${esc(o.id)}"></td><td><span class="order-code">${esc(o.id)}</span></td><td>${esc(o.customer)}</td><td>${esc(o.phone)}</td><td><span style="max-width:150px;display:inline-block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(o.address)}">${esc(o.address)}</span></td><td>${esc(o.devicetype)}<br><small>${esc(o.brand)}</small></td><td>${o.quantity}</td><td>${esc(o.paymentmethod)}<br><small>${esc(o.paymentstatus)}</small></td><td>${esc(o.driver||'غير محدد')}</td><td>${statusBadge(o.status)}</td><td>${fmtDate(o.receivedat)}<br><small>${fmtTime(o.receivedat)}</small></td><td>${deliveryphotoHtml}${signatureHtml}</td><td>${allRatingsHtml}</td><td>${notesHtml}</td><td><button class="icon-btn" data-edit_order="${esc(o.id)}" title="تعديل">✏️</button><button class="icon-btn" data-delete_order="${esc(o.id)}" title="حذف" style="color: var(--red);">🗑️</button><button class="icon-btn" data-copy_link="${trackUrl}" title="نسخ رابط">📋</button><a class="icon-btn" href="${whatsappUrl}" target="_blank" title="واتساب" style="color: #25D366;">📱</a><a class="icon-btn" href="${emailUrl}" title="إيميل" style="color: #EA4335;">✉️</a></td></tr>`;
    }).join('');
    $('#orders-empty').classList.toggle('hidden',filtered.length>0);
  }

  function renderDashboard(){
    const total = orders.length;
    const completed = orders.filter(o => o.status === 'تم التوصيل').length;
    const pending = orders.filter(o => ['تم طلبه', 'تم الشحن', 'خرج للتوصيل'].includes(o.status)).length;

    $('#dash-total').textContent = total;
    $('#dash-completed').textContent = completed;
    $('#dash-pending').textContent = pending;

    // Status Chart
    const statusCounts = {
      'تم طلبه': orders.filter(o => o.status === 'تم طلبه').length,
      'تم الشحن': orders.filter(o => o.status === 'تم الشحن').length,
      'خرج للتوصيل': orders.filter(o => o.status === 'خرج للتوصيل').length,
      'تم التوصيل': orders.filter(o => o.status === 'تم التوصيل').length,
      'تعذر التسليم': orders.filter(o => o.status === 'تعذر التسليم').length
    };

    const statusCtx = document.getElementById('statusChart');
    if (window.statusChartInstance) window.statusChartInstance.destroy();
    window.statusChartInstance = new Chart(statusCtx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(statusCounts),
        datasets: [{
          data: Object.values(statusCounts),
          backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#ef4444']
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });

    // Driver Performance Report
    const drivers = ['ناصر اسلام', 'ابراهيم ذكري', 'عمرو حرحش', 'جمعة السيد'];
    const driverStats = drivers.map(driver => {
      const driverOrders = orders.filter(o => o.driver === driver);
      const driverCompleted = driverOrders.filter(o => o.status === 'تم التوصيل').length;
      const driverPending = driverOrders.filter(o => ['تم طلبه', 'تم الشحن', 'خرج للتوصيل'].includes(o.status)).length;
      const driverRating = driverOrders
        .filter(o => o.driverRating)
        .reduce((sum, o) => sum + o.driverRating, 0) / (driverOrders.filter(o => o.driverRating).length || 1);

      return {
        name: driver,
        total: driverOrders.length,
        completed: driverCompleted,
        pending: driverPending,
        rating: driverRating.toFixed(1)
      };
    });

    const driverStatsHtml = driverStats.map(d => `
      <div style="padding: 12px; border: 1px solid var(--line); border-radius: 8px; margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong>${d.name}</strong>
          <span style="color: #f59e0b;">★ ${d.rating}</span>
        </div>
        <div style="display: flex; gap: 20px; margin-top: 8px; font-size: 14px;">
          <span>إجمالي: ${d.total}</span>
          <span style="color: #10b981;">مكتمل: ${d.completed}</span>
          <span style="color: #f59e0b;">قيد التوصيل: ${d.pending}</span>
        </div>
      </div>
    `).join('');

    // Add driver stats section if it doesn't exist
    if (!document.getElementById('driver-stats-section')) {
      const dashboardCharts = document.querySelector('.dashboard-charts');
      const driverSection = document.createElement('section');
      driverSection.className = 'panel';
      driverSection.id = 'driver-stats-section';
      driverSection.innerHTML = `
        <div class="section-title">
          <h3>أداء السائقين</h3>
          <p>تقرير أداء كل سائق</p>
        </div>
        <div id="driver-stats-container">${driverStatsHtml}</div>
      `;
      dashboardCharts.parentNode.insertBefore(driverSection, dashboardCharts.nextSibling);
    } else {
      document.getElementById('driver-stats-container').innerHTML = driverStatsHtml;
    }
  }

  function generateReport(period){
    const now=new Date();
    let startDate;
    if(period==='today'){
      startDate=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    }else if(period==='week'){
      startDate=new Date(now.getFullYear(),now.getMonth(),now.getDate()-7);
    }else if(period==='month'){
      startDate=new Date(now.getFullYear(),now.getMonth(),1);
    }

    const filtered=orders.filter(o=>{
      const orderDate=new Date(o.receivedat);
      return orderDate>=startDate;
    });

    const total=filtered.length;
    const completed=filtered.filter(o=>o.status==='تم التوصيل').length;
    const pending=filtered.filter(o=>['تم طلبه','تم الشحن','خرج للتوصيل'].includes(o.status)).length;

    const periodNames={today:'اليوم',week:'هذا الأسبوع',month:'هذا الشهر'};
    $('#report-result').innerHTML=`
      <div class="report-summary">
        <h3>تقرير ${periodNames[period]}</h3>
        <div class="report-stats">
          <div><strong>${total}</strong><small>إجمالي الطلبات</small></div>
          <div><strong>${completed}</strong><small>تم التوصيل</small></div>
          <div><strong>${pending}</strong><small>قيد التوصيل</small></div>
        </div>
      </div>
    `;
    $('#report-result').classList.remove('hidden');
  }

  $('#generate-report').addEventListener('click',()=>{
    const period=$('#report-period').value;
    generateReport(period);
  });
  
  $('#today').textContent=today.toLocaleDateString('ar-EG',{weekday:'long',day:'numeric',month:'long'});
  $$('[data-view]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.view)));
  $$('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));
  $('#order-search').addEventListener('input',renderSales);
  $('#status-filter').addEventListener('change',renderSales);
  $('#payment-filter').addEventListener('change',renderSales);
  $('#driver-filter').addEventListener('change',renderSales);
  $('#filter-date-from').addEventListener('change',renderSales);
  $('#filter-date-to').addEventListener('change',renderSales);
  $('#filter-phone').addEventListener('input',renderSales);
  $('#filter-multiple-status').addEventListener('change',renderSales);
  
  // Toggle completed orders only
  $('#toggle-completed-only').addEventListener('click',()=>{
    showCompletedOnly = !showCompletedOnly;
    const btn=$('#toggle-completed-only');
    btn.classList.toggle('active', showCompletedOnly);
    renderSales();
    toast(showCompletedOnly ? 'عرض الطلبات المكتملة فقط' : 'عرض جميع الطلبات', 'success');
  });
  $('#clear-filters').addEventListener('click',()=>{
    $('#order-search').value='';
    $('#status-filter').value='';
    $('#payment-filter').value='';
    $('#driver-filter').value='';
    $('#filter-date-from').value='';
    $('#filter-date-to').value='';
    $('#filter-phone').value='';
    $('#filter-multiple-status').selectedOptions.forEach(opt=>opt.selected=false);
    renderSales();
    toast('تم مسح جميع الفلاتر', 'success');
  });

  $('#export-excel').addEventListener('click',()=>{
    const q=($('#order-search').value||'').trim().toLowerCase();
    const statusFilter=$('#status-filter').value;
    const paymentFilter=$('#payment-filter').value;
    const driverFilter=$('#driver-filter').value;
    const filtered=orders.filter(o=>{
      const matchesSearch=!q||[o.id,o.customer,o.phone,o.brand].some(v=>String(v||'').toLowerCase().includes(q));
      const matchesStatus=!statusFilter||o.status===statusFilter;
      const matchesPayment=!paymentFilter||o.paymentmethod===paymentFilter;
      const matchesDriver=!driverFilter||o.driver===driverFilter;
      return matchesSearch&&matchesStatus&&matchesPayment&&matchesDriver;
    });

    if(filtered.length===0){
      toast('لا توجد طلبات للتصدير', 'warning');
      return;
    }

    const exportData=filtered.map(o=>({
      'رقم الطلب':o.id,
      'العميل':o.customer,
      'الهاتف':o.phone,
      'العنوان':o.address,
      'نوع الجهاز':o.devicetype,
      'الماركة':o.brand,
      'الكمية':o.quantity,
      'التفاصيل':o.details,
      'طريقة الدفع':o.paymentmethod,
      'حالة الدفع':o.paymentstatus,
      'السائق':o.driver,
      'الحالة':o.status,
      'تاريخ الاستلام':o.receivedat,
      'ملاحظات':o.notes||''
    }));

    const ws=XLSX.utils.json_to_sheet(exportData);
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,'الطلبات');
    XLSX.writeFile(wb,'YAS-Orders.xlsx');
    toast('تم تصدير البيانات بنجاح');
  });


  // Export to JSON
  $('#export-json').addEventListener('click',()=>{
    if(orders.length===0){
      toast('لا توجد طلبات للتصدير', 'warning');
      return;
    }

    const exportData = JSON.stringify(orders, null, 2);
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `YAS-Orders-Backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('تم تصدير النسخة الاحتياطية بنجاح');
  });

  // Import from JSON
  $('#import-json').addEventListener('click',()=>{
    $('#import-file').click();
  });

  $('#import-file').addEventListener('change',async (e)=>{
    const file = e.target.files[0];
    if(!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        
        if(!Array.isArray(importedData)){
          toast('الملف غير صالح: يجب أن يكون مصفوفة طلبات', 'error');
          return;
        }

        if(!confirm(`استيراد ${importedData.length} طلب؟ سيتم إضافتها إلى الطلبات الحالية.`)) return;

        for(const order of importedData){
          const { error } = await supabaseClient
            .from('orders')
            .upsert(order);
          
          if(error){
            console.error('Error importing order:', error);
          }
        }

        await loadOrders();
        toast(`تم استيراد ${importedData.length} طلب بنجاح`, 'success');
      } catch (error) {
        console.error('Error parsing JSON:', error);
        toast('خطأ في قراءة الملف: تأكد أنه ملف JSON صالح', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset file input
  });

  $('#bulk-update').addEventListener('click',async ()=>{
    const selectedIds=[...document.querySelectorAll('.order-checkbox:checked')].map(cb=>cb.dataset.id);
    if(selectedIds.length===0){
      toast('اختر طلبات على الأقل للتحديث', 'warning');
      return;
    }
    const newStatus=prompt('اختر الحالة الجديدة:\n\n1. تم طلبه\n2. تم الشحن\n3. خرج للتوصيل\n4. تم التوصيل\n5. تعذر التسليم\n\nأدخل الرقم:');
    const statusMap={'1':'تم طلبه','2':'تم الشحن','3':'خرج للتوصيل','4':'تم التوصيل','5':'تعذر التسليم'};
    if(!newStatus||!statusMap[newStatus]){
      toast('اختيار غير صحيح', 'error');
      return;
    }
    const selectedStatus=statusMap[newStatus];
    if(!confirm(`تأكد من تغيير حالة ${selectedIds.length} طلب إلى "${selectedStatus}"؟`)){
      return;
    }
    selectedIds.forEach(async id=>{
      const o=orders.find(x=>x.id===id);
      if(o){
        o.status=selectedStatus;
        o.history=o.history||[];
        o.history.push({status:selectedStatus,at:new Date().toISOString()});
        const { error }=await supabaseClient.from('orders').update({status:o.status,history:o.history}).eq('id',id);
        if(error) console.error('Error updating order:',error);
        
        // If status is "تم التوصيل", show archive notification
        if(selectedStatus==='تم التوصيل'&&!error){
          toast(`تم نقل الطلب ${id} إلى الأرشيف`, 'success');
        }
      }
    });
    await loadOrders();
    toast(`تم تحديث ${selectedIds.length} طلب بنجاح`);
    document.querySelectorAll('.order-checkbox').forEach(cb=>cb.checked=false);
  });

  $('#select-all').addEventListener('change',e=>{
    document.querySelectorAll('.order-checkbox').forEach(cb=>cb.checked=e.target.checked);
  });
  
  loadOrders();
  
  $('#orders-table').addEventListener('click',async e=>{
    const b=e.target.closest('[data-copy_link]');
    if(b){
      const link=b.dataset.copy_link;
      navigator.clipboard.writeText(link).then(()=>toast('تم نسخ رابط التتبع ✓')).catch(()=>toast('خطأ في النسخ', 'error'));
    }
    const editBtn=e.target.closest('[data-edit_order]');
    if(editBtn){
      const orderId=editBtn.dataset.edit_order;
      const o=orders.find(x=>x.id===orderId);
      if(o){
        $('#edit_order_id').value=o.id;
        $('#edit_order_form').elements.customer.value=o.customer;
        $('#edit_order_form').elements.phone.value=o.phone;
        $('#edit_order_form').elements.address.value=o.address;
        $('#edit_order_form').elements.mapLink.value=o.maplink||'';
        // Handle multiple device types
        const deviceTypeCheckboxes = document.querySelectorAll('#edit_order_form input[name="deviceType"]');
        deviceTypeCheckboxes.forEach(cb => {
          cb.checked = false;
        });
        if(o.devicetype) {
          const types = o.devicetype.split(',');
          types.forEach(type => {
            const checkbox = document.querySelector(`#edit_order_form input[name="deviceType"][value="${type.trim()}"]`);
            if(checkbox) checkbox.checked = true;
          });
        }
        // Trigger updateProductQuantities to show quantity fields
        updateProductQuantities('edit');
        $('#edit_order_form').elements.brand.value=o.brand;
        // Skip quantity field as it's now handled dynamically
        $('#edit_order_form').elements.details.value=o.details;
        $('#edit_order_form').elements.paymentMethod.value=o.paymentmethod;
        $('#edit_order_form').elements.paymentStatus.value=o.paymentstatus;
        $('#edit_order_form').elements.driver.value=o.driver;
        $('#edit_order_form').elements.driverPhone.value=o.driverphone||'';
        $('#edit_order_form').elements.receivedAt.value=o.receivedat;
        $('#edit_order_form').elements.notes.value=o.notes||'';
        
        // Show delivery proof if exists
        const proofSection=$('#delivery-proof-section');
        const photoContainer=$('#edit-delivery-photo-container');
        const signatureContainer=$('#edit-signature-container');
        
        if(o.deliveryphoto||o.signature){
          proofSection.style.display='block';
          photoContainer.innerHTML=o.deliveryphoto?`<label>صورة التسليم<br><img src="${o.deliveryphoto}" style="max-width:200px;max-height:200px;border-radius:8px;margin-top:5px;cursor:pointer;" onclick="showImageModal('${o.deliveryphoto}')"></label>`:'';
          signatureContainer.innerHTML=o.signature?`<label>توقيع العميل<br><img src="${o.signature}" style="max-width:200px;max-height:200px;border-radius:8px;margin-top:5px;cursor:pointer;" onclick="showImageModal('${o.signature}')"></label>`:'';
        }else{
          proofSection.style.display='none';
        }

        // Show driver rating if exists
        const ratingSection=$('#driver-rating-section');
        const ratingContainer=$('#edit-driver-rating-container');
        if(o.driverRating){
          ratingSection.style.display='block';
          ratingContainer.innerHTML=`<label>تقييم السائق<br><span style="color:#f59e0b;font-size:24px;">${'★'.repeat(o.driverRating)}${'☆'.repeat(5-o.driverRating)}</span></label>`;
        }else{
          ratingSection.style.display='none';
        }

        // Show customer notes if exists
        const notesSectionEdit=$('#customer-notes-section-edit');
        const notesContainerEdit=$('#edit-customer-notes-container');
        if(o.customerNotes){
          notesSectionEdit.style.display='block';
          notesContainerEdit.innerHTML=`<label>ملاحظات العميل<br><p style="background:var(--blue2);padding:10px;border-radius:8px;margin-top:5px;">${esc(o.customerNotes)}</p></label>`;
        }else{
          notesSectionEdit.style.display='none';
        }
        
        go('edit_order');
      }
    }
    const deleteBtn=e.target.closest('[data-delete_order]');
    if(deleteBtn){
      const orderId=deleteBtn.dataset.delete_order;
      if(confirm(`هل أنت متأكد من حذف الطلب ${orderId}؟ لا يمكن التراجع عن هذا الإجراء.`)){
        const { error } = await supabaseClient.from('orders').delete().eq('id', orderId);
        if (error) {
          console.error('Error deleting order:', error);
          toast('حدث خطأ أثناء حذف الطلب', 'error');
          return;
        }
        await loadOrders();
        toast(`تم حذف الطلب ${orderId}`);
      }
    }
  });
  
  $('#order-form').addEventListener('submit',async e=>{
    e.preventDefault();
    const form=e.currentTarget;
    if(!form.reportValidity())return;
    const data=Object.fromEntries(new FormData(form).entries());

    // Generate simple order ID: YAS-1, YAS-2, etc.
    const maxOrderNum = orders.reduce((max, o) => {
      const num = parseInt(o.id.replace('YAS-', '')) || 0;
      return num > max ? num : max;
    }, 0);
    const orderId = `YAS-${maxOrderNum + 1}`;

    // Collect device types and quantities
    const deviceTypeCheckboxes = document.querySelectorAll('#order-form input[name="deviceType"]:checked');
    const deviceTypes = Array.from(deviceTypeCheckboxes).map(cb => cb.value);
    const quantities = {};
    deviceTypes.forEach(type => {
      const quantityInput = document.querySelector(`#productQuantitiesNew input[name="quantity_${type}"]`);
      if(quantityInput) {
        quantities[type] = quantityInput.value;
      }
    });

    const o={
      id: orderId,
      customer: data.customer,
      phone: data.phone,
      address: data.address,
      maplink: data.mapLink || null,
      devicetype: deviceTypes.join(','),
      brand: data.brand,
      quantity: Object.values(quantities).reduce((sum, qty) => sum + parseInt(qty || 0), 0) || 1,
      amount: data.amount || null,
      details: data.details,
      paymentmethod: data.paymentMethod,
      paymentstatus: data.paymentStatus,
      driver: data.driver,
      driverphone: data.driverPhone || null,
      receivedat: data.receivedAt,
      notes: data.notes,
      status:'تم طلبه',
      history:[{status:'تم طلبه',at:new Date().toISOString()}],
      location:null
    };

    const { error } = await supabaseClient.from('orders').insert([o]);
    if (error) {
      console.error('Error creating order:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      toast('حدث خطأ أثناء حفظ الطلب: ' + error.message, 'error');
      return;
    }

    form.reset();
    setReceivedAt();
    await loadOrders();
    go('sales');
    toast(`تم تسجيل الطلب بنجاح · ${o.id}`);

    // Open WhatsApp with tracking link
    const trackUrl=`${window.location.origin}/track.html?order=${o.id}`;
    const message=`مرحباً ${o.customer}، طلبك رقم ${o.id} تم تسجيله بنجاح! 📦\n\nتابع حالة طلبك هنا:\n${trackUrl}\n\nشكراً لتعاملك معنا! 🙏`;
    const whatsappUrl=`https://wa.me/${o.phone.replace(/^0/, '20')}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  });

  $('#edit_order_form').addEventListener('submit',async e=>{
    e.preventDefault();
    const form=e.currentTarget;
    if(!form.reportValidity())return;
    const data=Object.fromEntries(new FormData(form).entries());
    const orderId=data.edit_orderId;
    delete data.edit_orderId;

    // Collect device types and quantities
    const deviceTypeCheckboxes = document.querySelectorAll('#edit_order_form input[name="deviceType"]:checked');
    const deviceTypes = Array.from(deviceTypeCheckboxes).map(cb => cb.value);
    const quantities = {};
    deviceTypes.forEach(type => {
      const quantityInput = document.querySelector(`#productQuantitiesEdit input[name="quantity_${type}"]`);
      if(quantityInput) {
        quantities[type] = quantityInput.value;
      }
    });

    const o={
      customer: data.customer,
      phone: data.phone,
      address: data.address,
      maplink: data.mapLink || null,
      devicetype: deviceTypes.join(','),
      brand: data.brand,
      quantity: Object.values(quantities).reduce((sum, qty) => sum + parseInt(qty || 0), 0) || 1,
      amount: data.amount || null,
      details: data.details,
      paymentmethod: data.paymentMethod,
      paymentstatus: data.paymentStatus,
      driver: data.driver,
      driverphone: data.driverPhone || null,
      receivedat: data.receivedAt,
      notes: data.notes
    };

    const { error } = await supabaseClient.from('orders').update(o).eq('id', orderId);
    if (error) {
      console.error('Error updating order:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      toast('حدث خطأ أثناء تحديث الطلب: ' + error.message, 'error');
      return;
    }

    await loadOrders();
    go('sales');
    toast(`تم تحديث الطلب بنجاح · ${orderId}`);
  });

  loadOrders();
})();

// Pull to Refresh
let startY = 0;
let isPulling = false;
const pullThreshold = 100;

document.addEventListener('touchstart', (e) => {
  if (window.scrollY === 0) {
    startY = e.touches[0].clientY;
    isPulling = true;
  }
});

document.addEventListener('touchmove', (e) => {
  if (!isPulling) return;
  
  const currentY = e.touches[0].clientY;
  const diff = currentY - startY;
  
  if (diff > 0 && window.scrollY === 0) {
    e.preventDefault();
    const pullIndicator = document.querySelector('.pull-to-refresh') || createPullIndicator();
    pullIndicator.style.top = Math.min(diff - 60, 0) + 'px';
  }
});

document.addEventListener('touchend', (e) => {
  if (!isPulling) return;
  isPulling = false;
  
  const pullIndicator = document.querySelector('.pull-to-refresh');
  if (pullIndicator) {
    const currentTop = parseInt(pullIndicator.style.top || 0);
    if (currentTop >= -10) {
      // Trigger refresh
      pullIndicator.classList.add('active');
      location.reload();
    } else {
      pullIndicator.style.top = '-60px';
    }
  }
});

function createPullIndicator() {
  const indicator = document.createElement('div');
  indicator.className = 'pull-to-refresh';
  indicator.innerHTML = '<div class="spinner"></div>';
  document.body.appendChild(indicator);
  return indicator;
}


// Swipe Gestures for Navigation
let touchStartX = 0;
let touchEndX = 0;

document.addEventListener('touchstart', (e) => {
  touchStartX = e.changedTouches[0].screenX;
});

document.addEventListener('touchend', (e) => {
  touchEndX = e.changedTouches[0].screenX;
  handleSwipe();
});

function handleSwipe() {
  const swipeThreshold = 100;
  const diff = touchStartX - touchEndX;
  
  if (Math.abs(diff) > swipeThreshold) {
    if (diff > 0) {
      // Swipe left - next view
      const currentView = document.querySelector('.view.active');
      const allViews = document.querySelectorAll('.view');
      const currentIndex = Array.from(allViews).indexOf(currentView);
      
      if (currentIndex < allViews.length - 1) {
        const nextView = allViews[currentIndex + 1];
        const viewName = nextView.id.replace('view-', '');
        go(viewName);
      }
    } else {
      // Swipe right - previous view
      const currentView = document.querySelector('.view.active');
      const allViews = document.querySelectorAll('.view');
      const currentIndex = Array.from(allViews).indexOf(currentView);
      
      if (currentIndex > 0) {
        const prevView = allViews[currentIndex - 1];
        const viewName = prevView.id.replace('view-', '');
        go(viewName);
      }
    }
  }
}




