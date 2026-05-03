var invoices=[],nextInvoiceNumber=100001,lineItemCount=0,editingIndex=-1;
var STORAGE_KEY='styledwithshimmer_invoice_data_v1';
var THEME_KEY='styledwithshimmer_theme_v1';
function formatCurrency(n){return 'P'+Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});}
function showToast(msg,type){var c=document.getElementById('toastContainer'),t=document.createElement('div');t.className='toast '+(type||'');var ic=type==='success'?'fa-check-circle':type==='error'?'fa-exclamation-circle':'fa-info-circle';var clr=type==='success'?'var(--emerald)':type==='error'?'var(--coral)':'var(--pink)';t.innerHTML='<i class="fas '+ic+'" style="color:'+clr+';font-size:16px;flex-shrink:0;"></i><span>'+msg+'</span>';c.appendChild(t);setTimeout(function(){t.style.opacity='0';t.style.transform='translateX(30px)';t.style.transition='all 0.3s ease';setTimeout(function(){t.remove();},300);},3000);}
function switchView(v){document.querySelectorAll('.view-section').forEach(function(e){e.classList.remove('active');});document.querySelectorAll('.nav-item').forEach(function(e){e.classList.remove('active');});document.getElementById('view-'+v).classList.add('active');var n=document.querySelector('[data-view="'+v+'"]');if(n)n.classList.add('active');document.getElementById('sidebar').classList.remove('open');if(v==='dashboard')refreshDashboard();if(v==='tracking')refreshTracking();if(v==='invoices')refreshAllInvoices();}
var PDF_LOGO_PATH='assets/image.jpg';
function loadImageAsDataURL(src){
  return new Promise(function(resolve,reject){
    var img=new Image();
    img.onload=function(){
      var c=document.createElement('canvas');
      c.width=img.naturalWidth||img.width;
      c.height=img.naturalHeight||img.height;
      var x=c.getContext('2d');
      if(!x){reject(new Error('Canvas context unavailable'));return;}
      x.drawImage(img,0,0);
      resolve(c.toDataURL('image/jpeg'));
    };
    img.onerror=function(){reject(new Error('Failed to load logo image'));};
    img.src=src+'?v='+(new Date().getTime());
  });
}
function persistData(){
  try{
    localStorage.setItem(STORAGE_KEY,JSON.stringify({invoices:invoices,nextInvoiceNumber:nextInvoiceNumber}));
  }catch(e){
    console.error('Failed to save data:',e);
  }
}
function loadPersistedData(){
  try{
    var raw=localStorage.getItem(STORAGE_KEY);
    if(!raw)return;
    var data=JSON.parse(raw);
    if(Array.isArray(data.invoices))invoices=data.invoices;
    if(typeof data.nextInvoiceNumber==='number'&&isFinite(data.nextInvoiceNumber)&&data.nextInvoiceNumber>0){
      nextInvoiceNumber=Math.floor(data.nextInvoiceNumber);
    }else if(invoices.length>0){
      var maxNum=invoices.reduce(function(mx,iv){
        var n=parseInt(iv.number,10);
        return isNaN(n)?mx:Math.max(mx,n);
      },100000);
      nextInvoiceNumber=maxNum+1;
    }
  }catch(e){
    console.error('Failed to load saved data:',e);
  }
}
function applyTheme(theme){
  var t=(theme==='light')?'light':'dark';
  document.body.setAttribute('data-theme',t);
  var icon=document.getElementById('themeIcon');
  var label=document.getElementById('themeLabel');
  if(icon){
    icon.className=t==='light'?'fas fa-moon':'fas fa-sun';
  }
  if(label){
    label.textContent=t==='light'?'Dark Mode':'Light Mode';
  }
}
function initTheme(){
  var stored=null;
  try{stored=localStorage.getItem(THEME_KEY);}catch(_e){stored=null;}
  var preferred=stored||(window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');
  applyTheme(preferred);
  var btn=document.getElementById('themeToggle');
  if(btn){
    btn.addEventListener('click',function(){
      var current=document.body.getAttribute('data-theme')||'dark';
      var next=current==='dark'?'light':'dark';
      applyTheme(next);
      try{localStorage.setItem(THEME_KEY,next);}catch(_e){}
    });
  }
}

var scI=null,mcI=null;
function refreshDashboard(){
  var t=invoices.length,ta=0,p=0,pa=0,u=0;
  invoices.forEach(function(i){
    ta+=i.total;
    if(i.status==='paid')p++;else if(i.status==='partial')pa++;else u++;
  });

  var o=pa+u;
  document.getElementById('dashTotalInv').textContent=t;
  document.getElementById('dashTotalAmt').textContent=formatCurrency(ta);
  document.getElementById('dashPaid').textContent=p;
  document.getElementById('dashOutstanding').textContent=o;
  document.getElementById('dashFullyPaid').textContent=p;
  document.getElementById('dashPartial').textContent=pa;
  document.getElementById('dashUnpaid').textContent=u;

  var pp=t>0?(p/t*100):0,pap=t>0?(pa/t*100):0,up=t>0?(u/t*100):0;
  document.getElementById('dashPaidBar').style.width=pp+'%';
  document.getElementById('dashPartialBar').style.width=pap+'%';
  document.getElementById('dashUnpaidBar').style.width=up+'%';
  document.getElementById('dashYear').textContent=new Date().getFullYear();

  var hd=t>0;
  document.getElementById('statusChartEmpty').style.display=hd?'none':'flex';
  document.getElementById('monthlyChartEmpty').style.display=hd?'none':'flex';

  var mm={},mn=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  invoices.forEach(function(i){
    var d=new Date(i.date);
    var k=d.getFullYear()+'-'+String(d.getMonth()).padStart(2,'0');
    if(!mm[k])mm[k]={l:mn[d.getMonth()]+' '+d.getFullYear(),inv:0,pd:0};
    mm[k].inv+=i.total;
    if(i.status==='paid')mm[k].pd+=i.total;
    else if(i.status==='partial')mm[k].pd+=i.total*0.5;
  });

  var sm=Object.keys(mm).sort();
  var ml=sm.map(function(k){return mm[k].l;}),mi=sm.map(function(k){return mm[k].inv;}),mp=sm.map(function(k){return mm[k].pd;});

  if(typeof Chart!=='undefined'){
    if(scI)scI.destroy();
    scI=new Chart(document.getElementById('statusChart').getContext('2d'),{
      type:'doughnut',
      data:{
        labels:['Fully Paid','Partially Paid','Unpaid'],
        datasets:[{data:hd?[p,pa,u]:[0,0,0],backgroundColor:['#3ecf8e','#f0b429','#e8614d'],borderColor:['rgba(62,207,142,0.3)','rgba(240,180,41,0.3)','rgba(232,97,77,0.3)'],borderWidth:2,hoverOffset:8}]
      },
      options:{responsive:true,maintainAspectRatio:false,cutout:'68%',plugins:{legend:{position:'bottom',labels:{color:'#7a7888',font:{family:'DM Sans',size:12,weight:'600'},padding:16,usePointStyle:true,pointStyleWidth:10}},tooltip:{backgroundColor:'#14141e',titleColor:'#e8e6e1',bodyColor:'#e8e6e1',borderColor:'#2a2a3a',borderWidth:1,cornerRadius:8,padding:12}},animation:{animateRotate:true,duration:800}}
    });

    if(mcI)mcI.destroy();
    mcI=new Chart(document.getElementById('monthlyChart').getContext('2d'),{
      type:'bar',
      data:{
        labels:hd?ml:mn,
        datasets:[
          {label:'Invoiced',data:hd?mi:Array(12).fill(0),backgroundColor:'rgba(212,115,138,0.7)',borderColor:'rgba(212,115,138,1)',borderWidth:1,borderRadius:4,barPercentage:0.4,categoryPercentage:0.7},
          {label:'Collected',data:hd?mp:Array(12).fill(0),backgroundColor:'rgba(62,207,142,0.7)',borderColor:'rgba(62,207,142,1)',borderWidth:1,borderRadius:4,barPercentage:0.4,categoryPercentage:0.7}
        ]
      },
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:'#7a7888',font:{family:'DM Sans',size:12,weight:'600'},padding:16,usePointStyle:true,pointStyleWidth:10}},tooltip:{backgroundColor:'#14141e',titleColor:'#e8e6e1',bodyColor:'#e8e6e1',borderColor:'#2a2a3a',borderWidth:1,cornerRadius:8,padding:12,callbacks:{label:function(c){return c.dataset.label+': '+formatCurrency(c.parsed.y);}}}},scales:{x:{grid:{color:'rgba(42,42,58,0.3)',drawBorder:false},ticks:{color:'#7a7888',font:{family:'DM Sans',size:11,weight:'600'}}},y:{grid:{color:'rgba(42,42,58,0.3)',drawBorder:false},ticks:{color:'#7a7888',font:{family:'DM Sans',size:11},callback:function(v){return 'P'+(v/1000)+'k';}},beginAtZero:true}},animation:{duration:800}}
    });
  }else{
    if(scI){scI.destroy();scI=null;}
    if(mcI){mcI.destroy();mcI=null;}
  }

  var tb=document.getElementById('dashRecentTable');
  tb.innerHTML='';
  var re=document.getElementById('dashRecentEmpty');
  if(invoices.length===0){
    re.style.display='block';
  }else{
    re.style.display='none';
    invoices.slice().reverse().slice(0,10).forEach(function(i){
      var tr=document.createElement('tr');
      var bc=i.status==='paid'?'badge-paid':i.status==='partial'?'badge-partial':'badge-unpaid';
      var bt=i.status==='paid'?'Paid':i.status==='partial'?'Partial':'Unpaid';
      tr.innerHTML='<td style="font-weight:700;color:var(--pink);">'+i.number+'</td><td style="font-weight:600;">'+i.client+'</td><td>'+new Date(i.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})+'</td><td>'+formatCurrency(i.total)+'</td><td><span class="badge '+bc+'"><span class="badge-dot"></span>'+bt+'</span></td>';
      tb.appendChild(tr);
    });
  }
}

