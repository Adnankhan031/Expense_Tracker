export type SeedCategory = {
  id: string;
  name: string;
  icon: string;
  color: string;
  kind: 'expense' | 'income';
  keywords: string[];
};

/**
 * Seed categories double as the parser's starting dictionary. Every keyword is a
 * word the user might actually type; the alias table takes over from here as the
 * user corrects things.
 */
export const SEED_CATEGORIES: SeedCategory[] = [
  {
    id: 'food',
    name: 'Food & Drink',
    icon: '🍜',
    color: '#FF8A65',
    kind: 'expense',
    keywords: [
      'food', 'lunch', 'dinner', 'breakfast', 'brunch', 'snack', 'snacks', 'meal', 'meals',
      'restaurant', 'hotel', 'cafe', 'coffee', 'tea', 'chai', 'juice', 'shake', 'icecream',
      'ice cream', 'pizza', 'burger', 'biryani', 'dosa', 'idli', 'samosa', 'roll', 'shawarma',
      'swiggy', 'zomato', 'zom', 'ubereats', 'dominos', 'kfc', 'mcdonalds', 'mcd', 'subway',
      'starbucks', 'ccd', 'chaipoint', 'eat', 'eating', 'ate', 'canteen', 'mess', 'tiffin',
      'juice shop', 'bakery', 'sweets', 'dessert', 'drinks', 'beer', 'bar', 'takeaway',
    ],
  },
  {
    id: 'groceries',
    name: 'Groceries',
    icon: '🛒',
    color: '#81C784',
    kind: 'expense',
    keywords: [
      'grocery', 'groceries', 'vegetables', 'veggies', 'sabzi', 'fruits', 'milk', 'bread',
      'eggs', 'rice', 'atta', 'flour', 'dal', 'oil', 'supermarket', 'kirana', 'provision',
      'bigbasket', 'blinkit', 'zepto', 'instamart', 'dmart', 'd mart', 'reliance fresh',
      'more', 'grofers', 'jiomart', 'ration', 'household', 'detergent', 'soap',
    ],
  },
  {
    id: 'transport',
    name: 'Transport',
    icon: '🚕',
    color: '#4FC3F7',
    kind: 'expense',
    keywords: [
      'transport', 'auto', 'rickshaw', 'cab', 'taxi', 'uber', 'ola', 'rapido', 'bus',
      'metro', 'train', 'ticket', 'railway', 'irctc', 'toll', 'parking', 'travel local',
      'commute', 'ride', 'namma yatri', 'blusmart', 'sharing', 'bike taxi',
    ],
  },
  {
    id: 'fuel',
    name: 'Fuel',
    icon: '⛽',
    color: '#FFB74D',
    kind: 'expense',
    keywords: ['fuel', 'petrol', 'diesel', 'gas station', 'cng', 'refuel', 'tank', 'hp petrol', 'indian oil', 'bunk'],
  },
  {
    id: 'bills',
    name: 'Bills & Utilities',
    icon: '💡',
    color: '#7986CB',
    kind: 'expense',
    keywords: [
      'bill', 'bills', 'electricity', 'current bill', 'power', 'water', 'gas bill', 'cylinder',
      'lpg', 'internet', 'wifi', 'broadband', 'airtel', 'jio', 'vi', 'vodafone', 'bsnl',
      'recharge', 'mobile', 'phone bill', 'dth', 'cable', 'maintenance', 'utility',
    ],
  },
  {
    id: 'rent',
    name: 'Rent',
    icon: '🏠',
    color: '#A1887F',
    kind: 'expense',
    keywords: ['rent', 'house rent', 'room rent', 'pg', 'hostel', 'deposit', 'landlord', 'lease'],
  },
  {
    id: 'shopping',
    name: 'Shopping',
    icon: '🛍️',
    color: '#BA68C8',
    kind: 'expense',
    keywords: [
      'shopping', 'clothes', 'clothing', 'shirt', 'tshirt', 'jeans', 'shoes', 'sandals',
      'dress', 'amazon', 'flipkart', 'myntra', 'ajio', 'meesho', 'nykaa', 'bag', 'watch',
      'electronics', 'gadget', 'mobile phone', 'laptop', 'headphones', 'earphones',
      'accessories', 'furniture', 'decor', 'ikea', 'purchase',
    ],
  },
  {
    id: 'health',
    name: 'Health',
    icon: '🩺',
    color: '#4DB6AC',
    kind: 'expense',
    keywords: [
      'health', 'medical', 'medicine', 'medicines', 'meds', 'pharmacy', 'chemist', 'doctor',
      'clinic', 'hospital', 'checkup', 'test', 'lab', 'scan', 'dentist', 'dental', 'therapy',
      'apollo', 'pharmeasy', 'tata 1mg', '1mg', 'netmeds', 'insurance health', 'surgery',
      'vaccine', 'physio', 'eye', 'spectacles', 'glasses',
    ],
  },
  {
    id: 'entertainment',
    name: 'Entertainment',
    icon: '🎬',
    color: '#F06292',
    kind: 'expense',
    keywords: [
      'entertainment', 'movie', 'movies', 'cinema', 'pvr', 'inox', 'bookmyshow', 'concert',
      'game', 'games', 'gaming', 'outing', 'party', 'club', 'fun', 'amusement', 'bowling',
      'zoo', 'museum', 'event', 'show',
    ],
  },
  {
    id: 'subscriptions',
    name: 'Subscriptions',
    icon: '🔁',
    color: '#9575CD',
    kind: 'expense',
    keywords: [
      'subscription', 'netflix', 'prime', 'spotify', 'youtube premium', 'hotstar', 'jiocinema',
      'sony liv', 'zee5', 'icloud', 'google one', 'chatgpt', 'claude', 'notion', 'canva',
      'adobe', 'gym membership', 'membership', 'saas', 'renewal',
    ],
  },
  {
    id: 'travel',
    name: 'Travel & Tour',
    icon: '✈️',
    color: '#64B5F6',
    kind: 'expense',
    keywords: [
      'travel', 'tour', 'trip', 'flight', 'flights', 'airfare', 'airport', 'holiday',
      'vacation', 'hotel stay', 'stay', 'resort', 'airbnb', 'oyo', 'makemytrip', 'goibibo',
      'booking', 'visa', 'passport', 'sightseeing', 'tourism', 'excursion', 'road trip',
      'luggage', 'homestay',
    ],
  },
  {
    id: 'education',
    name: 'Education',
    icon: '📚',
    color: '#AED581',
    kind: 'expense',
    keywords: [
      'education', 'course', 'courses', 'class', 'classes', 'tuition', 'fees', 'fee',
      'college', 'school', 'exam', 'books', 'book', 'stationery', 'udemy', 'coursera',
      'certification', 'training', 'coaching', 'notebook', 'pen',
    ],
  },
  {
    id: 'personal',
    name: 'Personal Care',
    icon: '💇',
    color: '#FF7043',
    kind: 'expense',
    keywords: [
      'personal care', 'salon', 'haircut', 'hair', 'barber', 'spa', 'grooming', 'cosmetics',
      'skincare', 'shampoo', 'gym', 'fitness', 'yoga', 'massage', 'beauty', 'parlour',
      'parlor', 'laundry', 'dry clean', 'ironing',
    ],
  },
  {
    id: 'gifts',
    name: 'Gifts & Donations',
    icon: '🎁',
    color: '#E57373',
    kind: 'expense',
    keywords: [
      'gift', 'gifts', 'present', 'donation', 'donate', 'charity', 'temple', 'church',
      'mosque', 'offering', 'wedding gift', 'birthday gift', 'tip', 'shagun',
    ],
  },
  {
    id: 'unexpected',
    name: 'Unexpected',
    icon: '⚡',
    color: '#FFD54F',
    kind: 'expense',
    keywords: [
      'unexpected', 'emergency', 'repair', 'repairs', 'fine', 'penalty', 'challan', 'damage',
      'breakdown', 'replacement', 'urgent', 'accident', 'loss', 'service charge', 'servicing',
      'puncture', 'mechanic', 'plumber', 'electrician',
    ],
  },
  {
    id: 'family',
    name: 'Family & Kids',
    icon: '👨‍👩‍👧',
    color: '#90A4AE',
    kind: 'expense',
    keywords: [
      'family', 'kids', 'children', 'child', 'baby', 'diapers', 'toys',
      'parents', 'mom', 'dad', 'home', 'wife', 'husband', 'pocket money', 'helper', 'maid',
    ],
  },
  {
    id: 'investments',
    name: 'Investments & Savings',
    icon: '📈',
    color: '#4DB6AC',
    kind: 'expense',
    keywords: [
      'investment', 'invest', 'sip', 'mutual fund', 'mf', 'stocks', 'shares', 'equity',
      'gold', 'fd', 'rd', 'ppf', 'nps', 'crypto', 'savings', 'zerodha', 'groww', 'upstox',
      'insurance', 'premium', 'lic',
    ],
  },
  {
    id: 'loan',
    name: 'Loan & EMI',
    icon: '🏦',
    color: '#9575CD',
    kind: 'expense',
    keywords: ['loan', 'emi', 'installment', 'instalment', 'credit card bill', 'repayment', 'interest paid', 'borrowed return'],
  },
  {
    id: 'other',
    name: 'Other',
    icon: '📦',
    color: '#90A4AE',
    kind: 'expense',
    keywords: ['other', 'misc', 'miscellaneous', 'random', 'general', 'uncategorised', 'uncategorized'],
  },

  // ---- income ----
  {
    id: 'salary',
    name: 'Salary',
    icon: '💰',
    color: '#3DDC97',
    kind: 'income',
    keywords: ['salary', 'sal', 'paycheck', 'pay', 'stipend', 'wages', 'monthly salary'],
  },
  {
    id: 'freelance',
    name: 'Freelance & Business',
    icon: '💼',
    color: '#4FC3F7',
    kind: 'income',
    keywords: ['freelance', 'freelancing', 'client', 'project payment', 'business', 'sales', 'profit', 'consulting', 'gig'],
  },
  {
    id: 'returns',
    name: 'Interest & Returns',
    icon: '🪙',
    color: '#FFD54F',
    kind: 'income',
    keywords: ['interest', 'dividend', 'returns', 'matured', 'capital gain', 'cashback', 'reward'],
  },
  {
    id: 'refund',
    name: 'Refunds',
    icon: '↩️',
    color: '#81C784',
    kind: 'income',
    keywords: ['refund', 'refunded', 'returned money', 'reimbursement', 'reimbursed', 'settled'],
  },
  {
    id: 'other_income',
    name: 'Other Income',
    icon: '✨',
    color: '#BA68C8',
    kind: 'income',
    keywords: ['other income', 'gift received', 'bonus', 'prize', 'won', 'received', 'credited', 'income'],
  },
];

export const SEED_ACCOUNTS = [
  { id: 'cash', name: 'Cash', kind: 'cash', icon: '💵' },
  { id: 'bank', name: 'Bank', kind: 'bank', icon: '🏦' },
  { id: 'card', name: 'Card', kind: 'card', icon: '💳' },
  { id: 'wallet', name: 'Wallet / UPI', kind: 'wallet', icon: '📱' },
];

/** Payment-method words the parser strips out of a line. */
export const METHOD_WORDS: Record<string, string> = {
  cash: 'Cash',
  upi: 'UPI',
  gpay: 'UPI',
  'google pay': 'UPI',
  phonepe: 'UPI',
  paytm: 'UPI',
  bhim: 'UPI',
  card: 'Card',
  'credit card': 'Card',
  'debit card': 'Card',
  cc: 'Card',
  netbanking: 'Bank',
  'net banking': 'Bank',
  bank: 'Bank',
  neft: 'Bank',
  imps: 'Bank',
  wallet: 'Wallet',
};
