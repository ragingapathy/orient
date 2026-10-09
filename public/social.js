/* Shared URL recognition; finding a link never fetches its destination. */
(function(root){
 'use strict';
 const platforms=[['instagram.com','Instagram','camera'],['facebook.com','Facebook','facebook'],['x.com','X','at-sign'],['twitter.com','X','at-sign'],['tiktok.com','TikTok','music-2'],['youtube.com','YouTube','youtube'],['linkedin.com','LinkedIn','linkedin'],['bsky.app','Bluesky','cloud'],['threads.net','Threads','at-sign'],['threads.com','Threads','at-sign'],['pinterest.com','Pinterest','pin']];
 function parse(value,base){try{const u=new URL(value,base);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)return null;const host=u.hostname.toLowerCase(),p=u.pathname.replace(/\/+$/,'');const platform=platforms.find(([domain])=>host===domain||host.endsWith('.'+domain));let label,icon;
 if(platform){[,label,icon]=platform;if(!p||/^\/(?:sharer(?:\.php)?|share|intent|dialog|plugins|embed|widgets|login|home|search|watch|shorts|reel|reels|p|stories|explore|hashtag|accounts|privacy|terms)(?:\/|$)/i.test(p)||/\/status\//i.test(p))return null;
 if(/\/(?:posts|status|video|reel|reels)\//i.test(p))return null;
 if(['Instagram','X','Threads','Pinterest'].includes(label)&&!/^\/[^/]+$/.test(p))return null;
 if(label==='YouTube'&&!/^\/(?:@|channel\/|c\/|user\/)/i.test(p))return null;
 if(label==='TikTok'&&!/^\/@[^/]+$/.test(p))return null;
 if(label==='LinkedIn'&&!/^\/(?:company|in|school)\/[^/]+/i.test(p))return null;
 if(label==='Bluesky'&&!/^\/profile\/[^/]+/.test(p))return null;
 }else if(host.includes('.')&&/^\/@[^/]+$/.test(p)){label='Mastodon';icon='at-sign';}else return null;
 u.hash='';for(const key of [...u.searchParams.keys()])if(/^(?:utm_|fbclid$|igshid$|si$|ref$)/i.test(key))u.searchParams.delete(key);if(u.hostname==='twitter.com'||u.hostname==='www.twitter.com')u.hostname='x.com';u.pathname=p;return {url:u.href,label,icon};
 }catch{return null;}}
 const value={parse};if(typeof module==='object'&&module.exports)module.exports=value;else root.OrientSocial=value;
})(typeof window==='object'?window:globalThis);