function refreshTracking(){var tb=document.getElementById('trackingBody');tb.innerHTML='';var e=document.getElementById('trackingEmpty');if(invoices.length===0){e.style.display='block';}else{e.style.display='none';invoices.forEach(function(iv,idx){var tr=document.createElement('tr');var tp=0;var py=iv.payments||[];var h='<td style="font-weight:700;color:var(--pink);">'+iv.number+'</td><td style="font-weight:600;">'+iv.client+'</td><td>'+(iv.serviceType||'General')+'</td><td style="font-weight:600;">'+formatCurrency(iv.total)+'</td>';for(var p=0;p<5;p++){var pt=py[p]||{date:'',amount:0};var ms=pt.date&&pt.amount===0&&new Date(pt.date)<new Date();tp+=pt.amount||0;h+='<td'+(ms?' class="cell-highlight"':'')+'>'+(pt.date||'--')+'</td>';h+='<td'+(ms?' class="cell-highlight"':'')+'>'+(pt.amount>0?formatCurrency(pt.amount):'--')+'</td>';}var bl=iv.total-tp;h+='<td style="font-weight:700;color:'+(bl>0?'var(--coral)':'var(--emerald)')+';">'+formatCurrency(bl)+'</td>';h+='<td><button class="btn-action btn-action-delete" onclick="deleteInvoice('+idx+')" title="Delete"><i class="fas fa-trash-alt"></i></button></td>';tr.innerHTML=h;tb.appendChild(tr);});}}

