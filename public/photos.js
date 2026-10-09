/* Small private photo memories, carried with the same map backup and sync. */
'use strict';
window.OrientPhotos=(()=>{
  const MAX_IMAGE=150000,MAX_TOTAL=1800000;
  let api,dialog,placeId,editing=null,pending='',busy=false,coordinates=null,metadataFailed=false,memory=false,manualLocation=false;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function clean(raw,ids){
    const out={};let total=0;
    if(!raw||typeof raw!=='object')return out;
    for(const [id,list]of Object.entries(raw)){
      if(!ids.has(id)||!Array.isArray(list))continue;
      const seen=new Set();
      const photos=list.filter(p=>p&&typeof p.id==='string'&&p.id.length<=100&&!seen.has(p.id)&&seen.add(p.id)&&typeof p.image==='string'&&p.image.length<=MAX_IMAGE&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(p.image)).map(p=>{
        total+=p.image.length;if(total>MAX_TOTAL)throw new Error('This photo album is too large for this version of Orient.');
        return {id:p.id,image:p.image,note:String(p.note||'').slice(0,800),added:typeof p.added==='string'?p.added.slice(0,40):''};
      });
      if(photos.length)Object.defineProperty(out,id,{value:photos,enumerable:true,writable:true,configurable:true});
    }
    return out;
  }
  const list=id=>api.store().photos?.[id]||[];
  async function gps(file){
    const value=await window.exifr.gps(file);
    if(!value||!Number.isFinite(value.longitude)||!Number.isFinite(value.latitude)||Math.abs(value.longitude)>180||Math.abs(value.latitude)>85)return null;
    return [value.longitude,value.latitude];
  }
  function matches(coords,places){return places.filter(p=>!p.demo&&Array.isArray(p.coordinates)&&p.coordinates.every(Number.isFinite)).map(p=>({p,distance:OrientPlaces.distance(coords,p.coordinates)})).filter(c=>c.distance<=100).sort((a,b)=>a.distance-b.distance||a.p.name.localeCompare(b.p.name));}
  function destination(){
    const root=dialog.querySelector('[data-photo-destination]');if(!root)return;
    const places=api.places().filter(p=>!p.demo||p.id===placeId),near=coordinates?matches(coordinates,places):[];
    if(memory){
      root.innerHTML='<p class="fine">'+(coordinates?(manualLocation?'Pin will use your chosen map center.':'Pin will use the photo’s GPS location.')+' '+coordinates[1].toFixed(5)+', '+coordinates[0].toFixed(5)+'.':'This photo has no readable GPS. Center the map on the location before adding it, then use the map center.')+'</p><button type="button" class="button full" data-photo-center>'+(coordinates?'Use map center instead':'Use map center for this photo')+'</button><details class="photo-attach"><summary>Attach to an existing place instead</summary><label>Save photo to<select name="photo-destination"><option value="__new">Its own photo pin</option>'+near.map(c=>'<option value="'+esc(c.p.id)+'">'+esc(c.p.name)+' · '+Math.round(c.distance)+' m</option>').join('')+places.filter(p=>!near.some(c=>c.p.id===p.id)).map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join('')+'</select></label></details>';
      preview();return;
    }
    const ids=new Set(near.map(c=>c.p.id)),best=near[0];
    const selected=best&&best.distance<=35&&(!near[1]||near[1].distance-best.distance>=15)?best.p.id:placeId||'';
    root.innerHTML='<p class="fine">'+(coordinates?'Photo location found. GPS is approximate; check the destination before saving.':metadataFailed?'Couldn’t read a photo location. Choose where to keep it.':'No readable GPS location in this photo. Choose where to keep it.')+'</p><label>Save photo to<select name="photo-destination" required><option value="">Choose a place</option>'+(near.length?'<optgroup label="Near the photo">'+near.map(c=>'<option value="'+esc(c.p.id)+'">'+esc(c.p.name)+' · '+Math.round(c.distance)+' m</option>').join('')+'</optgroup>':'')+'<optgroup label="Your map">'+places.filter(p=>!ids.has(p.id)).sort((a,b)=>a.name.localeCompare(b.name)).map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join('')+'</optgroup>'+(coordinates?'<option value="__new">New place at this photo’s location</option>':'')+'</select></label><label data-photo-new hidden>Name this place<input name="photo-place-name" maxlength="100" placeholder="A bench, a mural, a favorite view…"></label>';
    root.querySelector('select').value=selected;
    if(coordinates&&!selected&&!near.length)root.querySelector('select').value='__new';
    newPlaceField();
  }
  function newPlaceField(){const select=dialog.querySelector('[name=photo-destination]');if(!select)return;if(memory){preview();return;}const isNew=select.value==='__new';dialog.querySelector('[data-photo-new]').hidden=!isNew;dialog.querySelector('[name=photo-place-name]').required=isNew;dialog.querySelector('.sub').textContent=isNew?'New place at the photo’s location':api.places().find(p=>p.id===select.value)?.name||'Choose where this photo belongs';}
  function hero(p){const photo=p.photoMemory?list(p.id)[0]:null;return photo?'<button class="photo-memory-hero" data-photo-edit="'+esc(photo.id)+'" data-photo-place="'+esc(p.id)+'" aria-label="Open photo memory"><img src="'+photo.image+'" alt="'+esc(photo.note||'Photo memory')+'">'+(photo.note?'<span>'+esc(photo.note)+'</span>':'')+'</button>':'';}
  function section(p){const photos=list(p.id);return '<section class="place-photos"><h3>Photos & notes</h3><p class="fine">'+(photos.length?photos.length+' photo'+(photos.length===1?'':'s'):'A detail, a view, something worth remembering.')+'</p><div class="place-photo-grid">'+photos.map(photo=>'<button class="place-photo" data-photo-edit="'+esc(photo.id)+'" data-photo-place="'+esc(p.id)+'" aria-label="'+esc(photo.note?'Open photo: '+photo.note:'Open photo')+'"><img loading="lazy" src="'+photo.image+'" alt="'+esc(photo.note||'Photo at '+p.name)+'">'+(photo.note?'<span>'+esc(photo.note)+'</span>':'')+'</button>').join('')+'</div><button class="button full" data-photo-add="'+esc(p.id)+'">Add a photo</button></section>';}
  async function compress(file){
    if(!/^image\/(jpeg|png|webp|gif|avif|heic|heif)$/.test(file.type))throw new Error('Choose an image, such as a JPEG, PNG, or WebP photo.');
    if(file.size>25*1024*1024)throw new Error('Choose a photo smaller than 25 MB.');
    const url=URL.createObjectURL(file),img=new Image();
    try{
      img.src=url;await img.decode();
      const canvas=document.createElement('canvas');let edge=1000;
      for(let step=0;step<5;step++){
        const scale=Math.min(1,edge/Math.max(img.naturalWidth,img.naturalHeight));canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
        const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
        const data=canvas.toDataURL('image/jpeg',.76-step*.08);if(data.length<=MAX_IMAGE)return data;edge=Math.round(edge*.75);
      }
      throw new Error('That image could not be made small enough. Try a smaller photo.');
    }catch(e){if(e.name==='EncodingError')throw new Error('This browser cannot read that photo format. Try a JPEG or PNG copy.');throw e;}finally{URL.revokeObjectURL(url);}
  }
  function status(message){dialog.querySelector('[data-photo-status]').textContent=message;}
  function preview(){const img=dialog.querySelector('[data-photo-preview]');img.hidden=!pending;if(pending)img.src=pending;else img.removeAttribute('src');const target=dialog.querySelector('[name=photo-destination]')?.value;dialog.querySelector('[type=submit]').disabled=!pending||busy||(memory&&!coordinates&&(!target||target==='__new'));}
  function open(id,photoId,asMemory=false){
    if(busy)return;
    const place=api.places().find(p=>p.id===id);if(id&&!place)return;
    memory=asMemory;manualLocation=false;placeId=id||null;editing=photoId||null;const photo=list(id).find(p=>p.id===editing);if(editing&&!photo)return;pending=photo?.image||'';coordinates=null;metadataFailed=false;
    if(!dialog){dialog=document.createElement('dialog');dialog.id='photo-dialog';dialog.setAttribute('aria-labelledby','photo-title');document.body.append(dialog);
      dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
      dialog.addEventListener('click',e=>{if(e.target.closest('[data-photo-center]')&&!busy){const point=api.mapCenter();if(!point){status('The map is not ready. Try again when it has loaded.');return;}coordinates=point;manualLocation=true;destination();status('Map center selected. Ready to save.');}});
      dialog.addEventListener('click',e=>{if(e.target.closest('[data-photo-close]')&&!busy)dialog.close();if(e.target.closest('[data-photo-delete]')&&!busy){const old=api.store().photos;api.store().photos={...old,[placeId]:list(placeId).filter(p=>p.id!==editing)};if(api.save()){dialog.close();api.render();}else{api.store().photos=old;status('Could not save the removal. Your photo is still here.');}}});
      dialog.addEventListener('change',async e=>{if(e.target.matches('[name=photo-destination]')){newPlaceField();return;}if(!e.target.matches('[data-photo-file]')||busy)return;const file=e.target.files[0];if(!file)return;busy=true;pending='';coordinates=null;metadataFailed=false;manualLocation=false;preview();status('Preparing your photo…');try{if(file.size>25*1024*1024)throw new Error('Choose a photo smaller than 25 MB.');try{coordinates=await gps(file);}catch{metadataFailed=true;}pending=await compress(file);destination();status('Ready to save.');}catch(error){status(error.message);}finally{busy=false;preview();e.target.value='';}});
      dialog.addEventListener('submit',e=>{
        e.preventDefault();if(busy||!pending)return;const store=api.store(),old=store.photos||{};
        let target=editing?placeId:dialog.querySelector('[name=photo-destination]')?.value,newPlace=null;
        if(target==='__new'&&coordinates){const note=dialog.querySelector('[name=photo-note]').value.trim();const name=memory?(note.split('\n')[0].slice(0,80)||'Photo memory'):dialog.querySelector('[name=photo-place-name]').value.trim();if(!name)return;newPlace={id:'local-'+crypto.randomUUID(),name:name.slice(0,100),kind:memory?'Photo memory':'Other',icon:memory?'camera':'map-pin',photoMemory:memory,coordinates:[...coordinates],address:'',note:'',demo:false};target=newPlace.id;}
        if(!target||(!newPlace&&!api.places().some(p=>p.id===target))){status('Choose a place before saving.');return;}
        const photos=list(target);
        if(!editing&&photos.length>=12){status('This place already has 12 photos. Remove one to make room.');return;}
        const photo={id:editing||'photo-'+crypto.randomUUID(),image:pending,note:dialog.querySelector('[name=photo-note]').value.trim().slice(0,800),added:photos.find(p=>p.id===editing)?.added||new Date().toISOString()};
        const next={...old,[target]:editing?photos.map(p=>p.id===editing?photo:p):[...photos,photo]};
        if(Object.values(next).flat().reduce((sum,p)=>sum+p.image.length,0)>MAX_TOTAL){status('Your photo album is full. Remove a few photos to make room.');return;}
        if(newPlace&&store.custom.length>=500){status('Your map has reached its personal place limit. Choose an existing place.');return;}
        const previous={custom:store.custom,saved:[...store.saved],osm:[...store.osm]};
        if(newPlace)store.custom=[...store.custom,newPlace];api.keep(target);store.photos=next;
        if(api.save()){dialog.close();api.select(target);api.toast(editing?'Photo note updated.':'Photo added to '+(newPlace?.name||api.places().find(p=>p.id===target)?.name||'your place')+'.');}else{store.photos=old;Object.assign(store,previous);status('Could not save your photo. Free some browser storage and try again.');}
      });
    }
    dialog.innerHTML='<form><div class="panel-heading"><h2 id="photo-title">'+(photo?'Photo & note':'A photo of this place')+'</h2><button type="button" class="icon-button" data-photo-close aria-label="Close">×</button></div><p class="sub">'+esc(place?.name||'Find a place from your photo')+'</p><img class="photo-preview" data-photo-preview alt="Photo preview" hidden>'+(!photo?'<label class="button full photo-picker">Choose a photo<input data-photo-file type="file" accept="image/*"></label><label class="button full photo-picker">Take a photo<input data-photo-file type="file" accept="image/*" capture="environment"></label>':'')+'<label>A note for this photo<textarea name="photo-note" maxlength="800" rows="3" placeholder="The quiet bench by the river. Good shade after lunch.">'+esc(photo?.note||'')+'</textarea></label><p class="fine" data-photo-status role="status"></p><p class="fine">Photos stay with your private map, including sync and backups. We save a smaller copy and leave the original untouched.</p><button type="submit" class="button primary full">'+(photo?'Save note':'Save photo')+'</button>'+(photo?'<button type="button" class="button full danger" data-photo-delete>Remove photo</button>':'')+'</form>';
    if(!photo){const root=document.createElement('div');root.dataset.photoDestination='';dialog.querySelector('[name=photo-note]').closest('label').before(root);}
    if(memory){dialog.querySelector('#photo-title').textContent='Photo + note';dialog.querySelector('.sub').textContent='A picture worth putting on your map. No name or address needed.';dialog.querySelector('[type=submit]').textContent='Save to my map';}
    preview();dialog.showModal();
  }
  return {hero,entry:()=>'<button class="button full" data-photo-add="">Add a place photo</button>',clean,section,compress,gps,matches,init:a=>{api=a;document.addEventListener('click',e=>{const add=e.target.closest('[data-photo-add]'),edit=e.target.closest('[data-photo-edit]'),quick=e.target.closest('[data-photo-memory]');if(quick){api.startMemory();open(null,null,true);}if(add)open(add.dataset.photoAdd||null);if(edit)open(edit.dataset.photoPlace,edit.dataset.photoEdit);});}};
})();
