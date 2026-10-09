// A few made-up places so a fresh copy of Orient has something on the map. They are examples, not real businesses.
// To use your own places, create public/catalog.local.js (ignored by git) that sets window.ORIENT_CATALOG the same way;
// it loads first and this file then leaves it alone.
if (!window.ORIENT_CATALOG) {
  window.ORIENT_CATALOG_SOURCE = 'sample';
  window.ORIENT_DEFAULT_PLACE = 'sample-taqueria';
  window.ORIENT_CATALOG = [
    {id:'sample-taqueria', name:'Example Taqueria', kind:'Food & drink', icon:'coffee', coordinates:[-83.5379, 41.6528], address:'Example address, Toledo, Ohio', note:'Made-up example. Taco Tuesday.', demo:true, hours:'', phone:'', sourceURL:'', retrievedAt:'',
      specials:[{title:'2-for-1 tacos', repeat:'weekly', days:['TU'], time:'', end:''}]},
    {id:'sample-coffee', name:'Example Coffee Roasters', kind:'Coffee shop', icon:'coffee', coordinates:[-83.5455, 41.6560], address:'Example address, Toledo, Ohio', note:'Made-up example.', demo:true, hours:'', phone:'', sourceURL:'', retrievedAt:''},
    {id:'sample-comics', name:'Example Comics & Games', kind:'Comic shop', icon:'book-open', coordinates:[-83.5290, 41.6490], address:'Example address, Toledo, Ohio', note:'Made-up example.', demo:true, hours:'', phone:'', sourceURL:'', retrievedAt:''},
    {id:'sample-pantry', name:'Example Neighborhood Pantry', kind:'Food pantry', icon:'utensils', coordinates:[-83.5500, 41.6430], address:'Example address, Toledo, Ohio', note:'Made-up example.', demo:true, hours:'2nd Saturday 10:00am-12:00pm', phone:'', sourceURL:'', retrievedAt:''},
  ];
}