function refreshAllInvoices(){var tb=document.getElementById('allInvoicesBody');tb.innerHTML='';var e=document.getElementById('allInvoicesEmpty');if(invoices.length===0){e.style.display='block';}else{e.style.display='none';invoices.forEach(function(iv,idx){var tr=document.createElement('tr');var bc=iv.status==='paid'?'badge-paid':iv.status==='partial'?'badge-partial':'badge-unpaid';var bt=iv.status==='paid'?'Paid':iv.status==='partial'?'Partial':'Unpaid';tr.innerHTML='<td style="font-weight:700;color:var(--pink);">'+iv.number+'</td><td style="font-weight:600;">'+iv.client+'</td><td>'+new Date(iv.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})+'</td><td>'+iv.items.length+'</td><td style="font-weight:700;">'+formatCurrency(iv.total)+'</td><td><span class="badge '+bc+'"><span class="badge-dot"></span>'+bt+'</span></td><td style="text-align:center;"><div style="display:flex;gap:6px;justify-content:center;"><button class="btn-action btn-action-edit" onclick="editInvoiceFromList('+idx+')" title="Edit"><i class="fas fa-pen"></i> Edit</button><button class="btn-action btn-action-pdf" onclick="downloadInvoicePDF('+idx+')" title="Download PDF"><i class="fas fa-download"></i> PDF</button><button class="btn-action btn-action-delete" onclick="deleteInvoice('+idx+')" title="Delete"><i class="fas fa-trash-alt"></i></button></div></td>';tb.appendChild(tr);});}}

