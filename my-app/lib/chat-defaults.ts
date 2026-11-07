// Seeded Maya config and topics. Used when the tables are empty or unreadable, so the
// guided assistant works before any admin edit.
//
// Sinhala copy needs the owner's review.
//
// Answer syntax (see fillFacts in lib/chat-guided.ts):
//  - {name} is replaced by a shop fact; a sentence with a fact that is missing is dropped.
//  - A line or sentence that starts with [feature] is kept only while that feature is on.
// Nothing here may promise something the shop does not do (no new-arrival alerts, no urgency).
import {
  DEFAULT_ACCENT,
  DEFAULT_ASSISTANT_NAME,
  DEFAULT_FIRST_MESSAGE,
  DEFAULT_GREETING,
  type ChatConfig,
  type ChatFeature,
  type ChatTopic,
} from "./chat";

type Seed = Omit<ChatTopic, "sortOrder" | "visible" | "requires"> & { requires?: ChatFeature };

const link = (si: string, en: string, href: string) => ({ label: { si, en }, href });

const SEEDS: Seed[] = [
  {
    id: "checkout",
    title: { si: "Checkout කරන හැටි", en: "How to check out" },
    keywords: ["checkout", "check out", "order", "buy", "how to order", "kohomada order", "ගන්නේ", "ඇණවුම", "ඕඩර්", "ඕඩර් කරන්නේ"],
    answer: {
      si: "Checkout කරන්න ලේසියි:\n1) ඔයාට ඕන භාණ්ඩ size එකත් එක්ක කරත්තයට දාන්න.\n2) කරත්තයෙන් Checkout ඔබන්න (ගිණුමකින් ඇතුළු වෙන්න ඕන).\n3) නම, දුරකථන අංකය, ලිපිනය සහ දිස්ත්‍රික්කය ඇතුල් කරන්න.\n4) ගෙවන විදිහ තෝරලා Place order ඔබන්න.",
      en: "Checking out is easy:\n1) Add the items you want, with your size, to the cart.\n2) Press Checkout in the cart (you need to be signed in).\n3) Enter your name, phone number, address and district.\n4) Choose how to pay and press Place order.",
    },
    links: [link("කරත්තය", "Cart", "/cart"), link("Checkout", "Checkout", "/checkout")],
    followUps: ["payment", "delivery"],
  },
  {
    id: "payment",
    title: { si: "ගෙවන විදිහ", en: "How to pay" },
    keywords: ["pay", "payment", "cod", "cash on delivery", "ගෙවන්න", "ගෙවීම", "ගෙවන්නේ", "salli", "gewanna", "kohomada gewanne"],
    answer: {
      si: "බඩු ලැබෙන විට ගෙවන්න පුළුවන් (Cash on delivery).\n[card] කාඩ්පතකින් ඔන්ලයින් ගෙවන්නත් පුළුවන්.\n[advance] සමහර ඇණවුම් වලට කුඩා advance එකක් බැංකු මාරුවකින් ගෙවිය යුතුයි.",
      en: "You can pay when your order arrives (cash on delivery).\n[card] You can also pay online by card.\n[advance] Some orders need a small advance by bank transfer.",
    },
    links: [link("Checkout", "Checkout", "/checkout")],
    followUps: ["payment-card", "advance", "delivery"],
  },
  {
    id: "payment-card",
    title: { si: "කාඩ්පතකින් ගෙවීම", en: "Paying by card" },
    keywords: ["card", "visa", "master", "online payment", "payhere", "කාඩ්", "කාඩ්පත", "ඔන්ලයින් ගෙවීම"],
    requires: "card",
    answer: {
      si: "ඇණවුම place කළාම ඇණවුම් පිටුවේ 'දැන් ඔන්ලයින් ගෙවන්න' ඔබලා PayHere හරහා ආරක්ෂිතව කාඩ්පතකින් ගෙවන්න පුළුවන්. ගෙවීම සාර්ථක වුණාම ඇණවුම ඉබේම තහවුරු වෙනවා.",
      en: "After you place the order, press 'Pay online now' on the order page to pay by card, securely through PayHere. When the payment succeeds, your order is confirmed automatically.",
    },
    links: [link("මගේ ඇණවුම්", "My orders", "/orders")],
    followUps: ["payment", "tracking"],
  },
  {
    id: "advance",
    title: { si: "Advance ගෙවීම", en: "Advance payment" },
    keywords: ["advance", "bank", "transfer", "slip", "qr", "බැංකු", "බැංකුව", "ස්ලිප්", "slip upload"],
    requires: "advance",
    answer: {
      si: "සමහර ඇණවුම් වලට (විශේෂයෙන් අලුත් ගනුදෙනුකරුවන්ට) කුඩා advance එකක් බැංකු මාරුවකින් ගෙවිය යුතුයි. ඉතිරිය බඩු ලැබෙන විට ගෙවන්න. ඇණවුම place කළාම ඇණවුම් පිටුවේ බැංකු විස්තර, QR සහ slip එක upload කරන තැන තියෙනවා.",
      en: "Some orders (especially for new customers) need a small advance by bank transfer. The rest is paid when the order arrives. After you place the order, the order page shows the bank details, the QR code and where to upload your slip.",
    },
    links: [link("මගේ ඇණවුම්", "My orders", "/orders")],
    followUps: ["payment", "trust"],
  },
  {
    id: "delivery",
    title: { si: "Delivery ගාස්තුව", en: "Delivery fee" },
    keywords: ["delivery", "shipping", "ship", "fee", "charge", "courier", "බෙදාහැරීම", "ගාස්තුව", "ඩිලිවරි", "ගෙන්නන්නේ"],
    answer: {
      si: "Delivery ගාස්තුව {shippingFee} වගේ. ඔයාගේ දිස්ත්‍රික්කය අනුව නිවැරදි ගාස්තුව Checkout එකේදී පෙනෙනවා.\n{freeShippingFrom} ට වැඩි ඇණවුම් වලට delivery නොමිලේ.",
      en: "Delivery is about {shippingFee}. The exact fee for your district shows at Checkout.\nOrders over {freeShippingFrom} ship free.",
    },
    links: [link("Checkout", "Checkout", "/checkout")],
    followUps: ["tracking", "returns"],
  },
  {
    id: "tracking",
    title: { si: "Delivery status දැනගන්නේ", en: "Tracking your order" },
    keywords: ["track", "tracking", "status", "delivery status", "order status", "track order", "where is my order", "parcel", "කොහෙද", "ඇණවුම කොහෙද", "ට්‍රැක්", "parcel eka"],
    answer: {
      si: "ඔයාගේ ඇණවුමේ තත්ත්වය ඕන වෙලාවක 'මගේ ඇණවුම්' පිටුවෙන් බලන්න පුළුවන්.\nඇණවුම ship වුණාම courier නම, tracking අංකය සහ tracking link එක ඒ පිටුවේම පෙනෙනවා.",
      en: "You can check your order's status any time on the My orders page.\nOnce it ships, the courier, tracking number and a tracking link appear on that page.",
    },
    links: [link("මගේ ඇණවුම්", "My orders", "/orders")],
    followUps: ["notifications", "cancel"],
  },
  {
    id: "notifications",
    title: { si: "Notifications on කිරීමේ ප්‍රයෝජන", en: "Why turn notifications on" },
    keywords: ["notification", "notifications", "alert", "sms", "email", "push", "දැනුම්", "නොටිෆිකේෂන්", "message", "දැනුම් දීම"],
    answer: {
      si: "ඇණවුම ගැන දැනගන්න ඔයාට නිතර අඩවියට එන්න ඕන නෑ.\n[sms] ඇණවුම place වුණාම, ship වුණාම, deliver වුණාම SMS එකක් එනවා.\n[email] ඊමේල් එකකුත් එනවා.\n[push] ගිණුම් පිටුවේ notifications on කළොත් ඔයාගේ phone/browser එකටත් දැනුම් එනවා.",
      en: "You don't have to keep checking the site for your order.\n[sms] You get an SMS when your order is placed, shipped and delivered.\n[email] You also get an email.\n[push] Turn on notifications on your account page and they reach your phone or browser too.",
    },
    links: [link("මගේ ගිණුම", "My account", "/account"), link("මගේ ඇණවුම්", "My orders", "/orders")],
    followUps: ["tracking"],
  },
  {
    id: "new-arrivals",
    title: { si: "අලුත් භාණ්ඩ", en: "New arrivals" },
    keywords: ["new", "new in", "arrival", "arrivals", "latest", "අලුත්", "අලුතින්", "අලුත් භාණ්ඩ", "aluth"],
    answer: {
      si: "අලුතින් එකතු වුණු භාණ්ඩ 'අලුතින් ආ' පිටුවේ තියෙනවා. එතනින් නිතර බලන්න.",
      en: "Newly added items are on the New In page. Check it from time to time.",
    },
    links: [link("අලුතින් ආ", "New In", "/products?view=new"), link("Flash Deals", "Flash Deals", "/products?view=deals")],
    followUps: ["size-guide", "checkout"],
  },
  {
    id: "returns",
    title: { si: "Return කිරීම", en: "Returns" },
    keywords: ["return", "refund", "exchange", "ආපසු", "ආපසු දෙන්න", "මුදල් ආපසු", "ripta", "return policy"],
    answer: {
      si: "Return කරන්න පුළුවන් {returnDays} දවසක් ඇතුළත.\nසම්පූර්ණ කොන්දේසි Returns පිටුවේ තියෙනවා.",
      en: "You can return items within {returnDays} days.\nThe full conditions are on the Returns page.",
    },
    links: [link("Returns", "Returns", "/returns")],
    followUps: ["trust", "contact"],
  },
  {
    id: "size-guide",
    title: { si: "Size guide", en: "Size guide" },
    keywords: ["size", "sizes", "fit", "measurement", "chart", "සයිස්", "size guide", "ප්‍රමාණය", "sizing"],
    answer: {
      si: "සයිස් තෝරගන්න ආධාර වෙන්න Size guide එකක් තියෙනවා. භාණ්ඩ පිටුවේ size එක ළඟත් link එකක් තියෙනවා.",
      en: "There is a size guide to help you pick. You will also find a link next to the sizes on each product page.",
    },
    links: [link("Size guide", "Size guide", "/size-guide")],
    followUps: ["checkout", "returns"],
  },
  {
    id: "cancel",
    title: { si: "ඇණවුම cancel කිරීම", en: "Cancelling an order" },
    keywords: ["cancel", "cancel order", "change order", "අවලංගු", "අවලංගු කරන්න", "cancel karanna"],
    answer: {
      si: "ඇණවුම තවම තහවුරු කර නැත්නම් ඇණවුම් පිටුවෙන්ම cancel කරන්න පුළුවන්.\nඊට පස්සේ නම් අපව අමතන්න.\nඅපේ දුරකථන අංකය {phone}.",
      en: "While your order is still waiting for confirmation, you can cancel it from the order page.\nAfter that, please contact us.\nOur phone number is {phone}.",
    },
    links: [link("මගේ ඇණවුම්", "My orders", "/orders"), link("අප අමතන්න", "Contact", "/contact")],
    followUps: ["contact", "returns"],
  },
  {
    id: "points",
    title: { si: "Points", en: "Points" },
    keywords: ["points", "loyalty", "reward", "rewards", "පොයින්ට්", "ලකුණු", "pointsla"],
    requires: "points",
    answer: {
      si: "ඇණවුම deliver වුණාම ඔයාට points ලැබෙනවා. Checkout එකේදී ඒවා වට්ටමකට පාවිච්චි කරන්න පුළුවන්. ඔයාගේ points ගිණුම් පිටුවේ පෙනෙනවා.",
      en: "You earn points when an order is delivered, and can spend them as a discount at Checkout. Your points show on your account page.",
    },
    links: [link("මගේ ගිණුම", "My account", "/account")],
    followUps: ["checkout"],
  },
  {
    id: "account",
    title: { si: "ගිණුම / ඇතුළු වීම", en: "Account and sign-in" },
    keywords: ["account", "sign in", "login", "log in", "register", "sign up", "ගිණුම", "ලොගින්", "ඇතුළු වෙන්න", "password"],
    answer: {
      si: "ඇණවුම් කරන්න ගිණුමකින් ඇතුළු වෙන්න ඕන. Google හෝ ඊමේල් එකෙන් ඇතුළු වෙන්න පුළුවන්.\n[sms] දුරකථන අංකයට එන SMS කේතයෙනුත් ඇතුළු වෙන්න පුළුවන්.",
      en: "You need to be signed in to place an order. You can sign in with Google or email.\n[sms] You can also sign in with an SMS code sent to your phone number.",
    },
    links: [link("මගේ ගිණුම", "My account", "/account")],
    followUps: ["checkout", "notifications"],
  },
  {
    id: "trust",
    title: { si: "අපිව විශ්වාස කරන්න පුළුවන්ද?", en: "Can I trust this shop?" },
    keywords: ["trust", "safe", "secure", "genuine", "real", "scam", "legit", "විශ්වාස", "ආරක්ෂිතද", "ඇත්තද", "wishwasa"],
    answer: {
      si: "ඔයාට බඩු ලැබුණාම ගෙවන්න (Cash on delivery) පුළුවන්, ඒ නිසා කලින් සල්ලි දීලා අවදානමක් ගන්න ඕන නෑ.\n{reviewCount}ක ගනුදෙනුකරුවන්ගේ reviews වල සාමාන්‍යය {averageRating} / 5.\nReturn කොන්දේසි Returns පිටුවේ පැහැදිලිව තියෙනවා.\nඅපව ඕන වෙලාවක අමතන්නත් පුළුවන්.",
      en: "You can pay when your order arrives (cash on delivery), so you don't have to risk money up front.\nOur {reviewCount} customer reviews average {averageRating} out of 5.\nOur return terms are clear on the Returns page.\nYou can contact us any time.",
    },
    links: [link("අප ගැන", "About us", "/about"), link("Returns", "Returns", "/returns"), link("අප අමතන්න", "Contact", "/contact")],
    followUps: ["payment", "contact"],
  },
  {
    id: "contact",
    title: { si: "අප අමතන්න", en: "Contact us" },
    keywords: ["contact", "call", "phone", "whatsapp", "help", "support", "human", "අමතන්න", "දුරකථන", "උදව්", "කතා කරන්න"],
    answer: {
      si: "අපිට කතා කරන්න:\nදුරකථන: {phone}\nWhatsApp: {whatsapp}\nඊමේල්: {email}",
      en: "You can reach us here:\nPhone: {phone}\nWhatsApp: {whatsapp}\nEmail: {email}",
    },
    links: [link("අප අමතන්න", "Contact", "/contact")],
    followUps: ["returns", "cancel"],
  },
];

export const DEFAULT_TOPICS: ChatTopic[] = SEEDS.map((seed, index) => ({
  ...seed,
  sortOrder: (index + 1) * 10,
  visible: true,
}));

export const DEFAULT_CONFIG: ChatConfig = {
  enabled: false,
  engine: "guided",
  assistantName: DEFAULT_ASSISTANT_NAME,
  mascotUrl: null,
  greeting: DEFAULT_GREETING,
  firstMessage: DEFAULT_FIRST_MESSAGE,
  accent: DEFAULT_ACCENT,
  showBubble: true,
  trust: { si: "", en: "" },
  topics: DEFAULT_TOPICS,
  facts: {
    features: { card: false, advance: false, sms: false, email: false, push: false, points: false },
  },
};
