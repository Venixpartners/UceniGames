/* Uceni: voluntary sharing of server-awarded learning badges.
 * Does not grant badges, auto-post, tag contacts or send entered handles to Uceni.
 * Native share may send PNG; social URLs usually share text/link only.
 */
(function(root){
"use strict";
var URL_GAME="https://games.uceni.africa/";
function clean(text,n){return String(text||"").replace(/[<>\r\n]/g," ").trim().slice(0,n);}
function message(badge,handle){
  return "I earned the "+clean(badge,60)+" badge in Uceni Games! 🏅 "+
    (clean(handle,50)?clean(handle,50)+" — ":"")+
    "Think you can earn yours? Play and learn free: "+URL_GAME+
    " Educational badges only; no cash or material prizes.";
}
function picture(badge,name){
  var c=document.createElement("canvas");c.width=1080;c.height=1080;
  var x=c.getContext("2d");if(!x)throw Error("Your browser cannot generate a badge image.");
  var bg=x.createLinearGradient(0,0,1080,1080);
  bg.addColorStop(0,"#10295e");bg.addColorStop(.55,"#12748e");bg.addColorStop(1,"#179c76");
  x.fillStyle=bg;x.fillRect(0,0,1080,1080);
  x.fillStyle="#f9d976";x.beginPath();x.arc(540,425,246,0,Math.PI*2);x.fill();
  x.fillStyle="#112e62";x.beginPath();x.arc(540,425,223,0,Math.PI*2);x.fill();
  x.strokeStyle="#ffecae";x.lineWidth=8;x.beginPath();x.arc(540,425,190,0,Math.PI*2);x.stroke();
  x.textAlign="center";
  x.fillStyle="#ffffff";x.font="bold 92px sans-serif";x.fillText("UCENI GAMES",540,130,1000);
  x.fillStyle="#d9f8fa";x.font="bold 37px sans-serif";x.fillText("THE GAMIFIED LEARNING EXPERIENCE",540,196,1010);
  x.font="193px sans-serif";x.fillText("🏅",540,503,360);
  x.fillStyle="#ffe69b";x.font="bold 49px sans-serif";x.fillText("ACHIEVEMENT UNLOCKED",540,730,980);
  x.fillStyle="#fff";x.font="bold 78px sans-serif";x.fillText(clean(badge,60),540,829,960);
  x.font="40px sans-serif";x.fillText("Earned by "+clean(name||"Learner",30),540,915,970);
  x.fillStyle="#d9f1ff";x.font="28px sans-serif";x.fillText("games.uceni.africa   •   Learning badge   •   No cash value",540,1017,1030);
  return c;
}
function blob(canvas){
 return new Promise(function(resolve,reject){
  canvas.toBlob(function(b){b?resolve(b):reject(Error("Could not prepare the badge image."));},"image/png");
 });
}
function share(badge,name,handle,platform){
 var text=message(badge,handle),links={
  whatsapp:"https://wa.me/?text="+encodeURIComponent(text),
  x:"https://twitter.com/intent/tweet?text="+encodeURIComponent(text),
  telegram:"https://t.me/share/url?url="+encodeURIComponent(URL_GAME)+"&text="+encodeURIComponent(text),
  facebook:"https://www.facebook.com/sharer/sharer.php?u="+encodeURIComponent(URL_GAME),
  linkedin:"https://www.linkedin.com/sharing/share-offsite/?url="+encodeURIComponent(URL_GAME)
 };
 if(platform==="copy"){
  if(navigator.clipboard&&navigator.clipboard.writeText)
    return navigator.clipboard.writeText(text).then(function(){return "Challenge message copied.";});
  window.prompt("Copy your message:",text);
  return Promise.resolve("Copy the message into your social app.");
 }
 if(links[platform]){
  // Synchronous from click to avoid popup blockers.
  var a=document.createElement("a");a.href=links[platform];a.target="_blank";a.rel="noopener noreferrer";
  document.body.appendChild(a);a.click();a.remove();
  return Promise.resolve("Sharing link opened. Save your badge image to post the picture and tag friends in that app.");
 }
 if(platform!=="native"&&platform!=="download")return Promise.reject(Error("Unknown share option."));
 return blob(picture(badge,name)).then(function(b){
  var filename="uceni-"+clean(badge,60).toLowerCase().replace(/[^a-z0-9]+/g,"-")+".png";
  if(platform==="download"){
   var href=URL.createObjectURL(b),a=document.createElement("a");
   a.href=href;a.download=filename;document.body.appendChild(a);a.click();a.remove();
   setTimeout(function(){URL.revokeObjectURL(href);},3000);
   return "Badge PNG saved. Upload it to Instagram, TikTok, Snapchat, Stories or any platform, and tag friends there.";
  }
  if(!navigator.share)return "Native sharing isn't supported. Choose Save PNG or a social link.";
  var file=new File([b],filename,{type:"image/png"});
  if(navigator.canShare&&navigator.canShare({files:[file]}))
   return navigator.share({files:[file],title:"Uceni achievement",text:text}).then(function(){return "Share completed.";});
  return navigator.share({title:"Uceni achievement",text:text,url:URL_GAME}).then(function(){return "Share completed.";});
 });
}
root.UCENI_BADGE_SHARE={message:message,picture:picture,share:share};
})(window);