function deleteInvoice(idx){if(idx>=0&&idx<invoices.length){var n=invoices[idx].number;invoices.splice(idx,1);persistData();showToast('Invoice #'+n+' deleted','error');var av=document.querySelector('.view-section.active');if(av){var id=av.id.replace('view-','');if(id==='dashboard')refreshDashboard();else if(id==='tracking')refreshTracking();else if(id==='invoices')refreshAllInvoices();}}}
function editInvoiceFromList(idx){if(idx<0||idx>=invoices.length)return;var iv=invoices[idx];editingIndex=idx;document.getElementById('editBanner').classList.add('active');document.getElementById('editBannerNum').textContent=iv.number;switchView('create');document.getElementById('invNumber').value=iv.number;document.getElementById('invDate').value=iv.date;document.getElementById('invClient').value=iv.client;document.getElementById('invStatus').value=iv.status;document.getElementById('invNotes').value=iv.notes||'';document.getElementById('lineItems').innerHTML='';lineItemCount=0;iv.items.forEach(function(it){addLineItem(it.description,it.qty,it.price);});updatePreview();showToast('Editing Invoice #'+iv.number,'info');}
function cancelEdit(){editingIndex=-1;document.getElementById('editBanner').classList.remove('active');clearForm();showToast('Edit cancelled','info');}

function addLineItem(d,q,p){lineItemCount++;var id=lineItemCount;var c=document.getElementById('lineItems');var dv=document.createElement('div');dv.className='line-item-row';dv.id='lineItem-'+id;dv.style.cssText='display:grid;grid-template-columns:1fr 70px 100px 40px;gap:10px;margin-bottom:10px;animation:slideInUp 0.3s ease;';dv.innerHTML='<input class="form-input item-desc" placeholder="Description" value="'+(d||'')+'" oninput="updatePreview()"><input class="form-input item-qty" type="number" min="1" value="'+(q||1)+'" oninput="updatePreview()"><input class="form-input item-price" type="number" min="0" step="0.01" value="'+(p||'')+'" oninput="updatePreview()"><button onclick="removeLineItem('+id+')" style="background:var(--coral-dim);color:var(--coral);border:none;border-radius:10px;cursor:pointer;font-size:14px;transition:all 0.2s;" onmouseover="this.style.background=\'rgba(232,97,77,0.3)\'" onmouseout="this.style.background=\'var(--coral-dim)\'"><i class="fas fa-trash-alt"></i></button>';c.appendChild(dv);updatePreview();}
function removeLineItem(id){var e=document.getElementById('lineItem-'+id);if(e){e.style.opacity='0';e.style.transform='translateX(20px)';e.style.transition='all 0.2s ease';setTimeout(function(){e.remove();updatePreview();},200);}}

