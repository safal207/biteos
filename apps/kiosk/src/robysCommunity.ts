export type Lang="tr"|"ru"|"en";
export type Product={id:string;name:Record<Lang,string>;priceMinor:number};
export type CommunityInput={firstId:string;secondId:string;startDay:string;duration:number;rewardLimit:number;unitCostMinor:number;budgetMinor:number};
export type Stage={id:string;day:string;title:string;draft:string;measure:string};
const DAY=86400000;
const day=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s&&s>="2020-01-01"&&s<="2099-12-01";
const int=(n:number,min:number,max:number)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const date=(n:number)=>new Date(n).toISOString().slice(0,10);
export function communityPlan(input:CommunityInput,catalog:readonly Product[],lang:Lang){
 const a=catalog.find(p=>p.id===input.firstId),b=catalog.find(p=>p.id===input.secondId);
 if(!a||!b||a.id===b.id||!["tr","ru","en"].includes(lang)||!day(input.startDay)||!int(input.duration,3,14)||!int(input.rewardLimit,1,200)||!int(input.unitCostMinor,1,1000000)||!int(input.budgetMinor,0,100000000))throw Error("Invalid plan");
 const start=Date.parse(input.startDay),end=start+input.duration*DAY;
 const labelA=a.name[lang],labelB=b.name[lang],cost=input.rewardLimit*input.unitCostMinor;
 const text={
 tr:[
 ["Hikâye","Roby’s’de küçük bir kahve molası sana ne ifade ediyor?","İçerik görüntüleme; menüye geçiş"],
 ["Soru","Bir sonraki lezzet önerimiz hangisi olsun: "+labelA+" mı, "+labelB+" mı?","Gönüllü oylar; yanıt sayısı"],
 ["Diyalog","Fikrini bizimle paylaş. Olumlu ya da olumsuz, her öneri değerli.","Yanıtlanan sorular; bağımsız geri bildirim"],
 ["Beklenti","Birlikte seçilecek lezzet için küçük bir tadım etkinliği planlıyoruz. Ayrıntılar onaydan sonra.","Duyuru görüntüleme; ilgi"],
 ["Koşullar","Taslak: "+date(start)+"–"+date(end)+" (bitiş günü hariç). İlk "+input.rewardLimit+" uygun yetişkin katılımcıya, kişi başı bir tadım; satın alma veya yorum gerekmez. Lezzet, porsiyon, uygunluk ve alerjenler onay bekliyor.","Onaylı koşullar; ödül maliyet sınırı"],
 ["Etkinlik","Koşullar onaylandıktan sonra davet metni hazırlanacak.","Katılım, verilen ödüller, maliyet"],
 ["Kapanış","Katılım süresi sona erdiğinde duyuruyu güncelle ve kalan ödülleri kaydet.","Gerçek katılım ve ödüller"],
 ["Sonuç","Katıldığınız için teşekkürler! Yalnızca doğrulanmış sayıları ve izinli fotoğrafları paylaş.","Doğrulanmış sonuçlar; fotoğraf izinleri"],
 ["Öğrenme","Bir sonraki Roby’s buluşmasında ne görmek istersiniz?","Etiketli oturumlar; doğrulanmış tekrar alışverişler"]
 ],
 ru:[
 ["История","Что для вас значит небольшая пауза за кофе в Roby’s?","Просмотры контента; переходы в меню"],
 ["Вопрос","Какой вкус предложим следующим: "+labelA+" или "+labelB+"?","Добровольные голоса; ответы"],
 ["Диалог","Поделитесь своим мнением. Любая обратная связь — положительная или критическая — важна.","Ответы гостям; независимая обратная связь"],
 ["Ожидание","Планируем небольшую дегустацию выбранного вместе вкуса. Подробности после согласования.","Просмотры анонса; интерес"],
 ["Условия","Черновик: "+date(start)+"–"+date(end)+" (день окончания не входит). Первым "+input.rewardLimit+" подходящим совершеннолетним участникам — одна дегустация на человека, без покупки и обязательного отзыва. Вкус, порция, критерии и аллергены ещё согласуются.","Согласованные условия; лимит затрат"],
 ["Акция","Текст приглашения подготовить после согласования условий.","Участники; выданные награды; расходы"],
 ["Завершение","После окончания обновить объявление и учесть оставшиеся награды.","Фактическое участие и награды"],
 ["Результаты","Спасибо за участие! Публиковать только проверенные результаты и фотографии с разрешения.","Подтверждённые результаты; согласия на фото"],
 ["Обучение","Что вы хотели бы увидеть на следующей встрече Roby’s?","Размеченные сессии; сверенные повторные покупки"]
 ],
 en:[
 ["Story","What does a little coffee break at Roby’s mean to you?","Content views; menu transitions"],
 ["Question","Which taste should we feature next: "+labelA+" or "+labelB+"?","Voluntary votes; replies"],
 ["Dialogue","Tell us what you think. Positive or critical, all feedback is welcome.","Replies to guests; independent feedback"],
 ["Anticipation","We're planning a small tasting of a flavor chosen together. Details after approval.","Announcement views; interest"],
 ["Terms","Draft: "+date(start)+"–"+date(end)+" (end day excluded). One tasting per person for the first "+input.rewardLimit+" eligible adults; no purchase or review required. Flavor, portion, eligibility and allergens await approval.","Approved terms; reward cost cap"],
 ["Event","Prepare an invitation only after all terms are approved.","Participants; rewards issued; cost"],
 ["Close","When participation closes, update the announcement and record remaining rewards.","Actual participation and rewards"],
 ["Results","Thank you for participating! Share only verified figures and photos with permission.","Verified results; photo permissions"],
 ["Learning","What would you like to see at the next Roby’s gathering?","Tagged sessions; reconciled repeat purchases"]
 ]}[lang];
 const offsets=[-7,-6,-5,-3,-1,0,input.duration,input.duration+1,input.duration+7];
 const ids=["story","question","dialogue","anticipation","terms","event","close","results","learning"];
 const stages:Stage[]=text.map(([title,draft,measure],i)=>({id:ids[i],day:date(start+offsets[i]*DAY),title,draft,measure}));
 return {schema:"biteos.robys-community-draft.v1" as const,tenantId:"robys" as const,input:{...input},language:lang,timeZone:"UTC+03:00",endExclusive:date(end),rewardCostMinor:cost,withinBudget:cost<=input.budgetMinor,requiresOwnerApproval:true,externalEffectsAuthorized:false,reviewRequiredForReward:false,stages};
}