function updatePreview(){document.getElementById('previewInvNum').textContent=document.getElementById('invNumber').value||'--';document.getElementById('previewClient').textContent=document.getElementById('invClient').value||'Client Name';var dv=document.getElementById('invDate').value;document.getElementById('previewDate').textContent=dv?new Date(dv+'T00:00:00').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}):'--';var its=document.querySelectorAll('.line-item-row');var tb=document.getElementById('previewItems');tb.innerHTML='';var st=0;its.forEach(function(it){var d=it.querySelector('.item-desc').value||'Item';var q=parseFloat(it.querySelector('.item-qty').value)||0;var p=parseFloat(it.querySelector('.item-price').value)||0;var t=q*p;st+=t;var tr=document.createElement('tr');tr.innerHTML='<td style="font-weight:600;">'+d+'</td><td style="text-align:center;">'+q+'</td><td style="text-align:right;">'+formatCurrency(p)+'</td><td style="text-align:right;font-weight:700;">'+formatCurrency(t)+'</td>';tb.appendChild(tr);});if(its.length===0){tb.innerHTML='<tr><td colspan="4" style="text-align:center;color:#ccc;padding:24px;">No items added yet</td></tr>';}var tx=0,ds=0,tt=st+tx-ds;document.getElementById('previewSubtotal').textContent=formatCurrency(st);document.getElementById('previewTax').textContent=formatCurrency(tx);document.getElementById('previewDiscount').textContent='- '+formatCurrency(ds);document.getElementById('previewTotal').textContent=formatCurrency(tt);var nt=document.getElementById('invNotes').value;document.getElementById('previewNotes').innerHTML=nt?'<i class="fas fa-sticky-note"></i>'+nt:'<i class="fas fa-info-circle"></i>Payment is due within 30 days of invoice date.';}

function saveInvoice(){var cl=document.getElementById('invClient').value.trim();if(!cl){showToast('Please enter a client name','error');document.getElementById('invClient').focus();return;}var dt=document.getElementById('invDate').value;if(!dt){showToast('Please select a date','error');document.getElementById('invDate').focus();return;}var ir=document.querySelectorAll('.line-item-row');if(ir.length===0){showToast('Add at least one line item','error');return;}var its=[],st=0,hv=false;ir.forEach(function(r){var d=r.querySelector('.item-desc').value.trim()||'Item';var q=parseFloat(r.querySelector('.item-qty').value)||0;var p=parseFloat(r.querySelector('.item-price').value)||0;var lt=q*p;if(q>0&&p>0)hv=true;its.push({description:d,qty:q,price:p,total:lt});st+=lt;});if(!hv){showToast('At least one item must have qty and price > 0','error');return;}var num=document.getElementById('invNumber').value,st2=document.getElementById('invStatus').value,nt=document.getElementById('invNotes').value.trim();var py=[];if(st2==='paid'){py.push({date:dt,amount:st});for(var i=1;i<5;i++)py.push({date:'',amount:0});}else if(st2==='partial'){var h=Math.round(st/2*100)/100;py.push({date:dt,amount:h});for(var i=1;i<5;i++)py.push({date:'',amount:0});}else{for(var i=0;i<5;i++)py.push({date:'',amount:0});}var d={number:num,client:cl,date:dt,status:st2,items:its,subtotal:st,tax:0,discount:0,total:st,notes:nt,serviceType:its.length>0?its[0].description:'General',payments:py};if(editingIndex>=0&&editingIndex<invoices.length){invoices[editingIndex]=d;persistData();showToast('Invoice #'+num+' updated','success');editingIndex=-1;document.getElementById('editBanner').classList.remove('active');}else{invoices.push(d);nextInvoiceNumber++;persistData();showToast('Invoice #'+num+' saved','success');}clearForm();}
function clearForm(){document.getElementById('invClient').value='';document.getElementById('invNotes').value='';document.getElementById('invStatus').value='unpaid';document.getElementById('lineItems').innerHTML='';lineItemCount=0;editingIndex=-1;document.getElementById('editBanner').classList.remove('active');document.getElementById('invNumber').value=String(nextInvoiceNumber).padStart(6,'0');document.getElementById('invDate').value=new Date().toISOString().split('T')[0];updatePreview();}

/* ========== PDF DOWNLOAD — robust blob approach ========== */
async function downloadInvoicePDF(idx){
  if(idx<0||idx>=invoices.length)return;
  var inv=invoices[idx];
  try{
    var jsPDF=window.jspdf.jsPDF;
    var doc=new jsPDF({orientation:'portrait',unit:'mm',format:[148,210]});

    /* Build PDF content */
    var logoDataURL=null;
    try{logoDataURL=await loadImageAsDataURL(PDF_LOGO_PATH);}catch(_e){logoDataURL=null;}
    if(logoDataURL){
      doc.addImage(logoDataURL,'JPEG',11,9,14,14,undefined,'FAST');
    }else{
      doc.setFillColor(212,115,138);doc.circle(18,16,7,'F');
      doc.setFontSize(11);doc.setFont('helvetica','bold');doc.setTextColor(255,255,255);doc.text('S',18,19.2,{align:'center'});
    }
    doc.setFontSize(14);doc.setFont('helvetica','bold');doc.setTextColor(26,26,26);doc.text('StyledWithShimmer',28,14);
    doc.setFontSize(6.5);doc.setFont('helvetica','bold');doc.setTextColor(212,115,138);doc.text('DIGITAL PRINTING SERVICES',28,18.5);
    doc.setFontSize(6.5);doc.setFont('helvetica','normal');doc.setTextColor(119,119,119);
    doc.text('T. Alonzo St. Poblacion, Madridejos (Bantayan Island), Cebu',28,22.5);
    doc.text('0998 336 7889  |  styledwithshimmer@gmail.com',28,26);
    doc.setFontSize(22);doc.setFont('helvetica','bold');doc.setTextColor(26,26,26);doc.text('INVOICE',136,14,{align:'right'});
    doc.setFontSize(6.5);doc.setFont('helvetica','normal');doc.setTextColor(153,153,153);doc.text('INVOICE #',136,19,{align:'right'});
    doc.setFontSize(12);doc.setFont('helvetica','bold');doc.setTextColor(212,115,138);doc.text(inv.number,136,24,{align:'right'});
    doc.setDrawColor(232,228,223);doc.setLineWidth(0.3);doc.line(12,30,136,30);
    doc.setFontSize(6.5);doc.setFont('helvetica','bold');doc.setTextColor(170,170,170);doc.text('BILL TO',12,37);
    doc.setFontSize(11);doc.setFont('helvetica','bold');doc.setTextColor(26,26,26);doc.text(inv.client,12,42);
    doc.setFontSize(6.5);doc.setFont('helvetica','bold');doc.setTextColor(170,170,170);doc.text('DATE',136,37,{align:'right'});
    doc.setFontSize(10);doc.setFont('helvetica','normal');doc.setTextColor(26,26,26);
    doc.text(new Date(inv.date+'T00:00:00').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}),136,42,{align:'right'});

    var tY=50;doc.setFillColor(245,242,237);doc.rect(12,tY,124,7,'F');
    doc.setFontSize(6.5);doc.setFont('helvetica','bold');doc.setTextColor(136,136,136);
    doc.text('DESCRIPTION',16,tY+5);doc.text('QTY',88,tY+5,{align:'center'});doc.text('UNIT PRICE',110,tY+5,{align:'right'});doc.text('TOTAL',133,tY+5,{align:'right'});

    var rY=tY+11;doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(51,51,51);
    inv.items.forEach(function(it){
      var d=it.description.length>28?it.description.substring(0,28)+'...':it.description;
      doc.text(d,16,rY);doc.text(String(it.qty),88,rY,{align:'center'});doc.text(formatCurrency(it.price),110,rY,{align:'right'});
      doc.setFont('helvetica','bold');doc.text(formatCurrency(it.total),133,rY,{align:'right'});doc.setFont('helvetica','normal');
      doc.setDrawColor(238,238,238);doc.setLineWidth(0.15);doc.line(12,rY+2.5,136,rY+2.5);rY+=7;
    });

    rY+=4;doc.setFontSize(9);
    doc.setFont('helvetica','normal');doc.setTextColor(136,136,136);doc.text('Subtotal',100,rY,{align:'right'});doc.setTextColor(51,51,51);doc.setFont('helvetica','bold');doc.text(formatCurrency(inv.subtotal),133,rY,{align:'right'});
    rY+=6;doc.setFont('helvetica','normal');doc.setTextColor(136,136,136);doc.text('Tax',100,rY,{align:'right'});doc.setTextColor(51,51,51);doc.setFont('helvetica','bold');doc.text(formatCurrency(inv.tax||0),133,rY,{align:'right'});
    rY+=6;doc.setFont('helvetica','normal');doc.setTextColor(136,136,136);doc.text('Discount',100,rY,{align:'right'});doc.setTextColor(51,51,51);doc.setFont('helvetica','bold');doc.text('- '+formatCurrency(inv.discount||0),133,rY,{align:'right'});
    rY+=3;doc.setDrawColor(26,26,26);doc.setLineWidth(0.4);doc.line(12,rY,136,rY);
    rY+=6;doc.setFontSize(10);doc.setFont('helvetica','bold');doc.setTextColor(26,26,26);doc.text('TOTAL',100,rY,{align:'right'});doc.setFontSize(14);doc.text(formatCurrency(inv.total),133,rY,{align:'right'});
    rY+=8;doc.setFillColor(249,247,244);doc.roundedRect(12,rY,124,14,2,2,'F');
    doc.setFontSize(7);doc.setFont('helvetica','normal');doc.setTextColor(136,136,136);doc.text(inv.notes||'Payment is due within 30 days of invoice date.',16,rY+6,{maxWidth:116});
    doc.setFillColor(26,26,40);doc.rect(0,196,148,14,'F');
    doc.setFontSize(6);doc.setFont('helvetica','normal');doc.setTextColor(200,200,200);doc.text('Thank you for your business',12,204);
    doc.setFont('helvetica','bold');doc.setTextColor(212,115,138);doc.text('StyledWithShimmer',136,204,{align:'right'});

    /* === Robust download: blob → object URL → anchor click === */
    var blob = doc.output('blob');
    var blobUrl = URL.createObjectURL(blob);
    var fileName = 'Invoice_' + inv.number + '.pdf';

    var anchor = document.createElement('a');
    anchor.style.display = 'none';
    anchor.href = blobUrl;
    anchor.download = fileName;
    anchor.setAttribute('target', '_blank');

    // Must append to body for Firefox
    document.body.appendChild(anchor);

    // Use click() to trigger the download
    anchor.click();

    // Cleanup after a short delay
    setTimeout(function() {
      document.body.removeChild(anchor);
      URL.revokeObjectURL(blobUrl);
    }, 250);

    showToast('Downloading: ' + fileName, 'success');
  }catch(e){
    showToast('PDF error: '+e.message,'error');
    console.error('PDF generation error:',e);
  }
}

/* INIT */
document.addEventListener('DOMContentLoaded',function(){
  initTheme();
  loadPersistedData();
  document.getElementById('invNumber').value=String(nextInvoiceNumber).padStart(6,'0');
  document.getElementById('invDate').value=new Date().toISOString().split('T')[0];
  ['invClient','invDate','invNotes','invStatus'].forEach(function(id){document.getElementById(id).addEventListener('input',updatePreview);});
  refreshDashboard();
  function cm(){var t=document.getElementById('mobileToggle');if(window.innerWidth<=1024)t.style.display='flex';else{t.style.display='none';document.getElementById('sidebar').classList.remove('open');}}
  cm();window.addEventListener('resize',cm);
  document.querySelectorAll('.stat-card').forEach(function(c){var g=document.createElement('div');g.className='sparkle-grid';for(var s=0;s<5;s++){var d=document.createElement('div');d.className='sparkle';d.style.left=(Math.random()*100)+'%';d.style.top=(Math.random()*100)+'%';d.style.animationDelay=(Math.random()*3)+'s';d.style.animationDuration=(2+Math.random()*3)+'s';g.appendChild(d);}c.appendChild(g);});
  updatePreview();
});
